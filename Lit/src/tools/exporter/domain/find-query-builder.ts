/**
 * Query builders for data export — generates SELECT queries from schema tree selections.
 */

import type { SchemaTreeNode } from '../types/wizard-state';
import type { ExportQueryConfig } from '../types/export-config';

/**
 * Build a SELECT * FROM "<bundleName>"; query.
 */
export function buildSelectAllQuery(bundleName: string): string {
  return `SELECT * FROM "${bundleName}";`;
}

/**
 * Build export queries from checked bundle nodes.
 * Returns an array of { databaseName, bundleName, query } objects.
 */
export function buildExportQueries(selectedBundles: SchemaTreeNode[]): ExportQueryConfig[] {
  return selectedBundles.map((node) => ({
    databaseName: node.databaseName || '',
    bundleName: node.name,
    query: buildSelectAllQuery(node.name),
  }));
}

/**
 * Extract all checked bundle nodes from a schema tree.
 */
export function getCheckedBundles(nodes: SchemaTreeNode[]): SchemaTreeNode[] {
  const results: SchemaTreeNode[] = [];
  for (const node of nodes) {
    if (node.type === 'bundle' && node.checked) {
      results.push(node);
    }
    if (node.children.length > 0) {
      results.push(...getCheckedBundles(node.children));
    }
  }
  return results;
}

/**
 * Extract all checked nodes from a schema tree (any type).
 */
export function getCheckedNodes(nodes: SchemaTreeNode[]): SchemaTreeNode[] {
  const results: SchemaTreeNode[] = [];
  for (const node of nodes) {
    if (node.checked) {
      results.push(node);
    }
    if (node.children.length > 0) {
      results.push(...getCheckedNodes(node.children));
    }
  }
  return results;
}
