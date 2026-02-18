/**
 * Grammar Engine for SyndrQL Language Service V2
 * Loads and manages JSON-based grammar definitions with versioning support
 */

import ddlGrammarJSON from './ddl_grammar.json';
import dmlGrammarJSON from './dml_grammar.json';
import dolGrammarJSON from './dol_grammar.json';
import migrationGrammarJSON from './migration_grammar.json';
import { configLoader } from '../../../config/config-loader.js';
import { TokenType } from './token_types.js';

// Extract token constants for easier use
const {
    TOKEN_CREATE, TOKEN_ALTER, TOKEN_DROP, TOKEN_SHOW,
    TOKEN_SELECT, TOKEN_ADD, TOKEN_UPDATE, TOKEN_DELETE,
    TOKEN_GRANT, TOKEN_REVOKE,
    TOKEN_MIGRATION, TOKEN_APPLY, TOKEN_VALIDATE, TOKEN_ROLLBACK
} = TokenType;

type Grammar = Array<GrammarEntry>;

type GrammarEntry = {
    version?: string;
    root: string;
    rules: GrammarRule[];
}

type GrammarRule = {
    name: string;
    symbols: Array<GrammarSymbolToken | GrammarSymbolLiteral | GrammarBranches | GrammarSymbolReference>;
    postprocess: ((data: any, location: any, reject: any) => any) | null;
    minimumBranches?: number;
    minimumSymbols?: number;
}

type GrammarSymbolToken = {
    token: string;
    optional?: boolean;
    repeatable?: boolean;
}

type GrammarSymbolLiteral = {
    literal: string;
    optional?: boolean;
    repeatable?: boolean;
}

// For references to other parts of the grammar
type GrammarSymbolReference = {
    reference: string;
    optional?: boolean;
    repeatable?: boolean;
}

type GrammarBranches = {
    branches: Array<GrammarBranch>;
    optional?: boolean;
}

/**
 * Validation error from grammar engine
 */
export interface ValidationError {
    code: string;
    message: string;
    severity: 'error' | 'warning' | 'info';
    startPosition: number;
    endPosition: number;
}

/**
 * Result of statement validation
 */
export interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
}

type GrammarBranch = {
    name?: string;
    symbols: Array<GrammarSymbolToken | GrammarSymbolLiteral | GrammarSymbolReference | GrammarBranches>;
}

/**
 * Grammar type enumeration
 */
enum GrammarType {
    DDL = 'DDL',
    DML = 'DML',
    DOL = 'DOL',
    MIGRATION = 'MIGRATION',
    UNKNOWN = 'UNKNOWN'
}

/**
 * Parsed grammar with metadata
 */
interface ParsedGrammar {
    type: GrammarType;
    version: string;
    grammar: Grammar;
    grammarEntries: Map<string, GrammarEntry>;
}

/**
 * Grammar Engine class
 */
export class GrammarEngine {
    private static instance: GrammarEngine;
    private grammars: Map<GrammarType, ParsedGrammar> = new Map();
    private initialized: boolean = false;

    private constructor() {}

    static getInstance(): GrammarEngine {
        if (!GrammarEngine.instance) {
            GrammarEngine.instance = new GrammarEngine();
        }
        return GrammarEngine.instance;
    }

    /**
     * Initialize and load all grammars
     */
    async initialize(): Promise<void> {
        if (this.initialized) {
            console.log('⚠️ Grammar engine already initialized');
            return;
        }

        console.log('🔧 Initializing Grammar Engine...');

        try {
            // Load all grammars
            const ddl = this.parseGrammar(ddlGrammarJSON, GrammarType.DDL);
            const dml = this.parseGrammar(dmlGrammarJSON, GrammarType.DML);
            const dol = this.parseGrammar(dolGrammarJSON, GrammarType.DOL);
            const migration = this.parseGrammar(migrationGrammarJSON, GrammarType.MIGRATION);

            this.grammars.set(GrammarType.DDL, ddl);
            this.grammars.set(GrammarType.DML, dml);
            this.grammars.set(GrammarType.DOL, dol);
            this.grammars.set(GrammarType.MIGRATION, migration);

            // Log versions
            console.log(`✅ DDL Grammar loaded (version: ${ddl.version})`);
            console.log(`✅ DML Grammar loaded (version: ${dml.version})`);
            console.log(`✅ DOL Grammar loaded (version: ${dol.version})`);
            console.log(`✅ Migration Grammar loaded (version: ${migration.version})`);

            this.initialized = true;
            console.log('✅ Grammar Engine initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize Grammar Engine:', error);
            throw error;
        }
    }

    /**
     * Parse grammar JSON into structured format
     */
    private parseGrammar(grammarJSON: any, type: GrammarType): ParsedGrammar {
        const grammar = grammarJSON as Grammar;
        const rules = new Map<string, GrammarEntry>();

        // Extract version from first entry
        const version = grammar[0]?.version || 'unknown';

        // Build rules map for quick lookup
        for (const entry of grammar) {
            rules.set(entry.root, entry);
        }

        return {
            type,
            version,
            grammar,
            grammarEntries: rules
        };
    }

    /**
     * Reload grammars (development mode only)
     */
    async reloadGrammars(): Promise<void> {
        if (configLoader.isProduction()) {
            console.warn('⚠️ Grammar reloading is disabled in production mode');
            return;
        }

        console.log('🔄 Reloading grammars...');
        this.initialized = false;
        this.grammars.clear();
        await this.initialize();
        console.log('✅ Grammars reloaded');
    }

    /**
     * Get grammar for a specific statement type
     */
    getGrammarForStatement(token: Token): ParsedGrammar {
        const grammarType = this.determineGrammarType(token);
        const grammar = this.grammars.get(grammarType);

        if (!grammar) {
            console.error(`No grammar found for type: ${grammarType}`);
            return this.getUnknownGrammar();
        }

        return grammar;
    }

    /**
     * Determine grammar type based on first token
     */
    private determineGrammarType(token: Token): GrammarType {
        const tokenType = token.Type;
        const tokenValue = token.Value?.toUpperCase();

        // DDL statements
        if (tokenType === TOKEN_CREATE || tokenType === TOKEN_ALTER || 
            tokenType === TOKEN_DROP || tokenType === TOKEN_SHOW) {
            return GrammarType.DDL;
        }

        // DML statements
        if (tokenType === TOKEN_SELECT || tokenType === TOKEN_ADD || 
            tokenType === TOKEN_UPDATE || tokenType === TOKEN_DELETE) {
            return GrammarType.DML;
        }

        // DOL statements
        if (tokenType === TOKEN_GRANT || tokenType === TOKEN_REVOKE) {
            return GrammarType.DOL;
        }

        // Migration statements
        if (tokenType === TOKEN_MIGRATION || tokenType === TOKEN_APPLY || 
            tokenType === TOKEN_VALIDATE || tokenType === TOKEN_ROLLBACK ||
            tokenValue === 'MIGRATION' || tokenValue === 'RUN') {
            return GrammarType.MIGRATION;
        }

        return GrammarType.UNKNOWN;
    }

    /**
     * Get unknown grammar for unrecognized statements
     */
    private getUnknownGrammar(): ParsedGrammar {
        return {
            type: GrammarType.UNKNOWN,
            version: '1.0.0',
            grammar: [
                {
                    version: '1.0.0',
                    root: 'unknown_statement',
                    rules: [
                        {
                            name: 'unknown_statement',
                            symbols: [{ token: 'TOKEN_ILLEGAL' }],
                            postprocess: null
                        }
                    ]
                }
            ],
            grammarEntries: new Map()
        };
    }

    /**
     * Get all loaded grammars
     */
    getAllGrammars(): Map<GrammarType, ParsedGrammar> {
        return this.grammars;
    }

    /**
     * Check if grammar engine is initialized
     */
    isInitialized(): boolean {
        return this.initialized;
    }

    /**
     * Validate a statement against its grammar
     * @param tokens Array of tokens from tokenizer
     * @returns Validation result with errors if any
     */
    validateStatement(tokens: Token[]): ValidationResult {
        // Filter out comments, whitespace, and newlines - they should be ignored for validation
        const filteredTokens = tokens.filter(token => 
            token.Type !== TokenType.TOKEN_COMMENT &&
            token.Type !== TokenType.TOKEN_WHITESPACE &&
            token.Type !== TokenType.TOKEN_NEWLINE
        );
        
        if (filteredTokens.length === 0) {
            return {
                isValid: false,
                errors: [{
                    code: 'EMPTY_STATEMENT',
                    message: 'Statement is empty',
                    severity: 'error',
                    startPosition: 0,
                    endPosition: 0
                }]
            };
        }

        // Determine grammar type from first token
        const firstToken = filteredTokens[0];
        const grammarType = this.determineGrammarType(firstToken);
        
        if (grammarType === GrammarType.UNKNOWN) {
            return {
                isValid: false,
                errors: [{
                    code: 'UNKNOWN_STATEMENT',
                    message: `Unknown statement type: ${firstToken.Value}`,
                    severity: 'error',
                    startPosition: firstToken.StartPosition,
                    endPosition: firstToken.EndPosition
                }]
            };
        }

        const grammar = this.getGrammarForStatement(filteredTokens[0]);
        if (!grammar) {
            return {
                isValid: false,
                errors: [{
                    code: 'NO_GRAMMAR',
                    message: 'No grammar found for statement',
                    severity: 'error',
                    startPosition: 0,
                    endPosition: filteredTokens[filteredTokens.length - 1].EndPosition
                }]
            };
        }

        // Find matching grammar entry (root rule)
        const grammarEntry = this.findGrammarEntry(grammar, firstToken);
        if (!grammarEntry) {
            return {
                isValid: false,
                errors: [{
                    code: 'NO_MATCHING_RULE',
                    message: `No grammar rule found for: ${firstToken.Value}`,
                    severity: 'error',
                    startPosition: firstToken.StartPosition,
                    endPosition: firstToken.EndPosition
                }]
            };
        }

        // Traverse grammar and validate tokens
        return this.traverseGrammar(grammarEntry, filteredTokens, grammar);
    }

    /**
     * Find grammar entry matching the first token
     */
    private findGrammarEntry(grammar: ParsedGrammar, firstToken: Token): GrammarEntry | null {
        for (const entry of grammar.grammar) {
            const firstRule = entry.rules[0];
            if (firstRule.symbols.length > 0) {
                const firstSymbol = firstRule.symbols[0];
                if ('token' in firstSymbol && firstSymbol.token === firstToken.Type) {
                    return entry;
                }
            }
        }
        return null;
    }

    /**
     * Find grammar entry by root name (for reference resolution)
     * @param grammar The parsed grammar to search in
     * @param rootName The root name to find (from symbol.reference)
     * @returns The matching GrammarEntry or null if not found
     */
    private matchGrammarEntry(grammar: ParsedGrammar, rootName: string): GrammarEntry | null {
        for (const entry of grammar.grammar) {
            if (entry.root === rootName) {
                return entry;
            }
        }
        return null;
    }

    /**
     * Traverse grammar rules and validate tokens
     */
    private traverseGrammar(
        grammarEntry: GrammarEntry,
        tokens: Token[],
        grammar: ParsedGrammar
    ): ValidationResult {
        const errors: ValidationError[] = [];
        let tokenIndex = 0;

        // Try each rule variant until one matches or all fail
        for (const rule of grammarEntry.rules) {
            const result = this.matchRule(rule, tokens, 0, grammar);
            
            if (result.matched) {
                // Check if we consumed all tokens
                if (result.tokensConsumed === tokens.length) {
                    return { isValid: true, errors: [] };
                } else {
                    // Partial match - extra tokens
                    const extraToken = tokens[result.tokensConsumed];
                    errors.push({
                        code: 'UNEXPECTED_TOKEN',
                        message: `Unexpected token: ${extraToken.Value}`,
                        severity: 'error',
                        startPosition: extraToken.StartPosition,
                        endPosition: extraToken.EndPosition
                    });
                }
            } else {
                // Track errors from this rule attempt
                errors.push(...result.errors);
            }
        }

        // If we got here, no rule matched completely
        return {
            isValid: false,
            errors: errors.length > 0 ? errors : [{
                code: 'SYNTAX_ERROR',
                message: 'Statement does not match grammar',
                severity: 'error',
                startPosition: tokens[0].StartPosition,
                endPosition: tokens[tokens.length - 1].EndPosition
            }]
        };
    }

    /**
     * Match a single grammar rule against tokens
     */
    private matchRule(
        rule: GrammarRule,
        tokens: Token[],
        startIndex: number,
        grammar: ParsedGrammar
    ): { matched: boolean; tokensConsumed: number; errors: ValidationError[] } {
        let tokenIndex = startIndex;
        const errors: ValidationError[] = [];

        for (let symbolIndex = 0; symbolIndex < rule.symbols.length; symbolIndex++) {
            const symbol = rule.symbols[symbolIndex];

            if (tokenIndex >= tokens.length) {
                // Check if remaining symbols are optional
                const remainingRequired = rule.symbols.slice(symbolIndex).some(s => !('optional' in s && s.optional));
                if (remainingRequired) {
                    const expectedValue = 'token' in symbol ? symbol.token : 
                                         'literal' in symbol ? symbol.literal : 
                                         'reference' in symbol ? symbol.reference : 'unknown';
                    errors.push({
                        code: 'UNEXPECTED_EOF',
                        message: `Expected ${expectedValue} but reached end of statement`,
                        severity: 'error',
                        startPosition: tokens[tokens.length - 1].EndPosition,
                        endPosition: tokens[tokens.length - 1].EndPosition
                    });
                    return { matched: false, tokensConsumed: tokenIndex - startIndex, errors };
                }
                break;
            }

            const token = tokens[tokenIndex];

            // Handle different symbol types
            if ('token' in symbol) {
                // Token symbol - check if it matches
                // Contextual tokens (lowercase like field_reference, bundle_reference, literal)
                // match identifier/string; 'literal' also matches number and boolean
                const matches = this.isRuleReference(symbol.token)
                    ? this.tokenMatchesContextualSymbol(token.Type, symbol.token)
                    : (token.Type === symbol.token);
                
                if (!matches) {
                    if ('optional' in symbol && symbol.optional) {
                        // Skip optional symbol
                        continue;
                    }
                    errors.push({
                        code: 'UNEXPECTED_TOKEN',
                        message: `Expected ${symbol.token} but found ${token.Type}`,
                        severity: 'error',
                        startPosition: token.StartPosition,
                        endPosition: token.EndPosition
                    });
                    return { matched: false, tokensConsumed: tokenIndex - startIndex, errors };
                }
                tokenIndex++;
            } else if ('literal' in symbol) {
                // Literal symbol - must match exact value (case-insensitive)
                if (token.Value.toLowerCase() !== symbol.literal.toLowerCase()) {
                    if ('optional' in symbol && symbol.optional) {
                        // Skip optional symbol
                        continue;
                    }
                    errors.push({
                        code: 'UNEXPECTED_TOKEN',
                        message: `Expected '${symbol.literal}' but found '${token.Value}'`,
                        severity: 'error',
                        startPosition: token.StartPosition,
                        endPosition: token.EndPosition
                    });
                    return { matched: false, tokensConsumed: tokenIndex - startIndex, errors };
                }
                tokenIndex++;
            } else if ('reference' in symbol) {
                // Reference to another rule - recursively match
                const referencedGrammarEntry = this.matchGrammarEntry(grammar, symbol.reference);
                if (!referencedGrammarEntry) {
                    errors.push({
                        code: 'INTERNAL_ERROR',
                        message: `Grammar rule not found: ${symbol.reference}`,
                        severity: 'error',
                        startPosition: token.StartPosition,
                        endPosition: token.EndPosition
                    });
                    return { matched: false, tokensConsumed: tokenIndex - startIndex, errors };
                }

                // Match the first rule of the referenced entry
                const referencedRule = referencedGrammarEntry.rules[0];
                const result = this.matchRule(referencedRule, tokens, tokenIndex, grammar);
                if (!result.matched && !('optional' in symbol && symbol.optional)) {
                    return result;
                }
                tokenIndex += result.tokensConsumed;
            } else if ('branches' in symbol) {
                // Branch symbol - try each branch and pick the one that consumes the most tokens
                let bestBranch: { matched: boolean; tokensConsumed: number; errors: ValidationError[] } | null = null;
                
                // console.log(`🔍 VALIDATION: Trying ${symbol.branches.length} branches at token index ${tokenIndex}, token: ${tokens[tokenIndex]?.Value}`);
                
                for (let i = 0; i < symbol.branches.length; i++) {
                    const branch = symbol.branches[i];
                    const branchResult = this.matchBranch(branch, tokens, tokenIndex, grammar);
                    // console.log(`🔍 VALIDATION: Branch ${i} result: matched=${branchResult.matched}, tokensConsumed=${branchResult.tokensConsumed}`);
                    if (branchResult.matched) {
                        // Pick the branch that consumes the most tokens
                        if (!bestBranch || branchResult.tokensConsumed > bestBranch.tokensConsumed) {
                            bestBranch = branchResult;
                        }
                    }
                }
                
                if (bestBranch) {
                    // console.log(`🔍 VALIDATION: Best branch consumes ${bestBranch.tokensConsumed} tokens`);
                    tokenIndex += bestBranch.tokensConsumed;
                } else if (!('optional' in symbol && symbol.optional)) {
                    errors.push({
                        code: 'NO_BRANCH_MATCH',
                        message: 'No valid branch found in grammar',
                        severity: 'error',
                        startPosition: token.StartPosition,
                        endPosition: token.EndPosition
                    });
                    return { matched: false, tokensConsumed: tokenIndex - startIndex, errors };
                }
            }

            // Handle repeating symbols
            if ('repeatable' in symbol && symbol.repeatable) {
                // Match as many times as possible
                while (tokenIndex < tokens.length) {
                    const currentIndex = tokenIndex;
                    
                    // Try to match the same symbol again
                    if ('token' in symbol && tokens[tokenIndex].Type === symbol.token) {
                        tokenIndex++;
                    } else if ('literal' in symbol && tokens[tokenIndex].Value.toLowerCase() === symbol.literal.toLowerCase()) {
                        tokenIndex++;
                    } else if ('reference' in symbol) {
                        const referencedGrammarEntry = this.matchGrammarEntry(grammar, symbol.reference);
                        if (referencedGrammarEntry) {
                            const referencedRule = referencedGrammarEntry.rules[0];
                            const result = this.matchRule(referencedRule, tokens, tokenIndex, grammar);
                            if (result.matched) {
                                tokenIndex += result.tokensConsumed;
                            } else {
                                break;
                            }
                        } else {
                            break;
                        }
                    } else {
                        break;
                    }
                    
                    // Prevent infinite loop
                    if (tokenIndex === currentIndex) break;
                }
            }
        }

        return { matched: true, tokensConsumed: tokenIndex - startIndex, errors: [] };
    }

    /**
     * Match a grammar branch
     */
    private matchBranch(
        branch: GrammarBranch,
        tokens: Token[],
        startIndex: number,
        grammar: ParsedGrammar
    ): { matched: boolean; tokensConsumed: number; errors: ValidationError[] } {
        let tokenIndex = startIndex;
        const errors: ValidationError[] = [];

        // Handle both array format and object with symbols property
        const branchSymbols = Array.isArray(branch) ? branch : (branch.symbols || []);

        // console.log(`🔍 VALIDATION: matchBranch starting at index ${startIndex}, branch has ${branchSymbols.length} symbols`);

        for (const symbol of branchSymbols) {
            if (tokenIndex >= tokens.length) {
                // No more tokens - check if remaining symbols are all optional
                if ('optional' in symbol && symbol.optional) {
                    // console.log(`🔍 VALIDATION: No more tokens, skipping optional symbol`);
                    continue; // Skip optional symbol
                }
                // Required symbol but no tokens left - branch doesn't match
                // console.log(`🔍 VALIDATION: No more tokens, required symbol fails branch`);
                return { matched: false, tokensConsumed: 0, errors };
            }

            const token = tokens[tokenIndex];

            if ('token' in symbol) {
                // Contextual tokens (lowercase like field_reference, bundle_reference) 
                // match any identifier or string token
                const matches = this.isRuleReference(symbol.token)
                    ? this.tokenMatchesContextualSymbol(token.Type, symbol.token)
                    : (token.Type === symbol.token);
                
                if (!matches) {
                    // console.log(`🔍 VALIDATION: Token ${symbol.token} doesn't match ${token.Type}, optional=${symbol.optional}`);
                    if ('optional' in symbol && symbol.optional) {
                        continue;
                    }
                    return { matched: false, tokensConsumed: 0, errors };
                }
                // console.log(`🔍 VALIDATION: Token ${symbol.token} matched, consuming token`);
                tokenIndex++;
            } else if ('literal' in symbol) {
                if (token.Value.toLowerCase() !== symbol.literal.toLowerCase()) {
                    // console.log(`🔍 VALIDATION: Literal "${symbol.literal}" doesn't match "${token.Value}", optional=${symbol.optional}`);
                    if ('optional' in symbol && symbol.optional) {
                        continue;
                    }
                    return { matched: false, tokensConsumed: 0, errors };
                }
                // console.log(`🔍 VALIDATION: Literal "${symbol.literal}" matched, consuming token`);
                tokenIndex++;
            } else if ('reference' in symbol) {
                // console.log(`🔍 VALIDATION: Trying to match reference ${symbol.reference}, optional=${symbol.optional}`);
                const referencedGrammarEntry = this.matchGrammarEntry(grammar, symbol.reference);
                
                if (!referencedGrammarEntry) {
                    // console.log(`🔍 VALIDATION: Reference ${symbol.reference} not found in grammar`);
                    if ('optional' in symbol && symbol.optional) {
                        continue;
                    }
                    return { matched: false, tokensConsumed: 0, errors };
                }
                
                // Match the first rule of the referenced entry
                const referencedRule = referencedGrammarEntry.rules[0];
                const result = this.matchRule(referencedRule, tokens, tokenIndex, grammar);
                // console.log(`🔍 VALIDATION: Reference ${symbol.reference} match result: matched=${result.matched}, tokensConsumed=${result.tokensConsumed}`);
                if (!result.matched) {
                    if ('optional' in symbol && symbol.optional) {
                        continue;
                    }
                    return result;
                }
                tokenIndex += result.tokensConsumed;
            }
        }

        // console.log(`🔍 VALIDATION: Branch matched, consumed ${tokenIndex - startIndex} tokens`);
        return { matched: true, tokensConsumed: tokenIndex - startIndex, errors: [] };
    }

    /**
     * Get suggestions for next token based on current position
     */
    getSuggestionsAtPosition(
        tokens: Token[],
        cursorPosition: number
    ): string[] {
        if (tokens.length === 0) {
            // Start of statement - suggest all statement keywords
            return [
                TOKEN_CREATE, TOKEN_ALTER, TOKEN_DROP, TOKEN_SHOW,  // DDL
                TOKEN_SELECT, TOKEN_ADD, TOKEN_UPDATE, TOKEN_DELETE,  // DML
                TOKEN_GRANT, TOKEN_REVOKE,  // DOL
                TOKEN_MIGRATION, TOKEN_APPLY, TOKEN_VALIDATE, TOKEN_ROLLBACK  // Migration
            ];
        }

        // console.log(`🔍 getSuggestionsAtPosition: tokens=${tokens.map(t => t.Value)}, cursorPos=${cursorPosition}`);

        // Get grammar for statement
        const grammar = this.getGrammarForStatement(tokens[0]);
        if (!grammar) {
            // console.log('🔍 No grammar found');
            return [];
        }

        const grammarEntry = this.findGrammarEntry(grammar, tokens[0]);
        if (!grammarEntry) {
            // console.log('🔍 No grammar entry found');
            return [];
        }

        // console.log(`🔍 Grammar entry root: ${grammarEntry.root}, rules: ${grammarEntry.rules.length}`);

        // Get suggestions by matching tokens through the grammar
        const suggestions = new Set<string>();
        
        for (const rule of grammarEntry.rules) {
            // Match tokens through the rule to find current position
            const matchResult = this.matchTokensForSuggestions(rule, tokens, grammar);
            
            if (matchResult.suggestions.length > 0) {
                matchResult.suggestions.forEach(s => suggestions.add(s));
            }
        }

        // console.log(`🔍 Final suggestions:`, Array.from(suggestions));
        return Array.from(suggestions);
    }

    /**
     * Match tokens through rule symbols to find what suggestions should be shown next
     */
    private matchTokensForSuggestions(
        rule: any,
        tokens: Token[],
        grammar: ParsedGrammar
    ): { suggestions: string[]; tokensConsumed: number } {
        let tokenIndex = 0;
        let symbolIndex = 0;
        
        const suggestionsSet = new Set<string>();

        while (symbolIndex < rule.symbols.length && tokenIndex <= tokens.length) {
            const symbol = rule.symbols[symbolIndex];
            
            // If we've consumed all tokens, suggest what comes next
            if (tokenIndex >= tokens.length) {
                this.addSymbolSuggestions(symbol, suggestionsSet);
                break;
            }
            
            const token = tokens[tokenIndex];
            
            // Try to match this symbol with the current token
            if ('token' in symbol) {
                // Contextual tokens (e.g. field_reference, literal) match identifier/string; literal also number/boolean
                const matches = this.isRuleReference(symbol.token)
                    ? this.tokenMatchesContextualSymbol(token.Type, symbol.token)
                    : (token.Type === symbol.token);
                
                if (matches) {
                    // Token matches - consume it
                    tokenIndex++;
                    symbolIndex++;
                } else if (symbol.optional) {
                    // Optional token doesn't match - skip symbol
                    symbolIndex++;
                } else {
                    // Required token doesn't match - this path fails
                    break;
                }
            } else if ('literal' in symbol) {
                if (token.Value.toLowerCase() === symbol.literal.toLowerCase()) {
                    // Literal matches - consume it
                    tokenIndex++;
                    symbolIndex++;
                } else if (symbol.optional) {
                    // Optional literal doesn't match - skip symbol
                    symbolIndex++;
                } else {
                    // Required literal doesn't match - this path fails
                    break;
                }
            } else if ('reference' in symbol) {
                // Try to match the referenced rule
                const referencedEntry = this.matchGrammarEntry(grammar, symbol.reference);
                if (referencedEntry && referencedEntry.rules.length > 0) {
                    const refResult = this.matchTokensForSuggestions(referencedEntry.rules[0], tokens.slice(tokenIndex), grammar);
                    
                    if (refResult.tokensConsumed > 0) {
                        // Reference consumed some tokens
                        tokenIndex += refResult.tokensConsumed;
                        symbolIndex++;
                        
                        // If reference has suggestions, we're inside it
                        if (refResult.suggestions.length > 0) {
                            return { suggestions: refResult.suggestions, tokensConsumed: tokenIndex };
                        }
                    } else if (symbol.optional) {
                        // Optional reference didn't match
                        // If we're at end of tokens, also suggest what's inside this optional reference
                        if (tokenIndex >= tokens.length && refResult.suggestions.length > 0) {
                            refResult.suggestions.forEach(s => suggestionsSet.add(s));
                        }
                        // Skip this optional symbol and continue
                        symbolIndex++;
                    } else {
                        // Required reference failed
                        break;
                    }
                } else if (symbol.optional) {
                    symbolIndex++;
                } else {
                    break;
                }
            } else if ('branches' in symbol) {
                // Try each branch to find which one matches
                let branchMatched = false;
                
                for (const branch of symbol.branches) {
                    const branchSymbols = Array.isArray(branch) ? branch : branch.symbols || [];
                    
                    // Try to match this branch
                    const branchResult = this.matchBranchForSuggestions(branchSymbols, tokens.slice(tokenIndex), grammar);
                    
                    if (branchResult.matched || branchResult.suggestions.length > 0) {
                        tokenIndex += branchResult.tokensConsumed;
                        
                        if (branchResult.suggestions.length > 0) {
                            // We're inside this branch - return its suggestions
                            return { suggestions: branchResult.suggestions, tokensConsumed: tokenIndex };
                        }
                        branchMatched = true;
                        break;
                    }
                }
                
                if (branchMatched || symbol.optional) {
                    symbolIndex++;
                } else {
                    break;
                }
            } else {
                // Unknown symbol type - skip
                symbolIndex++;
            }
        }
        
        return { suggestions: Array.from(suggestionsSet), tokensConsumed: tokenIndex };
    }

    /**
     * Match tokens through branch symbols for suggestions
     */
    private matchBranchForSuggestions(
        branchSymbols: any[],
        tokens: Token[],
        grammar: ParsedGrammar
    ): { matched: boolean; tokensConsumed: number; suggestions: string[] } {
        let tokenIndex = 0;
        let symbolIndex = 0;
        const suggestionsSet = new Set<string>();
        
        // console.log(`🔍 matchBranchForSuggestions: branchSymbols=${JSON.stringify(branchSymbols)}, tokens=${tokens.map(t => t.Value)}`);
        
        while (symbolIndex < branchSymbols.length) {
            if (tokenIndex >= tokens.length) {
                // Consumed all tokens - suggest next symbol if any remain
                if (symbolIndex < branchSymbols.length) {
                    const symbol = branchSymbols[symbolIndex];
                    this.addSymbolSuggestions(symbol, suggestionsSet);
                }
                // console.log(`🔍 Branch matched: consumed ${tokenIndex} tokens, suggestions=${Array.from(suggestionsSet)}`);
                return { matched: true, tokensConsumed: tokenIndex, suggestions: Array.from(suggestionsSet) };
            }
            
            const symbol = branchSymbols[symbolIndex];
            const token = tokens[tokenIndex];
            
            // Try to match symbol
            if ('token' in symbol) {
                const matches = this.isRuleReference(symbol.token)
                    ? this.tokenMatchesContextualSymbol(token.Type, symbol.token)
                    : (token.Type === symbol.token);
                
                if (matches) {
                    // console.log(`🔍 Branch: matched token ${symbol.token} with ${token.Value} (type: ${token.Type})`);
                    tokenIndex++;
                    symbolIndex++;
                } else if (symbol.optional) {
                    // console.log(`🔍 Branch: skipping optional token ${symbol.token} (got ${token.Type})`);
                    symbolIndex++;
                } else {
                    // console.log(`🔍 Branch: failed to match required token ${symbol.token} with ${token.Type}`);
                    return { matched: false, tokensConsumed: 0, suggestions: [] };
                }
            } else if ('literal' in symbol) {
                if (token.Value.toLowerCase() === symbol.literal.toLowerCase()) {
                    // console.log(`🔍 Branch: matched literal "${symbol.literal}"`);
                    tokenIndex++;
                    symbolIndex++;
                } else if (symbol.optional) {
                    // console.log(`🔍 Branch: skipping optional literal "${symbol.literal}"`);
                    symbolIndex++;
                } else {
                    // console.log(`🔍 Branch: failed to match required literal "${symbol.literal}" with ${token.Value}`);
                    return { matched: false, tokensConsumed: 0, suggestions: [] };
                }
            } else if ('reference' in symbol) {
                const referencedEntry = this.matchGrammarEntry(grammar, symbol.reference);
                if (referencedEntry && referencedEntry.rules.length > 0) {
                    const refResult = this.matchTokensForSuggestions(referencedEntry.rules[0], tokens.slice(tokenIndex), grammar);
                    
                    if (refResult.tokensConsumed > 0) {
                        // console.log(`🔍 Branch: reference ${symbol.reference} consumed ${refResult.tokensConsumed} tokens`);
                        tokenIndex += refResult.tokensConsumed;
                        symbolIndex++;
                        
                        if (refResult.suggestions.length > 0) {
                            return { matched: true, tokensConsumed: tokenIndex, suggestions: refResult.suggestions };
                        }
                    } else if (symbol.optional) {
                        // console.log(`🔍 Branch: skipping optional reference ${symbol.reference}`);
                        // If we're at end of tokens, also suggest what's inside this optional reference
                        if (tokenIndex >= tokens.length && refResult.suggestions.length > 0) {
                            refResult.suggestions.forEach(s => suggestionsSet.add(s));
                        }
                        symbolIndex++;
                    } else {
                        // console.log(`🔍 Branch: required reference ${symbol.reference} failed`);
                        return { matched: false, tokensConsumed: 0, suggestions: [] };
                    }
                } else if (symbol.optional) {
                    symbolIndex++;
                } else {
                    return { matched: false, tokensConsumed: 0, suggestions: [] };
                }
            } else {
                symbolIndex++;
            }
        }
        
        // console.log(`🔍 Branch fully matched: consumed ${tokenIndex} tokens`);
        return { matched: true, tokensConsumed: tokenIndex, suggestions: Array.from(suggestionsSet) };
    }

    /**
     * Map token type to its display value
     */
    private mapTokenToDisplayValue(tokenType: string): string {
        // Map token types to their actual character/string representations
        const tokenMap: Record<string, string> = {
            'ASTERISK': '*',
            'TOKEN_ASTERISK': '*',
            'COMMA': ',',
            'TOKEN_COMMA': ',',
            'SEMICOLON': ';',
            'TOKEN_SEMICOLON': ';',
            'LPAREN': '(',
            'TOKEN_LPAREN': '(',
            'RPAREN': ')',
            'TOKEN_RPAREN': ')',
            'LBRACE': '{',
            'TOKEN_LBRACE': '{',
            'RBRACE': '}',
            'TOKEN_RBRACE': '}',
            'LBRACKET': '[',
            'TOKEN_LBRACKET': '[',
            'RBRACKET': ']',
            'TOKEN_RBRACKET': ']',
            'DOT': '.',
            'TOKEN_DOT': '.',
            'COLON': ':',
            'TOKEN_COLON': ':',
            'ASSIGN': '=',
            'TOKEN_ASSIGN': '=',
            'EQ': '==',
            'TOKEN_EQ': '==',
            'NOT_EQ': '!=',
            'TOKEN_NOT_EQ': '!=',
            'LT': '<',
            'TOKEN_LT': '<',
            'GT': '>',
            'TOKEN_GT': '>',
            'LT_EQ': '<=',
            'TOKEN_LT_EQ': '<=',
            'GT_EQ': '>=',
            'TOKEN_GT_EQ': '>=',
            'PLUS': '+',
            'TOKEN_PLUS': '+',
            'MINUS': '-',
            'TOKEN_MINUS': '-',
            'SLASH': '/',
            'TOKEN_SLASH': '/'
        };
        
        return tokenMap[tokenType] || tokenType;
    }

    /**
     * Recursively add suggestions from a symbol (including all branches)
     */
    private addSymbolSuggestions(symbol: any, suggestions: Set<string>, visitedRules: Set<string> = new Set()): void {
        if ('token' in symbol) {
            const tokenValue = symbol.token;
            
            // Check if this is a reference to another rule (lowercase with underscores)
            // vs an actual keyword token (uppercase)
            if (this.isRuleReference(tokenValue)) {
                // This is a reference - follow it to get suggestions from that rule
                this.addReferenceSuggestions(tokenValue, suggestions, visitedRules);
            } else {
                // This is an actual token keyword - map to display value
                const displayValue = this.mapTokenToDisplayValue(tokenValue);
                suggestions.add(displayValue);
            }
        } else if ('literal' in symbol) {
            suggestions.add(symbol.literal);
        } else if ('reference' in symbol) {
            // Explicit reference - follow it
            this.addReferenceSuggestions(symbol.reference, suggestions, visitedRules);
        } else if ('branches' in symbol) {
            // Branches can be either:
            // 1. Array of objects with 'symbols': [{symbols: [...]}, {symbols: [...]}]
            // 2. Array of arrays (legacy): [[...], [...]]
            for (const branch of symbol.branches) {
                if (Array.isArray(branch)) {
                    // Legacy format: array of symbols
                    // Only get first symbol from each branch
                    if (branch.length > 0) {
                        this.addSymbolSuggestions(branch[0], suggestions, visitedRules);
                    }
                } else if (branch.symbols) {
                    // New format: object with symbols property
                    // Only get first symbol from each branch
                    if (branch.symbols.length > 0) {
                        this.addSymbolSuggestions(branch.symbols[0], suggestions, visitedRules);
                    }
                }
            }
        }
    }

    /**
     * Check if a token value is a rule reference (lowercase with underscores)
     * vs an actual keyword (uppercase)
     */
    private isRuleReference(tokenValue: string): boolean {
        // Rule references are lowercase and may contain underscores
        // Keywords are uppercase (SELECT, FROM, CREATE, etc.)
        return tokenValue === tokenValue.toLowerCase() && /^[a-z_]+$/.test(tokenValue);
    }

    /**
     * Check if a token type matches a contextual symbol (e.g. bundle_reference, literal).
     * For 'literal', accepts IDENT, STRING, NUMBER, and boolean keywords (TRUE/FALSE).
     * For other contextual refs (bundle_reference, field_reference), accepts IDENT and STRING only.
     */
    private tokenMatchesContextualSymbol(tokenType: string, symbolToken: string): boolean {
        if (symbolToken === 'literal') {
            return tokenType === TokenType.TOKEN_IDENT || tokenType === TokenType.TOKEN_STRING ||
                tokenType === TokenType.TOKEN_NUMBER || tokenType === TokenType.TOKEN_TRUE ||
                tokenType === TokenType.TOKEN_FALSE;
        }
        return tokenType === TokenType.TOKEN_IDENT || tokenType === TokenType.TOKEN_STRING;
    }

    /**
     * Add suggestions from a referenced rule
     */
    private addReferenceSuggestions(ruleName: string, suggestions: Set<string>, visitedRules: Set<string>): void {
        // Prevent infinite recursion
        if (visitedRules.has(ruleName)) {
            return;
        }
        visitedRules.add(ruleName);

        // Check if this is a contextual reference (needs to be resolved by suggestion engine)
        const contextualReferences = ['bundle_reference', 'database_reference', 'field_reference', 'user_reference', 'role_reference', 'literal'];
        if (contextualReferences.includes(ruleName)) {
            // Add the reference name itself - suggestion engine will resolve it
            suggestions.add(ruleName);
            return;
        }

        // Find the grammar entry for this rule
        // Search in all loaded grammars
        for (const [grammarType, parsedGrammar] of this.grammars.entries()) {
            const grammarEntry = parsedGrammar.grammar.find(entry => entry.root === ruleName);
            if (grammarEntry && grammarEntry.rules.length > 0) {
                // Get first symbols from this rule
                for (const rule of grammarEntry.rules) {
                    if (rule.symbols.length > 0) {
                        this.addSymbolSuggestions(rule.symbols[0], suggestions, visitedRules);
                    }
                }
                break;
            }
        }
    }
}

// Export singleton instance
export const grammarEngine = GrammarEngine.getInstance();

// Load grammars (for backward compatibility with existing code)
let ddlGrammar: Grammar = [];
let dmlGrammar: Grammar = [];
let dolGrammar: Grammar = [];
let migrationGrammar: Grammar = [];

const unknownGrammar: Grammar = [
    {
        "root": "unknown_statement", 
        "rules": [
            {
                "name": "unknown_statement",
                "symbols": [
                    { "token": "TOKEN_ILLEGAL" }
                ],
                "postprocess": null
            }
        ]
    }
];



// Get the first token of the input to determine the type of query
function getFirstToken(tokens: Token[]): Token | null {
    return tokens.length > 0 ? tokens[0] : null;
}

// When given the first token, determine which grammar to use
function determineStatementType(token: Token): Grammar { 
    switch (token.Type) {
        case TOKEN_CREATE:
        case TOKEN_ALTER:
        case TOKEN_DROP:
        case TOKEN_SHOW:
            return ddlGrammar!;
        case TOKEN_SELECT:
        case TOKEN_ADD:
        case TOKEN_UPDATE:
        case TOKEN_DELETE:
            return dmlGrammar!;
        case TOKEN_GRANT:
        case TOKEN_REVOKE:
            return dolGrammar!;
        case TOKEN_MIGRATION:
        case TOKEN_APPLY:
        case TOKEN_VALIDATE:
        case TOKEN_ROLLBACK:
            return migrationGrammar!;
        default:
            //throw new Error(`Unknown statement type for token: ${token.Value}`);
            return unknownGrammar!
    }

}


function getGrammarRule(grammar: Grammar, firstToken: Token): GrammarEntry | null { 
    // Assume the token passed in is the first token of the input
    const statementTypeGrammar = determineStatementType(firstToken);

    for (const grammarEntry of statementTypeGrammar) {
        
        const firstRuleSymbol = grammarEntry.rules[0].symbols[0];
        if ('token' in firstRuleSymbol && firstRuleSymbol.token === firstToken.Type) {
            return grammarEntry;
        }
    }
    return null;
}

function getSuggestionsForToken(grammarEntry: GrammarEntry, currentTokenIndex: number): Array<string> {
    const suggestions: Array<string> = [];
    for (const rule of grammarEntry.rules) {
        if (currentTokenIndex < rule.symbols.length) {
            const symbol = rule.symbols[currentTokenIndex];
            if ('token' in symbol) {
                // Some token identifiers are special, like:
                //  _commands, bundle_reference, database_reference, field_reference
                // function_reference, relationship_type, permission_list.
                // 
                // bundle_reference, database_reference, field_reference come from context cache
                // function_reference, relationship_type, permission_list are predefined values
                if (symbol.token)
                suggestions.push(symbol.token);
            } else if ('literal' in symbol) {
                suggestions.push(symbol.literal);
            }
        }
    }
    return suggestions;
}

export { GrammarEntry as grammarEntry, GrammarRule, GrammarSymbolToken, GrammarSymbolLiteral, GrammarBranches, GrammarBranch };