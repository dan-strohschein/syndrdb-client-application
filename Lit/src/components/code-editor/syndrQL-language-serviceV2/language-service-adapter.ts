/**
 * Language Service V2 Adapter
 * Provides backward compatibility layer for migrating from old service to V2
 */

import { LanguageServiceV2, ValidationResult, type FormatOptions } from './language-service-v2';
import type { AppConfig } from '../../../config/config-types';
import type { Token as SyntaxToken } from './tokenizer';
import type { Suggestion } from './suggestion-engine';

/**
 * Old grammar validator result format (for compatibility)
 */
export interface LegacyValidationResult {
    isValid: boolean;
    invalidTokens: Set<number>;
    errorDetails?: Array<{
        code: string;
        message: string;
        line: number;
        column: number;
        source: string;
        suggestion?: string;
    }>;
}

/**
 * Adapter that wraps V2 service and provides old API
 */
export class LanguageServiceAdapter {
    private serviceV2: LanguageServiceV2;
    private initialized = false;

    constructor(config: AppConfig) {
        this.serviceV2 = new LanguageServiceV2(config);
    }

    /**
     * Initialize both old and new services
     */
    async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }

        await this.serviceV2.initialize();
        this.initialized = true;
    }

    /**
     * Validate tokens using V2 service (old API format)
     * 
     * @param tokens - Array of syntax tokens
     * @param lineOffset - Line offset for error reporting
     * @returns Legacy validation result
     */
    async validate(tokens: SyntaxToken[], lineOffset: number = 0): Promise<LegacyValidationResult> {
        // Convert tokens to code string
        const code = tokens.map(t => t.Value).join('');
        
        // Validate using V2
        const result = await this.serviceV2.validate(code);
        
        // Convert to legacy format
        return this.convertToLegacyResult(result, tokens, lineOffset);
    }

    /**
     * Get suggestions (new API)
     */
    async getSuggestions(code: string, cursorPosition: number, filterText?: string): Promise<Suggestion[]> {
        return this.serviceV2.getSuggestions(code, cursorPosition, filterText);
    }

    /**
     * Refresh context from server
     */
    async refreshContext(): Promise<void> {
        return this.serviceV2.refreshContext();
    }

    /**
     * Set current database
     */
    setCurrentDatabase(database: string | null): void {
        this.serviceV2.setCurrentDatabase(database);
    }

    /**
     * Get service statistics
     */
    getStatistics() {
        return this.serviceV2.getStatistics();
    }

    /**
     * Format code
     */
    format(code: string, options?: FormatOptions): string {
        return this.serviceV2.format(code, options);
    }

    /**
     * Clear caches
     */
    clearCaches(): void {
        this.serviceV2.clearCaches();
    }

    /**
     * Record suggestion usage
     */
    recordSuggestionUsage(label: string): void {
        this.serviceV2.recordSuggestionUsage(label);
    }

    /**
     * Check if context is stale
     */
    isContextStale(): boolean {
        return this.serviceV2.isContextStale();
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        this.serviceV2.dispose();
    }

    /**
     * Direct access to V2 service for new features
     */
    getV2Service(): LanguageServiceV2 {
        return this.serviceV2;
    }

    // Private helper methods

    /**
     * Convert V2 validation result to legacy format
     */
    private convertToLegacyResult(
        result: ValidationResult,
        tokens: SyntaxToken[],
        lineOffset: number
    ): LegacyValidationResult {
        const invalidTokens = new Set<number>();
        const errorDetails: Array<{
            code: string;
            message: string;
            line: number;
            column: number;
            source: string;
            suggestion?: string;
        }> = [];

        // Process all errors
        for (const error of result.errors) {
            // Convert position to line/column
            const position = this.positionToLineColumn(error.startPosition, tokens);
            
            // Find affected tokens
            const affectedTokens = this.findTokensAtPosition(tokens, position.line - lineOffset, position.column);
            affectedTokens.forEach(idx => invalidTokens.add(idx));

            // Convert error format
            errorDetails.push({
                code: error.code,
                message: error.message,
                line: position.line - lineOffset,
                column: position.column,
                source: this.extractSourceFromTokens(tokens, position.line - lineOffset, position.column),
                suggestion: error.suggestion
            });
        }

        return {
            isValid: result.valid,
            invalidTokens,
            errorDetails: errorDetails.length > 0 ? errorDetails : undefined
        };
    }

    /**
     * Find token indices at a specific line and column
     */
    private findTokensAtPosition(tokens: SyntaxToken[], line: number, column: number): number[] {
        const indices: number[] = [];
        
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            if (token.Line === line && column >= token.Column && column < token.Column + token.Value.length) {
                indices.push(i);
            }
        }
        
        return indices;
    }

    /**
     * Convert character position to line and column
     */
    private positionToLineColumn(position: number, tokens: SyntaxToken[]): { line: number; column: number } {
        if (tokens.length === 0) {
            return { line: 1, column: 0 };
        }

        // Reconstruct the text to find line/column from position
        const text = tokens.map(t => t.Value).join('');
        let currentLine = 1;
        let currentColumn = 0;

        for (let i = 0; i < Math.min(position, text.length); i++) {
            if (text[i] === '\n') {
                currentLine++;
                currentColumn = 0;
            } else {
                currentColumn++;
            }
        }

        return { line: currentLine, column: currentColumn };
    }

    /**
     * Extract source text from tokens at position
     */
    private extractSourceFromTokens(tokens: SyntaxToken[], line: number, column: number): string {
        const lineTokens = tokens.filter(t => t.Line === line);
        if (lineTokens.length === 0) {
            return '';
        }

        // Find the token or closest token
        const token = lineTokens.find(t => column >= t.Column && column < t.Column + t.Value.length);
        return token ? token.Value : lineTokens[0].Value;
    }
}

/**
 * Create and initialize adapter
 */
export async function createLanguageServiceAdapter(config: AppConfig): Promise<LanguageServiceAdapter> {
    const adapter = new LanguageServiceAdapter(config);
    await adapter.initialize();
    return adapter;
}
