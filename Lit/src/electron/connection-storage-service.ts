// Connection Storage Service - Handles persistent storage of connection configurations
import { promises as fs } from 'fs';
import { join } from 'path';
import { app } from 'electron';
import { ConnectionConfig } from '../drivers/syndrdb-driver';

export interface StoredConnection {
  id: string;
  name: string;
  hostname: string;
  port: string;
  database: string;
  username: string;
  // Note: In production, passwords should be encrypted
  password: string;
  createdAt: string;
  lastModified: string;
}

export class ConnectionStorageService {
  private connectionsFilePath: string;

  constructor() {
    // Store connections.json in the app's user data directory
    const userDataPath = app.getPath('userData');
    this.connectionsFilePath = join(userDataPath, 'connections.json');
  }

  /**
   * Load all saved connections from the JSON file
   */
  async loadConnections(): Promise<StoredConnection[]> {
    try {
      const fileExists = await this.fileExists();
      if (!fileExists) {
        return [];
      }

      const fileContent = await fs.readFile(this.connectionsFilePath, 'utf-8');
      const data = JSON.parse(fileContent);
      
      // Ensure the data has the expected structure
      if (!data.connections || !Array.isArray(data.connections)) {
        console.warn('Invalid connections file format, returning empty array');
        return [];
      }

      return data.connections;
    } catch (error) {
      console.error('Error loading connections:', error);
      return [];
    }
  }

  /**
   * Save all connections to the JSON file
   */
  async saveConnections(connections: StoredConnection[]): Promise<void> {
    try {
      const data = {
        version: '1.0',
        lastUpdated: new Date().toISOString(),
        connections
      };

      await fs.writeFile(
        this.connectionsFilePath, 
        JSON.stringify(data, null, 2), 
        'utf-8'
      );
    } catch (error) {
      console.error('Error saving connections:', error);
      throw error;
    }
  }

  /**
   * Add a new connection or update existing one
   */
  async saveConnection(connection: ConnectionConfig): Promise<{ success: boolean; connectionExists?: boolean; error?: string }> {
    try {
      const connections = await this.loadConnections();
      
      // Check if connection with same name already exists
      const existingIndex = connections.findIndex(conn => conn.name === connection.name);
      const connectionExists = existingIndex !== -1;

      const storedConnection: StoredConnection = {
        id: connectionExists ? connections[existingIndex].id : this.generateId(),
        name: connection.name,
        hostname: connection.hostname,
        port: connection.port,
        database: connection.database,
        username: connection.username,
        password: connection.password, // In production, encrypt this
        createdAt: connectionExists ? connections[existingIndex].createdAt : new Date().toISOString(),
        lastModified: new Date().toISOString()
      };

      if (connectionExists) {
        // Return info about existing connection for user confirmation
        return { success: false, connectionExists: true };
      } else {
        // Add new connection
        connections.push(storedConnection);
        await this.saveConnections(connections);
        return { success: true };
      }
    } catch (error) {
      console.error('Error saving connection:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Overwrite an existing connection
   */
  async overwriteConnection(connection: ConnectionConfig): Promise<{ success: boolean; error?: string }> {
    try {
      const connections = await this.loadConnections();
      const existingIndex = connections.findIndex(conn => conn.name === connection.name);

      if (existingIndex === -1) {
        return { success: false, error: 'Connection not found' };
      }

      const storedConnection: StoredConnection = {
        id: connections[existingIndex].id,
        name: connection.name,
        hostname: connection.hostname,
        port: connection.port,
        database: connection.database,
        username: connection.username,
        password: connection.password,
        createdAt: connections[existingIndex].createdAt,
        lastModified: new Date().toISOString()
      };

      connections[existingIndex] = storedConnection;
      await this.saveConnections(connections);
      return { success: true };
    } catch (error) {
      console.error('Error overwriting connection:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Delete a connection by name
   */
  async deleteConnection(connectionName: string): Promise<{ success: boolean; error?: string }> {
    try {
      const connections = await this.loadConnections();
      const filteredConnections = connections.filter(conn => conn.name !== connectionName);
      
      if (filteredConnections.length === connections.length) {
        return { success: false, error: 'Connection not found' };
      }

      await this.saveConnections(filteredConnections);
      return { success: true };
    } catch (error) {
      console.error('Error deleting connection:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Check if connections file exists
   */
  private async fileExists(): Promise<boolean> {
    try {
      await fs.access(this.connectionsFilePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate a unique ID for connections
   */
  private generateId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get the connections file path (for debugging)
   */
  getFilePath(): string {
    return this.connectionsFilePath;
  }
}
