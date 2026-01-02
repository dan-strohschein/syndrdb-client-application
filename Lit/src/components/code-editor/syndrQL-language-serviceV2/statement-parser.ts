/**
 * Statement Parser for SyndrQL Language Service V2
 * Parses documents into individual statements and manages validation queue
 */

import { Token } from './tokenizer.js';
import { TokenType } from './token_types.js';
import { StatementCache, CachedStatement, StatementError } from './statement-cache.js';
import { AppConfig } from '../../../config/config-types.js';

/**
 * Parsed statement with metadata
 */
export interface ParsedStatement {
    text: string;
    hash: string;
    tokens: Token[];
    startLine: number;
    endLine: number;
    startPosition: number;
    endPosition: number;
}

/**
 * Validation queue entry
 */
interface ValidationQueueEntry {
    documentId: string;
    statementHash: string;
    statement: ParsedStatement;
    priority: number;
}

/**
 * Statement Parser with debounced validation
 */
export class StatementParser {
    private config: AppConfig;
    private cache: StatementCache;
    private validationQueue: Map<string, ValidationQueueEntry[]> = new Map();
    private validationTimers: Map<string, number> = new Map();
    private onValidationNeeded?: (documentId: string, statements: ParsedStatement[]) => Promise<void>;

    constructor(config: AppConfig, cache: StatementCache) {
        this.config = config;
        this.cache = cache;
    }

    /**
     * Set validation callback
     */
    setValidationCallback(callback: (documentId: string, statements: ParsedStatement[]) => Promise<void>): void {
        this.onValidationNeeded = callback;
    }

    /**
     * Parse document into statements
     */
    parseDocument(documentId: string, text: string, tokens: Token[]): ParsedStatement[] {
        const statements: ParsedStatement[] = [];
        let currentStatement: Token[] = [];
        let startLine = 1;
        let startPosition = 0;
        let statementText = '';
        let textStartPos = 0;
        let hasSeenNonCommentToken = false;

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            
            // Skip comments and whitespace entirely - they don't belong to statements
            if (token.Type === TokenType.TOKEN_COMMENT ||
                token.Type === TokenType.TOKEN_WHITESPACE ||
                token.Type === TokenType.TOKEN_NEWLINE) {
                continue;
            }

            // First real token starts a new statement
            if (!hasSeenNonCommentToken || currentStatement.length === 0) {
                startLine = token.Line;
                startPosition = token.StartPosition;
                textStartPos = token.StartPosition;
                hasSeenNonCommentToken = true;
            }

            currentStatement.push(token);

            // Check for statement terminator (semicolon)
            if (token.Value === ';') {
                // Reconstruct statement text from tokens
                const endPosition = token.EndPosition;
                statementText = currentStatement.map(t => t.Value).join(' ').trim();

                if (statementText.length > 0) {
                    const statement: ParsedStatement = {
                        text: statementText,
                        hash: StatementCache.generateHash(statementText),
                        tokens: [...currentStatement],
                        startLine,
                        endLine: token.Line,
                        startPosition: textStartPos,
                        endPosition
                    };

                    statements.push(statement);
                }

                // Reset for next statement
                currentStatement = [];
                textStartPos = endPosition;
                if (i + 1 < tokens.length) {
                    startLine = tokens[i + 1].Line;
                    startPosition = tokens[i + 1].StartPosition;
                }
            }
        }

        // Handle incomplete statement (no semicolon at end)
        if (currentStatement.length > 0) {
            const lastToken = currentStatement[currentStatement.length - 1];
            
            // Reconstruct statement text from tokens
            statementText = currentStatement.map(t => t.Value).join(' ').trim();

            if (statementText.length > 0) {
                const statement: ParsedStatement = {
                    text: statementText,
                    hash: StatementCache.generateHash(statementText),
                    tokens: [...currentStatement],
                    startLine,
                    endLine: lastToken.Line,
                    startPosition: textStartPos,
                    endPosition: lastToken.EndPosition
                };

                statements.push(statement);
            }
        }

        return statements;
    }

    /**
     * Handle text change and mark statements dirty
     */
    onTextChange(documentId: string, text: string, tokens: Token[]): void {
        // Parse statements
        const statements = this.parseDocument(documentId, text, tokens);

        // Mark all statements as dirty and update cache
        for (const statement of statements) {
            const existing = this.cache.get(documentId, statement.hash);

            if (existing) {
                // Statement exists, mark as dirty
                this.cache.markDirty(documentId, statement.hash);
            } else {
                // New statement, add to cache as dirty
                this.cache.put(documentId, statement.hash, {
                    text: statement.text,
                    isValid: false,
                    isDirty: true,
                    timestamp: Date.now(),
                    errors: []
                });
            }

            // Add to validation queue
            this.enqueueValidation(documentId, statement);
        }

        // Trigger debounced validation
        this.triggerDebouncedValidation(documentId);
    }

    /**
     * Enqueue statement for validation
     */
    private enqueueValidation(documentId: string, statement: ParsedStatement, priority: number = 0): void {
        let queue = this.validationQueue.get(documentId);

        if (!queue) {
            queue = [];
            this.validationQueue.set(documentId, queue);
        }

        // Check if already in queue
        const exists = queue.find(entry => entry.statementHash === statement.hash);
        if (exists) {
            // Update priority if higher
            if (priority > exists.priority) {
                exists.priority = priority;
            }
            return;
        }

        // Add to queue
        queue.push({
            documentId,
            statementHash: statement.hash,
            statement,
            priority
        });

        // Sort by priority (higher first)
        queue.sort((a, b) => b.priority - a.priority);
    }

    /**
     * Trigger debounced validation
     */
    private triggerDebouncedValidation(documentId: string): void {
        // Clear existing timer
        const existingTimer = this.validationTimers.get(documentId);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        // Set new timer
        const delay = this.config.languageService.validationDebounceDelay;
        const timer = window.setTimeout(() => {
            this.processValidationQueue(documentId);
        }, delay);

        this.validationTimers.set(documentId, timer);
    }

    /**
     * Process validation queue for document
     */
    private async processValidationQueue(documentId: string): Promise<void> {
        const queue = this.validationQueue.get(documentId);

        if (!queue || queue.length === 0) {
            return;
        }

        // Get dirty statements from cache
        const dirtyStatements = this.cache.getDirtyStatements(documentId);

        if (dirtyStatements.length === 0) {
            // Clear queue
            this.validationQueue.delete(documentId);
            return;
        }

        // Extract parsed statements from queue
        const statements = queue
            .filter(entry => dirtyStatements.some(d => d.hash === entry.statementHash))
            .map(entry => entry.statement);

        if (statements.length > 0 && this.onValidationNeeded) {
            try {
                await this.onValidationNeeded(documentId, statements);
            } catch (error) {
                console.error('❌ Validation error:', error);
            }
        }

        // Clear processed items from queue
        this.validationQueue.delete(documentId);
    }

    /**
     * Force immediate validation (bypass debounce)
     */
    async forceValidation(documentId: string): Promise<void> {
        // Cancel debounce timer
        const timer = this.validationTimers.get(documentId);
        if (timer) {
            clearTimeout(timer);
            this.validationTimers.delete(documentId);
        }

        // Process immediately
        await this.processValidationQueue(documentId);
    }

    /**
     * Get validation queue status
     */
    getQueueStatus(documentId: string): { pending: number; dirty: number } {
        const queue = this.validationQueue.get(documentId);
        const dirty = this.cache.getDirtyStatements(documentId);

        return {
            pending: queue?.length || 0,
            dirty: dirty.length
        };
    }

    /**
     * Clear validation queue for document
     */
    clearQueue(documentId: string): void {
        const timer = this.validationTimers.get(documentId);
        if (timer) {
            clearTimeout(timer);
            this.validationTimers.delete(documentId);
        }

        this.validationQueue.delete(documentId);
    }
}
