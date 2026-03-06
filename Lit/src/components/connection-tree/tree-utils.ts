/**
 * Utility functions for the connection tree
 */

/**
 * Generate a unique node ID for tree nodes
 */
export function generateNodeId(connectionId: string, type: string, name: string): string {
  return `${connectionId}-${type}-${name}`;
}

/**
 * Generate a database node ID
 */
export function generateDatabaseNodeId(connectionId: string, databaseName: string): string {
  return generateNodeId(connectionId, 'database', databaseName);
}

/**
 * Generate a bundle node ID
 */
export function generateBundleNodeId(connectionId: string, databaseName: string, bundleName: string): string {
  return `${connectionId}-database-${databaseName}-bundle-${bundleName}`;
}

/**
 * Generate a users node ID
 */
export function generateUsersNodeId(connectionId: string, databaseName: string): string {
  return `${connectionId}-database-${databaseName}-users`;
}

/**
 * Generate an individual user node ID
 */
export function generateUserNodeId(connectionId: string, userName: string): string {
  return generateNodeId(connectionId, 'user', userName);
}

/**
 * Generate an indexes node ID
 */
export function generateIndexesNodeId(connectionId: string, databaseName: string, bundleName: string): string {
  return `${connectionId}-database-${databaseName}-bundle-${bundleName}-indexes`;
}

/**
 * Generate a relationships node ID
 */
export function generateRelationshipsNodeId(connectionId: string, databaseName: string, bundleName: string): string {
  return `${connectionId}-database-${databaseName}-bundle-${bundleName}-relationships`;
}

/**
 * Generate a databases container node ID
 */
export function generateDatabasesNodeId(connectionId: string): string {
  return `${connectionId}-databases`;
}

/**
 * Generate a bundles container node ID
 */
export function generateBundlesNodeId(connectionId: string, databaseName: string): string {
  return `${connectionId}-database-${databaseName}-bundles`;
}

/**
 * Generate a fields container node ID
 */
export function generateFieldsNodeId(connectionId: string, databaseName: string, bundleName: string): string {
  return `${connectionId}-database-${databaseName}-bundle-${bundleName}-fields`;
}

/**
 * Generate a hash indexes container node ID
 */
export function generateHashIndexesNodeId(connectionId: string, databaseName: string, bundleName: string): string {
  return `${connectionId}-database-${databaseName}-bundle-${bundleName}-indexes-hash`;
}

/**
 * Generate a btree indexes container node ID
 */
export function generateBTreeIndexesNodeId(connectionId: string, databaseName: string, bundleName: string): string {
  return `${connectionId}-database-${databaseName}-bundle-${bundleName}-indexes-btree`;
}

/**
 * Extract connection ID from a user node ID
 */
export function extractConnectionIdFromUserNode(nodeId: string): string {
  return nodeId.split('-user-')[0];
}

/**
 * Format count badge for display
 */
export function formatCountBadge(count: number): string {
  if (count === 0) return '0';
  if (count < 1000) return count.toString();
  if (count < 1000000) return `${Math.floor(count / 1000)}k`;
  return `${Math.floor(count / 1000000)}M`;
}

/**
 * Get icon class for different node types
 */
export function getNodeIcon(nodeType: string): string {
  switch (nodeType) {
    case 'connection':
      return 'fa-solid fa-server text-icon-server';
    case 'databases':
      return 'fa-solid fa-database text-icon-database';
    case 'database':
      return 'fa-solid fa-database text-icon-database';
    case 'delete-database':
      return 'fa-solid fa-trash-can text-icon-danger';
    case 'bundles':
      return 'fa-solid fa-boxes-stacked text-icon-bundle';
    case 'bundle':
      return 'fa-solid fa-box text-icon-bundle';
    case 'fields':
      return 'fa-solid fa-tags text-icon-field';
    case 'field':
      return 'fa-solid fa-tag text-icon-field';
    case 'indexes':
      return 'fa-solid fa-list text-icon-history';
    case 'hash-indexes':
      return 'fa-solid fa-hashtag text-icon-history';
    case 'btree-indexes':
      return 'fa-solid fa-tree text-icon-history';
    case 'index':
      return 'fa-solid fa-list text-icon-history';
    case 'relationships':
      return 'fa-solid fa-project-diagram text-icon-relationship';
    case 'relationship':
      return 'fa-solid fa-link text-icon-relationship';
    case 'users':
      return 'fa-solid fa-users text-icon-session';
    case 'user':
      return 'fa-solid fa-user text-icon-session';
    default:
      return 'fa-solid fa-circle text-gray-400';
  }
}
