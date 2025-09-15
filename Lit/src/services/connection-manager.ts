import { SyndrDBDriver, ConnectionConfig, QueryResult } from '../drivers/syndrdb-driver';
import { connectionPool, PooledConnection } from './connection-pool';

export interface BundleDetails {
  name: string;
  documentStructure?: DocumentStructure;
  relationships?: any[];
  indexes?: any[];
  rawData?: any; // Store the full SHOW BUNDLE result
}

export interface DocumentStructure {
  FieldDefinitions: FieldDefinition[];
}

export interface FieldDefinition  {
	Name:         string      ;
	Type :        string      ;
	IsRequired:   boolean      ; // Indicates if the field can be null
	IsUnique:     boolean      ;
	DefaultValue: any         ; // Optional default value for the field
}


export interface Connection {
  id: string;
  name: string;
  config: ConnectionConfig;
  driver: SyndrDBDriver;
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  lastError?: string;
  databases?: string[];
  users?: string[];
  bundles?: string[];
  bundleDetails?: Map<string, BundleDetails>; // Map of bundle name to its details
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
        
        // Add connection to global pool
        const pooledConnection: PooledConnection = {
          id: connectionId,
          connectionId: connection.driver.getConnectionId() || connectionId,
          driver: connection.driver,
          name: connection.name,
          hostname: connection.config.hostname,
          port: connection.config.port,
          database: connection.config.database,
          username: connection.config.username,
          lastUsed: new Date(),
          isActive: true
        };
        connectionPool.addConnection(pooledConnection);
        
        // Emit the status change first
        this.emit('connectionStatusChanged', connection);
        
        // Automatically fetch databases after successful connection
        console.log('🔄 Automatically fetching databases after connection success...');
        try {
          await this.refreshConnectionMetadata(connectionId);
          console.log('✅ Databases fetched automatically after connection');
        } catch (error) {
          console.warn('⚠️ Failed to fetch databases automatically:', error);
        }
        
        console.log('✅ Connection established with databases loaded');
      } else {
        connection.status = 'error';
        connection.lastError = 'Connection failed';
        this.emit('connectionStatusChanged', connection);
      }
      
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
      const databasesResult = await connection.driver.executeQuery('SHOW DATABASES;');
      console.log('📊 SHOW DATABASES result:', databasesResult);
      
      if (databasesResult.success && databasesResult.data) {
        // SyndrDB returns Result: ["database1", "database2", ...]
        // The data field now contains the Result array directly
        if (Array.isArray(databasesResult.data)) {
          connection.databases = databasesResult.data.map((dbName: any) => {
            // Database names should be strings directly
            return typeof dbName === 'string' ? dbName : String(dbName);
          });
        } else {
          connection.databases = [];
        }
        
        console.log('✅ Parsed databases:', connection.databases);
      } else {
        console.log('❌ No database data received');
        connection.databases = [];
      }

      // Fetch users
      try {
        const usersResult = await connection.driver.executeQuery('SHOW USERS;');
        console.log('👥 SHOW USERS result:', usersResult);
        
        if (usersResult.success && usersResult.data) {
          if (Array.isArray(usersResult.data)) {
            connection.users = usersResult.data.map((user: any) => {
              // User data might be objects or strings
              return user.Name || user.Username || user.name || user.username || String(user);
            });
          } else {
            connection.users = [];
          }
          console.log('✅ Parsed users:', connection.users);
        } else {
          console.log('❌ No user data received');
          connection.users = [];
        }
      } catch (userError) {
        console.warn('Failed to fetch users:', userError);
        connection.users = [];
      }

      // Fetch bundles
      try {
        const bundlesResult = await connection.driver.executeQuery('SHOW BUNDLES;');
        console.log('📦 SHOW BUNDLES result:', bundlesResult);
        
        if (bundlesResult.success && bundlesResult.data) {
          if (Array.isArray(bundlesResult.data)) {
            connection.bundles = bundlesResult.data.map((bundle: any) => {
              return bundle.Name || String(bundle);
            });
          } else {
            connection.bundles = [];
          }
          console.log('✅ Parsed bundles:', connection.bundles);
        } else {
          console.log('❌ No bundle data received');
          connection.bundles = [];
        }
      } catch (bundleError) {
        console.warn('Failed to fetch bundles:', bundleError);
        connection.bundles = [];
      }
      
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

    // Execute the query using the driver
    return await connection.driver.executeQuery(query);
  }

  /**
   * Execute a query on a specific connection by ID
   */
  async executeQueryOnConnectionId(connectionId: string, query: string): Promise<QueryResult> {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.status !== 'connected') {
      throw new Error('Connection is not available');
    }

    // Execute the query using the driver
    return await connection.driver.executeQuery(query);
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
   * Get bundle details for a specific bundle
   */
  async getBundleDetails(connectionId: string, bundleName: string): Promise<BundleDetails | null> {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.status !== 'connected') {
      throw new Error('Connection not found or not connected');
    }

    // Initialize bundleDetails map if it doesn't exist
    if (!connection.bundleDetails) {
      connection.bundleDetails = new Map<string, BundleDetails>();
    }

    // Check if we already have the bundle details cached
    const existingDetails = connection.bundleDetails.get(bundleName);
    if (existingDetails) {
      return existingDetails;
    }

    try {
      console.log(`🔍 Fetching details for bundle: ${bundleName}`);
      
      // Execute SHOW BUNDLE query
      const result = await connection.driver.executeQuery(`SHOW BUNDLE "${bundleName}";`);
      console.log('📦 Bundle details result:', result);
      
      if (result.success && result.data) {
        const bundleDetails: BundleDetails = {
          name: bundleName,
          documentStructure: undefined,
          relationships: [],
          indexes: [],
          rawData: result.data
        };

        // Parse fields from DocumentStructure
        const data = result.data as any;
        if (data.DocumentStructure) {
          bundleDetails.documentStructure = data.DocumentStructure
        }

        // Store the bundle details
        connection.bundleDetails.set(bundleName, bundleDetails);
        
        console.log('✅ Parsed bundle details:', bundleDetails);
        return bundleDetails;
      } else {
        console.log('❌ No bundle details received');
        return null;
      }
    } catch (error) {
      console.error('❌ Error fetching bundle details:', error);
      return null;
    }
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
