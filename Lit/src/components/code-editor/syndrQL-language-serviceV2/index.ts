/**
 * SyndrQL Language Service V2 - Main Entry Point
 * 
 * Exports all public APIs for the modern grammar-driven language service
 */

// Pluggable language service interface
export type {
    ILanguageService,
    ILanguageServiceParsedStatement,
    ILanguageServiceValidationResult,
    ILanguageServiceSuggestion,
    ILanguageServiceError,
    ILanguageServiceDatabaseDefinition,
} from '../language-service-interface';

// Main API
export { LanguageServiceV2, createLanguageService } from './language-service-v2';
export type { ValidationResult, FormatOptions, RefreshOptions, ServiceStats, ParsedStatement } from './language-service-v2';

// Adapter for backward compatibility
export { LanguageServiceAdapter, createLanguageServiceAdapter } from './language-service-adapter';
export type { LegacyValidationResult } from './language-service-adapter';

// Core components (for advanced usage)
export { GrammarEngine } from './grammar_engine';
export { Tokenizer } from './tokenizer';
export { StatementCache } from './statement-cache';
export { ErrorAnalyzer, ErrorCategory, ErrorSeverity } from './error-analyzer';
export { DocumentContext, ContextState } from './document-context';
export { CrossStatementValidator } from './cross-statement-validator';
export { SuggestionEngine, SuggestionKind } from './suggestion-engine';
export { ContextExpander, PrefetchStrategy } from './context-expander';

// Types
export type { Token } from './tokenizer';
export type { EnhancedErrorDetail } from './error-analyzer';
export { ErrorCodes } from './error-analyzer';
export type { 
    DatabaseDefinition, 
    BundleDefinition, 
    FieldDefinition,
    Relationship,
    Permission,
    MigrationDefinition 
} from './document-context';
export type { Suggestion } from './suggestion-engine';

// UI Components
export { ContextStalenessIndicator, ContextStalenessBadge, ContextStatusPanel } from './staleness-ui';

// Rendering infrastructure
export { 
    renderSyntaxHighlightedLine,
    renderTokenErrorUnderline,
    renderStatementErrorUnderline,
    organizeTokensByLine
} from './renderer';
export type { 
    SyntaxTheme,
    ErrorUnderlineStyle
} from './rendering-types';
export { 
    DEFAULT_SYNDRQL_THEME,
    STATEMENT_ERROR_STYLE,
    getColorForCategory
} from './rendering-types';
export {
    RenderingCategory,
    getRenderingCategory,
    shouldRenderTokenError,
    isKeywordToken,
    isOperatorToken,
    shouldSkipRendering
} from './token-mapping';
