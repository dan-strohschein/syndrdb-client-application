/**
 * Unit Tests for ConnectionSchemaApi
 * Tests schema queries with mocked ConnectionManager
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConnectionSchemaApi } from '@/services/connection-schema-api';

// Mock ConnectionManager with just the methods we use
function createMockConnectionManager() {
    return {
        executeQueryOnConnectionId: vi.fn(),
        setDatabaseContext: vi.fn().mockResolvedValue(undefined),
    };
}

describe('ConnectionSchemaApi', () => {
    let api: ConnectionSchemaApi;
    let mockCM: ReturnType<typeof createMockConnectionManager>;
    const connectionId = 'test-conn-1';

    beforeEach(() => {
        mockCM = createMockConnectionManager();
        // Cast to satisfy the constructor which expects a full ConnectionManager
        api = new ConnectionSchemaApi(mockCM as never, connectionId);
    });

    describe('getDatabases', () => {
        it('should execute SHOW DATABASES and return DatabaseDefinitions', async () => {
            mockCM.executeQueryOnConnectionId.mockResolvedValue({
                success: true,
                data: ['inventory_db', 'analytics_db'],
            });

            const databases = await api.getDatabases();

            expect(mockCM.executeQueryOnConnectionId).toHaveBeenCalledWith(
                connectionId,
                'SHOW DATABASES;',
            );
            expect(databases).toHaveLength(2);
            expect(databases[0].name).toBe('inventory_db');
            expect(databases[1].name).toBe('analytics_db');
            // Each database starts with empty bundles map
            expect(databases[0].bundles.size).toBe(0);
        });

        it('should return empty array on failure', async () => {
            mockCM.executeQueryOnConnectionId.mockResolvedValue({
                success: false,
                error: 'Connection lost',
            });

            const databases = await api.getDatabases();
            expect(databases).toEqual([]);
        });

        it('should return empty array when data is missing', async () => {
            mockCM.executeQueryOnConnectionId.mockResolvedValue({
                success: true,
            });

            const databases = await api.getDatabases();
            expect(databases).toEqual([]);
        });
    });

    describe('getBundles', () => {
        it('should set database context and execute SHOW BUNDLES', async () => {
            mockCM.executeQueryOnConnectionId.mockResolvedValue({
                success: true,
                data: [
                    { Name: 'users' },
                    { Name: 'orders' },
                ],
            });

            const bundles = await api.getBundles('mydb');

            expect(mockCM.setDatabaseContext).toHaveBeenCalledWith(connectionId, 'mydb');
            expect(mockCM.executeQueryOnConnectionId).toHaveBeenCalledWith(
                connectionId,
                'SHOW BUNDLES;',
            );
            expect(bundles).toHaveLength(2);
            expect(bundles[0].name).toBe('users');
            expect(bundles[0].database).toBe('mydb');
            expect(bundles[1].name).toBe('orders');
        });

        it('should handle lowercase name field', async () => {
            mockCM.executeQueryOnConnectionId.mockResolvedValue({
                success: true,
                data: [{ name: 'products' }],
            });

            const bundles = await api.getBundles('mydb');
            expect(bundles[0].name).toBe('products');
        });

        it('should return empty array on failure', async () => {
            mockCM.executeQueryOnConnectionId.mockResolvedValue({
                success: false,
            });

            const bundles = await api.getBundles('mydb');
            expect(bundles).toEqual([]);
        });
    });

    describe('getBundle', () => {
        it('should set database context and execute SHOW BUNDLE', async () => {
            mockCM.executeQueryOnConnectionId.mockResolvedValue({
                success: true,
                data: {
                    BundleMetadata: {
                        DocumentStructure: {
                            FieldDefinitions: {
                                DocumentID: { Name: 'DocumentID', Type: 'STRING', Required: true, Unique: true },
                                email: { Name: 'email', Type: 'STRING', Required: true, Unique: false },
                                age: { Name: 'age', Type: 'INT', Required: false, Unique: false },
                            },
                        },
                    },
                },
            });

            const bundle = await api.getBundle('mydb', 'users');

            expect(mockCM.setDatabaseContext).toHaveBeenCalledWith(connectionId, 'mydb');
            expect(mockCM.executeQueryOnConnectionId).toHaveBeenCalledWith(
                connectionId,
                'SHOW BUNDLE "users";',
            );

            expect(bundle.name).toBe('users');
            expect(bundle.database).toBe('mydb');
            expect(bundle.fields.size).toBe(3);

            const docIdField = bundle.fields.get('DocumentID');
            expect(docIdField).toBeDefined();
            expect(docIdField!.name).toBe('DocumentID');
            expect(docIdField!.type).toBe('text'); // STRING maps to text
            expect(docIdField!.constraints.nullable).toBe(false);
            expect(docIdField!.constraints.unique).toBe(true);
            expect(docIdField!.constraints.primary).toBe(true);

            const ageField = bundle.fields.get('age');
            expect(ageField).toBeDefined();
            expect(ageField!.type).toBe('number'); // INT maps to number
            expect(ageField!.constraints.nullable).toBe(true);
        });

        it('should return empty fields when query fails', async () => {
            mockCM.executeQueryOnConnectionId.mockResolvedValue({
                success: false,
            });

            const bundle = await api.getBundle('mydb', 'users');
            expect(bundle.name).toBe('users');
            expect(bundle.fields.size).toBe(0);
        });
    });

    describe('getFields', () => {
        it('should delegate to getBundle and return fields array', async () => {
            mockCM.executeQueryOnConnectionId.mockResolvedValue({
                success: true,
                data: {
                    BundleMetadata: {
                        DocumentStructure: {
                            FieldDefinitions: {
                                name: { Name: 'name', Type: 'STRING', Required: true },
                            },
                        },
                    },
                },
            });

            const fields = await api.getFields('mydb', 'users');
            expect(fields).toHaveLength(1);
            expect(fields[0].name).toBe('name');
        });
    });

    describe('getRelationships', () => {
        it('should return empty array (no relationships in SHOW BUNDLE yet)', async () => {
            mockCM.executeQueryOnConnectionId.mockResolvedValue({
                success: true,
                data: { BundleMetadata: {} },
            });

            const relationships = await api.getRelationships('mydb', 'users');
            expect(relationships).toEqual([]);
        });
    });

    describe('getPermissions', () => {
        it('should return empty array (not yet implemented)', async () => {
            const permissions = await api.getPermissions();
            expect(permissions).toEqual([]);
        });
    });

    describe('getMigrations', () => {
        it('should return empty array (not yet implemented)', async () => {
            const migrations = await api.getMigrations();
            expect(migrations).toEqual([]);
        });
    });

    describe('mapFieldType', () => {
        it('should map SyndrDB types correctly via getBundle', async () => {
            mockCM.executeQueryOnConnectionId.mockResolvedValue({
                success: true,
                data: {
                    DocumentStructure: {
                        FieldDefinitions: {
                            f1: { Name: 'f1', Type: 'STRING' },
                            f2: { Name: 'f2', Type: 'INT' },
                            f3: { Name: 'f3', Type: 'BOOLEAN' },
                            f4: { Name: 'f4', Type: 'DATETIME' },
                            f5: { Name: 'f5', Type: 'JSON' },
                            f6: { Name: 'f6', Type: 'DECIMAL' },
                            f7: { Name: 'f7', Type: 'UNKNOWN_TYPE' },
                        },
                    },
                },
            });

            const bundle = await api.getBundle('db', 'test');

            expect(bundle.fields.get('f1')!.type).toBe('text');
            expect(bundle.fields.get('f2')!.type).toBe('number');
            expect(bundle.fields.get('f3')!.type).toBe('boolean');
            expect(bundle.fields.get('f4')!.type).toBe('date');
            expect(bundle.fields.get('f5')!.type).toBe('json');
            expect(bundle.fields.get('f6')!.type).toBe('number');
            expect(bundle.fields.get('f7')!.type).toBe('text'); // unknown defaults to text
        });
    });
});
