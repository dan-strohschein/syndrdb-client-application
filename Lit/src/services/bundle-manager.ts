import { Bundle } from "../types/bundle";
import { Connection, ConnectionManager } from "./connection-manager";



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



export class BundleManager {

private connectionManager = ConnectionManager.getInstance();
private connections: Map<string, Connection> = this.connectionManager.getAllConnections()
  private eventListeners: Map<string, Function[]> = new Map();


// TODO Refactor to use dependency injection
constructor() {}

// TODO REfactor this event stuff into its own class for better management/maintenance

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
   * Load bundles for a specific database
   */
  async loadBundlesForDatabase(connectionId: string, databaseName: string): Promise<Bundle[]> {
    const connection = this.connectionManager.getConnection(connectionId); // Ensure connection is loaded
    if (!connection || connection.status !== 'connected') {
      throw new Error('Connection is not available');
    }

    try {
      // Set database context first
      await this.connectionManager.setDatabaseContext(connectionId, databaseName);
      
      const bundlesCommand = `SHOW BUNDLES;`; // No need for "FOR database" when context is set
      console.log('📦 Loading bundles for database:', databaseName, 'with command:', bundlesCommand);
      
      const bundlesResult = await connection.driver.executeQuery(bundlesCommand);
      console.log('📦 SHOW BUNDLES result:', bundlesResult);
      
      let bundles: Bundle[] = [];
      
      if (bundlesResult.success && bundlesResult.data) {

        if (bundlesResult.ResultCount && bundlesResult.ResultCount > 0 && bundlesResult.data != null) {
          if (Array.isArray(bundlesResult.data)) {
            bundles = bundlesResult.data.map((rawBundle: any) => {
              // The new structure has BundleMetadata containing the bundle info
              let newBundle:Bundle = { Name: '', FieldDefinitions: [] };
              if (rawBundle.BundleMetadata) {

                if (rawBundle.BundleMetadata.Name) {
                    newBundle.Name = rawBundle.BundleMetadata.Name;
                }
                newBundle.DocumentStructure = rawBundle.BundleMetadata.DocumentStructure;
                newBundle.Indexes = rawBundle.BundleMetadata.Indexes;
                newBundle.Relationships = rawBundle.BundleMetadata.Relationships;
                newBundle.FieldDefinitions = rawBundle.BundleMetadata.DocumentStructure?.FieldDefinitions || [];
                newBundle.BundleId = rawBundle.BundleMetadata.BundleId;
                newBundle.CreatedAt = rawBundle.BundleMetadata.CreatedAt;
                newBundle.UpdatedAt = rawBundle.BundleMetadata.UpdatedAt;
                newBundle.DocumentCount = rawBundle.BundleMetadata.DocumentCount;
                
              }
              
              // Fallback to old structure if BundleMetadata doesn't exist
              return newBundle;
            });
          }
        } else {
          bundles = [];
        }
      } else {
        console.log('❌ No bundle data received for database:', databaseName);
      }
      
      // Store the bundles for this database
      if (!connection.databaseBundles) {
        connection.databaseBundles = new Map();
      }
      connection.databaseBundles.set(databaseName, bundles);
      
      console.log('✅ Loaded', bundles.length, 'bundles for database', databaseName, ':', bundles);
      
      this.emit('connectionStatusChanged', connection);
      return bundles;
      
    } catch (error) {
      console.error('Failed to fetch bundles for database:', databaseName, error);
      return [];
    }
  }

}