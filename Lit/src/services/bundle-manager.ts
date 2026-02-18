import { Bundle } from "../types/bundle";
import { connectionManager } from "./connection-manager";
import { fieldDefinitionsToArray } from "../lib/bundle-utils";

export class BundleManager {

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
    const connection = connectionManager.getConnection(connectionId); // Ensure connection is loaded
    if (!connection || connection.status !== 'connected') {
      throw new Error('Connection is not available');
    }

    try {
      // Set database context first
      await connectionManager.setDatabaseContext(connectionId, databaseName);
      
      const bundlesCommand = `SHOW BUNDLES;`; // No need for "FOR database" when context is set
      console.log('📦 Loading bundles for database:', databaseName, 'with command:', bundlesCommand);
      
      const bundlesResult = await connection.driver.executeQuery(bundlesCommand);
      // console.log('📦 SHOW BUNDLES result:', bundlesResult);
      
      let bundles: Bundle[] = [];
      
      if (bundlesResult.success && bundlesResult.data) {

        if (bundlesResult.ResultCount && bundlesResult.ResultCount > 0 && bundlesResult.data != null) {
          if (Array.isArray(bundlesResult.data)) {
            bundles = bundlesResult.data.map((rawBundle: any) => {
              // New structure: bundles are directly in Result array with all properties
              let newBundle: Bundle = { Name: '', FieldDefinitions: [] };
              
              // Try new structure first (direct properties)
              if (rawBundle.Name) {
                newBundle.Name = rawBundle.Name;
                newBundle.DocumentStructure = rawBundle.DocumentStructure;
                newBundle.Indexes = rawBundle.Indexes;
                newBundle.Relationships = rawBundle.Relationships;
                newBundle.FieldDefinitions = fieldDefinitionsToArray(rawBundle.DocumentStructure?.FieldDefinitions);
                newBundle.BundleId = rawBundle.BundleID || rawBundle.BundleId; // Handle both casings
                newBundle.CreatedAt = rawBundle.CreatedAt;
                newBundle.UpdatedAt = rawBundle.UpdatedAt;
                newBundle.DocumentCount = rawBundle.TotalDocuments; // Updated field name
              }
              // Fallback to old BundleMetadata structure
              else if (rawBundle.BundleMetadata) {
                if (rawBundle.BundleMetadata.Name) {
                  newBundle.Name = rawBundle.BundleMetadata.Name;
                }
                newBundle.DocumentStructure = rawBundle.BundleMetadata.DocumentStructure;
                newBundle.Indexes = rawBundle.BundleMetadata.Indexes;
                newBundle.Relationships = rawBundle.BundleMetadata.Relationships;
                newBundle.FieldDefinitions = fieldDefinitionsToArray(rawBundle.BundleMetadata.DocumentStructure?.FieldDefinitions);
                newBundle.BundleId = rawBundle.BundleMetadata.BundleId;
                newBundle.CreatedAt = rawBundle.BundleMetadata.CreatedAt;
                newBundle.UpdatedAt = rawBundle.BundleMetadata.UpdatedAt;
                newBundle.DocumentCount = rawBundle.BundleMetadata.DocumentCount;
              }
              
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

      // Seed bundleDetails with indexes from SHOW BUNDLES so the tree shows Hash/B-Tree without expanding each bundle
      connectionManager.seedBundleDetailsFromShowBundles(connectionId, bundles);

      this.emit('connectionStatusChanged', connection);
      return bundles;
      
    } catch (error) {
      console.error('Failed to fetch bundles for database:', databaseName, error);
      return [];
    }
  }

}