// SyndrDB Driver - Handles TCP connections and protocol communication
import { SyndrDBElectronAPI } from '../types/electron-api';

// Type declaration for Electron API (when available)
declare global {
  interface Window {
    electronAPI?: {
      syndrdb: SyndrDBElectronAPI;
    };
  }
}

export interface ConnectionConfig {
  name: string;
  hostname: string;
  port: string;
  database: string;
  username: string;
  password: string;
}

export interface QueryResult {
  success: boolean;
  data?: any[];
  error?: string;
  executionTime?: number;
  documentCount?: number;
}

export class SyndrDBDriver {
  private connectionId: string | null = null;
  private connected = false;
  private config: ConnectionConfig | null = null;

  constructor() {}

  /**
   * Connect to SyndrDB server using Electron IPC to main process TCP socket
   */
  async connect(config: ConnectionConfig): Promise<boolean> {
    if (this.connected) {
      throw new Error('Already connected');
    }

    this.config = config;

    try {
      // Check if we're running in Electron
      if (typeof window !== 'undefined' && window.electronAPI) {
        console.log('Connecting to SyndrDB via Electron main process...');
        
        const result = await window.electronAPI.syndrdb.connect(config);
        
        if (result.success && result.connectionId) {
          this.connectionId = result.connectionId;
          this.connected = true;
          console.log('SyndrDB connection successful:', this.connectionId);
          return true;
        } else {
          console.error('SyndrDB connection failed:', result.error);
          return false;
        }
      } else {
        // Fallback to WebSocket for non-Electron environments (development)
        console.log('Electron API not available, using WebSocket fallback...');
        return this.connectWebSocket(config);
      }
    } catch (error) {
      console.error('SyndrDB connection error:', error);
      throw error;
    }
  }

  /**
   * WebSocket fallback for development/browser environments
   */
  private async connectWebSocket(config: ConnectionConfig): Promise<boolean> {
    // This is the original WebSocket implementation for fallback
    const connectionString = this.buildConnectionString(config);
    const wsUrl = `ws://${config.hostname}:${parseInt(config.port) + 1}`;
    
    console.log('Fallback: Connecting via WebSocket:', wsUrl);
    
    // For now, just simulate success in development
    await new Promise(resolve => setTimeout(resolve, 1000));
    this.connected = true;
    this.connectionId = 'ws_fallback_' + Date.now();
    return true;
  }

  /**
   * Build SyndrDB connection string in the required format
   */
  private buildConnectionString(config: ConnectionConfig): string {
    return `syndrdb://${config.hostname}:${config.port}:${config.database}:${config.username}:${config.password}`;
  }

  /**
   * Test connection without storing the configuration
   */
  async testConnection(config: ConnectionConfig): Promise<boolean> {
    try {
      // Check if we're running in Electron
      if (typeof window !== 'undefined' && window.electronAPI) {
        return await window.electronAPI.syndrdb.testConnection(config);
      } else {
        // Fallback for non-Electron environments
        console.log('Testing connection via fallback method...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        return true; // Mock success for development
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  /**
   * Execute a query on the SyndrDB server
   */
  async executeQuery(query: string): Promise<QueryResult> {
    if (!this.connected || !this.connectionId) {
      throw new Error('Not connected to SyndrDB server');
    }

    console.log('🔍 executeQuery called with:', query);
    console.log('🔍 Connected:', this.connected);
    console.log('🔍 ConnectionId:', this.connectionId);
    console.log('🔍 Window electronAPI available:', typeof window !== 'undefined' && !!window.electronAPI);

    try {
      // Check if we're running in Electron
      if (typeof window !== 'undefined' && window.electronAPI) {
        console.log('✅ Using Electron IPC for query execution');
        const result = await window.electronAPI.syndrdb.executeQuery(this.connectionId, query);
        console.log('📦 Query result from Electron:', result);
        return result;
      } else {
        // Fallback to mock implementation for development
        console.log('⚠️ Using mock implementation - Electron API not available');
        return this.executeQueryMock(query);
      }
    } catch (error) {
      console.error('Query execution failed:', error);
      throw error;
    }
  }

  /**
   * Disconnect from the SyndrDB server
   */
  async disconnect(): Promise<void> {
    if (!this.connected || !this.connectionId) {
      return;
    }

    try {
      // Check if we're running in Electron
      if (typeof window !== 'undefined' && window.electronAPI) {
        await window.electronAPI.syndrdb.disconnect(this.connectionId);
      }
    } catch (error) {
      console.error('Disconnect error:', error);
    }

    this.connected = false;
    this.connectionId = null;
    this.config = null;
  }

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get current connection configuration
   */
  getConfig(): ConnectionConfig | null {
    return this.config;
  }

  /**
   * Get current connection ID
   */
  getConnectionId(): string | null {
    return this.connectionId;
  }

  /**
   * Mock implementation for development/testing
   * This simulates a SyndrDB server response
   */
  async executeQueryMock(query: string): Promise<QueryResult> {
    const startTime = Date.now();
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 500));
    
    const executionTime = Date.now() - startTime;

    // Parse query type
    const queryLower = query.toLowerCase().trim();
    
    if (queryLower.includes('find')) {
      // Mock find query result
      return {
        success: true,
        data: [
          {
            "_id": "64f1a2b3c4d5e6f7a8b9c0d1",
            "name": "John Doe",
            "email": "john.doe@example.com",
            "age": 28,
            "department": "Engineering"
          },
          {
            "_id": "64f1a2b3c4d5e6f7a8b9c0d2",
            "name": "Jane Smith",
            "email": "jane.smith@example.com",
            "age": 32,
            "department": "Marketing"
          }
        ],
        executionTime,
        documentCount: 2
      };
    } else if (queryLower.includes('show') || queryLower.includes('list')) {
      // Handle specific show commands
      if (queryLower.includes('databases')) {
        // Mock SHOW DATABASES result
        return {
          success: true,
          data: [
            { database: "inventory_db" },
            { database: "analytics_db" },
            { database: "user_sessions" },
            { database: "audit_logs" }
          ],
          executionTime,
          documentCount: 4
        };
      } else {
        // Mock show/list query result for collections
        return {
          success: true,
          data: [
            { collection: "users", documents: 1234, size: "45.2 KB" },
            { collection: "orders", documents: 5678, size: "123.8 KB" },
            { collection: "products", documents: 892, size: "28.9 KB" }
          ],
          executionTime,
          documentCount: 3
        };
      }
    } else if (queryLower.includes('error')) {
      // Mock error response
      return {
        success: false,
        error: "Simulated query error: Invalid syntax",
        executionTime
      };
    } else {
      // Default success response
      return {
        success: true,
        data: [{ message: "Query executed successfully", result: "OK" }],
        executionTime,
        documentCount: 1
      };
    }
  }
}
