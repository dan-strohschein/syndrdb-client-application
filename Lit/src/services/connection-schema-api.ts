/**
 * ConnectionSchemaApi — Implements SchemaServerApi using ConnectionManager.
 * Executes SyndrQL queries to fetch live schema data for the language service.
 */

import type { SchemaServerApi } from './schema-server-api';
import type { ConnectionManager } from './connection-manager';
import type {
    FieldDefinition,
    Relationship,
    BundleDefinition,
    DatabaseDefinition,
    Permission,
    MigrationDefinition,
} from '../components/code-editor/syndrQL-language-serviceV2/document-context';

export class ConnectionSchemaApi implements SchemaServerApi {
    constructor(
        private connectionManager: ConnectionManager,
        private connectionId: string,
    ) {}

    async getDatabases(): Promise<DatabaseDefinition[]> {
        const result = await this.connectionManager.executeQueryOnConnectionId(
            this.connectionId,
            'SHOW DATABASES;',
        );

        if (!result.success || !result.data) return [];

        return (result.data as unknown[]).map((db) => {
            const name = typeof db === 'string' ? db : String(db);
            return {
                name,
                bundles: new Map(),
            };
        });
    }

    async getBundles(database: string): Promise<BundleDefinition[]> {
        await this.connectionManager.setDatabaseContext(this.connectionId, database);
        const result = await this.connectionManager.executeQueryOnConnectionId(
            this.connectionId,
            'SHOW BUNDLES;',
        );

        if (!result.success || !result.data) return [];

        return (result.data as Record<string, unknown>[]).map((raw) => {
            const name = (raw.Name ?? raw.name ?? '') as string;
            return {
                name,
                database,
                fields: new Map(),
                relationships: new Map(),
                indexes: [],
            };
        });
    }

    async getBundle(database: string, bundleName: string): Promise<BundleDefinition> {
        await this.connectionManager.setDatabaseContext(this.connectionId, database);
        const result = await this.connectionManager.executeQueryOnConnectionId(
            this.connectionId,
            `SHOW BUNDLE "${bundleName}";`,
        );

        const fields = new Map<string, FieldDefinition>();
        const relationships = new Map<string, Relationship>();

        if (result.success && result.data) {
            const data = (Array.isArray(result.data) ? result.data[0] : result.data) as Record<string, unknown>;
            const bundleData = (data.BundleMetadata ?? data) as Record<string, unknown>;
            const docStructure = bundleData.DocumentStructure as Record<string, unknown> | undefined;
            const fieldDefs = docStructure?.FieldDefinitions;

            if (fieldDefs && typeof fieldDefs === 'object') {
                for (const [fieldName, fieldDef] of Object.entries(fieldDefs as Record<string, Record<string, unknown>>)) {
                    fields.set(fieldName, {
                        name: (fieldDef.Name as string) ?? fieldName,
                        type: this.mapFieldType((fieldDef.Type as string) ?? 'text'),
                        constraints: {
                            nullable: !(fieldDef.Required ?? fieldDef.IsRequired),
                            unique: (fieldDef.Unique ?? fieldDef.IsUnique) === true,
                            primary: fieldName === 'DocumentID',
                            default: fieldDef.DefaultValue,
                        },
                    });
                }
            }
        }

        return {
            name: bundleName,
            database,
            fields,
            relationships,
            indexes: [],
        };
    }

    async getFields(database: string, bundleName: string): Promise<FieldDefinition[]> {
        const bundle = await this.getBundle(database, bundleName);
        return Array.from(bundle.fields.values());
    }

    async getRelationships(database: string, bundleName: string): Promise<Relationship[]> {
        const bundle = await this.getBundle(database, bundleName);
        return Array.from(bundle.relationships.values());
    }

    async getPermissions(): Promise<Permission[]> {
        // Permissions are not yet exposed via SyndrQL — return empty.
        return [];
    }

    async getMigrations(): Promise<MigrationDefinition[]> {
        // Migrations are not yet exposed via SyndrQL — return empty.
        return [];
    }

    /** Map SyndrDB field types to language-service field types */
    private mapFieldType(type: string): FieldDefinition['type'] {
        const lower = type.toLowerCase();
        switch (lower) {
            case 'string':
            case 'text':
                return 'text';
            case 'int':
            case 'integer':
            case 'decimal':
            case 'float':
            case 'number':
                return 'number';
            case 'boolean':
            case 'bool':
                return 'boolean';
            case 'datetime':
            case 'date':
            case 'timestamp':
                return 'date';
            case 'json':
            case 'object':
                return 'json';
            default:
                return 'text';
        }
    }
}
