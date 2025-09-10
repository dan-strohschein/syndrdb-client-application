// Shared type definitions for SyndrDB Electron API
import { ConnectionConfig, QueryResult } from '../drivers/syndrdb-driver';

export interface SyndrDBElectronAPI {
  connect: (config: ConnectionConfig) => Promise<{ success: boolean; connectionId?: string; error?: string }>;
  disconnect: (connectionId: string) => Promise<void>;
  testConnection: (config: ConnectionConfig) => Promise<boolean>;
  executeQuery: (connectionId: string, query: string) => Promise<QueryResult>;
  onConnectionStatus: (callback: (data: { connectionId: string; status: string; error?: string }) => void) => void;
  removeConnectionStatusListener: (callback: Function) => void;
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

export interface ElectronAPI {
  syndrdb: SyndrDBElectronAPI;
  connectionStorage: ConnectionStorageAPI;
}