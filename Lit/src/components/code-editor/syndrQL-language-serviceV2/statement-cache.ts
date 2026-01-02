/**
 * Statement Cache System for SyndrQL Language Service V2
 * Implements LRU cache with access-weighted eviction for per-document statement caching
 */

import { AppConfig } from '../../../config/config-types.js';

/**
 * Cached statement with validation state and metadata
 */
export interface CachedStatement {
    text: string;
    hash: string;
    isValid: boolean;
    isDirty: boolean;
    timestamp: number;
    accessCount: number;
    lastAccessTime: number;
    errors: StatementError[];
    byteSize: number;
}

/**
 * Statement error information
 */
export interface StatementError {
    code: string;
    message: string;
    line: number;
    column: number;
    length: number;
}

/**
 * Cache metrics for monitoring
 */
export interface CacheMetrics {
    hitCount: number;
    missCount: number;
    evictionCount: number;
    totalSize: number;
    statementCount: number;
    hitRate: number;
}

/**
 * Statement Cache with LRU and access-frequency weighting
 */
export class StatementCache {
    private caches: Map<string, Map<string, CachedStatement>> = new Map();
    private config: AppConfig;
    private metrics: Map<string, CacheMetrics> = new Map();

    constructor(config: AppConfig) {
        this.config = config;
    }

    /**
     * Get statement from cache
     */
    get(documentId: string, statementHash: string): CachedStatement | null {
        const cache = this.getOrCreateCache(documentId);
        const statement = cache.get(statementHash);

        if (statement) {
            // Update access metadata
            statement.accessCount++;
            statement.lastAccessTime = Date.now();
            
            // Update metrics
            const metrics = this.getOrCreateMetrics(documentId);
            metrics.hitCount++;
            this.updateHitRate(documentId);
            
            return statement;
        }

        // Cache miss
        const metrics = this.getOrCreateMetrics(documentId);
        metrics.missCount++;
        this.updateHitRate(documentId);
        
        return null;
    }

    /**
     * Put statement into cache
     */
    put(documentId: string, statementHash: string, statement: Omit<CachedStatement, 'hash' | 'accessCount' | 'lastAccessTime' | 'byteSize'>): void {
        const cache = this.getOrCreateCache(documentId);
        
        // Calculate byte size (approximate)
        const byteSize = this.calculateByteSize(statement.text);
        
        const cachedStatement: CachedStatement = {
            ...statement,
            hash: statementHash,
            accessCount: 1,
            lastAccessTime: Date.now(),
            byteSize
        };

        // Check if we need to evict
        const currentSize = this.getCacheSize(documentId);
        const maxSize = this.config.languageService.statementCacheBufferSize;
        
        if (currentSize + byteSize > maxSize) {
            this.evict(documentId, byteSize);
        }

        cache.set(statementHash, cachedStatement);
        
        // Update metrics
        const metrics = this.getOrCreateMetrics(documentId);
        metrics.statementCount = cache.size;
        metrics.totalSize = this.getCacheSize(documentId);
    }

    /**
     * Mark statement as dirty (needs revalidation)
     */
    markDirty(documentId: string, statementHash: string): boolean {
        const cache = this.getOrCreateCache(documentId);
        const statement = cache.get(statementHash);
        
        if (statement) {
            statement.isDirty = true;
            return true;
        }
        
        return false;
    }

    /**
     * Mark statement as clean (validation complete)
     */
    markClean(documentId: string, statementHash: string, isValid: boolean, errors: StatementError[] = []): boolean {
        const cache = this.getOrCreateCache(documentId);
        const statement = cache.get(statementHash);
        
        if (statement) {
            statement.isDirty = false;
            statement.isValid = isValid;
            statement.errors = errors;
            statement.timestamp = Date.now();
            return true;
        }
        
        return false;
    }

    /**
     * Get all dirty statements for a document
     */
    getDirtyStatements(documentId: string): Array<{ hash: string; statement: CachedStatement }> {
        const cache = this.getOrCreateCache(documentId);
        const dirty: Array<{ hash: string; statement: CachedStatement }> = [];
        
        for (const [hash, statement] of cache.entries()) {
            if (statement.isDirty) {
                dirty.push({ hash, statement });
            }
        }
        
        return dirty;
    }

    /**
     * Get all statements for a document
     */
    getAllStatements(documentId: string): Map<string, CachedStatement> {
        return this.getOrCreateCache(documentId);
    }

    /**
     * Clear cache for a document
     */
    clear(documentId: string): void {
        this.caches.delete(documentId);
        this.metrics.delete(documentId);
    }

    /**
     * Clear cache for a document (alias for clear)
     */
    clearDocument(documentId: string): void {
        this.clear(documentId);
    }

    /**
     * Get cache metrics for a document (or global metrics)
     */
    getMetrics(documentId?: string): CacheMetrics {
        if (documentId) {
            return this.getOrCreateMetrics(documentId);
        }
        
        // Return aggregated metrics for all documents
        let totalHits = 0;
        let totalMisses = 0;
        let totalEvictions = 0;
        let totalStatements = 0;
        let totalSize = 0;
        
        for (const metrics of this.metrics.values()) {
            totalHits += metrics.hitCount;
            totalMisses += metrics.missCount;
            totalEvictions += metrics.evictionCount;
            totalStatements += metrics.statementCount;
            totalSize += metrics.totalSize;
        }
        
        const totalAccess = totalHits + totalMisses;
        const hitRate = totalAccess > 0 ? totalHits / totalAccess : 0;
        
        return {
            hitCount: totalHits,
            missCount: totalMisses,
            evictionCount: totalEvictions,
            statementCount: totalStatements,
            totalSize,
            hitRate
        };
    }

    /**
     * Evict statements based on weighted score
     */
    private evict(documentId: string, requiredSpace: number): void {
        const cache = this.getOrCreateCache(documentId);
        const metrics = this.getOrCreateMetrics(documentId);
        const weightFactor = this.config.languageService.cacheAccessWeightFactor;
        
        // Calculate eviction scores for all statements
        const scores: Array<{ hash: string; score: number; size: number }> = [];
        const now = Date.now();
        
        for (const [hash, statement] of cache.entries()) {
            // Recency factor: older statements get higher scores (more likely to evict)
            const ageMs = now - statement.lastAccessTime;
            const recencyFactor = ageMs / (1000 * 60); // Age in minutes
            
            // Eviction score = (size / accessCount) * recencyFactor * weightFactor
            // Higher score = more likely to evict
            const accessFactor = Math.max(1, statement.accessCount);
            const score = (statement.byteSize / accessFactor) * recencyFactor * weightFactor;
            
            scores.push({ hash, score, size: statement.byteSize });
        }
        
        // Sort by score (descending) - highest score evicted first
        scores.sort((a, b) => b.score - a.score);
        
        // Evict until we have enough space
        let freedSpace = 0;
        let evicted = 0;
        
        for (const { hash, size } of scores) {
            cache.delete(hash);
            freedSpace += size;
            evicted++;
            
            if (freedSpace >= requiredSpace) {
                break;
            }
        }
        
        // Update metrics
        metrics.evictionCount += evicted;
        metrics.statementCount = cache.size;
        metrics.totalSize = this.getCacheSize(documentId);
        
        console.log(`📦 Evicted ${evicted} statements (${this.formatBytes(freedSpace)}) from document ${documentId}`);
    }

    /**
     * Calculate current cache size for a document
     */
    private getCacheSize(documentId: string): number {
        const cache = this.getOrCreateCache(documentId);
        let totalSize = 0;
        
        for (const statement of cache.values()) {
            totalSize += statement.byteSize;
        }
        
        return totalSize;
    }

    /**
     * Calculate byte size of a string
     */
    private calculateByteSize(text: string): number {
        // Approximate: UTF-16 uses 2 bytes per character
        // Add overhead for object structure
        return (text.length * 2) + 200; // 200 bytes for metadata overhead
    }

    /**
     * Get or create cache for a document
     */
    private getOrCreateCache(documentId: string): Map<string, CachedStatement> {
        let cache = this.caches.get(documentId);
        
        if (!cache) {
            cache = new Map();
            this.caches.set(documentId, cache);
        }
        
        return cache;
    }

    /**
     * Get or create metrics for a document
     */
    private getOrCreateMetrics(documentId: string): CacheMetrics {
        let metrics = this.metrics.get(documentId);
        
        if (!metrics) {
            metrics = {
                hitCount: 0,
                missCount: 0,
                evictionCount: 0,
                totalSize: 0,
                statementCount: 0,
                hitRate: 0
            };
            this.metrics.set(documentId, metrics);
        }
        
        return metrics;
    }

    /**
     * Update hit rate calculation
     */
    private updateHitRate(documentId: string): void {
        const metrics = this.getOrCreateMetrics(documentId);
        const total = metrics.hitCount + metrics.missCount;
        metrics.hitRate = total > 0 ? metrics.hitCount / total : 0;
    }

    /**
     * Format bytes for display
     */
    private formatBytes(bytes: number): string {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }

    /**
     * Generate hash for statement text
     */
    static generateHash(text: string): string {
        // Simple hash function for statement identification
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36);
    }
}
