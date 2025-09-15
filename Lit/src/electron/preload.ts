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
    onConnectionStatus: (callback: (data: any) => void) => {
      console.log('🎧 Setting up connection status listener');
      ipcRenderer.on('syndrdb:connection-status', (_, data) => {
        console.log('🎧 IPC event received in preload:', data);
        callback(data);
      });
    },
    removeConnectionStatusListener: (callback: Function) => {
      console.log('🎧 Removing connection status listener');
      ipcRenderer.off('syndrdb:connection-status', callback as any);
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
  }
} as ElectronAPI);
