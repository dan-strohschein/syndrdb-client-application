/**
 * Schema Server API Interface
 * Abstracts server-side schema queries so the language service and context expander
 * are not coupled to ConnectionManager or any specific transport layer.
 */

import type {
    FieldDefinition,
    Relationship,
    BundleDefinition,
    DatabaseDefinition,
    Permission,
    MigrationDefinition,
} from '../components/code-editor/syndrQL-language-serviceV2/document-context';

export interface SchemaServerApi {
    /** List all databases on the server */
    getDatabases(): Promise<DatabaseDefinition[]>;

    /** List all bundles in a database */
    getBundles(database: string): Promise<BundleDefinition[]>;

    /** Get a single bundle definition */
    getBundle(database: string, bundleName: string): Promise<BundleDefinition>;

    /** Get field definitions for a bundle */
    getFields(database: string, bundleName: string): Promise<FieldDefinition[]>;

    /** Get relationships for a bundle */
    getRelationships(database: string, bundleName: string): Promise<Relationship[]>;

    /** Get all permissions */
    getPermissions(): Promise<Permission[]>;

    /** Get all migrations */
    getMigrations(): Promise<MigrationDefinition[]>;
}
