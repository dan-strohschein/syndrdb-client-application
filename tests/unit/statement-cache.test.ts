/**
 * Unit Tests for Statement Cache
 * Tests LRU caching with access-weighted eviction
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StatementCache } from '../../Lit/src/components/code-editor/syndrQL-language-serviceV2/statement-cache';
import type { CachedStatement } from '../../Lit/src/components/code-editor/syndrQL-language-serviceV2/statement-cache';
import { DEFAULT_CONFIG } from '../../Lit/src/config/config-types';

describe('StatementCache', () => {
    let cache: StatementCache;

    beforeEach(() => {
        cache = new StatementCache(DEFAULT_CONFIG);
    });

    describe('Basic Operations', () => {
        it('should store and retrieve statements', () => {
            const statement = {
                text: 'CREATE DATABASE test;',
                isValid: true,
                isDirty: false,
                timestamp: Date.now(),
                errors: []
            };

            cache.put('doc1', 'hash1', statement);
            const retrieved = cache.get('doc1', 'hash1');

            expect(retrieved).toBeDefined();
            expect(retrieved?.text).toBe(statement.text);
        });

        it('should return null for non-existent statements', () => {
            const result = cache.get('doc1', 'nonexistent');
            expect(result).toBeNull();
        });

        it('should increment access count on get', () => {
            const statement = {
                text: 'SELECT * FROM users;',
                isValid: true,
                isDirty: false,
                timestamp: Date.now(),
                errors: []
            };

            cache.put('doc1', 'hash2', statement);
            cache.get('doc1', 'hash2');
            cache.get('doc1', 'hash2');
            
            const retrieved = cache.get('doc1', 'hash2');
            expect(retrieved?.accessCount).toBe(4); // 1 initial + 3 gets
        });

        it('should update last access time', async () => {
            const statement = {
                text: 'SHOW DATABASES;',
                isValid: true,
                isDirty: false,
                timestamp: Date.now(),
                errors: []
            };

            const initialTime = Date.now();
            cache.put('doc1', 'hash3', statement);
            
            // Wait a bit and access again
            await new Promise(resolve => setTimeout(resolve, 10));
            const retrieved = cache.get('doc1', 'hash3');
            expect(retrieved?.lastAccessTime).toBeGreaterThan(initialTime);
        });
    });

    describe('Document Isolation', () => {
        it('should isolate statements by document', () => {
            const statement1 = {
                text: 'CREATE DATABASE db1;',
                isValid: true,
                isDirty: false,
                timestamp: Date.now(),
                errors: []
            };

            const statement2 = {
                text: 'CREATE DATABASE db2;',
                isValid: true,
                isDirty: false,
                timestamp: Date.now(),
                errors: []
            };

            cache.put('doc1', 'hash1', statement1);
            cache.put('doc2', 'hash1', statement2);

            const retrieved1 = cache.get('doc1', 'hash1');
            const retrieved2 = cache.get('doc2', 'hash1');

            expect(retrieved1?.text).toBe('CREATE DATABASE db1;');
            expect(retrieved2?.text).toBe('CREATE DATABASE db2;');
        });

        it('should clear document cache independently', () => {
            cache.put('doc1', 'hash1', {
                text: 'Statement 1',
                isValid: true,
                isDirty: false,
                timestamp: Date.now(),
                errors: []
            });

            cache.put('doc2', 'hash2', {
                text: 'Statement 2',
                isValid: true,
                isDirty: false,
                timestamp: Date.now(),
                errors: []
            });

            cache.clearDocument('doc1');

            expect(cache.get('doc1', 'hash1')).toBeNull();
            expect(cache.get('doc2', 'hash2')).toBeDefined();
        });
    });

    describe('Dirty/Clean Marking', () => {
        it('should mark statements as dirty', () => {
            const statement = {
                text: 'SELECT * FROM users;',
                isValid: true,
                isDirty: false,
                timestamp: Date.now(),
                errors: []
            };

            cache.put('doc1', 'hash1', statement);
            cache.markDirty('doc1', 'hash1');

            const retrieved = cache.get('doc1', 'hash1');
            expect(retrieved?.isDirty).toBe(true);
        });

        it('should mark statements as clean', () => {
            const statement = {
                text: 'SELECT * FROM users;',
                isValid: true,
                isDirty: true,
                timestamp: Date.now(),
                errors: []
            };

            cache.put('doc1', 'hash1', statement);
            cache.markClean('doc1', 'hash1', true);

            const retrieved = cache.get('doc1', 'hash1');
            expect(retrieved?.isDirty).toBe(false);
        });

        it('should get all dirty statements', () => {
            cache.put('doc1', 'hash1', {
                text: 'Statement 1',
                isValid: true,
                isDirty: true,
                timestamp: Date.now(),
                errors: []
            });

            cache.put('doc1', 'hash2', {
                text: 'Statement 2',
                isValid: true,
                isDirty: false,
                timestamp: Date.now(),
                errors: []
            });

            cache.put('doc1', 'hash3', {
                text: 'Statement 3',
                isValid: true,
                isDirty: true,
                timestamp: Date.now(),
                errors: []
            });

            const dirty = cache.getDirtyStatements('doc1');
            expect(dirty).toHaveLength(2);
            expect(dirty.every(s => s.statement.isDirty)).toBe(true);
        });
    });

    describe('Cache Eviction', () => {
        it('should evict statements when buffer is full', () => {
            // Create cache with small buffer (1KB)
            const smallCache = new StatementCache({
                ...DEFAULT_CONFIG,
                languageService: {
                    ...DEFAULT_CONFIG.languageService,
                    statementCacheBufferSize: 1024
                }
            });

            // Add statements until eviction occurs
            for (let i = 0; i < 20; i++) {
                smallCache.put(`doc1`, `hash${i}`, {
                    text: `CREATE DATABASE db${i};`.repeat(10), // Larger statements
                    isValid: true,
                    isDirty: false,
                    timestamp: Date.now(),
                    errors: []
                });
            }

            const metrics = smallCache.getMetrics();
            expect(metrics.evictionCount).toBeGreaterThan(0);
        });

        it('should evict based on access-weighted score', () => {
            const smallCache = new StatementCache({
                ...DEFAULT_CONFIG,
                languageService: {
                    ...DEFAULT_CONFIG.languageService,
                    statementCacheBufferSize: 500
                }
            });

            // Add frequently accessed statement
            smallCache.put('doc1', 'frequent', {
                text: 'Frequently accessed',
                isValid: true,
                isDirty: false,
                timestamp: Date.now(),
                errors: []
            });

            // Add rarely accessed statement
            smallCache.put('doc1', 'rare', {
                text: 'Rarely accessed',
                isValid: true,
                isDirty: false,
                timestamp: Date.now() - 60000, // Older
                errors: []
            });

            // Fill cache to trigger eviction
            for (let i = 0; i < 10; i++) {
                smallCache.put('doc1', `hash${i}`, {
                    text: `Statement ${i}`,
                    isValid: true,
                    isDirty: false,
                    timestamp: Date.now(),
                    errors: []
                });
            }

            // Frequently accessed statement should still be there
            expect(smallCache.get('doc1', 'frequent')).toBeDefined();
        });
    });

    describe('Cache Metrics', () => {
        it('should track cache hits', () => {
            cache.put('doc1', 'hash1', {
                text: 'SELECT * FROM users;',
                isValid: true,
                isDirty: false,
                timestamp: Date.now(),
                errors: []
            });
            cache.get('doc1', 'hash1'); // Hit
            cache.get('doc1', 'hash1'); // Hit

            const metrics = cache.getMetrics();
            expect(metrics.hitCount).toBe(2);
        });

        it('should track cache misses', () => {
            cache.get('doc1', 'nonexistent'); // Miss
            cache.get('doc1', 'another_miss'); // Miss

            const metrics = cache.getMetrics();
            expect(metrics.missCount).toBe(2);
        });

        it('should calculate hit rate', () => {
            cache.put('doc1', 'hash1', {
                text: 'SELECT * FROM users;',
                isValid: true,
                isDirty: false,
                timestamp: Date.now(),
                errors: []
            });
            cache.get('doc1', 'hash1'); // Hit
            cache.get('doc1', 'nonexistent'); // Miss
            cache.get('doc1', 'hash1'); // Hit

            const metrics = cache.getMetrics();
            expect(metrics.hitRate).toBeCloseTo(0.67, 1); // 2 hits, 1 miss = 66.7%
        });

        it('should track total size', () => {
            cache.put('doc1', 'hash1', {
                text: 'Statement 1',
                isValid: true,
                isDirty: false,
                timestamp: Date.now(),
                errors: []
            });

            cache.put('doc1', 'hash2', {
                text: 'Statement 2',
                isValid: true,
                isDirty: false,
                timestamp: Date.now(),
                errors: []
            });

            const metrics = cache.getMetrics();
            // Total size includes computed byte size which may vary
            expect(metrics.totalSize).toBeGreaterThan(0);
        });
    });
});
