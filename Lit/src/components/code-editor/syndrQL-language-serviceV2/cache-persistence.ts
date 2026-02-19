/**
 * Cache Persistence System
 * Handles background persistence of statement cache to disk
 */

import { CachedStatement, CacheMetrics } from './statement-cache.js';
import { AppConfig } from '../../../config/config-types.js';
// Import for Window.electronAPI global type
import '../../../types/electron-api';

/**
 * Cache index structure
 */
interface CacheIndex {
    version: string;
    documents: Array<{
        documentId: string;
        filename: string;
        timestamp: number;
    }>;
}

/**
 * Persisted cache data
 */
interface PersistedCache {
    version: string;
    documentId: string;
    timestamp: number;
    statements: Array<CachedStatement>;
    metrics: CacheMetrics;
}

/**
 * Cache format version for compatibility checking
 */
const CACHE_FORMAT_VERSION = '1.0.0';

/**
 * Cache Persistence Manager
 */
export class CachePersistence {
    private config: AppConfig;
    private persistenceTimer: number | null = null;
    private cacheDirectory: string = '.cache';
    private isShuttingDown: boolean = false;

    constructor(config: AppConfig) {
        this.config = config;
    }

    /**
     * Start background persistence worker
     */
    startPersistenceWorker(getStatements: (documentId: string) => Map<string, CachedStatement>, getMetrics: (documentId: string) => CacheMetrics, documentIds: () => string[]): void {
        if (this.persistenceTimer) {
            console.warn('⚠️ Persistence worker already running');
            return;
        }

        const interval = this.config.languageService.cachePersistenceInterval;
        
        this.persistenceTimer = window.setInterval(async () => {
            if (!this.isShuttingDown) {
                await this.persistAllCaches(getStatements, getMetrics, documentIds);
            }
        }, interval);

        console.log(`✅ Cache persistence worker started (interval: ${interval}ms)`);
    }

    /**
     * Stop persistence worker
     */
    stopPersistenceWorker(): void {
        if (this.persistenceTimer) {
            clearInterval(this.persistenceTimer);
            this.persistenceTimer = null;
            console.log('✅ Cache persistence worker stopped');
        }
    }

    /**
     * Load cache from disk for a document
     */
    async loadCacheFromDisk(documentId: string): Promise<{ statements: Map<string, CachedStatement>; metrics: CacheMetrics } | null> {
        try {
            // Check if we have electron API available
            if (typeof window === 'undefined' || !window.electronAPI) {
                console.warn('⚠️ Electron API not available, skipping cache load');
                return null;
            }

            // Read cache index
            const indexPath = `${this.cacheDirectory}/cache-index.json`;
            const indexData = await window.electronAPI!.readFile!(indexPath);
            const index: CacheIndex = JSON.parse(indexData);

            // Check version compatibility
            if (index.version !== CACHE_FORMAT_VERSION) {
                console.warn(`⚠️ Cache format version mismatch (expected ${CACHE_FORMAT_VERSION}, found ${index.version}), rebuilding cache`);
                await this.deleteCacheDirectory();
                return null;
            }

            // Find document in index
            const docEntry = index.documents.find(d => d.documentId === documentId);
            if (!docEntry) {
                return null;
            }

            // Load cache file
            const cachePath = `${this.cacheDirectory}/${docEntry.filename}`;
            const cacheData = await window.electronAPI!.readFile!(cachePath);
            const persistedCache: PersistedCache = JSON.parse(cacheData);

            // Convert array back to Map
            const statements = new Map<string, CachedStatement>();
            for (const stmt of persistedCache.statements) {
                statements.set(stmt.hash, stmt);
            }

            console.log(`✅ Loaded ${statements.size} cached statements for document ${documentId}`);
            
            return {
                statements,
                metrics: persistedCache.metrics
            };
        } catch (error) {
            console.error('❌ Error loading cache from disk:', error);
            // If cache is corrupted, delete and start fresh
            await this.deleteCacheDirectory();
            return null;
        }
    }

    /**
     * Persist all caches to disk
     */
    private async persistAllCaches(
        getStatements: (documentId: string) => Map<string, CachedStatement>,
        getMetrics: (documentId: string) => CacheMetrics,
        documentIds: () => string[]
    ): Promise<void> {
        try {
            if (typeof window === 'undefined' || !window.electronAPI) {
                return;
            }

            const ids = documentIds();
            if (ids.length === 0) {
                return; // Nothing to persist
            }

            // Create cache directory if it doesn't exist
            await window.electronAPI!.createDirectory!(this.cacheDirectory);

            const index: CacheIndex = {
                version: CACHE_FORMAT_VERSION,
                documents: []
            };

            // Persist each document cache
            for (const documentId of ids) {
                const statements = getStatements(documentId);
                const metrics = getMetrics(documentId);

                if (statements.size === 0) {
                    continue; // Skip empty caches
                }

                // Generate filename
                const filename = this.generateCacheFilename(documentId);
                
                // Convert Map to Array for JSON serialization
                const statementsArray = Array.from(statements.values());

                const persistedCache: PersistedCache = {
                    version: CACHE_FORMAT_VERSION,
                    documentId,
                    timestamp: Date.now(),
                    statements: statementsArray,
                    metrics
                };

                // Write cache file
                const cachePath = `${this.cacheDirectory}/${filename}`;
                await window.electronAPI!.writeFile!(cachePath, JSON.stringify(persistedCache, null, 2));

                // Add to index
                index.documents.push({
                    documentId,
                    filename,
                    timestamp: Date.now()
                });
            }

            // Write index file
            const indexPath = `${this.cacheDirectory}/cache-index.json`;
            await window.electronAPI!.writeFile!(indexPath, JSON.stringify(index, null, 2));

            console.log(`💾 Persisted cache for ${ids.length} documents`);
        } catch (error) {
            console.error('❌ Error persisting cache:', error);
        }
    }

    /**
     * Shutdown persistence with final save
     */
    async shutdown(
        getStatements: (documentId: string) => Map<string, CachedStatement>,
        getMetrics: (documentId: string) => CacheMetrics,
        documentIds: () => string[]
    ): Promise<void> {
        this.isShuttingDown = true;
        this.stopPersistenceWorker();
        
        console.log('💾 Final cache persistence before shutdown...');
        await this.persistAllCaches(getStatements, getMetrics, documentIds);
        console.log('✅ Cache persistence shutdown complete');
    }

    /**
     * Delete cache for specific document
     */
    async deleteCacheForDocument(documentId: string): Promise<void> {
        try {
            if (typeof window === 'undefined' || !window.electronAPI) {
                return;
            }

            const filename = this.generateCacheFilename(documentId);
            const cachePath = `${this.cacheDirectory}/${filename}`;
            
            await window.electronAPI!.deleteFile!(cachePath);
            console.log(`🗑️ Deleted cache for document ${documentId}`);
        } catch (error) {
            console.error('❌ Error deleting cache:', error);
        }
    }

    /**
     * Delete entire cache directory
     */
    private async deleteCacheDirectory(): Promise<void> {
        try {
            if (typeof window === 'undefined' || !window.electronAPI) {
                return;
            }

            await window.electronAPI!.deleteDirectory!(this.cacheDirectory);
            console.log('🗑️ Deleted cache directory');
        } catch (error) {
            console.error('❌ Error deleting cache directory:', error);
        }
    }

    /**
     * Generate cache filename for document
     */
    private generateCacheFilename(documentId: string): string {
        // Create safe filename from documentId
        const safeId = documentId.replace(/[^a-zA-Z0-9-_]/g, '_');
        const hash = this.simpleHash(documentId);
        return `document-${safeId}-cache-${hash}.json`;
    }

    /**
     * Simple hash function for filename generation
     */
    private simpleHash(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36).substring(0, 8);
    }
}
