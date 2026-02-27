/**
 * Builds SyndrQL BULK ADD DOCUMENTS statements from mapped row data.
 *
 * Syntax:
 *   BULK ADD DOCUMENTS TO BUNDLE "BundleName" WITH (
 *     ({"field" = "value"}, {"field2" = 42}),
 *     ({"field" = "other"}, {"field2" = 99})
 *   );
 */

import type { ColumnMapping } from '../types/wizard-state';

/**
 * Format a single cell value for BULK INSERT syntax.
 * - STRING/DATETIME: "double-quoted" (escape " as \")
 * - INT/DECIMAL: unquoted number
 * - BOOLEAN: true / false (lowercase)
 * - NULL: NULL
 */
export function formatBulkValue(value: string | null, targetType: string): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }

  const upper = targetType.toUpperCase();

  switch (upper) {
    case 'INT':
    case 'DECIMAL':
      return value;
    case 'BOOLEAN':
      return value.toLowerCase() === 'true' || value === '1' ? 'true' : 'false';
    case 'DATETIME':
    case 'STRING':
    default:
      return `"${value.replace(/"/g, '\\"')}"`;
  }
}

/**
 * Build one document's field set for BULK INSERT.
 * Returns: ({"Name" = "Alice"}, {"Age" = 28})
 */
export function buildDocumentFields(
  row: (string | null)[],
  mappings: ColumnMapping[]
): string {
  const enabledMappings = mappings.filter((m) => m.enabled && m.targetField);
  if (enabledMappings.length === 0) {
    return '';
  }

  const fields = enabledMappings.map((mapping) => {
    const value = row[mapping.sourceIndex];
    const formatted = formatBulkValue(value, mapping.targetType);
    return `{"${mapping.targetField!}" = ${formatted}}`;
  });

  return `(${fields.join(', ')})`;
}

/**
 * Build a complete BULK ADD DOCUMENTS TO BUNDLE statement.
 * Caller is responsible for chunking rows to respect the 10,000 doc limit.
 * Returns empty string if no rows or no enabled mappings.
 */
export function buildBulkInsertStatement(
  rows: (string | null)[][],
  mappings: ColumnMapping[],
  bundleName: string
): string {
  if (rows.length === 0) {
    return '';
  }

  const documents = rows
    .map((row) => buildDocumentFields(row, mappings))
    .filter((doc) => doc.length > 0);

  if (documents.length === 0) {
    return '';
  }

  const docList = documents.map((doc) => `  ${doc}`).join(',\n');
  return `BULK ADD DOCUMENTS TO BUNDLE "${bundleName}" WITH (\n${docList}\n);`;
}
