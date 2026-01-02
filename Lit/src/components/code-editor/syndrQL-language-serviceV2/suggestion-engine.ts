/**
 * Suggestion Engine for SyndrQL Language Service V2
 * Provides grammar-based and context-aware auto-completion suggestions
 * Implements priority ranking, fuzzy matching, and pre-fetching
 */

import type { Token } from './tokenizer';
import type { DocumentContext } from './document-context';
import { grammarEngine } from './grammar_engine';
import type { AppConfig } from '../../../config/config-types';

/**
 * Suggestion item with metadata
 */
export interface Suggestion {
    label: string;
    kind: SuggestionKind;
    detail?: string;
    documentation?: string;
    insertText?: string;
    priority: number;
    sortText?: string;
}

/**
 * Suggestion kinds (categories)
 */
export enum SuggestionKind {
    KEYWORD = 'keyword',
    DATABASE = 'database',
    BUNDLE = 'bundle',
    FIELD = 'field',
    USER = 'user',
    FUNCTION = 'function',
    OPERATOR = 'operator',
    VALUE = 'value',
    SNIPPET = 'snippet',
    RELATIONSHIP = 'relationship',
    PERMISSION = 'permission'
}

/**
 * Suggestion context for filtering
 */
interface SuggestionContext {
    statementType?: string;
    currentClause?: string;
    precedingTokens: Token[];
    cursorPosition: number;
}

/**
 * Fuzzy match result
 */
interface FuzzyMatchResult {
    matched: boolean;
    score: number;
}

/**
 * LRU cache for suggestions
 */
class SuggestionCache {
    private cache: Map<string, { suggestions: Suggestion[]; timestamp: number }> = new Map();
    private maxSize: number;
    private ttl: number; // Time-to-live in milliseconds

    constructor(maxSize: number = 100, ttl: number = 60000) {
        this.maxSize = maxSize;
        this.ttl = ttl;
    }

    get(key: string): Suggestion[] | null {
        const entry = this.cache.get(key);
        if (!entry) return null;

        // Check if entry is still valid
        if (Date.now() - entry.timestamp > this.ttl) {
            this.cache.delete(key);
            return null;
        }

        // Move to end (mark as recently used)
        this.cache.delete(key);
        this.cache.set(key, entry);
        
        return entry.suggestions;
    }

    set(key: string, suggestions: Suggestion[]): void {
        // Remove oldest if at capacity
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey || "");
        }

        this.cache.set(key, {
            suggestions,
            timestamp: Date.now()
        });
    }

    clear(): void {
        this.cache.clear();
    }

    size(): number {
        return this.cache.size;
    }
}

/**
 * Suggestion engine with grammar-based and context-aware suggestions
 */
export class SuggestionEngine {
    private cache: SuggestionCache;
    private config: AppConfig;
    private recentlyUsed: Map<string, number> = new Map(); // Track usage frequency

    constructor(config: AppConfig) {
        this.config = config;
        this.cache = new SuggestionCache(100, 60000); // 100 items, 1 minute TTL
    }

    /**
     * Get suggestions at cursor position
     */
    async getSuggestions(
        tokens: Token[],
        cursorPosition: number,
        context: DocumentContext,
        statementText: string
    ): Promise<Suggestion[]> {
        // Detect partial input at cursor position
        const partialInput = this.getPartialInputAtCursor(statementText, cursorPosition);
        
        // Generate cache key (include partial input for more specific caching)
        const cacheKey = this.generateCacheKey(tokens, cursorPosition, statementText + partialInput);
        
        // Check cache first
        const cached = this.cache.get(cacheKey);
        if (cached) {
            return cached;
        }

        // Build suggestion context
        const suggestionContext = this.buildSuggestionContext(tokens, cursorPosition);

        // Gather suggestions from multiple sources
        const suggestions: Suggestion[] = [];

        // 1. Grammar-based suggestions (including contextual references)
        const grammarSuggestions = await this.getGrammarSuggestions(tokens, cursorPosition, context);
        
        // Check if we're expecting a literal value (grammar returned empty due to literal filtering)
        // If so, don't add any other suggestions - the user needs to type a value
        if (grammarSuggestions.length === 0 && this.isExpectingLiteral(tokens, cursorPosition)) {
            this.cache.set(cacheKey, []);
            return [];
        }
        
        suggestions.push(...grammarSuggestions);

        // 2. Context-aware suggestions
        const contextSuggestions = await this.getContextSuggestions(
            suggestionContext,
            context
        );
        suggestions.push(...contextSuggestions);

        // 3. Snippet suggestions
        const snippetSuggestions = this.getSnippetSuggestions(suggestionContext);
        suggestions.push(...snippetSuggestions);

        // 4. Operator suggestions
        const operatorSuggestions = this.getOperatorSuggestions(suggestionContext);
        suggestions.push(...operatorSuggestions);

        // Remove duplicates and rank
        const uniqueSuggestions = this.deduplicateSuggestions(suggestions);
        const rankedSuggestions = this.rankSuggestions(uniqueSuggestions, suggestionContext);

        // Filter by partial input if user is typing
        const filteredSuggestions = partialInput 
            ? this.filterSuggestions(rankedSuggestions, partialInput)
            : rankedSuggestions;

        // Cache results
        this.cache.set(cacheKey, filteredSuggestions);

        return filteredSuggestions;
    }

    /**
     * Get partial input at cursor position (what the user is currently typing)
     */
    private getPartialInputAtCursor(text: string, cursorPosition: number): string {
        // Look backward from cursor to find start of current word
        let start = cursorPosition;
        while (start > 0 && /[a-zA-Z_0-9]/.test(text[start - 1])) {
            start--;
        }
        
        // Extract partial word
        const partialInput = text.substring(start, cursorPosition);
        return partialInput;
    }

    /**
     * Get suggestions based on grammar rules
     */
    private async getGrammarSuggestions(tokens: Token[], cursorPosition: number, context: DocumentContext): Promise<Suggestion[]> {
        const suggestions: Suggestion[] = [];
        
        try {
            // Filter out the token at cursor position if cursor is inside it (partial token)
            // We only want complete tokens for grammar analysis
            const completeTokens = tokens.filter(token => {
                // Keep token if cursor is after it (complete token)
                if (token.EndPosition < cursorPosition) {
                    return true;
                }
                // Keep token if cursor is before it (complete token)
                if (token.StartPosition > cursorPosition) {
                    return true;
                }
                // Cursor is inside this token - it's partial, exclude it
                return false;
            });
            
//            console.log('🔍 Grammar suggestions - complete tokens:', completeTokens.map(t => t.Value));
            
            // Use grammar engine to get valid next tokens
            const grammarSuggestionTokens = grammarEngine.getSuggestionsAtPosition(completeTokens, cursorPosition);
            
            // console.log('🔍 [DEBUG] Complete tokens:', completeTokens.map(t => `${t.Value}(${t.Type})`));
            // console.log('🔍 [DEBUG] Grammar suggestions:', grammarSuggestionTokens);
            
            // Filter out "literal" tokens - these are user-defined values that cannot be suggested
            // (strings, numbers, booleans, dates, etc.)
            const filterableSuggestionTokens = grammarSuggestionTokens.filter(token => {
                const lowerToken = token.toLowerCase();
                return lowerToken !== 'literal';
            });
            
            // If all suggestions were filtered out (only literal expected), return empty suggestions
            if (filterableSuggestionTokens.length === 0 && grammarSuggestionTokens.length > 0) {
                return suggestions; // Return empty suggestions array
            }
            
            for (const token of filterableSuggestionTokens) {
                // Check if this is a contextual reference (like bundle_reference, field_reference)
                const contextualSuggestions = await this.resolveContextualReference(token, context, completeTokens);
                
 //               console.log(`🔍 Token "${token}" resolved to ${contextualSuggestions.length} contextual suggestions`);
                
                if (contextualSuggestions.length > 0) {
                    suggestions.push(...contextualSuggestions);
                } else {
                    // Convert token types to keywords
                    const keyword = this.tokenTypeToKeyword(token);
                    if (keyword) {
                        suggestions.push({
                            label: keyword,
                            kind: SuggestionKind.KEYWORD,
                            detail: `SyndrQL keyword`,
                            priority: 80,
                            insertText: keyword
                        });
                    }
                }
            }
            
//            console.log('🔍 Final grammar suggestions:', suggestions.length, suggestions.map(s => s.label));
        } catch (error) {
            console.error('Error getting grammar suggestions:', error);
        }

        return suggestions;
    }

    /**
     * Check if the grammar is expecting a literal value at this position
     * This is determined by checking if the grammar engine returned "literal" as the only option
     */
    private isExpectingLiteral(tokens: Token[], cursorPosition: number): boolean {
        try {
            // Filter out the token at cursor position if cursor is inside it (partial token)
            const completeTokens = tokens.filter(token => {
                if (token.EndPosition < cursorPosition) return true;
                if (token.StartPosition > cursorPosition) return true;
                return false;
            });
            
            // Get what the grammar expects
            const grammarSuggestionTokens = grammarEngine.getSuggestionsAtPosition(completeTokens, cursorPosition);
            
            // Check if the only suggestion is "literal"
            const hasOnlyLiteral = grammarSuggestionTokens.length > 0 && 
                                   grammarSuggestionTokens.every(token => token.toLowerCase() === 'literal');
            
            return hasOnlyLiteral;
        } catch (error) {
            console.error('Error checking for literal expectation:', error);
            return false;
        }
    }

    /**
     * Get context-aware suggestions (databases, bundles, fields)
     * NOTE: Grammar-driven contextual references now handle most of these cases.
     * This method is kept for backward compatibility and edge cases not covered by grammar.
     */
    private async getContextSuggestions(
        suggestionContext: SuggestionContext,
        context: DocumentContext
    ): Promise<Suggestion[]> {
        const suggestions: Suggestion[] = [];
        
        // DISABLED: Grammar-based contextual references now handle these cases
        // The grammar engine with bundle_reference, database_reference, field_reference
        // provides more accurate and context-aware suggestions
        
        // Return empty array - all suggestions now come from grammar
        return suggestions;
        
        /* OLD IMPLEMENTATION - DISABLED
        const currentDatabase = context.getCurrentDatabase();

        // Determine what kind of suggestions are needed based on context
        const precedingToken = suggestionContext.precedingTokens.length > 0
            ? suggestionContext.precedingTokens[suggestionContext.precedingTokens.length - 1]
            : null;

        if (!precedingToken) {
            return suggestions;
        }

        const precedingValue = precedingToken.Value.toUpperCase();

        // Database suggestions
        if (precedingValue === 'DATABASE') {
            const databases = context.getAllDatabases();
            for (const db of databases) {
                suggestions.push({
                    label: db.name,
                    kind: SuggestionKind.DATABASE,
                    detail: `Database`,
                    documentation: `Database: ${db.name}`,
                    priority: 90,
                    insertText: db.name
                });
            }
        }

        // Bundle suggestions
        else if (['FROM', 'TO', 'INTO', 'BUNDLE', 'TABLE', 'COLLECTION'].includes(precedingValue)) {
            if (currentDatabase) {
                const bundles = context.getBundles(currentDatabase);
                for (const bundle of bundles) {
                    const fieldCount = bundle.fields.size;
                    suggestions.push({
                        label: bundle.name,
                        kind: SuggestionKind.BUNDLE,
                        detail: `Bundle (${fieldCount} fields)`,
                        documentation: `Bundle: ${bundle.name} in ${bundle.database}`,
                        priority: 95,
                        insertText: bundle.name
                    });
                }
            }
        }

        // Field suggestions
        else if (['SELECT', 'WHERE', 'SET', 'ORDER', 'GROUP'].includes(precedingValue)) {
            if (currentDatabase) {
                // Get current bundle from FROM clause if available
                const currentBundle = this.extractCurrentBundle(suggestionContext.precedingTokens);
                
                if (currentBundle) {
                    const fields = context.getFields(currentDatabase, currentBundle);
                    for (const field of fields) {
                        suggestions.push({
                            label: field.name,
                            kind: SuggestionKind.FIELD,
                            detail: `Field: ${field.type}`,
                            documentation: `${field.name}: ${field.type}${field.constraints.nullable === false ? ' (NOT NULL)' : ''}${field.constraints.unique ? ' (UNIQUE)' : ''}`,
                            priority: 100,
                            insertText: field.name
                        });
                    }
                }
            }
        }

        // User suggestions
        else if (precedingValue === 'USER') {
            // User suggestions would come from context
            // Placeholder for now
            suggestions.push({
                label: '<username>',
                kind: SuggestionKind.USER,
                detail: 'Username',
                priority: 85,
                insertText: 'username'
            });
        }

        return suggestions;
        */
    }

    /**
     * Get snippet suggestions
     */
    private getSnippetSuggestions(context: SuggestionContext): Suggestion[] {
        const suggestions: Suggestion[] = [];

        // Only suggest snippets at statement start
        if (context.precedingTokens.length > 0) {
            return suggestions;
        }

        const snippets = [
            {
                label: 'CREATE DATABASE',
                insertText: 'CREATE DATABASE ${1:name};',
                detail: 'Create a new database',
                documentation: 'CREATE DATABASE <name>;'
            },
            {
                label: 'CREATE BUNDLE',
                insertText: 'CREATE BUNDLE ${1:name} WITH FIELDS (${2:field_name} ${3:type});',
                detail: 'Create a new bundle with fields',
                documentation: 'CREATE BUNDLE <name> WITH FIELDS (...);'
            },
            {
                label: 'SELECT',
                insertText: 'SELECT ${1:*} FROM ${2:bundle_name};',
                detail: 'Query documents from a bundle',
                documentation: 'SELECT <fields> FROM <bundle>;'
            },
            {
                label: 'ADD',
                insertText: 'ADD TO ${1:bundle_name} { ${2:field}: ${3:value} };',
                detail: 'Insert a document into a bundle',
                documentation: 'ADD TO <bundle> { field: value };'
            },
            {
                label: 'UPDATE',
                insertText: 'UPDATE ${1:bundle_name} SET ${2:field} = ${3:value} WHERE ${4:condition};',
                detail: 'Update documents in a bundle',
                documentation: 'UPDATE <bundle> SET field = value WHERE condition;'
            },
            {
                label: 'DELETE',
                insertText: 'DELETE FROM ${1:bundle_name} WHERE ${2:condition};',
                detail: 'Delete documents from a bundle',
                documentation: 'DELETE FROM <bundle> WHERE condition;'
            },
            {
                label: 'GRANT',
                insertText: 'GRANT ${1:permission} ON ${2:resource} TO USER ${3:username};',
                detail: 'Grant permissions to a user',
                documentation: 'GRANT <permission> ON <resource> TO USER <username>;'
            },
            {
                label: 'MIGRATION',
                insertText: 'MIGRATION ${1:name} {\n\t${2:statements}\n};',
                detail: 'Define a database migration',
                documentation: 'MIGRATION <name> { statements };'
            }
        ];

        for (const snippet of snippets) {
            suggestions.push({
                label: snippet.label,
                kind: SuggestionKind.SNIPPET,
                detail: snippet.detail,
                documentation: snippet.documentation,
                insertText: snippet.insertText,
                priority: 70
            });
        }

        return suggestions;
    }

    /**
     * Get operator suggestions based on context
     */
    private getOperatorSuggestions(context: SuggestionContext): Suggestion[] {
        const suggestions: Suggestion[] = [];

        // Check if we're in a WHERE clause or comparison context
        const inWhereClause = context.precedingTokens.some(
            t => t.Value.toUpperCase() === 'WHERE'
        );

        if (!inWhereClause) {
            return suggestions;
        }

        const operators = [
            { label: '=', detail: 'Equal to' },
            { label: '!=', detail: 'Not equal to' },
            { label: '<', detail: 'Less than' },
            { label: '>', detail: 'Greater than' },
            { label: '<=', detail: 'Less than or equal to' },
            { label: '>=', detail: 'Greater than or equal to' },
            { label: 'AND', detail: 'Logical AND' },
            { label: 'OR', detail: 'Logical OR' },
            { label: 'NOT', detail: 'Logical NOT' },
            { label: 'IN', detail: 'Value in list' },
            { label: 'LIKE', detail: 'Pattern matching' }
        ];

        for (const op of operators) {
            suggestions.push({
                label: op.label,
                kind: SuggestionKind.OPERATOR,
                detail: op.detail,
                priority: 75,
                insertText: op.label
            });
        }

        return suggestions;
    }

    /**
     * Build suggestion context from tokens
     */
    private buildSuggestionContext(tokens: Token[], cursorPosition: number): SuggestionContext {
        // Find tokens before cursor
        const precedingTokens = tokens.filter(t => t.EndPosition <= cursorPosition);
        
        // Determine statement type
        const statementType = precedingTokens.length > 0 
            ? precedingTokens[0].Value.toUpperCase() 
            : undefined;

        // Determine current clause
        const currentClause = this.detectCurrentClause(precedingTokens);

        return {
            statementType,
            currentClause,
            precedingTokens,
            cursorPosition
        };
    }

    /**
     * Detect current SQL clause
     */
    private detectCurrentClause(tokens: Token[]): string | undefined {
        const clauses = ['SELECT', 'FROM', 'WHERE', 'ORDER', 'GROUP', 'SET', 'INTO', 'VALUES'];
        
        // Find last clause keyword
        for (let i = tokens.length - 1; i >= 0; i--) {
            if (clauses.includes(tokens[i].Value.toUpperCase())) {
                return tokens[i].Value.toUpperCase();
            }
        }

        return undefined;
    }

    /**
     * Extract current bundle from FROM clause
     */
    private extractCurrentBundle(tokens: Token[]): string | null {
        for (let i = 0; i < tokens.length; i++) {
            if (tokens[i].Value.toUpperCase() === 'FROM' && i + 1 < tokens.length) {
                // Strip quotes from bundle name
                let bundleName = tokens[i + 1].Value;
                if ((bundleName.startsWith('"') && bundleName.endsWith('"')) ||
                    (bundleName.startsWith("'") && bundleName.endsWith("'"))) {
                    bundleName = bundleName.slice(1, -1);
                }
                return bundleName;
            }
        }
        return null;
    }

    /**
     * Resolve contextual references (like bundle_reference, field_reference) to actual values
     */
    private async resolveContextualReference(
        reference: string,
        context: DocumentContext,
        tokens: Token[]
    ): Promise<Suggestion[]> {
        const suggestions: Suggestion[] = [];

        // Normalize reference name
        const refType = reference.toLowerCase();
        
//        console.log(`🔍 resolveContextualReference called with: "${reference}" -> normalized to "${refType}"`);

        // Handle different types of contextual references
        switch (refType) {
            case 'bundle_reference':
            case 'bundle_name':
            case 'table_name':
            case 'collection_name':
                // Get bundles from current database, or all databases if none selected
                const currentDatabase = context.getCurrentDatabase();
//                console.log(`🔍 Current database:`, currentDatabase);
                
                if (currentDatabase) {
                    // Get bundles from specific database
                    const bundles = context.getBundles(currentDatabase);
                    for (const bundle of bundles) {
                        suggestions.push({
                            label: bundle.name,
                            kind: SuggestionKind.BUNDLE,
                            detail: `Bundle (${bundle.fields.size} fields)`,
                            documentation: `Bundle: ${bundle.name} in ${bundle.database}`,
                            priority: 95,
                            insertText: `"${bundle.name}"`
                        });
                    }
                } else {
                    // No current database - show bundles from ALL databases
//                    console.log(`🔍 No current database set - checking all databases`);
                    const databases = context.getAllDatabases();
 //                   console.log(`🔍 Found ${databases.length} databases`);
                    
                    for (const db of databases) {
                        const bundles = context.getBundles(db.name);
 //                       console.log(`🔍 Found ${bundles.length} bundles in ${db.name}:`, bundles.map(b => b.name));
                        for (const bundle of bundles) {
                            suggestions.push({
                                label: bundle.name,
                                kind: SuggestionKind.BUNDLE,
                                detail: `Bundle in ${bundle.database} (${bundle.fields.size} fields)`,
                                documentation: `Bundle: ${bundle.name} in database ${bundle.database}`,
                                priority: 95,
                                insertText: `"${bundle.name}"`
                            });
                        }
                    }
                }
                break;

            case 'database_reference':
            case 'database_name':
                // Get all databases
                const databases = context.getAllDatabases();
 //               console.log(`🔍 Found ${databases.length} databases:`, databases.map(d => d.name));
                for (const db of databases) {
                    suggestions.push({
                        label: db.name,
                        kind: SuggestionKind.DATABASE,
                        detail: `Database`,
                        documentation: `Database: ${db.name}`,
                        priority: 95,
                        insertText: db.name
                    });
                }
                break;

            case 'field_reference':
            case 'field_name':
            case 'column_name':
                // Get fields from current bundle context (extract from FROM clause)
                const bundleName = this.extractCurrentBundle(tokens);
                const currentDb = context.getCurrentDatabase();
                
//                console.log(`🔍 field_reference - bundleName: ${bundleName}, currentDb: ${currentDb}`);
                
                if (bundleName && currentDb) {
                    const bundle = context.getBundle(currentDb, bundleName);
 //                   console.log(`🔍 Found bundle:`, bundle);
                    
                    if (bundle && bundle.fields.size > 0) {
 //                       console.log(`🔍 Bundle has ${bundle.fields.size} fields`);
                        for (const [fieldName, field] of bundle.fields) {
                            suggestions.push({
                                label: fieldName,
                                kind: SuggestionKind.FIELD,
                                detail: `Field (${field.type})`,
                                documentation: `${fieldName}: ${field.type}`,
                                priority: 90,
                                insertText: `"${fieldName}"`
                            });
                        }
                    } else if (bundle) {
 //                       console.log(`🔍 Bundle found but has no fields - need to load them`);
                        // Bundle exists but fields not loaded yet - return placeholder
                        suggestions.push({
                            label: 'field_reference',
                            kind: SuggestionKind.FIELD,
                            detail: 'Fields not loaded yet',
                            documentation: 'Expand bundle in connection tree to load fields',
                            priority: 90,
                            insertText: 'field_reference'
                        });
                    }
                } else {
 //                   console.log(`🔍 field_reference - missing bundleName or currentDb, showing placeholder`);
                    // No bundle context - show placeholder
                    suggestions.push({
                        label: 'field_reference',
                        kind: SuggestionKind.FIELD,
                        detail: 'Specify bundle in FROM clause first',
                        documentation: 'Add FROM "bundle_name" to see field suggestions',
                        priority: 90,
                        insertText: 'field_reference'
                    });
                }
                break;

            case 'user_reference':
            case 'username':
                // Could add user suggestions here if we have that context
                break;

            default:
                // Not a recognized contextual reference
                break;
        }

        return suggestions;
    }

    /**
     * Convert token type to keyword
     */
    private tokenTypeToKeyword(tokenType: string): string | null {
        // Token types are already keywords in most cases
        // Just clean up TOKEN_ prefix if present
        if (tokenType.startsWith('TOKEN_')) {
            return tokenType.substring(6);
        }
        return tokenType;
    }

    /**
     * Deduplicate suggestions by label
     */
    private deduplicateSuggestions(suggestions: Suggestion[]): Suggestion[] {
        const seen = new Map<string, Suggestion>();
        
        for (const suggestion of suggestions) {
            const key = `${suggestion.label}-${suggestion.kind}`;
            const existing = seen.get(key);
            
            // Keep suggestion with higher priority
            if (!existing || suggestion.priority > existing.priority) {
                seen.set(key, suggestion);
            }
        }

        return Array.from(seen.values());
    }

    /**
     * Rank suggestions by priority and usage
     */
    private rankSuggestions(
        suggestions: Suggestion[],
        context: SuggestionContext
    ): Suggestion[] {
        // Apply usage frequency boost
        const rankedSuggestions = suggestions.map(suggestion => {
            const usageCount = this.recentlyUsed.get(suggestion.label) || 0;
            const usageBoost = Math.min(usageCount * 2, 20); // Max 20 point boost
            
            return {
                ...suggestion,
                priority: suggestion.priority + usageBoost,
                sortText: this.generateSortText(suggestion.priority + usageBoost, suggestion.label)
            };
        });

        // Sort by priority (descending) then label (ascending)
        rankedSuggestions.sort((a, b) => {
            if (a.priority !== b.priority) {
                return b.priority - a.priority;
            }
            return a.label.localeCompare(b.label);
        });

        return rankedSuggestions;
    }

    /**
     * Generate sort text for suggestion ordering
     */
    private generateSortText(priority: number, label: string): string {
        // Pad priority to ensure proper sorting
        const paddedPriority = (1000 - priority).toString().padStart(4, '0');
        return `${paddedPriority}_${label}`;
    }

    /**
     * Generate cache key for suggestions
     */
    private generateCacheKey(tokens: Token[], cursorPosition: number, text: string): string {
        // Use token sequence and cursor position as key
        const tokenSequence = tokens
            .filter(t => t.EndPosition <= cursorPosition)
            .map(t => t.Value)
            .join('_');
        
        return `${tokenSequence}_${cursorPosition}`;
    }

    /**
     * Fuzzy match suggestion against input
     */
    fuzzyMatch(suggestion: string, input: string): FuzzyMatchResult {
        if (!input) {
            return { matched: true, score: 100 };
        }

        const suggestionLower = suggestion.toLowerCase();
        const inputLower = input.toLowerCase();

        // Exact match
        if (suggestionLower === inputLower) {
            return { matched: true, score: 100 };
        }

        // Prefix match
        if (suggestionLower.startsWith(inputLower)) {
            const score = 90 - (suggestion.length - input.length);
            return { matched: true, score: Math.max(score, 50) };
        }

        // Contains match
        if (suggestionLower.includes(inputLower)) {
            return { matched: true, score: 70 };
        }

        // Fuzzy character match
        let inputIndex = 0;
        let score = 60;
        
        for (let i = 0; i < suggestionLower.length && inputIndex < inputLower.length; i++) {
            if (suggestionLower[i] === inputLower[inputIndex]) {
                inputIndex++;
                score += 5;
            }
        }

        if (inputIndex === inputLower.length) {
            return { matched: true, score: Math.min(score, 80) };
        }

        return { matched: false, score: 0 };
    }

    /**
     * Filter suggestions by input text
     */
    filterSuggestions(suggestions: Suggestion[], input: string): Suggestion[] {
        if (!input) {
            return suggestions;
        }

        const filtered = suggestions
            .map(suggestion => ({
                suggestion,
                match: this.fuzzyMatch(suggestion.label, input)
            }))
            .filter(item => item.match.matched)
            .sort((a, b) => b.match.score - a.match.score)
            .map(item => item.suggestion);

        return filtered;
    }

    /**
     * Record suggestion usage for ranking
     */
    recordUsage(suggestion: string): void {
        const count = this.recentlyUsed.get(suggestion) || 0;
        this.recentlyUsed.set(suggestion, count + 1);

        // Limit size of usage tracking
        if (this.recentlyUsed.size > 200) {
            const entries = Array.from(this.recentlyUsed.entries());
            entries.sort((a, b) => b[1] - a[1]);
            this.recentlyUsed = new Map(entries.slice(0, 100));
        }
    }

    /**
     * Clear suggestion cache
     */
    clearCache(): void {
        this.cache.clear();
    }

    /**
     * Get cache statistics
     */
    getCacheStats(): { size: number; hitRate: number } {
        return {
            size: this.cache.size(),
            hitRate: 0 // Would need to track hits/misses to calculate
        };
    }
}
