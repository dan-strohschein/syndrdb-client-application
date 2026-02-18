/**
 * Document Context for SyndrQL Language Service V2
 * Tracks database schema, bundles, fields, relationships, and permissions
 * Server-authoritative with manual refresh capability
 *
 * Note: The app's domain model for bundles/fields lives in ../../types/field-definition and
 * ../../types/bundle. The types below are the language-service-specific schema (e.g. for
 * suggestions and validation) and may differ in shape.
 */

/**
 * Field definition in a bundle (language service schema)
 */
export interface FieldDefinition {
    name: string;
    type: 'text' | 'number' | 'boolean' | 'date' | 'json';
    constraints: {
        nullable?: boolean;
        unique?: boolean;
        primary?: boolean;
        default?: any;
    };
}

/**
 * Relationship between bundles
 */
export interface Relationship {
    name: string;
    fromBundle: string;
    toBundle: string;
    type: 'one-to-one' | 'one-to-many' | 'many-to-many';
    fromField: string;
    toField: string;
}

/**
 * Bundle (collection) definition
 */
export interface BundleDefinition {
    name: string;
    database: string;
    fields: Map<string, FieldDefinition>;
    relationships: Map<string, Relationship>;
    indexes: string[];
}

/**
 * Database definition
 */
export interface DatabaseDefinition {
    name: string;
    bundles: Map<string, BundleDefinition>;
}

/**
 * User permission
 */
export interface Permission {
    user: string;
    resource: string;
    resourceType: 'database' | 'bundle' | 'field';
    permissions: Array<'read' | 'write' | 'execute' | 'admin'>;
}

/**
 * Migration definition
 */
export interface MigrationDefinition {
    name: string;
    statements: string[];
    dependencies: string[];
    applied: boolean;
    timestamp?: number;
}

/**
 * Context freshness state
 */
export enum ContextState {
    FRESH = 'fresh',           // Recently loaded from server
    STALE = 'stale',           // Needs refresh
    REFRESHING = 'refreshing', // Currently refreshing
    ERROR = 'error'            // Failed to refresh
}

/**
 * Document context for cross-statement validation
 * Maintains server-authoritative schema information
 */
export class DocumentContext {
    private databases: Map<string, DatabaseDefinition> = new Map();
    private permissions: Map<string, Permission[]> = new Map();
    private migrations: Map<string, MigrationDefinition> = new Map();
    private contextState: ContextState = ContextState.STALE;
    private lastRefreshTime: number = 0;
    private currentDatabase: string | null = null;
    private stalenessThreshold: number = 5 * 60 * 1000; // 5 minutes

    /**
     * Get current context state
     */
    getState(): ContextState {
        return this.contextState;
    }

    /**
     * Check if context is stale
     */
    isStale(): boolean {
        if (this.contextState === ContextState.ERROR) {
            return true;
        }
        const now = Date.now();
        return now - this.lastRefreshTime > this.stalenessThreshold;
    }

    /**
     * Get time since last refresh in milliseconds
     */
    getTimeSinceRefresh(): number {
        return Date.now() - this.lastRefreshTime;
    }

    /**
     * Set current database for context-aware validation
     */
    setCurrentDatabase(database: string): void {
        this.currentDatabase = database;
    }

    /**
     * Get current database
     */
    getCurrentDatabase(): string | null {
        return this.currentDatabase;
    }

    /**
     * Refresh context from server
     * This should be called manually by user or on document load
     */
    async refreshFromServer(serverApi: any): Promise<void> {
        this.contextState = ContextState.REFRESHING;
        
        try {
            // Fetch databases and bundles from server
            const databases = await serverApi.getDatabases();
            this.databases.clear();
            
            for (const db of databases) {
                const bundles = await serverApi.getBundles(db.name);
                const bundleMap = new Map<string, BundleDefinition>();
                
                for (const bundle of bundles) {
                    const fields = await serverApi.getFields(db.name, bundle.name);
                    const relationships = await serverApi.getRelationships(db.name, bundle.name);
                    
                    const fieldMap = new Map<string, FieldDefinition>();
                    fields.forEach((f: FieldDefinition) => fieldMap.set(f.name, f));
                    
                    const relMap = new Map<string, Relationship>();
                    relationships.forEach((r: Relationship) => relMap.set(r.name, r));
                    
                    bundleMap.set(bundle.name, {
                        name: bundle.name,
                        database: db.name,
                        fields: fieldMap,
                        relationships: relMap,
                        indexes: bundle.indexes || []
                    });
                }
                
                this.databases.set(db.name, {
                    name: db.name,
                    bundles: bundleMap
                });
            }
            
            // Fetch permissions
            const permissions = await serverApi.getPermissions();
            this.permissions.clear();
            permissions.forEach((p: Permission) => {
                const key = `${p.user}:${p.resource}`;
                const existing = this.permissions.get(key) || [];
                this.permissions.set(key, [...existing, p]);
            });
            
            // Fetch migrations
            const migrations = await serverApi.getMigrations();
            this.migrations.clear();
            migrations.forEach((m: MigrationDefinition) => {
                this.migrations.set(m.name, m);
            });
            
            this.contextState = ContextState.FRESH;
            this.lastRefreshTime = Date.now();
        } catch (error) {
            console.error('Failed to refresh context from server:', error);
            this.contextState = ContextState.ERROR;
        }
    }

    /**
     * Load context from local cache (faster startup)
     */
    loadFromCache(cachedData: any): void {
        try {
            // Restore databases
            this.databases.clear();
            for (const [dbName, dbData] of Object.entries(cachedData.databases || {})) {
                const db = dbData as any;
                const bundleMap = new Map<string, BundleDefinition>();
                
                for (const [bundleName, bundleData] of Object.entries(db.bundles || {})) {
                    const bundle = bundleData as any;
                    bundleMap.set(bundleName, {
                        name: bundle.name,
                        database: dbName,
                        fields: new Map(Object.entries(bundle.fields || {})),
                        relationships: new Map(Object.entries(bundle.relationships || {})),
                        indexes: bundle.indexes || []
                    });
                }
                
                this.databases.set(dbName, {
                    name: dbName,
                    bundles: bundleMap
                });
            }
            
            // Restore permissions
            this.permissions.clear();
            for (const [key, perms] of Object.entries(cachedData.permissions || {})) {
                this.permissions.set(key, perms as Permission[]);
            }
            
            // Restore migrations
            this.migrations.clear();
            for (const [name, migration] of Object.entries(cachedData.migrations || {})) {
                this.migrations.set(name, migration as MigrationDefinition);
            }
            
            this.contextState = ContextState.STALE; // Cached data is stale by default
            this.lastRefreshTime = cachedData.lastRefreshTime || 0;
        } catch (error) {
            console.error('Failed to load context from cache:', error);
            this.contextState = ContextState.ERROR;
        }
    }

    /**
     * Serialize context for caching
     */
    toCache(): any {
        const serializeDatabases = () => {
            const result: any = {};
            for (const [dbName, db] of this.databases.entries()) {
                const bundles: any = {};
                for (const [bundleName, bundle] of db.bundles.entries()) {
                    bundles[bundleName] = {
                        name: bundle.name,
                        database: bundle.database,
                        fields: Object.fromEntries(bundle.fields),
                        relationships: Object.fromEntries(bundle.relationships),
                        indexes: bundle.indexes
                    };
                }
                result[dbName] = {
                    name: db.name,
                    bundles
                };
            }
            return result;
        };

        return {
            databases: serializeDatabases(),
            permissions: Object.fromEntries(this.permissions),
            migrations: Object.fromEntries(this.migrations),
            lastRefreshTime: this.lastRefreshTime
        };
    }

    /**
     * Check if database exists
     */
    hasDatabase(name: string): boolean {
        return this.databases.has(name);
    }

    /**
     * Get database definition
     */
    getDatabase(name: string): DatabaseDefinition | null {
        return this.databases.get(name) || null;
    }

    /**
     * Get all databases
     */
    getAllDatabases(): DatabaseDefinition[] {
        return Array.from(this.databases.values());
    }

    /**
     * Check if bundle exists
     */
    hasBundle(database: string, bundle: string): boolean {
        const db = this.databases.get(database);
        return db ? db.bundles.has(bundle) : false;
    }

    /**
     * Get bundle definition
     */
    getBundle(database: string, bundle: string): BundleDefinition | null {
        const db = this.databases.get(database);
        return db ? db.bundles.get(bundle) || null : null;
    }

    /**
     * Get all bundles in database
     */
    getBundles(database: string): BundleDefinition[] {
        const db = this.databases.get(database);
        return db ? Array.from(db.bundles.values()) : [];
    }

    /**
     * Check if field exists in bundle
     */
    hasField(database: string, bundle: string, field: string): boolean {
        const bundleDef = this.getBundle(database, bundle);
        return bundleDef ? bundleDef.fields.has(field) : false;
    }

    /**
     * Get field definition
     */
    getField(database: string, bundle: string, field: string): FieldDefinition | null {
        const bundleDef = this.getBundle(database, bundle);
        return bundleDef ? bundleDef.fields.get(field) || null : null;
    }

    /**
     * Get all fields in bundle
     */
    getFields(database: string, bundle: string): FieldDefinition[] {
        const bundleDef = this.getBundle(database, bundle);
        return bundleDef ? Array.from(bundleDef.fields.values()) : [];
    }

    /**
     * Check if relationship exists
     */
    hasRelationship(database: string, bundle: string, relationship: string): boolean {
        const bundleDef = this.getBundle(database, bundle);
        return bundleDef ? bundleDef.relationships.has(relationship) : false;
    }

    /**
     * Get relationship definition
     */
    getRelationship(database: string, bundle: string, relationship: string): Relationship | null {
        const bundleDef = this.getBundle(database, bundle);
        return bundleDef ? bundleDef.relationships.get(relationship) || null : null;
    }

    /**
     * Check user permission for resource
     */
    hasPermission(
        user: string,
        resource: string,
        permission: 'read' | 'write' | 'execute' | 'admin'
    ): boolean {
        const key = `${user}:${resource}`;
        const perms = this.permissions.get(key);
        return perms ? perms.some(p => p.permissions.includes(permission)) : false;
    }

    /**
     * Get all permissions for user
     */
    getUserPermissions(user: string): Permission[] {
        const result: Permission[] = [];
        for (const [key, perms] of this.permissions.entries()) {
            if (key.startsWith(`${user}:`)) {
                result.push(...perms);
            }
        }
        return result;
    }

    /**
     * Check if migration exists
     */
    hasMigration(name: string): boolean {
        return this.migrations.has(name);
    }

    /**
     * Get migration definition
     */
    getMigration(name: string): MigrationDefinition | null {
        return this.migrations.get(name) || null;
    }

    /**
     * Get all migrations
     */
    getAllMigrations(): MigrationDefinition[] {
        return Array.from(this.migrations.values());
    }

    /**
     * Check for circular migration dependencies
     */
    hasCircularDependency(migrationName: string, visited: Set<string> = new Set()): boolean {
        if (visited.has(migrationName)) {
            return true;
        }

        const migration = this.migrations.get(migrationName);
        if (!migration) {
            return false;
        }

        visited.add(migrationName);

        for (const dep of migration.dependencies) {
            if (this.hasCircularDependency(dep, new Set(visited))) {
                return true;
            }
        }

        return false;
    }

    /**
     * Validate migration dependencies
     */
    validateMigrationDependencies(migrationName: string): { valid: boolean; missing: string[] } {
        const migration = this.migrations.get(migrationName);
        if (!migration) {
            return { valid: false, missing: [] };
        }

        const missing: string[] = [];
        for (const dep of migration.dependencies) {
            if (!this.migrations.has(dep)) {
                missing.push(dep);
            }
        }

        return {
            valid: missing.length === 0,
            missing
        };
    }

    /**
     * Add or update database (for local changes before server sync)
     */
    updateDatabase(database: DatabaseDefinition): void {
        this.databases.set(database.name, database);
        // Mark as stale since we made local changes
        this.contextState = ContextState.STALE;
    }

    /**
     * Add or update bundle (for local changes before server sync)
     */
    updateBundle(database: string, bundle: BundleDefinition): void {
        const db = this.databases.get(database);
        if (db) {
            db.bundles.set(bundle.name, bundle);
            this.contextState = ContextState.STALE;
        }
    }

    /**
     * Clear all context data
     */
    clear(): void {
        this.databases.clear();
        this.permissions.clear();
        this.migrations.clear();
        this.contextState = ContextState.STALE;
        this.lastRefreshTime = 0;
        this.currentDatabase = null;
    }
}
