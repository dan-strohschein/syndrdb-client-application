/**
 * Unit Tests for Document Context
 * Tests server-authoritative context tracking and schema management
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
    DocumentContext, 
    ContextState,
    type DatabaseDefinition,
    type BundleDefinition,
    type FieldDefinition,
    type Permission,
    type MigrationDefinition
} from '../../Lit/src/components/code-editor/syndrQL-language-serviceV2/document-context';

describe('DocumentContext', () => {
    let context: DocumentContext;

    beforeEach(() => {
        context = new DocumentContext();
    });

    describe('Context State Management', () => {
        it('should start in STALE state', () => {
            expect(context.getState()).toBe(ContextState.STALE);
        });

        it('should report context as stale initially', () => {
            expect(context.isStale()).toBe(true);
        });

        it('should track time since refresh', () => {
            const timeSinceRefresh = context.getTimeSinceRefresh();
            expect(timeSinceRefresh).toBeGreaterThan(0);
        });
    });

    describe('Database Operations', () => {
        it('should store and retrieve database', () => {
            const db: DatabaseDefinition = {
                name: 'testdb',
                bundles: new Map()
            };

            context.updateDatabase(db);
            expect(context.hasDatabase('testdb')).toBe(true);
            
            const retrieved = context.getDatabase('testdb');
            expect(retrieved).toBeDefined();
            expect(retrieved?.name).toBe('testdb');
        });

        it('should return null for non-existent database', () => {
            const db = context.getDatabase('nonexistent');
            expect(db).toBeNull();
        });

        it('should get all databases', () => {
            context.updateDatabase({ name: 'db1', bundles: new Map() });
            context.updateDatabase({ name: 'db2', bundles: new Map() });

            const databases = context.getAllDatabases();
            expect(databases).toHaveLength(2);
            expect(databases.map(db => db.name)).toContain('db1');
            expect(databases.map(db => db.name)).toContain('db2');
        });

        it('should set and get current database', () => {
            context.setCurrentDatabase('mydb');
            expect(context.getCurrentDatabase()).toBe('mydb');
        });
    });

    describe('Bundle Operations', () => {
        beforeEach(() => {
            const db: DatabaseDefinition = {
                name: 'testdb',
                bundles: new Map()
            };
            context.updateDatabase(db);
        });

        it('should store and retrieve bundle', () => {
            const bundle: BundleDefinition = {
                name: 'users',
                database: 'testdb',
                fields: new Map(),
                relationships: new Map(),
                indexes: []
            };

            context.updateBundle('testdb', bundle);
            expect(context.hasBundle('testdb', 'users')).toBe(true);

            const retrieved = context.getBundle('testdb', 'users');
            expect(retrieved).toBeDefined();
            expect(retrieved?.name).toBe('users');
        });

        it('should return null for non-existent bundle', () => {
            const bundle = context.getBundle('testdb', 'nonexistent');
            expect(bundle).toBeNull();
        });

        it('should get all bundles in database', () => {
            const bundle1: BundleDefinition = {
                name: 'users',
                database: 'testdb',
                fields: new Map(),
                relationships: new Map(),
                indexes: []
            };
            const bundle2: BundleDefinition = {
                name: 'posts',
                database: 'testdb',
                fields: new Map(),
                relationships: new Map(),
                indexes: []
            };

            context.updateBundle('testdb', bundle1);
            context.updateBundle('testdb', bundle2);

            const bundles = context.getBundles('testdb');
            expect(bundles).toHaveLength(2);
        });
    });

    describe('Field Operations', () => {
        beforeEach(() => {
            const field: FieldDefinition = {
                name: 'email',
                type: 'text',
                constraints: { unique: true, nullable: false }
            };

            const bundle: BundleDefinition = {
                name: 'users',
                database: 'testdb',
                fields: new Map([['email', field]]),
                relationships: new Map(),
                indexes: []
            };

            const db: DatabaseDefinition = {
                name: 'testdb',
                bundles: new Map([['users', bundle]])
            };

            context.updateDatabase(db);
        });

        it('should check if field exists', () => {
            expect(context.hasField('testdb', 'users', 'email')).toBe(true);
            expect(context.hasField('testdb', 'users', 'nonexistent')).toBe(false);
        });

        it('should get field definition', () => {
            const field = context.getField('testdb', 'users', 'email');
            expect(field).toBeDefined();
            expect(field?.name).toBe('email');
            expect(field?.type).toBe('text');
            expect(field?.constraints.unique).toBe(true);
        });

        it('should get all fields in bundle', () => {
            const fields = context.getFields('testdb', 'users');
            expect(fields).toHaveLength(1);
            expect(fields[0].name).toBe('email');
        });
    });

    describe('Cache Serialization', () => {
        it('should serialize and deserialize context', () => {
            // Setup context with data
            const field: FieldDefinition = {
                name: 'name',
                type: 'text',
                constraints: {}
            };

            const bundle: BundleDefinition = {
                name: 'users',
                database: 'testdb',
                fields: new Map([['name', field]]),
                relationships: new Map(),
                indexes: []
            };

            const db: DatabaseDefinition = {
                name: 'testdb',
                bundles: new Map([['users', bundle]])
            };

            context.updateDatabase(db);

            // Serialize
            const cached = context.toCache();
            expect(cached).toBeDefined();
            expect(cached.databases).toBeDefined();

            // Create new context and load from cache
            const newContext = new DocumentContext();
            newContext.loadFromCache(cached);

            // Verify data was restored
            expect(newContext.hasDatabase('testdb')).toBe(true);
            expect(newContext.hasBundle('testdb', 'users')).toBe(true);
            expect(newContext.hasField('testdb', 'users', 'name')).toBe(true);
        });

        it('should handle empty cache gracefully', () => {
            const newContext = new DocumentContext();
            newContext.loadFromCache({ databases: {}, permissions: {}, migrations: {} });
            
            expect(newContext.getAllDatabases()).toHaveLength(0);
        });
    });

    describe('Migration Operations', () => {
        it('should detect circular dependencies', () => {
            const migration1: MigrationDefinition = {
                name: 'migration1',
                statements: [],
                dependencies: ['migration2'],
                applied: false
            };

            const migration2: MigrationDefinition = {
                name: 'migration2',
                statements: [],
                dependencies: ['migration1'],
                applied: false
            };

            // Add migrations through toCache/loadFromCache since there's no direct addMigration method
            const cacheData = {
                databases: {},
                permissions: {},
                migrations: {
                    migration1,
                    migration2
                },
                lastRefreshTime: Date.now()
            };

            context.loadFromCache(cacheData);

            expect(context.hasCircularDependency('migration1')).toBe(true);
            expect(context.hasCircularDependency('migration2')).toBe(true);
        });

        it('should validate migration dependencies', () => {
            const migration: MigrationDefinition = {
                name: 'create_users',
                statements: ['CREATE BUNDLE users;'],
                dependencies: ['create_database', 'missing_migration'],
                applied: false
            };

            const depMigration: MigrationDefinition = {
                name: 'create_database',
                statements: ['CREATE DATABASE mydb;'],
                dependencies: [],
                applied: true
            };

            context.loadFromCache({
                databases: {},
                permissions: {},
                migrations: {
                    create_users: migration,
                    create_database: depMigration
                },
                lastRefreshTime: Date.now()
            });

            const result = context.validateMigrationDependencies('create_users');
            expect(result.valid).toBe(false);
            expect(result.missing).toContain('missing_migration');
            expect(result.missing).not.toContain('create_database');
        });
    });

    describe('Context Clearing', () => {
        it('should clear all context data', () => {
            context.updateDatabase({ name: 'testdb', bundles: new Map() });
            context.setCurrentDatabase('testdb');

            context.clear();

            expect(context.getAllDatabases()).toHaveLength(0);
            expect(context.getCurrentDatabase()).toBeNull();
            expect(context.getState()).toBe(ContextState.STALE);
        });
    });
});
