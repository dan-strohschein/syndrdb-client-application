// Shared type definitions for SyndrDB Electron API
import { ConnectionConfig, QueryResult } from '../drivers/syndrdb-driver';

export interface SyndrDBElectronAPI {
  connect: (config: ConnectionConfig) => Promise<{ success: boolean; connectionId?: string; error?: string }>;
  disconnect: (connectionId: string) => Promise<void>;
  testConnection: (config: ConnectionConfig) => Promise<boolean>;
  executeQuery: (connectionId: string, query: string) => Promise<QueryResult>;
  onConnectionStatus: (callback: (data: { connectionId: string; status: string; error?: string }) => void) => void;
  removeConnectionStatusListener: (callback: Function) => void;

  // Monitor (streaming) API
  startMonitor: (connectionId: string, command: string) => Promise<{ success: boolean; error?: string }>;
  stopMonitor: (connectionId: string) => Promise<{ success: boolean; error?: string }>;
  onMonitorSnapshot: (callback: (data: { connectionId: string; timestamp: number; data: unknown }) => void) => void;
  onMonitorStopped: (callback: (data: { connectionId: string }) => void) => void;
  removeMonitorListeners: () => void;
}

export interface ConnectionStorageAPI {
  load: () => Promise<ConnectionConfig[]>;
  save: (connection: ConnectionConfig) => Promise<{ 
    success: boolean; 
    connectionExists?: boolean; 
    error?: string; 
  }>;
  overwrite: (connection: ConnectionConfig) => Promise<{ success: boolean; error?: string }>;
  delete: (name: string) => Promise<{ success: boolean; error?: string }>;
}

export interface FileDialogAPI {
  showOpenDialog: (options?: {
    title?: string;
    filters?: { name: string; extensions: string[] }[];
  }) => Promise<{ canceled: boolean; filePaths: string[] }>;
  
  showSaveDialog: (options?: {
    title?: string;
    filters?: { name: string; extensions: string[] }[];
  }) => Promise<{ canceled: boolean; filePath?: string }>;
}

/** Request payload for AI assistant generate: prompt + schema from DocumentContext.toCache() + current DB. */
export interface AIAssistantGenerateRequest {
  prompt: string;
  schemaContext: unknown;
  currentDatabase: string;
  /** Passed from renderer config so main does not need to load config. */
  endpoint?: string;
  requestTimeout?: number;
}

/** Success: server returned IR. Error: network/parse/server error. */
export interface AIAssistantGenerateResponseSuccess {
  success: true;
  data: AIAssistantResponseData;
}

export interface AIAssistantGenerateResponseError {
  success: false;
  error: string;
}

export type AIAssistantGenerateResponse = AIAssistantGenerateResponseSuccess | AIAssistantGenerateResponseError;

/** Shape of model server response (IR). Matches domain ai-ir-schema AIAssistantResponse. */
export interface AIAssistantResponseData {
  statements: unknown[];
  explanation?: string;
  confidence?: number;
}

export interface AIAssistantElectronAPI {
  generateQuery: (request: AIAssistantGenerateRequest) => Promise<AIAssistantGenerateResponse>;
  checkSubscription: () => Promise<{ premium: boolean }>;
}

export interface FileSystemAPI {
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, data: string) => Promise<void>;
  createDirectory: (path: string) => Promise<void>;
  deleteFile: (path: string) => Promise<void>;
  deleteDirectory: (path: string) => Promise<void>;
}

export interface ImporterElectronAPI {
  listPlugins: () => Promise<import('../tools/importer/types/importer-plugin').ImporterPluginManifest[]>;
  getFileInfo: (filePath: string) => Promise<import('../tools/importer/types/importer-plugin').FileInfo>;
  parsePreview: (pluginId: string, config: import('../tools/importer/types/importer-plugin').ParserConfig) => Promise<import('../tools/importer/types/importer-plugin').ParseResult>;
  validateImport: (config: import('../electron/import-execution-engine').ImportExecutionConfig, previewRows: (string | null)[][]) => Promise<{ validRows: number; invalidRows: number; errors: import('../tools/importer/types/importer-plugin').ImportRowError[] }>;
  startImport: (config: import('../electron/import-execution-engine').ImportExecutionConfig) => Promise<import('../tools/importer/types/importer-plugin').ImportResult>;
  abortImport: () => Promise<void>;
  onImportProgress: (callback: (data: unknown) => void) => void;
  onImportBatchResult: (callback: (data: unknown) => void) => void;
  onImportComplete: (callback: (data: unknown) => void) => void;
  onImportError: (callback: (data: unknown) => void) => void;
  removeImportListeners: () => void;
}

export interface ElectronAPI {
  syndrdb: SyndrDBElectronAPI;
  connectionStorage: ConnectionStorageAPI;
  fileDialog: FileDialogAPI;
  aiAssistant?: AIAssistantElectronAPI;
  importer?: ImporterElectronAPI;
  readFile?: FileSystemAPI['readFile'];
  writeFile?: FileSystemAPI['writeFile'];
  createDirectory?: FileSystemAPI['createDirectory'];
  deleteFile?: FileSystemAPI['deleteFile'];
  deleteDirectory?: FileSystemAPI['deleteDirectory'];
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}