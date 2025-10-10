/**
 * Type definitions and interfaces for the connection tree component
 */

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  nodeId: string;
  nodeName: string;
  nodeType: string;
  data?: any;
}

export type NodeType = 'connection' | 'databases' | 'database' | 'bundles' | 'bundle' | 'fields' | 'field' | 'indexes' | 'index' | 'relationships' | 'relationship' | 'hash-indexes' | 'btree-indexes' | 'users' | 'user';

export interface TreeNodeState {
  expandedNodes: Set<string>;
  selectedConnectionId: string | null;
  contextMenu: ContextMenuState | null;
}

export interface ContextMenuAction {
  action: string;
  nodeType: NodeType;
  nodeName: string;
  nodeId: string;
  connectionId?: string;
}

export interface UserData {
  name: string;
  userId: string;
  password: string;
  isActive: boolean;
  isLockedOut: boolean;
  failedLoginAttempts: number;
  lockoutExpiresOn: Date | string | null;
}

// Constants for node type identification
export const NODE_TYPES = {
  CONNECTION: 'connection' as const,
  DATABASES: 'databases' as const,
  DATABASE: 'database' as const,
  BUNDLES: 'bundles' as const,
  BUNDLE: 'bundle' as const,
  FIELDS: 'fields' as const,
  FIELD: 'field' as const,
  INDEXES: 'indexes' as const,
  INDEX: 'index' as const,
  RELATIONSHIPS: 'relationships' as const,
  RELATIONSHIP: 'relationship' as const,
  HASH_INDEXES: 'hash-indexes' as const,
  BTREE_INDEXES: 'btree-indexes' as const,
  USERS: 'users' as const,
  USER: 'user' as const,
} as const;

// Context menu actions
export const CONTEXT_MENU_ACTIONS = {
  TEST: 'test',
  EDIT_CONNECTION: 'edit-connection',
  DELETE_CONNECTION: 'delete-connection',
  REFRESH: 'refresh',
  QUERY: 'query',
  ADD_USER: 'add-user',
  EDIT_USER: 'edit-user',
  NEW_DATABASE: 'new-database',
  EDIT_DATABASE: 'edit-database',
  DELETE_DATABASE: 'delete-database',
  NEW_BUNDLE: 'new-bundle',
  EDIT_BUNDLE: 'edit-bundle',
  DELETE_BUNDLE: 'delete-bundle',
} as const;
