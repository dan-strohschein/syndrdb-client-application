// Preload script - Exposes secure APIs to the renderer process
import { contextBridge, ipcRenderer } from 'electron';
import { ConnectionConfig, QueryResult } from '../drivers/syndrdb-driver';
import { SyndrDBElectronAPI, ElectronAPI } from '../types/electron-api';

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  syndrdb: {
    connect: (config: ConnectionConfig) => ipcRenderer.invoke('syndrdb:connect', config),
    disconnect: (connectionId: string) => ipcRenderer.invoke('syndrdb:disconnect', connectionId),
    testConnection: (config: ConnectionConfig) => ipcRenderer.invoke('syndrdb:test-connection', config),
    executeQuery: (connectionId: string, query: string) => ipcRenderer.invoke('syndrdb:execute-query', connectionId, query),
    
    // Event listeners for connection status updates
    onConnectionStatus: (callback: (data: { connectionId: string; status: string; error?: string }) => void) => {
      console.log('🎧 Setting up connection status listener');
      ipcRenderer.on('syndrdb:connection-status', (_, data) => {
        console.log('🎧 IPC event received in preload:', data);
        callback(data);
      });
    },
    removeConnectionStatusListener: (callback: (...args: unknown[]) => void) => {
      console.log('🎧 Removing connection status listener');
      ipcRenderer.off('syndrdb:connection-status', callback);
    },

    // Monitor streaming API
    startMonitor: (connectionId: string, command: string) =>
      ipcRenderer.invoke('syndrdb:start-monitor', connectionId, command),
    stopMonitor: (connectionId: string) =>
      ipcRenderer.invoke('syndrdb:stop-monitor', connectionId),
    onMonitorSnapshot: (callback: (data: { connectionId: string; timestamp: number; data: unknown }) => void) => {
      ipcRenderer.on('syndrdb:monitor-snapshot', (_, data) => callback(data));
    },
    onMonitorStopped: (callback: (data: { connectionId: string }) => void) => {
      ipcRenderer.on('syndrdb:monitor-stopped', (_, data) => callback(data));
    },
    removeMonitorListeners: () => {
      ipcRenderer.removeAllListeners('syndrdb:monitor-snapshot');
      ipcRenderer.removeAllListeners('syndrdb:monitor-stopped');
    }
  } as SyndrDBElectronAPI,

  connectionStorage: {
    load: () => ipcRenderer.invoke('connection-storage:load'),
    save: (connection: ConnectionConfig) => ipcRenderer.invoke('connection-storage:save', connection),
    overwrite: (connection: ConnectionConfig) => ipcRenderer.invoke('connection-storage:overwrite', connection),
    delete: (name: string) => ipcRenderer.invoke('connection-storage:delete', name)
  },

  fileDialog: {
    showOpenDialog: (options?: { title?: string; filters?: { name: string; extensions: string[] }[] }) =>
      ipcRenderer.invoke('file-dialog:show-open', options),
    showSaveDialog: (options?: { title?: string; filters?: { name: string; extensions: string[] }[] }) =>
      ipcRenderer.invoke('file-dialog:show-save', options)
  },

  aiAssistant: {
    generateQuery: (request: import('../types/electron-api').AIAssistantGenerateRequest) =>
      ipcRenderer.invoke('ai-assistant:generate-query', request),
    checkSubscription: () => ipcRenderer.invoke('ai-assistant:check-subscription')
  },

  importer: {
    listPlugins: () => ipcRenderer.invoke('importer:list-plugins'),
    getFileInfo: (filePath: string) => ipcRenderer.invoke('importer:get-file-info', filePath),
    parsePreview: (pluginId: string, config: unknown) =>
      ipcRenderer.invoke('importer:parse-preview', pluginId, config),
    validateImport: (config: unknown, previewRows: unknown) =>
      ipcRenderer.invoke('importer:validate-import', config, previewRows),
    startImport: (config: unknown) => ipcRenderer.invoke('importer:start-import', config),
    abortImport: () => ipcRenderer.invoke('importer:abort-import'),
    onImportProgress: (callback: (data: unknown) => void) => {
      ipcRenderer.on('importer:import-progress', (_, data) => callback(data));
    },
    onImportBatchResult: (callback: (data: unknown) => void) => {
      ipcRenderer.on('importer:import-batch-result', (_, data) => callback(data));
    },
    onImportComplete: (callback: (data: unknown) => void) => {
      ipcRenderer.on('importer:import-complete', (_, data) => callback(data));
    },
    onImportError: (callback: (data: unknown) => void) => {
      ipcRenderer.on('importer:import-error', (_, data) => callback(data));
    },
    removeImportListeners: () => {
      ipcRenderer.removeAllListeners('importer:import-progress');
      ipcRenderer.removeAllListeners('importer:import-batch-result');
      ipcRenderer.removeAllListeners('importer:import-complete');
      ipcRenderer.removeAllListeners('importer:import-error');
    }
  },

  exporter: {
    listPlugins: () => ipcRenderer.invoke('exporter:list-plugins'),
    exportSchema: (ddlScript: string, filePath: string) =>
      ipcRenderer.invoke('exporter:export-schema', ddlScript, filePath),
    startExport: (config: unknown) => ipcRenderer.invoke('exporter:start-export', config),
    abortExport: () => ipcRenderer.invoke('exporter:abort-export'),
    onExportProgress: (callback: (data: unknown) => void) => {
      ipcRenderer.on('exporter:export-progress', (_, data) => callback(data));
    },
    onExportComplete: (callback: (data: unknown) => void) => {
      ipcRenderer.on('exporter:export-complete', (_, data) => callback(data));
    },
    onExportError: (callback: (data: unknown) => void) => {
      ipcRenderer.on('exporter:export-error', (_, data) => callback(data));
    },
    removeExportListeners: () => {
      ipcRenderer.removeAllListeners('exporter:export-progress');
      ipcRenderer.removeAllListeners('exporter:export-complete');
      ipcRenderer.removeAllListeners('exporter:export-error');
    }
  }
} as ElectronAPI);
