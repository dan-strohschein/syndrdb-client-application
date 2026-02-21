/**
 * Applies column-level transforms to imported rows.
 */

import type { ColumnMapping, NullHandling } from '../types/wizard-state';

/**
 * Apply a single transform to a cell value.
 */
export function applyTransform(
  value: string | null,
  mapping: ColumnMapping,
  nullHandling: NullHandling
): string | null {
  // Handle null/empty values first
  if (value === null || value === undefined || value === '') {
    switch (nullHandling) {
      case 'null':
        return null;
      case 'empty-string':
        return '';
      case 'default-value':
        return mapping.transform.type === 'default-value' && mapping.transform.param !== undefined
          ? mapping.transform.param
          : null;
    }
  }

  // Apply transform
  switch (mapping.transform.type) {
    case 'trim':
      return value!.trim();
    case 'uppercase':
      return value!.toUpperCase();
    case 'lowercase':
      return value!.toLowerCase();
    case 'date-format':
      return formatDate(value!, mapping.transform.param);
    case 'default-value':
      // Default value only applies to empty/null (handled above); non-empty passes through
      return value;
    case 'none':
    default:
      return value;
  }
}

/**
 * Basic date format transform.
 * Parses the input as a date and reformats using the given pattern.
 * Supports: YYYY, MM, DD, HH, mm, ss
 */
function formatDate(value: string, pattern?: string): string {
  if (!pattern) return value;

  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return value; // Return original if unparseable
  }

  const pad = (n: number) => n.toString().padStart(2, '0');

  return pattern
    .replace('YYYY', date.getFullYear().toString())
    .replace('MM', pad(date.getMonth() + 1))
    .replace('DD', pad(date.getDate()))
    .replace('HH', pad(date.getHours()))
    .replace('mm', pad(date.getMinutes()))
    .replace('ss', pad(date.getSeconds()));
}

/**
 * Transform an entire row using column mappings.
 * Returns a new array with transformed values in source-index order.
 */
export function transformRow(
  row: (string | null)[],
  mappings: ColumnMapping[],
  nullHandling: NullHandling
): (string | null)[] {
  const result = [...row];
  for (const mapping of mappings) {
    if (!mapping.enabled || mapping.targetField === null) continue;
    result[mapping.sourceIndex] = applyTransform(
      row[mapping.sourceIndex],
      mapping,
      nullHandling
    );
  }
  return result;
}

/**
 * Transform a batch of rows.
 */
export function transformBatch(
  rows: (string | null)[][],
  mappings: ColumnMapping[],
  nullHandling: NullHandling
): (string | null)[][] {
  return rows.map((row) => transformRow(row, mappings, nullHandling));
}
