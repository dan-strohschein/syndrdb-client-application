import { ConnectionManager, connectionManager } from '../../services/connection-manager';
import { BundleManager } from '../../services/bundle-manager';
import { fieldDefinitionsToArray, indexesToArray } from '../../lib/bundle-utils';
import { DiagramModel } from './diagram-model';
import type { DiagramNode, DiagramEdge, DiagramField, RelationshipCardinality } from './types';
import type { Bundle, Relationship, BundleDetails } from '../../types/bundle';

const NODE_HEADER_HEIGHT = 36;
const NODE_FIELD_ROW_HEIGHT = 22;
const NODE_PADDING = 16;
const NODE_MIN_WIDTH = 180;
const NODE_CHAR_WIDTH = 7.5; // approximate monospace char width at 12px

/**
 * Fetches bundle and relationship data from ConnectionManager,
 * then builds a DiagramModel for the schema diagram.
 */
export class DiagramDataService {
  private loading = false;
  private loadError: string | null = null;
  private bundleManager = new BundleManager(connectionManager);

  isLoading(): boolean {
    return this.loading;
  }

  getLoadError(): string | null {
    return this.loadError;
  }

  /**
   * Load schema for a given connection and database, populating the DiagramModel.
   */
  async loadSchema(
    connectionId: string,
    databaseName: string,
    model: DiagramModel,
  ): Promise<void> {
    this.loading = true;
    this.loadError = null;

    try {
      const cm = ConnectionManager.getInstance();
      const conn = cm.getConnection(connectionId);
      if (!conn || conn.status !== 'connected') {
        throw new Error('Connection is not available');
      }

      console.log(`[SchemaDiagram] loadSchema: connectionId=${connectionId}, databaseName="${databaseName}", server currentDatabase="${conn.currentDatabase}"`);

      // 1. Force the database context — always send USE to the server.
      //    The cached currentDatabase can be stale (other tabs can change
      //    the server context without updating the cache).
      conn.currentDatabase = undefined;
      await cm.setDatabaseContext(connectionId, databaseName);
      console.log(`[SchemaDiagram] Database context set to "${databaseName}"`);

      // 2. Always fetch bundles fresh from the server.
      //    Don't trust the databaseBundles cache — it may have been populated
      //    while the server was on a different database.
      const bundles = await this.bundleManager.loadBundlesForDatabase(connectionId, databaseName);
      await cm.setBundlesForDatabase(connectionId, databaseName, bundles);
      console.log(`[SchemaDiagram] Fetched ${bundles.length} bundles:`, bundles.map(b => b.Name));

      if (bundles.length === 0) {
        model.setGraph([], []);
        return;
      }

      // 3. Clear cached bundle details (keyed by bundle name only, not database)
      //    and re-fetch for the correct database.
      if (conn.bundleDetails) {
        conn.bundleDetails.clear();
      }

      const detailResults = await Promise.allSettled(
        bundles.map((b) => cm.getBundleDetails(connectionId, b.Name)),
      );

      // Merge details into bundles
      const detailsMap = new Map<string, BundleDetails>();
      detailResults.forEach((result, i) => {
        if (result.status === 'fulfilled' && result.value) {
          detailsMap.set(bundles[i].Name, result.value);
        }
      });

      // 4. Build nodes
      const nodes: DiagramNode[] = [];
      const allRelationships: Relationship[] = [];
      const seenRelationshipIds = new Set<string>();

      for (const bundle of bundles) {
        const details = detailsMap.get(bundle.Name);
        const rawFields = details?.documentStructure?.FieldDefinitions ?? bundle.FieldDefinitions;
        const fields = fieldDefinitionsToArray(rawFields);
        const indexes = indexesToArray(details?.indexes ?? bundle.Indexes ?? []);

        const diagramFields: DiagramField[] = fields.map((f) => ({
          name: f.Name,
          type: f.Type || 'STRING',
          isRequired: f.IsRequired ?? false,
          isUnique: f.IsUnique ?? false,
          isRelationshipSource: false,
          isRelationshipTarget: false,
        }));

        // Compute node size based on field count
        const maxFieldNameLen = diagramFields.reduce(
          (max, f) => Math.max(max, f.name.length + f.type.length + 6),
          bundle.Name.length + 8,
        );
        const width = Math.max(NODE_MIN_WIDTH, maxFieldNameLen * NODE_CHAR_WIDTH + NODE_PADDING * 2);
        const height = NODE_HEADER_HEIGHT + diagramFields.length * NODE_FIELD_ROW_HEIGHT + NODE_PADDING;

        nodes.push({
          id: bundle.Name,
          bundleName: bundle.Name,
          fields: diagramFields,
          indexes: indexes.map((idx) => idx.IndexName),
          position: { x: 0, y: 0 }, // layout engine will set
          velocity: { x: 0, y: 0 },
          pinned: false,
          size: { x: width, y: height },
          selected: false,
          hovered: false,
          documentCount: bundle.DocumentCount,
        });

        // Collect relationships from BundleDetails (SHOW BUNDLE) or Bundle (SHOW BUNDLES)
        const rawRels = details?.relationships ?? bundle.Relationships;
        const rels = this.normalizeRelationships(rawRels, bundle.Name);
        console.log(`[SchemaDiagram] Bundle "${bundle.Name}": found ${rels.length} relationships`, rels);

        for (const rel of rels) {
          // Deduplicate — use RelationshipID if available, otherwise generate a key
          const relId = rel.RelationshipID || this.makeRelationshipKey(rel);
          if (!seenRelationshipIds.has(relId)) {
            seenRelationshipIds.add(relId);
            allRelationships.push(rel);
          }
        }
      }

      console.log(`[SchemaDiagram] Total deduplicated relationships: ${allRelationships.length}`, allRelationships);

      // 5. Build edges from deduplicated relationships
      const nodeIds = new Set(nodes.map((n) => n.id));
      const edges: DiagramEdge[] = [];

      for (const rel of allRelationships) {
        const sourceName = rel.SourceBundle || rel.SourceBundleName || '';
        const targetName = rel.DestinationBundle || rel.TargetBundleName || '';

        // Only create edge if both nodes exist in the diagram
        if (!nodeIds.has(sourceName) || !nodeIds.has(targetName)) {
          console.log(`[SchemaDiagram] Skipping edge: source="${sourceName}" (exists=${nodeIds.has(sourceName)}), target="${targetName}" (exists=${nodeIds.has(targetName)})`);
          continue;
        }

        const cardinality = this.mapRelationshipType(rel.RelationshipType);

        edges.push({
          id: rel.RelationshipID || `${sourceName}-${targetName}-${rel.Name}`,
          name: rel.Name || '',
          sourceNodeId: sourceName,
          sourceField: rel.SourceField || '',
          targetNodeId: targetName,
          targetField: rel.DestinationField || '',
          relationshipType: cardinality,
        });

        // Mark fields as relationship sources/targets
        const sourceNode = nodes.find((n) => n.id === sourceName);
        const targetNode = nodes.find((n) => n.id === targetName);
        if (sourceNode) {
          const sf = sourceNode.fields.find((f) => f.name === rel.SourceField);
          if (sf) sf.isRelationshipSource = true;
        }
        if (targetNode) {
          const tf = targetNode.fields.find((f) => f.name === rel.DestinationField);
          if (tf) tf.isRelationshipTarget = true;
        }
      }

      console.log(`[SchemaDiagram] Created ${edges.length} edges for diagram`);

      model.setGraph(nodes, edges);
    } catch (err) {
      this.loadError = err instanceof Error ? err.message : 'Failed to load schema';
      console.error('DiagramDataService.loadSchema error:', err);
    } finally {
      this.loading = false;
    }
  }

  /**
   * Normalize relationships from server data into a flat array.
   * SyndrDB may return relationships as:
   *  - An array of Relationship objects (ideal)
   *  - A Go map serialized as JSON object: { "relName": { RelationshipID, ... } }
   *  - null / undefined
   */
  private normalizeRelationships(
    raw: unknown,
    ownerBundleName: string,
  ): Relationship[] {
    if (!raw) return [];

    // Already an array — use as-is
    if (Array.isArray(raw)) {
      return raw as Relationship[];
    }

    // Go map object — convert entries to array
    if (typeof raw === 'object') {
      console.log(`[SchemaDiagram] Converting map-style relationships for "${ownerBundleName}"`, raw);
      return Object.entries(raw as Record<string, unknown>).map(([key, value]) => {
        const relData = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
        return {
          RelationshipID: (relData.RelationshipID ?? relData.RelationshipId ?? '') as string,
          Name: (relData.Name ?? relData.RelationshipName ?? key) as string,
          Description: (relData.Description ?? '') as string,
          SourceField: (relData.SourceField ?? '') as string,
          DestinationBundle: (relData.DestinationBundle ?? relData.TargetBundle ?? '') as string,
          DestinationField: (relData.DestinationField ?? relData.TargetField ?? '') as string,
          SourceBundle: (relData.SourceBundle ?? ownerBundleName) as string,
          RelationshipType: (relData.RelationshipType ?? '') as string,
          SourceBundleID: (relData.SourceBundleID ?? '') as string,
          SourceBundleName: (relData.SourceBundleName ?? ownerBundleName) as string,
          TargetBundleID: (relData.TargetBundleID ?? '') as string,
          TargetBundleName: (relData.TargetBundleName ?? relData.DestinationBundle ?? relData.TargetBundle ?? '') as string,
        } as Relationship;
      });
    }

    return [];
  }

  /**
   * Generate a stable dedup key for relationships that lack a RelationshipID.
   */
  private makeRelationshipKey(rel: Relationship): string {
    const src = rel.SourceBundle || rel.SourceBundleName || '?';
    const tgt = rel.DestinationBundle || rel.TargetBundleName || '?';
    return `${src}:${rel.SourceField || '*'}->${tgt}:${rel.DestinationField || '*'}`;
  }

  private mapRelationshipType(raw: string): RelationshipCardinality {
    switch (raw) {
      case '1toMany':
      case '0toMany':
        return '1:N';
      case 'ManyToMany':
        return 'M:N';
      default:
        return '1:1';
    }
  }
}
