/**
 * Core types and interfaces for SyndrQL syntax highlighting
 * Follows Single Responsibility Principle: Only defines types and interfaces
 */

/**
 * Token types for syntax highlighting
 */
export enum TokenType {
  KEYWORD = 'keyword',
  IDENTIFIER = 'identifier', 
  LITERAL = 'literal',
  OPERATOR = 'operator',
  PUNCTUATION = 'punctuation',
  WHITESPACE = 'whitespace',
  NEWLINE = 'newline',
  COMMENT = 'comment',
  STRING = 'string',
  NUMBER = 'number',
  PLACEHOLDER = 'placeholder',
  UNKNOWN = 'unknown'
}

/**
 * Represents a syntax token with position information
 */
export interface SyntaxToken {
  type: TokenType;
  value: string;
  startPosition: number;
  endPosition: number;
  line: number;
  column: number;
  // TODO: Add semantic information for advanced features like hover/autocomplete
  semantic?: {
    category?: string;
    description?: string;
    isFunction?: boolean;
    isReserved?: boolean;
  };
}

/**
 * Color theme for syntax highlighting
 */
export interface SyntaxTheme {
  keyword: string;
  identifier: string;
  literal: string;
  operator: string;
  punctuation: string;
  comment: string;
  string: string;
  number: string;
  placeholder: string;
  unknown: string;
  // TODO: Add theme variants (dark/light mode support)
}

/**
 * Default syntax highlighting theme
 */
export const DEFAULT_SYNDRQL_THEME: SyntaxTheme = {
  keyword: '#569CD6',      // VS Code blue
  identifier: '#9CDCFE',   // Light blue
  literal: '#CE9178',      // Orange
  operator: '#D4D4D4',     // Light gray
  punctuation: '#D4D4D4',  // Light gray
  comment: '#6A9955',      // Green
  string: '#CE9178',       // Orange
  number: '#B5CEA8',       // Light green
  placeholder: '#4EC9B0',  // Cyan
  unknown: '#D4D4D4'       // Light gray
};

/**
 * Interface for tokenization services
 * Follows Open/Closed Principle: Extensible for other SQL dialects
 */
export interface ITokenizer {
  tokenize(input: string): SyntaxToken[];
  // TODO: Add tokenizeRange for partial retokenization performance optimization
}

/**
 * Interface for syntax highlighting renderers
 * Follows Open/Closed Principle: Different rendering strategies can be implemented
 */
export interface ISyntaxRenderer {
  render(tokens: SyntaxToken[], theme: SyntaxTheme): void;
  setTheme(theme: SyntaxTheme): void;
  // TODO: Add renderRange for performance optimization during editing
}

/**
 * Configuration for the syntax highlighting system
 */
export interface SyntaxHighlightConfig {
  theme: SyntaxTheme;
  enableSemanticHighlighting: boolean;
  // TODO: Add configuration for custom keyword extensions
  customKeywords?: string[];
  // TODO: Add configuration for performance tuning
  performanceMode?: 'fast' | 'accurate';
}

/**
 * Result of syntax analysis for advanced features
 */
export interface SyntaxAnalysisResult {
  tokens: SyntaxToken[];
  errors: SyntaxError[];
  // TODO: Add AST information for advanced language features
  // TODO: Add symbol table for identifier resolution
}

/**
 * Syntax error information
 */
export interface SyntaxError {
  message: string;
  line: number;
  column: number;
  startPosition: number;
  endPosition: number;
  severity: 'error' | 'warning' | 'info';
}