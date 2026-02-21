/**
 * DDL script generator — builds SyndrQL DDL statements from schema tree selections.
 * Reuses buildCreateBundleCommand from domain/bundle-commands.ts for bundle CREATE statements.
 */

import type { SchemaTreeNode } from '../types/wizard-state';
import type { Bundle, BundleIndex, Relationship } from '../../../types/bundle';
import { buildCreateBundleCommand } from '../../../domain/bundle-commands';
import { fieldDefinitionsToArray } from '../../../lib/bundle-utils';

/**
 * Build CREATE DATABASE "<name>"; statement.
 */
export function buildCreateDatabaseCommand(name: string): string {
  return `CREATE DATABASE "${name}";`;
}

/**
 * Build CREATE USER "<name>" WITH PASSWORD "<REPLACE_PASSWORD>"; statement.
 */
export function buildCreateUserCommand(name: string): string {
  return `CREATE USER "${name}" WITH PASSWORD "<REPLACE_PASSWORD>";`;
}

/**
 * Build UPDATE BUNDLE "<source>" ADD RELATIONSHIP (...) statement.
 */
export function buildAddRelationshipCommand(relationship: Relationship): string {
  const relType = relationship.RelationshipType || '0toMany';
  const srcBundle = relationship.SourceBundle || relationship.SourceBundleName || '';
  const srcField = relationship.SourceField || '';
  const destBundle = relationship.DestinationBundle || relationship.TargetBundleName || '';
  const destField = relationship.DestinationField || '';
  const relName = relationship.Name || '';

  return `UPDATE BUNDLE "${srcBundle}" ADD RELATIONSHIP ("${relName}" {"${relType}", "${srcBundle}", "${srcField}", "${destBundle}", "${destField}"});`;
}

/**
 * Build CREATE INDEX statement for a bundle index.
 * Because BundleIndex only stores IndexName, IndexType, and Fields[] (field names),
 * we use sensible defaults (false, false) for required/unique flags and omit optional clauses.
 */
export function buildCreateIndexCommand(bundleName: string, index: BundleIndex): string {
  const indexName = index.IndexName;
  const indexType = (index.IndexType || '').toUpperCase();
  const fields = index.Fields || [];

  if (fields.length === 0) {
    return `-- Index "${indexName}" on "${bundleName}" has no fields defined, skipping.`;
  }

  const fieldFragments = fields.map(
    (field) => `{"${field}", false, false}`
  );
  const fieldList = fieldFragments.join(', ');

  const comment = `-- NOTE: Index field flags (required, unique) default to false. Verify and adjust as needed.`;

  if (indexType === 'HASH' || indexType === 'HASH INDEX') {
    return `${comment}\nCREATE HASH INDEX "${indexName}" ON BUNDLE "${bundleName}" WITH FIELDS (${fieldList});`;
  }

  if (indexType === 'BRIN' || indexType === 'BRIN INDEX') {
    return `${comment}\nCREATE BRIN INDEX "${indexName}" ON BUNDLE "${bundleName}" WITH FIELDS (${fieldList});`;
  }

  // Default to B-INDEX (B-Tree)
  return `${comment}\nCREATE B-INDEX "${indexName}" ON BUNDLE "${bundleName}" WITH FIELDS (${fieldList});`;
}

/**
 * Generate a full DDL script from selected schema tree nodes.
 * Order: databases -> USE + bundles -> indexes -> relationships -> users
 */
export function generateFullDDLScript(selectedNodes: SchemaTreeNode[]): string {
  const parts: string[] = [];
  const databases: SchemaTreeNode[] = [];
  const bundles: SchemaTreeNode[] = [];
  const users: SchemaTreeNode[] = [];

  // Collect all checked nodes by type
  collectCheckedNodes(selectedNodes, databases, bundles, users);

  // 1. CREATE DATABASE statements
  if (databases.length > 0) {
    parts.push('-- ============================================');
    parts.push('-- Database Definitions');
    parts.push('-- ============================================');
    for (const db of databases) {
      parts.push(buildCreateDatabaseCommand(db.name));
    }
    parts.push('');
  }

  // 2. Bundle definitions grouped by database
  const bundlesByDb = new Map<string, SchemaTreeNode[]>();
  for (const bundle of bundles) {
    const dbName = bundle.databaseName || 'unknown';
    if (!bundlesByDb.has(dbName)) {
      bundlesByDb.set(dbName, []);
    }
    bundlesByDb.get(dbName)!.push(bundle);
  }

  if (bundlesByDb.size > 0) {
    parts.push('-- ============================================');
    parts.push('-- Bundle Definitions');
    parts.push('-- ============================================');

    for (const [dbName, dbBundles] of bundlesByDb) {
      parts.push(`USE "${dbName}";`);
      parts.push('');

      for (const bundleNode of dbBundles) {
        const bundleData = bundleNode.bundleData;
        if (bundleData) {
          const fieldDefs = fieldDefinitionsToArray(bundleData.FieldDefinitions);
          parts.push(buildCreateBundleCommand(bundleData.Name, fieldDefs));
        } else {
          parts.push(`-- Bundle "${bundleNode.name}" has no field data available`);
        }
      }
      parts.push('');
    }
  }

  // 3. Index definitions
  const allIndexStatements: string[] = [];
  for (const [dbName, dbBundles] of bundlesByDb) {
    for (const bundleNode of dbBundles) {
      const bundleData = bundleNode.bundleData;
      if (bundleData?.Indexes && bundleData.Indexes.length > 0) {
        for (const index of bundleData.Indexes) {
          allIndexStatements.push(buildCreateIndexCommand(bundleData.Name, index));
        }
      }
    }
  }

  if (allIndexStatements.length > 0) {
    parts.push('-- ============================================');
    parts.push('-- Index Definitions');
    parts.push('-- ============================================');
    for (const [dbName] of bundlesByDb) {
      parts.push(`USE "${dbName}";`);
    }
    parts.push('');
    parts.push(...allIndexStatements);
    parts.push('');
  }

  // 4. Relationship definitions
  const allRelStatements: string[] = [];
  for (const [dbName, dbBundles] of bundlesByDb) {
    for (const bundleNode of dbBundles) {
      const bundleData = bundleNode.bundleData;
      if (bundleData?.Relationships && bundleData.Relationships.length > 0) {
        for (const rel of bundleData.Relationships) {
          allRelStatements.push(buildAddRelationshipCommand(rel));
        }
      }
    }
  }

  if (allRelStatements.length > 0) {
    parts.push('-- ============================================');
    parts.push('-- Relationship Definitions');
    parts.push('-- ============================================');
    parts.push(...allRelStatements);
    parts.push('');
  }

  // 5. User definitions
  if (users.length > 0) {
    parts.push('-- ============================================');
    parts.push('-- User Definitions');
    parts.push('-- ============================================');
    for (const user of users) {
      parts.push(buildCreateUserCommand(user.name));
    }
    parts.push('');
  }

  return parts.join('\n');
}

/** Recursively collect checked nodes by type */
function collectCheckedNodes(
  nodes: SchemaTreeNode[],
  databases: SchemaTreeNode[],
  bundles: SchemaTreeNode[],
  users: SchemaTreeNode[]
): void {
  for (const node of nodes) {
    if (node.checked) {
      switch (node.type) {
        case 'database':
          databases.push(node);
          break;
        case 'bundle':
          bundles.push(node);
          break;
        case 'user':
          users.push(node);
          break;
      }
    }
    if (node.children.length > 0) {
      collectCheckedNodes(node.children, databases, bundles, users);
    }
  }
}
