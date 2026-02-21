/**
 * Analyzes sample data columns to suggest SyndrDB field types.
 * Tests each column against INT -> DECIMAL -> BOOLEAN -> DATETIME -> STRING (first match wins).
 */

import type { DetectedColumnType } from '../types/importer-plugin';

const INT_RE = /^-?\d+$/;
const DECIMAL_RE = /^-?\d+\.\d+$/;
const BOOL_RE = /^(true|false|0|1|yes|no)$/i;
// ISO date, US date, European date, datetime patterns
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}(T|\s)?\d{0,2}:?\d{0,2}:?\d{0,2}|^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/;

function isInt(value: string): boolean {
  return INT_RE.test(value.trim());
}

function isDecimal(value: string): boolean {
  return DECIMAL_RE.test(value.trim());
}

function isBoolean(value: string): boolean {
  return BOOL_RE.test(value.trim());
}

function isDatetime(value: string): boolean {
  if (!DATETIME_RE.test(value.trim())) return false;
  const d = new Date(value.trim());
  return !isNaN(d.getTime());
}

/**
 * Detect the type of a single column from sample values.
 * Returns the most specific type where >= threshold of non-null values match.
 */
export function detectColumnType(
  values: (string | null)[],
  threshold = 0.8
): DetectedColumnType {
  const nonNull = values.filter((v) => v !== null && v !== undefined && v !== '') as string[];
  if (nonNull.length === 0) {
    return { type: 'STRING', confidence: 1 };
  }

  // Test in order of specificity: INT > DECIMAL > BOOLEAN > DATETIME > STRING
  const checks: { type: DetectedColumnType['type']; test: (v: string) => boolean }[] = [
    { type: 'INT', test: isInt },
    { type: 'DECIMAL', test: isDecimal },
    { type: 'BOOLEAN', test: isBoolean },
    { type: 'DATETIME', test: isDatetime },
  ];

  for (const check of checks) {
    const matches = nonNull.filter(check.test).length;
    const confidence = matches / nonNull.length;
    if (confidence >= threshold) {
      return { type: check.type, confidence };
    }
  }

  return { type: 'STRING', confidence: 1 };
}

/**
 * Detect types for all columns from sample rows.
 * @param headers Column names (used for length)
 * @param rows Sample rows
 * @param maxSample Maximum rows to sample (default 1000)
 */
export function detectColumnTypes(
  headers: string[],
  rows: (string | null)[][],
  maxSample = 1000
): DetectedColumnType[] {
  const sampleRows = rows.slice(0, maxSample);
  return headers.map((_, colIndex) => {
    const columnValues = sampleRows.map((row) => row[colIndex] ?? null);
    return detectColumnType(columnValues);
  });
}

/**
 * Map a DetectedColumnType to a SyndrDB field type string.
 */
export function toSyndrDBType(detected: DetectedColumnType): string {
  return detected.type;
}
