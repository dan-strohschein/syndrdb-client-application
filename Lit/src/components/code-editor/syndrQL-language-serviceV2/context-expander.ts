/**
 * Context Expander for SyndrQL Language Service V2
 * Handles dynamic context loading, pre-fetching, and caching
 * Optimizes suggestion performance with background loading
 */

import type { DocumentContext, BundleDefinition, FieldDefinition, Relationship } from './document-context';
import type { AppConfig } from '../../../config/config-types';
import type { SchemaServerApi } from '../../../services/schema-server-api';

/**
 * Context load request
 */
interface ContextLoadRequest {
    type: 'database' | 'bundle' | 'fields' | 'relationships';
    database?: string;
    bundle?: string;
    priority: number;
}

/**
 * Context cache entry
 */
interface CacheEntry<T> {
    data: T;
    timestamp: number;
    accessCount: number;
}

/**
 * Prefetch strategy
 */
export enum PrefetchStrategy {
    AGGRESSIVE = 'aggressive',   // Prefetch all related data
    MODERATE = 'moderate',       // Prefetch likely needed data
    CONSERVATIVE = 'conservative' // Prefetch only on demand
}

/**
 * Context expansion configuration
 */
interface ContextExpanderConfig {
    prefetchStrategy: PrefetchStrategy;
    cacheSize: number;
    cacheTTL: number;
    backgroundLoadDelay: number;
}

/**
 * Context expander with dynamic loading and caching
 */
export class ContextExpander {
    private config: ContextExpanderConfig;
    private bundleCache: Map<string, CacheEntry<BundleDefinition>> = new Map();
    private fieldCache: Map<string, CacheEntry<FieldDefinition[]>> = new Map();
    private loadQueue: ContextLoadRequest[] = [];
    private isLoading: boolean = false;
    private backgroundLoadTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(appConfig: AppConfig) {
        this.config = {
            prefetchStrategy: PrefetchStrategy.MODERATE,
            cacheSize: 50,
            cacheTTL: 5 * 60 * 1000, // 5 minutes
            backgroundLoadDelay: 500 // 500ms delay for background loads
        };
    }

    /**
     * Expand context for a specific bundle
     * Loads bundle definition with fields and relationships
     */
    async expandBundle(
        database: string,
        bundleName: string,
        context: DocumentContext,
        serverApi: SchemaServerApi | null
    ): Promise<BundleDefinition | null> {
        if (!database || !bundleName) return null;

        const cacheKey = `${database}:${bundleName}`;
        
        // Check cache first
        const cached = this.bundleCache.get(cacheKey);
        if (cached && !this.isCacheStale(cached)) {
            cached.accessCount++;
            return cached.data;
        }

        // Load from context
        let bundle = context.getBundle(database, bundleName);
        
        // If not in context, fetch from server
        if (!bundle && serverApi) {
            try {
                bundle = await this.loadBundleFromServer(database, bundleName, serverApi);
                if (bundle) {
                    context.updateBundle(database, bundle);
                }
            } catch (error) {
                console.error(`Failed to load bundle ${bundleName}:`, error);
                return null;
            }
        }

        // Cache the result
        if (bundle) {
            this.bundleCache.set(cacheKey, {
                data: bundle,
                timestamp: Date.now(),
                accessCount: 1
            });

            // Evict old cache entries if needed
            this.evictOldCacheEntries();

            // Prefetch related data
            this.prefetchRelatedData(database, bundle, context, serverApi);
        }

        return bundle;
    }

    /**
     * Expand fields for a bundle
     */
    async expandFields(
        database: string,
        bundleName: string,
        context: DocumentContext,
        serverApi: SchemaServerApi | null
    ): Promise<FieldDefinition[]> {
        const cacheKey = `${database}:${bundleName}:fields`;
        
        // Check cache first
        const cached = this.fieldCache.get(cacheKey);
        if (cached && !this.isCacheStale(cached)) {
            cached.accessCount++;
            return cached.data;
        }

        // Get fields from context
        let fields = context.getFields(database, bundleName);

        // If not in context, fetch from server
        if (fields.length === 0 && serverApi) {
            try {
                fields = await this.loadFieldsFromServer(database, bundleName, serverApi);
                
                // Update bundle in context with new fields
                const bundle = context.getBundle(database, bundleName);
                if (bundle) {
                    const fieldMap = new Map<string, FieldDefinition>();
                    fields.forEach(f => fieldMap.set(f.name, f));
                    bundle.fields = fieldMap;
                    context.updateBundle(database, bundle);
                }
            } catch (error) {
                console.error(`Failed to load fields for ${bundleName}:`, error);
                return [];
            }
        }

        // Cache the result
        if (fields.length > 0) {
            this.fieldCache.set(cacheKey, {
                data: fields,
                timestamp: Date.now(),
                accessCount: 1
            });

            this.evictOldCacheEntries();
        }

        return fields;
    }

    /**
     * Prefetch related data based on strategy
     */
    private prefetchRelatedData(
        database: string,
        bundle: BundleDefinition,
        context: DocumentContext,
        serverApi: SchemaServerApi | null
    ): void {
        if (this.config.prefetchStrategy === PrefetchStrategy.CONSERVATIVE) {
            return;
        }

        // Queue related bundles for prefetching
        for (const [_, relationship] of bundle.relationships) {
            const relatedBundle = relationship.toBundle;
            
            this.queueBackgroundLoad({
                type: 'bundle',
                database,
                bundle: relatedBundle,
                priority: 50
            }, context, serverApi);
        }

        // Prefetch fields if not already loaded
        if (bundle.fields.size === 0) {
            this.queueBackgroundLoad({
                type: 'fields',
                database,
                bundle: bundle.name,
                priority: 75
            }, context, serverApi);
        }

        // Aggressive mode: prefetch all bundles in database
        if (this.config.prefetchStrategy === PrefetchStrategy.AGGRESSIVE) {
            const db = context.getDatabase(database);
            if (db) {
                for (const [bundleName, _] of db.bundles) {
                    if (bundleName !== bundle.name) {
                        this.queueBackgroundLoad({
                            type: 'bundle',
                            database,
                            bundle: bundleName,
                            priority: 25
                        }, context, serverApi);
                    }
                }
            }
        }
    }

    /**
     * Queue background load request
     */
    private queueBackgroundLoad(
        request: ContextLoadRequest,
        context: DocumentContext,
        serverApi: SchemaServerApi | null
    ): void {
        // Add to queue
        this.loadQueue.push(request);

        // Sort by priority (descending)
        this.loadQueue.sort((a, b) => b.priority - a.priority);

        // Schedule background processing
        if (!this.backgroundLoadTimer) {
            this.backgroundLoadTimer = setTimeout(() => {
                this.processLoadQueue(context, serverApi);
            }, this.config.backgroundLoadDelay);
        }
    }

    /**
     * Process queued load requests in background
     */
    private async processLoadQueue(context: DocumentContext, serverApi: SchemaServerApi | null): Promise<void> {
        this.backgroundLoadTimer = null;

        if (this.isLoading || this.loadQueue.length === 0) {
            return;
        }

        this.isLoading = true;

        try {
            // Process up to 3 requests at a time
            const batch = this.loadQueue.splice(0, 3);

            for (const request of batch) {
                try {
                    switch (request.type) {
                        case 'bundle':
                            if (request.database && request.bundle) {
                                await this.expandBundle(
                                    request.database,
                                    request.bundle,
                                    context,
                                    serverApi
                                );
                            }
                            break;

                        case 'fields':
                            if (request.database && request.bundle) {
                                await this.expandFields(
                                    request.database,
                                    request.bundle,
                                    context,
                                    serverApi
                                );
                            }
                            break;
                    }
                } catch (error) {
                    console.error('Background load error:', error);
                }
            }

            // Continue processing if queue has more items
            if (this.loadQueue.length > 0) {
                this.backgroundLoadTimer = setTimeout(() => {
                    this.processLoadQueue(context, serverApi);
                }, this.config.backgroundLoadDelay);
            }
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Load bundle from server
     */
    private async loadBundleFromServer(
        database: string,
        bundleName: string,
        serverApi: SchemaServerApi | null
    ): Promise<BundleDefinition | null> {
        if (!serverApi) return null;
        try {
            const bundleData = await serverApi.getBundle(database, bundleName);
            const fields = await serverApi.getFields(database, bundleName);
            const relationships = await serverApi.getRelationships(database, bundleName);

            const fieldMap = new Map<string, FieldDefinition>();
            fields.forEach((f: FieldDefinition) => fieldMap.set(f.name, f));

            const relMap = new Map<string, Relationship>();
            relationships.forEach((r: Relationship) => relMap.set(r.name, r));

            return {
                name: bundleName,
                database,
                fields: fieldMap,
                relationships: relMap,
                indexes: bundleData.indexes || []
            };
        } catch (error) {
            console.error(`Server load failed for bundle ${bundleName}:`, error);
            return null;
        }
    }

    /**
     * Load fields from server
     */
    private async loadFieldsFromServer(
        database: string,
        bundleName: string,
        serverApi: SchemaServerApi | null
    ): Promise<FieldDefinition[]> {
        if (!serverApi) return [];
        try {
            return await serverApi.getFields(database, bundleName);
        } catch (error) {
            console.error(`Server load failed for fields in ${bundleName}:`, error);
            return [];
        }
    }

    /**
     * Check if cache entry is stale
     */
    private isCacheStale<T>(entry: CacheEntry<T>): boolean {
        const age = Date.now() - entry.timestamp;
        return age > this.config.cacheTTL;
    }

    /**
     * Evict old cache entries when cache is full
     */
    private evictOldCacheEntries(): void {
        // Evict from bundle cache
        if (this.bundleCache.size > this.config.cacheSize) {
            const entries = Array.from(this.bundleCache.entries());
            
            // Sort by access count (ascending) and timestamp (ascending)
            entries.sort((a, b) => {
                if (a[1].accessCount !== b[1].accessCount) {
                    return a[1].accessCount - b[1].accessCount;
                }
                return a[1].timestamp - b[1].timestamp;
            });

            // Remove oldest/least accessed
            const toRemove = Math.ceil(this.config.cacheSize * 0.2); // Remove 20%
            for (let i = 0; i < toRemove; i++) {
                this.bundleCache.delete(entries[i][0]);
            }
        }

        // Evict from field cache
        if (this.fieldCache.size > this.config.cacheSize) {
            const entries = Array.from(this.fieldCache.entries());
            
            entries.sort((a, b) => {
                if (a[1].accessCount !== b[1].accessCount) {
                    return a[1].accessCount - b[1].accessCount;
                }
                return a[1].timestamp - b[1].timestamp;
            });

            const toRemove = Math.ceil(this.config.cacheSize * 0.2);
            for (let i = 0; i < toRemove; i++) {
                this.fieldCache.delete(entries[i][0]);
            }
        }
    }

    /**
     * Set prefetch strategy
     */
    setPrefetchStrategy(strategy: PrefetchStrategy): void {
        this.config.prefetchStrategy = strategy;
    }

    /**
     * Get prefetch strategy
     */
    getPrefetchStrategy(): PrefetchStrategy {
        return this.config.prefetchStrategy;
    }

    /**
     * Clear all caches
     */
    clearCache(): void {
        this.bundleCache.clear();
        this.fieldCache.clear();
        this.loadQueue = [];
        
        if (this.backgroundLoadTimer) {
            clearTimeout(this.backgroundLoadTimer);
            this.backgroundLoadTimer = null;
        }
    }

    /**
     * Get cache statistics
     */
    getCacheStats(): {
        bundleCacheSize: number;
        fieldCacheSize: number;
        queueLength: number;
        isLoading: boolean;
    } {
        return {
            bundleCacheSize: this.bundleCache.size,
            fieldCacheSize: this.fieldCache.size,
            queueLength: this.loadQueue.length,
            isLoading: this.isLoading
        };
    }

    /**
     * Get most accessed cache entries
     */
    getMostAccessed(limit: number = 10): Array<{ key: string; accessCount: number }> {
        const bundleEntries = Array.from(this.bundleCache.entries()).map(([key, entry]) => ({
            key,
            accessCount: entry.accessCount
        }));

        const fieldEntries = Array.from(this.fieldCache.entries()).map(([key, entry]) => ({
            key,
            accessCount: entry.accessCount
        }));

        const allEntries = [...bundleEntries, ...fieldEntries];
        allEntries.sort((a, b) => b.accessCount - a.accessCount);

        return allEntries.slice(0, limit);
    }

    /**
     * Warm up cache with frequently used bundles
     */
    async warmupCache(
        database: string,
        bundleNames: string[],
        context: DocumentContext,
        serverApi: SchemaServerApi | null
    ): Promise<void> {
        const promises = bundleNames.map(bundleName =>
            this.expandBundle(database, bundleName, context, serverApi)
        );

        await Promise.all(promises);
    }
}
