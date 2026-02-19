import { Bundle, DocumentStructure } from "../types/bundle";
import type { ConnectionManager, Connection } from "./connection-manager";
import { fieldDefinitionsToArray } from "../lib/bundle-utils";
import { TypedEventEmitter } from "../lib/typed-event-emitter";

/** Typed event map for BundleManager */
export interface BundleEventMap {
  connectionStatusChanged: Connection;
  bundlesLoaded: { connectionId: string; databaseName: string; bundles: Bundle[] };
}

export class BundleManager extends TypedEventEmitter<BundleEventMap> {
  private connManager: ConnectionManager;

  constructor(connectionManager: ConnectionManager) {
    super();
    this.connManager = connectionManager;
  }

  /**
   * Load bundles for a specific database
   */
  async loadBundlesForDatabase(connectionId: string, databaseName: string): Promise<Bundle[]> {
    const connection = this.connManager.getConnection(connectionId);
    if (!connection || connection.status !== 'connected') {
      throw new Error('Connection is not available');
    }

    try {
      // Set database context first
      await this.connManager.setDatabaseContext(connectionId, databaseName);

      const bundlesCommand = `SHOW BUNDLES;`;
      console.log('📦 Loading bundles for database:', databaseName, 'with command:', bundlesCommand);

      const bundlesResult = await connection.driver.executeQuery(bundlesCommand);

      let bundles: Bundle[] = [];

      if (bundlesResult.success && bundlesResult.data) {
        if (bundlesResult.ResultCount && bundlesResult.ResultCount > 0 && bundlesResult.data != null) {
          if (Array.isArray(bundlesResult.data)) {
            bundles = bundlesResult.data.map((rawBundle: Record<string, unknown>) => {
              const newBundle: Bundle = { Name: '', FieldDefinitions: [] };

              // Try new structure first (direct properties)
              if (rawBundle.Name) {
                const rb = rawBundle as Record<string, unknown>;
                const docStructure = rb.DocumentStructure as DocumentStructure | undefined;
                newBundle.Name = rb.Name as string;
                newBundle.DocumentStructure = docStructure;
                newBundle.Indexes = rb.Indexes as Bundle['Indexes'];
                newBundle.Relationships = rb.Relationships as Bundle['Relationships'];
                newBundle.FieldDefinitions = fieldDefinitionsToArray(docStructure?.FieldDefinitions);
                newBundle.BundleId = (rb.BundleID || rb.BundleId) as string | undefined;
                newBundle.CreatedAt = rb.CreatedAt as string | undefined;
                newBundle.UpdatedAt = rb.UpdatedAt as string | undefined;
                newBundle.DocumentCount = rb.TotalDocuments as number | undefined;
              }
              // Fallback to old BundleMetadata structure
              else if (rawBundle.BundleMetadata) {
                const meta = rawBundle.BundleMetadata as Record<string, unknown>;
                const metaDocStructure = meta.DocumentStructure as DocumentStructure | undefined;
                if (meta.Name) {
                  newBundle.Name = meta.Name as string;
                }
                newBundle.DocumentStructure = metaDocStructure;
                newBundle.Indexes = meta.Indexes as Bundle['Indexes'];
                newBundle.Relationships = meta.Relationships as Bundle['Relationships'];
                newBundle.FieldDefinitions = fieldDefinitionsToArray(metaDocStructure?.FieldDefinitions);
                newBundle.BundleId = meta.BundleId as string | undefined;
                newBundle.CreatedAt = meta.CreatedAt as string | undefined;
                newBundle.UpdatedAt = meta.UpdatedAt as string | undefined;
                newBundle.DocumentCount = meta.DocumentCount as number | undefined;
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
      this.connManager.seedBundleDetailsFromShowBundles(connectionId, bundles);

      this.emit('connectionStatusChanged', connection);
      return bundles;

    } catch (error) {
      console.error('Failed to fetch bundles for database:', databaseName, error);
      return [];
    }
  }
}
