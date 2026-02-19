// Global type declarations for the SyndrDB Client application

import { ElectronAPI } from './electron-api';

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
