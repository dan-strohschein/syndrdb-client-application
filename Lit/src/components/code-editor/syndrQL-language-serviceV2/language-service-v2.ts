/**
 * SyndrQL Language Service V2 - Unified API
 * 
 * Modern, grammar-driven language service providing:
 * - Syntax validation with detailed error reporting
 * - Context-aware auto-suggestions
 * - Cross-statement validation
 * - Server-authoritative schema context
 * - Statement-level caching
 * 
 * @example
 * ```typescript
 * const service = new LanguageServiceV2(config);
 * await service.initialize();
 * 
 * const result = await service.validate(code);
 * const suggestions = await service.getSuggestions(code, cursorPosition);
 * await service.refreshContext();
 * ```
 */

import type { AppConfig } from '../../../config/config-types';
import { GrammarEngine } from './grammar_engine';
import { Tokenizer, type Token } from './tokenizer';
import { TokenType } from './token_types';
import { StatementCache } from './statement-cache';
import { ErrorAnalyzer, type EnhancedErrorDetail, ErrorCategory } from './error-analyzer';
import { DocumentContext, type DatabaseDefinition, type BundleDefinition, ContextState } from './document-context';
import { CrossStatementValidator } from './cross-statement-validator';
import { SuggestionEngine, type Suggestion } from './suggestion-engine';
import { ContextExpander, PrefetchStrategy } from './context-expander';
import { StatementParser, type ParsedStatement } from './statement-parser';
import { FontMetrics } from '../types.js';
import { 
    SyntaxTheme, 
    DEFAULT_SYNDRQL_THEME 
} from './rendering-types.js';
import { 
    renderSyntaxHighlightedLine, 
    renderStatementErrorUnderline,
    organizeTokensByLine 
} from './renderer.js';

/**
 * Validation result with enhanced error details
 */
export interface ValidationResult {
    /** Whether the code is valid */
    valid: boolean;
    /** Detailed error information */
    errors: EnhancedErrorDetail[];
    /** Warnings that don't prevent execution */
    warnings: EnhancedErrorDetail[];
    /** Informational messages */
    info: EnhancedErrorDetail[];
}

/**
 * Formatting options
 */
export interface FormatOptions {
    /** Number of spaces for indentation */
    indentSize?: number;
    /** Use tabs instead of spaces */
    useTabs?: boolean;
    /** Insert spaces around operators */
    insertSpaceAroundOperators?: boolean;
    /** Capitalize keywords */
    capitalizeKeywords?: boolean;
}

/**
 * Context refresh options
 */
export interface RefreshOptions {
    /** Database to refresh (null for all) */
    database?: string | null;
    /** Force refresh even if not stale */
    force?: boolean;
    /** Prefetch strategy to use after refresh */
    prefetchStrategy?: PrefetchStrategy;
}

/**
 * Language service statistics
 */
export interface ServiceStats {
    /** Cache statistics */
    cache: {
        statements: number;
        bundles: number;
        fields: number;
        hitRate: number;
    };
    /** Context state */
    context: {
        state: ContextState;
        databases: number;
        currentDatabase: string | null;
        timeSinceRefresh: number;
    };
    /** Performance metrics */
    performance: {
        avgValidationTime: number;
        avgSuggestionTime: number;
        totalValidations: number;
        totalSuggestions: number;
    };
}

/**
 * Main Language Service V2 API
 * Provides unified access to all language service features
 */
export class LanguageServiceV2 {
    private grammarEngine: GrammarEngine;
    private tokenizer: Tokenizer;
    private cache: StatementCache;
    private errorAnalyzer: ErrorAnalyzer;
    private context: DocumentContext;
    private crossValidator: CrossStatementValidator;
    private suggestionEngine: SuggestionEngine;
    private contextExpander: ContextExpander;
    private statementParser: StatementParser;
    
    private initialized = false;
    private currentDocument = '';
    
    // Performance tracking
    private validationTimes: number[] = [];
    private suggestionTimes: number[] = [];
    
    // Rendering infrastructure
    private canvasContext: CanvasRenderingContext2D | null = null;
    private fontMetrics: FontMetrics | null = null;
    private theme: SyntaxTheme = DEFAULT_SYNDRQL_THEME;
    private tokensByLine: Map<number, Token[]> = new Map();
    
    constructor(private config: AppConfig) {
        this.grammarEngine = GrammarEngine.getInstance();
        this.tokenizer = new Tokenizer();
        this.cache = new StatementCache(config);
        this.errorAnalyzer = new ErrorAnalyzer();
        this.context = new DocumentContext();
        this.crossValidator = new CrossStatementValidator();
        this.suggestionEngine = new SuggestionEngine(config);
        this.contextExpander = new ContextExpander(config);
        this.statementParser = new StatementParser(config, this.cache); 
    }
    /**
     * Initialize the language service
     * Must be called before using any other methods
     */
    async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }

        try {
            // Load grammars
            await this.grammarEngine.initialize();
            
            // Load cached context if available (with empty data initially)
            this.context.loadFromCache({});
            
            this.initialized = true;
        } catch (error) {
            throw new Error(`Failed to initialize language service: ${error}`);
        }
    }

    /**
     * Validate SyndrQL code
     * 
     * @param code - The code to validate
     * @param documentUri - Optional document identifier for caching
     * @returns Validation result with errors, warnings, and info
     */
    async validate(code: string, documentUri?: string): Promise<ValidationResult> {
        this.ensureInitialized();
        
        const startTime = performance.now();
        
        try {
            // Update current document
            this.currentDocument = code;
            
            // Tokenize
            const tokens = this.tokenizer.tokenize(code);
            
            // Split into statements using the statement parser (which filters out comments)
            const statements = this.statementParser.parseDocument(documentUri || 'temp', code, tokens);
console.log('📝 [DEBUG] Parsed statements:', statements.map(s => s.text));

            const allErrors: EnhancedErrorDetail[] = [];
            const allWarnings: EnhancedErrorDetail[] = [];
            const allInfo: EnhancedErrorDetail[] = [];
            
            // Validate each statement
            for (const statement of statements) {
                const cacheKey = documentUri ? `${documentUri}:${statement.startLine}` : undefined;
                
                // Check cache
                let cached = false;
                if (cacheKey && documentUri) {
                    const stmtHash = this.hashStatement(statement.text);
                    const cachedResult = this.cache.get(documentUri, stmtHash);
                    if (cachedResult && cachedResult.text === statement.text && !cachedResult.isDirty) {
                        // Use cached result - convert to enhanced errors
                        const enhancedErrors = cachedResult.errors.map(err => ({
                            ...err,
                            severity: 'error' as const,
                            category: ErrorCategory.SYNTAX,
                            startPosition: err.line * 100 + err.column,
                            endPosition: err.line * 100 + err.column + err.length
                        }));
                        allErrors.push(...enhancedErrors);
                        cached = true;
                    }
                }
                
                if (!cached) {
                    // Validate statement using pre-filtered tokens (comments already removed)
                    const result = this.grammarEngine.validateStatement(statement.tokens);
                    
                    // Convert validation errors to enhanced errors
                    const enhancedErrors = result.errors.map(err => ({
                        ...err,
                        severity: 'error' as const,
                        category: ErrorCategory.SYNTAX
                    }));
                    allErrors.push(...enhancedErrors);
                    
                    // Cache result
                    if (cacheKey && documentUri) {
                        const stmtHash = this.hashStatement(statement.text);
                        this.cache.put(documentUri, stmtHash, {
                            text: statement.text,
                            isValid: result.isValid,
                            isDirty: false,
                            timestamp: Date.now(),
                            errors: result.errors.map(err => ({
                                code: err.code,
                                message: err.message,
                                line: 1,
                                column: err.startPosition,
                                length: err.endPosition - err.startPosition
                            }))
                        });
                    }
                }
                
                // Cross-statement validation using pre-filtered tokens
                const crossResult = this.crossValidator.validate(statement.tokens, statement.text, this.context);
                allErrors.push(...crossResult.errors);
                allWarnings.push(...crossResult.warnings);
            }
            
            // Warn about stale context
            if (this.context.isStale()) {
                allWarnings.push({
                    code: 'CONTEXT_STALE',
                    message: 'Schema context is stale. Consider refreshing for accurate validation.',
                    severity: 'warning',
                    category: ErrorCategory.SEMANTIC,
                    startPosition: 0,
                    endPosition: 0,
                    suggestion: 'Refresh context using refreshContext()'
                });
            }
            
            const endTime = performance.now();
            this.recordValidationTime(endTime - startTime);
            
            const result: ValidationResult = {
                valid: allErrors.length === 0,
                errors: allErrors,
                warnings: allWarnings,
                info: allInfo
            };
            
            // Store result for rendering purposes
            this.storeValidationResult(result);
            
            return result;
        } catch (error) {
            const result: ValidationResult = {
                valid: false,
                errors: [{
                    code: 'INTERNAL_ERROR',
                    message: `Validation error: ${error}`,
                    severity: 'error',
                    category: ErrorCategory.SYNTAX,
                    startPosition: 0,
                    endPosition: 0
                }],
                warnings: [],
                info: []
            };
            
            // Store result for rendering purposes
            this.storeValidationResult(result);
            
            return result;
        }
    }

    /**
     * Get suggestions for auto-completion
     * Suggestions are confined to the active statement (between semicolons)
     * 
     * @param code - The code to analyze
     * @param cursorPosition - Character position of cursor
     * @param filterText - Optional text to filter suggestions
     * @returns Array of suggestions
     */
    async getSuggestions(
        code: string,
        cursorPosition: number,
        filterText?: string
    ): Promise<Suggestion[]> {
        this.ensureInitialized();
        
        const startTime = performance.now();
        
        try {
            // Tokenize all code
            const allTokens = this.tokenizer.tokenize(code);
            
            // Check if cursor is inside a comment - if so, return no suggestions
            const tokenAtCursor = allTokens.find(token => 
                cursorPosition >= token.StartPosition && cursorPosition <= token.EndPosition
            );
            
            if (tokenAtCursor && tokenAtCursor.Type === TokenType.TOKEN_COMMENT) {
                return []; // No suggestions inside comments
            }
            
            // Find the active statement (between semicolons)
            const activeStatementTokens = this.getActiveStatementTokens(allTokens, cursorPosition);
            
            console.log('🔍 [DEBUG] Active statement tokens:', activeStatementTokens.map(t => `${t.Value}(${t.Type})`));
            
            // Check if active statement has any meaningful content (non-whitespace tokens)
            const hasContent = activeStatementTokens.some(token => 
                token.Type !== TokenType.TOKEN_WHITESPACE && 
                token.Type !== TokenType.TOKEN_NEWLINE &&
                token.Type !== TokenType.TOKEN_SEMICOLON
            );
            
            // If no content yet (just whitespace after semicolon), don't show suggestions
            // This prevents dropdown from appearing immediately after typing semicolon
            if (!hasContent) {
                return [];
            }
            
            // Get suggestions for active statement only
            let suggestions = await this.suggestionEngine.getSuggestions(
                activeStatementTokens,
                cursorPosition,
                this.context,
                code
            );
            
            // Filter if requested
            if (filterText) {
                suggestions = this.suggestionEngine.filterSuggestions(suggestions, filterText);
            }
            
            const endTime = performance.now();
            this.recordSuggestionTime(endTime - startTime);
            
            return suggestions;
        } catch (error) {
            console.error('Error getting suggestions:', error);
            return [];
        }
    }

    /**
     * Get tokens for the active statement at cursor position
     * Active statement is defined as tokens between semicolons
     * 
     * @param tokens - All tokens in the document
     * @param cursorPosition - Character position of cursor
     * @returns Tokens within the active statement
     */
    private getActiveStatementTokens(tokens: Token[], cursorPosition: number): Token[] {
        if (tokens.length === 0) {
            return [];
        }

        // Find the last semicolon before the cursor
        let statementStartIndex = 0;
        let lastSemicolonBeforeCursor = -1;

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            
            // If this semicolon is before the cursor, it marks the end of a previous statement
            if (token.Type === TokenType.TOKEN_SEMICOLON && token.EndPosition <= cursorPosition) {
                lastSemicolonBeforeCursor = i;
            }
        }

        // Start from the token after the last semicolon
        if (lastSemicolonBeforeCursor >= 0) {
            statementStartIndex = lastSemicolonBeforeCursor + 1;
        }

        // Find the next semicolon after the cursor (or end of tokens)
        let statementEndIndex = tokens.length;
        
        for (let i = statementStartIndex; i < tokens.length; i++) {
            const token = tokens[i];
            
            // If we find a semicolon at or after cursor, it marks the end of the active statement
            if (token.Type === TokenType.TOKEN_SEMICOLON && token.StartPosition >= cursorPosition) {
                statementEndIndex = i + 1; // Include the semicolon
                break;
            }
        }

        // Extract tokens for the active statement
        const activeStatementTokens = tokens.slice(statementStartIndex, statementEndIndex);

        // Filter out whitespace, newline, and comment tokens
        const filteredTokens = activeStatementTokens.filter(token => 
            token.Type !== TokenType.TOKEN_WHITESPACE && 
            token.Type !== TokenType.TOKEN_NEWLINE &&
            token.Type !== TokenType.TOKEN_COMMENT
        );

        return filteredTokens;
    }

    /**
     * Get all errors for the current document
     * Similar to validate() but returns only errors
     */
    async getErrors(code: string): Promise<EnhancedErrorDetail[]> {
        const result = await this.validate(code);
        return result.errors;
    }

    /**
     * Refresh schema context from server
     * 
     * @param options - Refresh options
     */
    async refreshContext(options: RefreshOptions = {}): Promise<void> {
        this.ensureInitialized();
        
        try {
            // Refresh from server - TODO: inject serverApi
            // await this.context.refreshFromServer(serverApi);
            
            // Apply prefetch strategy if specified
            if (options.prefetchStrategy) {
                this.contextExpander.setPrefetchStrategy(options.prefetchStrategy);
            }
            
            // Warmup cache with current database - TODO: requires database, bundle, context, serverApi
            // if (this.context.getCurrentDatabase()) {
            //     await this.contextExpander.warmupCache(...);
            // }
        } catch (error) {
            throw new Error(`Failed to refresh context: ${error}`);
        }
    }

    /**
     * Set the current database context
     */
    setCurrentDatabase(database: string | null): void {
        if (database !== null) {
            this.context.setCurrentDatabase(database);
        }
    }

    /**
     * Get the current database context
     */
    getCurrentDatabase(): string | null {
        return this.context.getCurrentDatabase();
    }

    /**
     * Update database definition in context
     */
    updateDatabase(database: DatabaseDefinition): void {
        this.context.updateDatabase(database);
    }

    /**
     * Update bundle definition in context
     */
    updateBundle(database: string, bundle: BundleDefinition): void {
        this.context.updateBundle(database, bundle);
    }

    /**
     * Update the document content and tokenize it
     * This should be called whenever the document content changes
     * Tokenizes the entire document once to properly handle multi-line comments
     * 
     * @param code - The complete document text
     */
    updateDocument(code: string): void {
        this.ensureInitialized();
        this.currentDocument = code;
        
        // Tokenize the entire document (handles multi-line comments correctly)
        const tokens = this.tokenizer.tokenize(code);
        
        // Organize tokens by line for efficient line-by-line rendering
        this.tokensByLine = organizeTokensByLine(tokens);
    }

    /**
     * Parse document into statements
     * 
     * @param code - The code to parse
     * @param documentUri - Optional document identifier for caching
     * @returns Array of parsed statements with metadata
     */
    parseStatements(code: string, documentUri?: string): ParsedStatement[] {
        this.ensureInitialized();
        const tokens = this.tokenizer.tokenize(code);
        return this.statementParser.parseDocument(documentUri || 'editor', code, tokens);
    }

    /**
     * Expand bundle details (load fields, relationships)
     * 
     * @param database - Database name
     * @param bundle - Bundle name
     */
    async expandBundle(database: string, bundle: string): Promise<BundleDefinition | null> {
        this.ensureInitialized();
        // TODO: inject serverApi
        return this.contextExpander.expandBundle(database, bundle, this.context, null);
    }

    /**
     * Format SyndrQL code
     * 
     * @param code - Code to format
     * @param options - Formatting options
     * @returns Formatted code
     */
    format(code: string, options: FormatOptions = {}): string {
        this.ensureInitialized();
        
        const {
            indentSize = 4,
            useTabs = false,
            insertSpaceAroundOperators = true,
            capitalizeKeywords = true
        } = options;
        
        try {
            const tokens = this.tokenizer.tokenize(code);
            let formatted = '';
            let indentLevel = 0;
            const indent = useTabs ? '\t' : ' '.repeat(indentSize);
            let lineStart = true;
            
            for (let i = 0; i < tokens.length; i++) {
                const token = tokens[i];
                const prevToken = i > 0 ? tokens[i - 1] : null;
                const nextToken = i < tokens.length - 1 ? tokens[i + 1] : null;
                
                // Handle indentation
                if (lineStart && token.Type !== TokenType.TOKEN_NEWLINE && token.Type !== TokenType.TOKEN_WHITESPACE) {
                    formatted += indent.repeat(indentLevel);
                    lineStart = false;
                }
                
                // Format token
                let tokenText = token.Value;
                
                if (capitalizeKeywords && token.Type === TokenType.TOKEN_KEYWORD) {
                    tokenText = tokenText.toUpperCase();
                }
                
                // Add spaces around operators
                if (insertSpaceAroundOperators && this.isOperator(token)) {
                    if (prevToken && !this.isWhitespace(prevToken)) {
                        formatted += ' ';
                    }
                    formatted += tokenText;
                    if (nextToken && !this.isWhitespace(nextToken) && nextToken.Type !== TokenType.TOKEN_NEWLINE) {
                        formatted += ' ';
                    }
                } else {
                    formatted += tokenText;
                }
                
                // Handle newlines
                if (token.Type === TokenType.TOKEN_NEWLINE) {
                    formatted += '\n';
                    lineStart = true;
                }
            }
            
            return formatted;
        } catch (error) {
            console.error('Error formatting code:', error);
            return code; // Return original on error
        }
    }

    /**
     * Get language service statistics
     */
    getStatistics(): ServiceStats {
        const cacheStats = this.contextExpander.getCacheStats();
        const cacheMetrics = this.cache.getMetrics();
        
        return {
            cache: {
                statements: cacheMetrics.statementCount,
                bundles: cacheStats.bundleCacheSize,
                fields: cacheStats.fieldCacheSize,
                hitRate: cacheMetrics.hitRate
            },
            context: {
                state: this.context.getState(),
                databases: this.context.getAllDatabases().length,
                currentDatabase: this.context.getCurrentDatabase(),
                timeSinceRefresh: this.context.getTimeSinceRefresh()
            },
            performance: {
                avgValidationTime: this.getAverage(this.validationTimes),
                avgSuggestionTime: this.getAverage(this.suggestionTimes),
                totalValidations: this.validationTimes.length,
                totalSuggestions: this.suggestionTimes.length
            }
        };
    }

    /**
     * Get context state
     */
    getContextState(): ContextState {
        return this.context.getState();
    }

    /**
     * Check if context is stale
     */
    isContextStale(): boolean {
        return this.context.isStale();
    }

    /**
     * Clear all caches
     */
    clearCaches(): void {
        // Clear all document caches - note: this clears ALL documents
        // To clear specific document, need to track document IDs
        this.contextExpander.clearCache();
        this.suggestionEngine.clearCache();
        this.validationTimes = [];
        this.suggestionTimes = [];
    }

    /**
     * Record suggestion usage for ranking
     */
    recordSuggestionUsage(label: string): void {
        this.suggestionEngine.recordUsage(label);
    }

    /**
     * Set prefetch strategy
     */
    setPrefetchStrategy(strategy: PrefetchStrategy): void {
        this.contextExpander.setPrefetchStrategy(strategy);
    }

    /**
     * Dispose of the language service
     */
    dispose(): void {
        this.initialized = false;
    }

    // Private helper methods

    private ensureInitialized(): void {
        if (!this.initialized) {
            throw new Error('Language service not initialized. Call initialize() first.');
        }
    }

    private splitIntoStatements(code: string): Array<{ text: string; startLine: number }> {
        const lines = code.split('\n');
        const statements: Array<{ text: string; startLine: number }> = [];
        let currentStatement = '';
        let startLine = 0;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (line.length === 0) {
                continue;
            }
            
            if (currentStatement.length === 0) {
                startLine = i + 1;
            }
            
            currentStatement += line + ' ';
            
            // Statement ends with semicolon or is standalone command
            if (line.endsWith(';') || this.isStandaloneStatement(line)) {
                statements.push({
                    text: currentStatement.trim(),
                    startLine
                });
                currentStatement = '';
            }
        }
        
        // Add remaining statement if any
        if (currentStatement.trim().length > 0) {
            statements.push({
                text: currentStatement.trim(),
                startLine
            });
        }
        
        return statements;
    }

    private isStandaloneStatement(line: string): boolean {
        const standaloneKeywords = ['USE', 'SHOW', 'DESCRIBE', 'DESC', 'HELP'];
        const upperLine = line.toUpperCase();
        return standaloneKeywords.some(kw => upperLine.startsWith(kw));
    }

    private isOperator(token: Token): boolean {
        return token.Type === TokenType.TOKEN_OPERATOR || 
               ['=', '!=', '<', '>', '<=', '>=', '+', '-', '*', '/', 'AND', 'OR'].includes(token.Value);
    }

    private isWhitespace(token: Token): boolean {
        return token.Type === TokenType.TOKEN_WHITESPACE || token.Type === TokenType.TOKEN_NEWLINE;
    }

    private recordValidationTime(time: number): void {
        this.validationTimes.push(time);
        if (this.validationTimes.length > 100) {
            this.validationTimes.shift();
        }
    }

    private recordSuggestionTime(time: number): void {
        this.suggestionTimes.push(time);
        if (this.suggestionTimes.length > 100) {
            this.suggestionTimes.shift();
        }
    }

    private getAverage(numbers: number[]): number {
        if (numbers.length === 0) return 0;
        return numbers.reduce((a, b) => a + b, 0) / numbers.length;
    }

    private hashStatement(text: string): string {
        // Simple hash for statement caching
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash.toString(36);
    }

    /**
     * Set the current database context
     * This should be called when the user selects a database in the connection tree
     */
    setDatabaseContext(databaseName: string | null): void {
        if (databaseName) {
            console.log(`🎯 LanguageService: Setting database context to "${databaseName}"`);
            this.context.setCurrentDatabase(databaseName);
        } else {
            console.log(`🎯 LanguageService: Clearing database context`);
            this.context.setCurrentDatabase('');
        }
    }

    /**
     * Add database and bundle definitions to context
     * This should be called when loading databases/bundles from the server
     */
    updateContextData(databases: DatabaseDefinition[]): void {
       // console.log(`🎯 LanguageService: Updating context with ${databases.length} databases`);
        
        // Convert DatabaseDefinition[] to the format expected by loadFromCache
        const cachedData: any = {
            databases: {},
            permissions: {},
            migrations: {}
        };

        for (const db of databases) {
            const bundlesObj: any = {};
            
            // Convert Map to object
            for (const [bundleName, bundle] of db.bundles.entries()) {
                bundlesObj[bundleName] = {
                    name: bundle.name,
                    database: bundle.database,
                    fields: Object.fromEntries(bundle.fields),
                    relationships: Object.fromEntries(bundle.relationships),
                    indexes: bundle.indexes
                };
            }
            
            cachedData.databases[db.name] = {
                name: db.name,
                bundles: bundlesObj
            };
        }

      //  console.log(`🎯 LanguageService: Loading context data:`, JSON.stringify(cachedData, null, 2));
        
        // Load into context
        this.context.loadFromCache(cachedData);
        
        /*
        just loaded X databases into the context... 
        let me verify by querying the first one to see if it returns the expected bundles
        */

        // console.log(`🎯 LanguageService: Context loaded, checking bundles for first database...`);
        // if (databases.length > 0) {
        //     const testDb = databases[0].name;
        //     const testBundles = this.context.getBundles(testDb);
        //     console.log(`🎯 LanguageService: Test query for ${testDb} returned ${testBundles.length} bundles`);
        // }
    }

    /**
     * Initialize rendering capabilities
     * Must be called to enable syntax highlighting and error underline rendering
     * 
     * @param context - Canvas rendering context
     * @param fontMetrics - Font metrics for text measurement
     * @param theme - Optional syntax theme (defaults to DEFAULT_SYNDRQL_THEME)
     */
    initializeRenderer(
        context: CanvasRenderingContext2D,
        fontMetrics: FontMetrics,
        theme?: SyntaxTheme
    ): void {
        this.canvasContext = context;
        this.fontMetrics = fontMetrics;
        if (theme) {
            this.theme = theme;
        }
    }

    /**
     * Update font metrics (called when font changes)
     * 
     * @param fontMetrics - New font metrics
     */
    updateFontMetrics(fontMetrics: FontMetrics): void {
        this.fontMetrics = fontMetrics;
    }

    /**
     * Update canvas context (called when canvas changes)
     * 
     * @param context - New canvas rendering context
     */
    updateCanvasContext(context: CanvasRenderingContext2D): void {
        this.canvasContext = context;
    }

    /**
     * Update syntax theme
     * 
     * @param theme - New syntax theme
     */
    setTheme(theme: SyntaxTheme): void {
        this.theme = theme;
    }

    /**
     * Render a single line with syntax highlighting
     * Integrates with the code editor's line-by-line rendering system
     * 
     * @param lineContent - Text content of the line
     * @param lineNumber - Line number (1-based)
     * @param lineY - Y position (baseline) for rendering
     * @param fontMetrics - Font metrics for text measurement
     * @param scrollOffset - Current scroll offset
     */
    renderLine(
        lineContent: string,
        lineNumber: number,
        lineY: number,
        fontMetrics: FontMetrics,
        scrollOffset: { x: number; y: number }
    ): void {
        if (!this.canvasContext) {
            console.warn('Canvas context not initialized. Call initializeRenderer() first.');
            return;
        }

        // Use cached tokens from full document tokenization
        // This ensures multi-line comments are properly recognized
        const lineTokens = this.tokensByLine.get(lineNumber) || [];
        
        // If no cached tokens found, fall back to tokenizing just this line
        // (this can happen if updateDocument wasn't called)
        const tokens = lineTokens.length > 0 
            ? lineTokens
            : this.tokenizer.tokenize(lineContent).map(token => ({
                ...token,
                Line: lineNumber
            }));

        // Render the line with syntax highlighting
        renderSyntaxHighlightedLine(
            this.canvasContext,
            tokens,
            lineNumber,
            lineY,
            fontMetrics,
            this.theme,
            scrollOffset
        );
    }

    /**
     * Render statement-level error underline for a specific line
     * Should be called by code editor when renderLine() returns true
     * 
     * @param lineContent - Text content of the line
     * @param lineY - Y position (baseline) for rendering
     * @param fontMetrics - Font metrics for text measurement
     * @param scrollOffset - Current scroll offset
     */
    renderStatementError(
        lineContent: string,
        lineY: number,
        fontMetrics: FontMetrics,
        scrollOffset: { x: number; y: number }
    ): void {
        if (!this.canvasContext) {
            console.warn('Canvas context not initialized. Call initializeRenderer() first.');
            return;
        }

        renderStatementErrorUnderline(
            this.canvasContext,
            lineContent,
            lineY,
            fontMetrics,
            scrollOffset
        );
    }

    /**
     * Get the last validation result
     * Used internally for determining if lines have errors
     * 
     * @returns Last validation result or null
     */
    private lastValidationResult: ValidationResult | null = null;

    private getLastValidationResult(): ValidationResult | null {
        return this.lastValidationResult;
    }

    /**
     * Store validation result for rendering purposes
     * Called internally during validate()
     */
    private storeValidationResult(result: ValidationResult): void {
        this.lastValidationResult = result;
    }
}

/**
 * Create and initialize a new language service instance
 * 
 * @param config - Application configuration
 * @returns Initialized language service
 */
export async function createLanguageService(config: AppConfig): Promise<LanguageServiceV2> {
    const service = new LanguageServiceV2(config);
    await service.initialize();
    return service;
}

// Re-export ParsedStatement type for external use
export type { ParsedStatement };
