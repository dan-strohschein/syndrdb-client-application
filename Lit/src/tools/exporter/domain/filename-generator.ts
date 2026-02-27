/**
 * Default filename generation for export files.
 * Pattern: <databaseName>_<YYYYMMDD_HHmmss>_objects.<extension>
 */

import type { SchemaTreeNode } from '../types/wizard-state';

/**
 * Generate a default export filename.
 * @param databaseName  Name of the selected database
 * @param extension     File extension without the dot (e.g. 'sql', 'json')
 */
export function generateDefaultExportFilename(
  databaseName: string,
  extension: string
): string {
  const dbPart = sanitizeFilename(databaseName || 'export');
  const datePart = formatDateForFilename(new Date());
  return `${dbPart}_${datePart}_objects.${extension}`;
}

/**
 * Extract selected database names from a schema tree.
 * Returns names of databases that are checked or have checked children (indeterminate).
 */
export function getSelectedDatabaseNames(schemaTree: SchemaTreeNode[]): string[] {
  const names: string[] = [];
  collectDatabaseNames(schemaTree, names);
  return [...new Set(names)];
}

function collectDatabaseNames(nodes: SchemaTreeNode[], names: string[]): void {
  for (const node of nodes) {
    if (node.type === 'database' && (node.checked || node.indeterminate)) {
      names.push(node.name);
    }
    if (node.children.length > 0) {
      collectDatabaseNames(node.children, names);
    }
  }
}

function formatDateForFilename(date: Date): string {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${y}${mo}${d}_${h}${mi}${s}`;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || 'export';
}
