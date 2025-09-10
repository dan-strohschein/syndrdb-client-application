import { SyndrDBDriver, ConnectionConfig, QueryResult } from '../drivers/syndrdb-driver';

export interface Connection {
  id: string;
  name: string;
  config: ConnectionConfig;
  driver: SyndrDBDriver;
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  lastError?: string;
  databases?: string[];
  users?: string[];
}

export class ConnectionManager {
  private connections: Map<string, Connection> = new Map();
  private activeConnectionId: string | null = null;
  private eventListeners: Map<string, Function[]> = new Map();

  constructor() {}

  /**
   * Add event listener for connection events
   */
  addEventListener(event: string, callback: Function) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)?.push(callback);
  }

  /**
   * Emit event to listeners
   */
  private emit(event: string, data?: any) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }

  /**
   * Add a new connection configuration
   */
  async addConnection(config: ConnectionConfig): Promise<string> {
    const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const connection: Connection = {
      id: connectionId,
      name: config.name,
      config,
      driver: new SyndrDBDriver(),
      status: 'disconnected'
    };

    this.connections.set(connectionId, connection);
    this.emit('connectionAdded', connection);
    
    return connectionId;
  }

  /**
   * Connect to a specific connection
   */
  async connect(connectionId: string): Promise<boolean> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error('Connection not found');
    }

    connection.status = 'connecting';
    this.emit('connectionStatusChanged', connection);

    try {
      const success = await connection.driver.connect(connection.config);
      
      if (success) {
        connection.status = 'connected';
        connection.lastError = undefined;
        this.activeConnectionId = connectionId;
        
        // Immediately fetch databases after successful connection
        try {
          await this.refreshConnectionMetadata(connectionId);
        } catch (metadataError) {
          console.warn('Failed to fetch metadata after connection:', metadataError);
          // Don't fail the connection if metadata fetch fails
        }
      } else {
        connection.status = 'error';
        connection.lastError = 'Connection failed';
      }
      
      this.emit('connectionStatusChanged', connection);
      return success;
      
    } catch (error) {
      connection.status = 'error';
      connection.lastError = error instanceof Error ? error.message : 'Unknown error';
      this.emit('connectionStatusChanged', connection);
      return false;
    }
  }

  /**
   * Refresh metadata (databases, users) for a connection
   */
  async refreshConnectionMetadata(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.status !== 'connected') {
      throw new Error('Connection not found or not connected');
    }

    try {
      // Fetch databases
      const databasesResult = await connection.driver.executeQuery('SHOW DATABASES');
      if (databasesResult.success && databasesResult.data) {
        // Extract database names from the result
        // Assuming the result format is an array of objects with database names
        connection.databases = databasesResult.data.map((row: any) => {
          // Handle different possible formats of the database result
          if (typeof row === 'string') {
            return row;
          } else if (row.database) {
            return row.database;
          } else if (row.Database) {
            return row.Database;
          } else if (row.name) {
            return row.name;
          } else {
            // If it's an object, take the first property value
            const values = Object.values(row);
            return values.length > 0 ? String(values[0]) : 'Unknown';
          }
        });
      } else {
        connection.databases = [];
      }

      // TODO: Fetch users when that command is available
      // const usersResult = await connection.driver.query('SHOW USERS');
      connection.users = [];
      
      this.emit('connectionStatusChanged', connection);
      
    } catch (error) {
      console.error('Failed to refresh metadata for connection:', error);
      // Set empty arrays if queries fail
      connection.databases = [];
      connection.users = [];
    }
  }

  /**
   * Disconnect from a specific connection
   */
  async disconnect(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    await connection.driver.disconnect();
    connection.status = 'disconnected';
    
    if (this.activeConnectionId === connectionId) {
      this.activeConnectionId = null;
    }
    
    this.emit('connectionStatusChanged', connection);
  }

  /**
   * Remove a connection
   */
  async removeConnection(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    // Disconnect if connected
    if (connection.status === 'connected') {
      await this.disconnect(connectionId);
    }

    this.connections.delete(connectionId);
    this.emit('connectionRemoved', connectionId);
  }

  /**
   * Test a connection without adding it to the manager
   */
  async testConnection(config: ConnectionConfig): Promise<boolean> {
    const driver = new SyndrDBDriver();
    return await driver.testConnection(config);
  }

  /**
   * Execute a query on the active connection
   */
  async executeQuery(query: string): Promise<QueryResult> {
    if (!this.activeConnectionId) {
      throw new Error('No active connection');
    }

    const connection = this.connections.get(this.activeConnectionId);
    if (!connection || connection.status !== 'connected') {
      throw new Error('Active connection is not available');
    }

    // For development, use mock implementation
    // In production, this would use: return await connection.driver.executeQuery(query);
    return await connection.driver.executeQueryMock(query);
  }

  /**
   * Execute a query on a specific connection
   */
  async executeQueryOnConnection(connectionId: string, query: string): Promise<QueryResult> {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.status !== 'connected') {
      throw new Error('Connection is not available');
    }

    // For development, use mock implementation
    return await connection.driver.executeQueryMock(query);
  }

  /**
   * Get all connections
   */
  getConnections(): Connection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get a specific connection
   */
  getConnection(connectionId: string): Connection | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * Get the active connection
   */
  getActiveConnection(): Connection | null {
    if (!this.activeConnectionId) {
      return null;
    }
    return this.connections.get(this.activeConnectionId) || null;
  }

  /**
   * Set the active connection
   */
  setActiveConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection && connection.status === 'connected') {
      this.activeConnectionId = connectionId;
      this.emit('activeConnectionChanged', connection);
    }
  }

  /**
   * Refresh metadata for a connection (public method)
   */
  async refreshMetadata(connectionId: string): Promise<void> {
    return this.refreshConnectionMetadata(connectionId);
  }

  /**
   * Get connection count by status
   */
  getConnectionStats(): { total: number; connected: number; disconnected: number; error: number } {
    const connections = this.getConnections();
    return {
      total: connections.length,
      connected: connections.filter(c => c.status === 'connected').length,
      disconnected: connections.filter(c => c.status === 'disconnected').length,
      error: connections.filter(c => c.status === 'error').length
    };
  }
}

// Global connection manager instance
export const connectionManager = new ConnectionManager();
