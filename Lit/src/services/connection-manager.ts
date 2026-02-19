import { SyndrDBDriver, ConnectionConfig, QueryResult } from '../drivers/syndrdb-driver';
import { Bundle, BundleDetails, BundleIndex, Relationship } from '../types/bundle';
import { fieldDefinitionsToArray } from '../lib/bundle-utils';
import { connectionPool, PooledConnection } from './connection-pool';
import { TypedEventEmitter } from '../lib/typed-event-emitter';

export type { BundleDetails } from '../types/bundle';

export interface Connection {
  id: string;
  name: string;
  config: ConnectionConfig;
  driver: SyndrDBDriver;
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  lastError?: string;
  databases?: string[];
  users?: string[];
  databaseBundles?: Map<string, Bundle[]>; // Map of database name to its bundles
  bundleDetails?: Map<string, BundleDetails>; // Map of bundle name to its details
  currentDatabase?: string; // Track the current database context
}

/** Typed event map for ConnectionManager */
export interface ConnectionEventMap {
  connectionAdded: Connection;
  connectionStatusChanged: Connection;
  connectionRemoved: string;
  connectionsChanged: Map<string, Connection>;
  activeConnectionChanged: Connection;
  databaseContextChanged: { connectionId: string; databaseName: string };
  bundlesLoaded: { connectionId: string; databaseName: string; bundles: Bundle[] };
}

export class ConnectionManager extends TypedEventEmitter<ConnectionEventMap> {
  private connections: Map<string, Connection> = new Map();
  private activeConnectionId: string | null = null;
  private static instance: ConnectionManager;

  constructor() {
    super();
    // Initialize connection manager
    this.connections = new Map();
    this.activeConnectionId = null;
    ConnectionManager.instance = this;
  }

  static getInstance(): ConnectionManager {
    if (!this.instance) {
      this.instance = new ConnectionManager();
    }
    return this.instance;
  }

  getAllConnections(): Map<string, Connection> {
    return this.connections;
  }

  /**
   * Add event listener for connection events (backward-compatible alias for on())
   */
  addEventListener<K extends keyof ConnectionEventMap>(event: K, callback: (data: ConnectionEventMap[K]) => void): void {
    this.on(event, callback);
  }

  /**
   * Notify listeners that connections have changed (bundles loaded, etc.)
   */
  private notifyConnectionsChanged(): void {
    this.emit('connectionsChanged', this.connections);
  }

  /**
   * Subscribe to connection changes (for components that need to re-render)
   */
  public onConnectionsChanged(callback: (connections: Map<string, Connection>) => void): void {
    this.addEventListener('connectionsChanged', callback);
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
        // console.log('🔄 Automatically fetching databases after connection success...');
        try {
          await this.refreshConnectionMetadata(connectionId);
          // console.log('✅ Databases fetched automatically after connection');
        } catch (error) {
          console.warn('⚠️ Failed to fetch databases automatically:', error);
        }
        
        // console.log('✅ Connection established with databases loaded');
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
      // console.log('📊 SHOW DATABASES result:', databasesResult);
      // console.log('📊 SHOW DATABASES data type:', typeof databasesResult.data);
      // console.log('📊 SHOW DATABASES data isArray:', Array.isArray(databasesResult.data));
      
      if (databasesResult.success && databasesResult.data) {
        // console.log('📊 Raw database data:', databasesResult.data);
        // SyndrDB returns Result: ["database1", "database2", ...]
        // The data field now contains the Result array directly
        if (Array.isArray(databasesResult.data)) {
          connection.databases = databasesResult.data.map((dbName: Record<string, unknown>) => {
            // Database names should be strings directly
            return typeof dbName === 'string' ? dbName : String(dbName);
          });
        } else {
          // console.log('⚠️ Database data is not an array, trying to convert...');
          connection.databases = [];
        }
        
        // console.log('✅ Final parsed databases:', connection.databases);
      } else {
        // console.log('❌ No database data received');
        connection.databases = [];
      }

      // Fetch users
      try {
        const usersResult = await connection.driver.executeQuery('SHOW USERS;');
        // console.log('👥 SHOW USERS result:', usersResult);
        
        if (usersResult.success && usersResult.data) {
          if (Array.isArray(usersResult.data)) {
            connection.users = usersResult.data.map((user: Record<string, unknown>) => {
              // User data might be objects or strings
              const u = user as Record<string, string>;
              return u.Name || u.Username || u.name || u.username || String(user);
            });
          } else {
            connection.users = [];
          }
          // console.log('✅ Parsed users:', connection.users);
        } else {
          // console.log('❌ No user data received');
          connection.users = [];
        }
      } catch (userError) {
        console.warn('Failed to fetch users:', userError);
        connection.users = [];
      }

      // Initialize database bundles map if not exists
      if (!connection.databaseBundles) {
        connection.databaseBundles = new Map();
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
   * Load bundles for a specific database
   */
  // async loadBundlesForDatabase(connectionId: string, databaseName: string): Promise<string[]> {
  //   const connection = this.connections.get(connectionId);
  //   if (!connection || connection.status !== 'connected') {
  //     throw new Error('Connection is not available');
  //   }

  //   try {
  //     // Set database context first
  //     await this.setDatabaseContext(connectionId, databaseName);
      
  //     const bundlesCommand = `SHOW BUNDLES;`; // No need for "FOR database" when context is set
  //     console.log('📦 Loading bundles for database:', databaseName, 'with command:', bundlesCommand);
      
  //     const bundlesResult = await connection.driver.executeQuery(bundlesCommand);
  //     console.log('📦 SHOW BUNDLES result:', bundlesResult);
      
  //     let bundles: string[] = [];
      
  //     if (bundlesResult.success && bundlesResult.data) {

  //       if (bundlesResult.ResultCount && bundlesResult.ResultCount > 0 && bundlesResult.data != null) {
  //         if (Array.isArray(bundlesResult.data)) {
  //           bundles = bundlesResult.data.map((bundle: any) => {
  //             // The new structure has BundleMetadata containing the bundle info
  //             if (bundle.BundleMetadata && bundle.BundleMetadata.Name) {
  //               return bundle.BundleMetadata.Name;
  //             }
  //             // Fallback to old structure if BundleMetadata doesn't exist
  //             return bundle.Name || String(bundle);
  //           });
  //         }
  //       } else {
  //         bundles = [];
  //       }
  //     } else {
  //       console.log('❌ No bundle data received for database:', databaseName);
  //     }
      
  //     // Store the bundles for this database
  //     if (!connection.databaseBundles) {
  //       connection.databaseBundles = new Map();
  //     }
  //     connection.databaseBundles.set(databaseName, bundles);
      
  //     console.log('✅ Loaded', bundles.length, 'bundles for database', databaseName, ':', bundles);
      
  //     this.emit('connectionStatusChanged', connection);
  //     return bundles;
      
  //   } catch (error) {
  //     console.error('Failed to fetch bundles for database:', databaseName, error);
  //     return [];
  //   }
  // }

  /**
   * Set the current database context for a connection
   */
  async setDatabaseContext(connectionId: string, databaseName: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.status !== 'connected') {
      throw new Error('Connection is not available');
    }

    // Only execute USE command if the database context is changing
    if (connection.currentDatabase !== databaseName) {
      // console.log('🔄 Setting database context:', databaseName);
      const useCommand = `USE "${databaseName}";`;
      
      try {
        const result = await connection.driver.executeQuery(useCommand);
        if (result.success) {
          connection.currentDatabase = databaseName;
          // console.log('✅ Database context set to:', databaseName);
          this.emit('databaseContextChanged', { connectionId, databaseName });
        } else {
          console.error('❌ Failed to set database context:', result);
          throw new Error(`Failed to set database context: ${result.error || 'Unknown error'}`);
        }
      } catch (error) {
        console.error('❌ Error setting database context:', error);
        throw error;
      }
    } else {
      // console.log('✅ Database context already set to:', databaseName);
    }
  }

  /**
   * Get the current database context for a connection
   */
  getCurrentDatabase(connectionId: string): string | undefined {
    const connection = this.connections.get(connectionId);
    return connection?.currentDatabase;
  }

  /**
   * Execute a query with automatic database context switching
   */
  async executeQueryWithContext(connectionId: string, query: string, databaseName?: string): Promise<QueryResult> {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.status !== 'connected') {
      throw new Error('Connection is not available');
    }

    // Set database context if provided and different from current
    if (databaseName) {
      await this.setDatabaseContext(connectionId, databaseName);
    }

    // Execute the query using the driver
    return await connection.driver.executeQuery(query);
  }

  /**
   * Get bundles for a specific database (from cache)
   */
  // getBundlesForDatabase(connectionId: string, databaseName: string): string[] {
  //   const connection = this.connections.get(connectionId);
  //   if (!connection || !connection.databaseBundles) {
  //     return [];
  //   }
    
  //   return connection.databaseBundles.get(databaseName) || [];
  // }

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


// Add method to store bundles for a specific database
  async setBundlesForDatabase(connectionId: string, databaseName: string, bundles: Bundle[]): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (connection) {
      if (!connection.databaseBundles) {
        connection.databaseBundles = new Map();
      }
      connection.databaseBundles.set(databaseName, bundles);
      
      // console.log(`🎯 ConnectionManager: Stored ${bundles.length} bundles for database "${databaseName}"`);
      
      // Emit event with bundle data so language service can update context
      this.emit('bundlesLoaded', { connectionId, databaseName, bundles });
      
      // Trigger update to notify components
      this.notifyConnectionsChanged();
    }
  }
  
  // Add method to get bundles for a specific database
  getBundlesForDatabase(connectionId: string, databaseName: string): Bundle[] {
    const connection = this.connections.get(connectionId);
    return connection?.databaseBundles?.get(databaseName) || [];
  }
  
  // Add method to check if bundles are loaded for a database
  hasBundlesForDatabase(connectionId: string, databaseName: string): boolean {
    const connection = this.connections.get(connectionId);
    return connection?.databaseBundles?.has(databaseName) || false;
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
      // console.log(`🔍 Fetching details for bundle: ${bundleName}`);
      
      // Execute SHOW BUNDLE query
      const result = await connection.driver.executeQuery(`SHOW BUNDLE "${bundleName}";`);
      // console.log('📦 Bundle details result:', result);
      
      if (result.success && result.data) {
        const bundleDetails: BundleDetails = {
          name: bundleName,
          documentStructure: undefined,
          relationships: [],
          indexes: [],
          rawData: result.data as unknown as Record<string, unknown>
        };

        // Parse fields from DocumentStructure
        // SHOW BUNDLE returns a single object (the first/only result), not an array
        const data = (Array.isArray(result.data) ? result.data[0] : result.data) as Record<string, unknown>;

        // Handle new structure where bundle data might be under BundleMetadata
        let bundleData: Record<string, unknown> = data;
        if (data.BundleMetadata) {
          bundleData = data.BundleMetadata as Record<string, unknown>;
        }

        const docStructure = bundleData.DocumentStructure as Record<string, unknown> | undefined;
        if (docStructure && docStructure.FieldDefinitions) {
          const fieldDefinitionsArray = fieldDefinitionsToArray(docStructure.FieldDefinitions);
          bundleDetails.documentStructure = {
            FieldDefinitions: fieldDefinitionsArray
          };
          // console.log('✅ Final parsed documentStructure with', bundleDetails.documentStructure.FieldDefinitions.length, 'fields');
        } else {
          // console.log('❌ No DocumentStructure.FieldDefinitions found in data');
          bundleDetails.documentStructure = {
            FieldDefinitions: []
          };
        }

        // Parse relationships if they exist
        // console.log('🔗 Looking for relationships in data...');
        // console.log('🔗 bundleData.Relationships:', bundleData.Relationships);
        // console.log('🔗 bundleData.Relationships type:', typeof bundleData.Relationships);
        
        if (bundleData.Relationships && typeof bundleData.Relationships === 'object' && !Array.isArray(bundleData.Relationships)) {
          // This is a Go map serialized as JSON object: { "relationshipName": { "RelationshipName": "...", ... } }
          const relationshipsArray = Object.entries(bundleData.Relationships as Record<string, unknown>).map(([key, relationshipData]) => ({
            ...(relationshipData as Record<string, unknown>),
            _mapKey: key
          }));
          bundleDetails.relationships = relationshipsArray as unknown as Relationship[];
          // console.log('🔗 Converted relationships map to array:', relationshipsArray);
        } else if (bundleData.Relationships && Array.isArray(bundleData.Relationships)) {
          // console.log('🔗 Found Relationships as array (unexpected but handling):', bundleData.Relationships);
          bundleDetails.relationships = bundleData.Relationships;
        } else {
          // console.log('❌ No Relationships found in data');
        }

        // Parse indexes if they exist
        // console.log('📑 Looking for indexes in data...');
        // console.log('📑 bundleData.Indexes:', bundleData.Indexes);
        // console.log('📑 bundleData.Indexes type:', typeof bundleData.Indexes);
        
        if (bundleData.Indexes) {
          bundleDetails.indexes = ConnectionManager.parseIndexes(bundleData.Indexes);
        }

        // Store the bundle details
        connection.bundleDetails.set(bundleName, bundleDetails);
        
        // console.log('✅ Parsed bundle details:', bundleDetails);
        return bundleDetails;
      } else {
        // console.log('❌ No bundle details received');
        return null;
      }
    } catch (error) {
      console.error('❌ Error fetching bundle details:', error);
      return null;
    }
  }

  /**
   * Normalize server IndexType to canonical form: "btree" -> "b-tree", lowercase otherwise.
   */
  private static normalizeIndexType(raw: string): string {
    const lower = (raw ?? '').toString().toLowerCase();
    return lower === 'btree' ? 'b-tree' : lower || 'unknown';
  }

  /**
   * Convert raw Indexes (Go map or array) from SHOW BUNDLES / SHOW BUNDLE into a normalized array.
   */
  private static parseIndexes(rawIndexes: unknown): BundleIndex[] {
    if (!rawIndexes || typeof rawIndexes !== 'object') return [];
    if (Array.isArray(rawIndexes)) {
      return rawIndexes.map((idx: Record<string, unknown>) => ({
        IndexName: (idx.IndexName ?? idx.indexName ?? '') as string,
        IndexType: ConnectionManager.normalizeIndexType((idx.IndexType ?? idx.indexType ?? '') as string)
      }));
    }
    return Object.entries(rawIndexes as Record<string, Record<string, unknown>>).map(([key, indexData]) => ({
      IndexName: (indexData.IndexName ?? indexData.indexName ?? key) as string,
      IndexType: ConnectionManager.normalizeIndexType((indexData.IndexType ?? indexData.indexType ?? '') as string),
      _mapKey: key
    }));
  }

  /**
   * Seed bundleDetails from SHOW BUNDLES response so the tree can show indexes (including B-tree)
   * without requiring each bundle to be expanded. Merges indexes into existing details or creates minimal details.
   */
  seedBundleDetailsFromShowBundles(connectionId: string, bundles: Bundle[]): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;
    if (!connection.bundleDetails) connection.bundleDetails = new Map();

    for (const bundle of bundles) {
      if (!bundle.Name || !bundle.Indexes) continue;
      const normalized = ConnectionManager.parseIndexes(bundle.Indexes);
      if (normalized.length === 0) continue;

      const existing = connection.bundleDetails.get(bundle.Name);
      if (existing) {
        existing.indexes = normalized;
      } else {
        connection.bundleDetails.set(bundle.Name, {
          name: bundle.Name,
          indexes: normalized,
          relationships: [],
          rawData: undefined
        });
      }
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
export const connectionManager = ConnectionManager.getInstance();
