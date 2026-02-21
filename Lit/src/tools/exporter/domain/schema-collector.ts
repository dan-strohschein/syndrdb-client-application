/**
 * Schema collector — builds a checkbox tree from ConnectionManager data.
 * Handles node check/uncheck cascading and parent indeterminate state.
 */

import type { SchemaTreeNode } from '../types/wizard-state';
import type { Connection } from '../../../services/connection-manager';
import type { Bundle } from '../../../types/bundle';

/**
 * Build a schema tree from a Connection's data.
 * Creates database nodes with bundle children (and user nodes if available).
 */
export function buildSchemaTree(connection: Connection): SchemaTreeNode[] {
  const nodes: SchemaTreeNode[] = [];

  // Add database nodes
  if (connection.databases) {
    for (const dbName of connection.databases) {
      const dbNode: SchemaTreeNode = {
        type: 'database',
        id: `${connection.id}:db:${dbName}`,
        name: dbName,
        connectionId: connection.id,
        databaseName: dbName,
        checked: false,
        indeterminate: false,
        children: [],
        expanded: false,
      };

      // Add bundle children if loaded
      const bundles = connection.databaseBundles?.get(dbName);
      if (bundles) {
        dbNode.children = bundles.map((bundle) => buildBundleNode(connection.id, dbName, bundle));
      }

      nodes.push(dbNode);
    }
  }

  // Add user nodes
  if (connection.users) {
    for (const userName of connection.users) {
      nodes.push({
        type: 'user',
        id: `${connection.id}:user:${userName}`,
        name: userName,
        connectionId: connection.id,
        checked: false,
        indeterminate: false,
        children: [],
        expanded: false,
      });
    }
  }

  return nodes;
}

/** Build a bundle tree node from a Bundle object */
function buildBundleNode(connectionId: string, databaseName: string, bundle: Bundle): SchemaTreeNode {
  return {
    type: 'bundle',
    id: `${connectionId}:db:${databaseName}:bundle:${bundle.Name}`,
    name: bundle.Name,
    connectionId,
    databaseName,
    checked: false,
    indeterminate: false,
    children: [],
    expanded: false,
    bundleData: bundle,
  };
}

/**
 * Add bundles to a database node (used for lazy-loading).
 */
export function addBundlesToDatabaseNode(
  nodes: SchemaTreeNode[],
  databaseNodeId: string,
  connectionId: string,
  databaseName: string,
  bundles: Bundle[]
): SchemaTreeNode[] {
  return nodes.map((node) => {
    if (node.id === databaseNodeId) {
      const bundleChildren = bundles.map((b) => buildBundleNode(connectionId, databaseName, b));
      // If the parent was checked, check all new children
      if (node.checked) {
        for (const child of bundleChildren) {
          child.checked = true;
        }
      }
      return { ...node, children: bundleChildren };
    }
    if (node.children.length > 0) {
      return {
        ...node,
        children: addBundlesToDatabaseNode(node.children, databaseNodeId, connectionId, databaseName, bundles),
      };
    }
    return node;
  });
}

/**
 * Toggle a node's checked state with cascading:
 * - Checking a parent checks all children
 * - Unchecking a parent unchecks all children
 * - Updates parent indeterminate state
 */
export function toggleNodeChecked(
  nodes: SchemaTreeNode[],
  nodeId: string,
  checked: boolean
): SchemaTreeNode[] {
  const updated = nodes.map((node) => {
    if (node.id === nodeId) {
      return cascadeCheck({ ...node }, checked);
    }
    if (node.children.length > 0) {
      return {
        ...node,
        children: toggleNodeChecked(node.children, nodeId, checked),
      };
    }
    return node;
  });

  return updateIndeterminateState(updated);
}

/**
 * Toggle a node's expanded state.
 */
export function toggleNodeExpanded(
  nodes: SchemaTreeNode[],
  nodeId: string
): SchemaTreeNode[] {
  return nodes.map((node) => {
    if (node.id === nodeId) {
      return { ...node, expanded: !node.expanded };
    }
    if (node.children.length > 0) {
      return {
        ...node,
        children: toggleNodeExpanded(node.children, nodeId),
      };
    }
    return node;
  });
}

/** Cascade check state to all children */
function cascadeCheck(node: SchemaTreeNode, checked: boolean): SchemaTreeNode {
  node.checked = checked;
  node.indeterminate = false;
  node.children = node.children.map((child) => cascadeCheck({ ...child }, checked));
  return node;
}

/** Update indeterminate state bottom-up */
function updateIndeterminateState(nodes: SchemaTreeNode[]): SchemaTreeNode[] {
  return nodes.map((node) => {
    if (node.children.length === 0) return node;

    const updatedChildren = updateIndeterminateState(node.children);
    const allChecked = updatedChildren.every((c) => c.checked && !c.indeterminate);
    const noneChecked = updatedChildren.every((c) => !c.checked && !c.indeterminate);

    return {
      ...node,
      children: updatedChildren,
      checked: allChecked,
      indeterminate: !allChecked && !noneChecked,
    };
  });
}
