/**
 * ILanguageService — Pluggable Language Service Interface
 *
 * Defines the contract that any language service must implement to integrate
 * with the canvas-based code editor. The code editor delegates syntax
 * highlighting, validation, suggestions, and document analysis to
 * whatever language service is plugged in.
 *
 * Existing implementation: LanguageServiceV2 (SyndrQL)
 * Additional implementation: GraphQLLanguageService
 */

import type { FontMetrics } from './types.js';
import type { SyntaxTheme } from './syndrQL-language-serviceV2/rendering-types.js';

// ─── Shared types (language-agnostic) ────────────────────────────────────────

/**
 * A parsed statement boundary within a document.
 * Each language defines what constitutes a "statement" —
 * SyndrQL uses semicolons, GraphQL uses top-level operation braces.
 */
export interface ILanguageServiceParsedStatement {
  text: string;
  startLine: number;
  endLine: number;
  tokens: any[];
}

/**
 * Result of validating a document or statement.
 */
export interface ILanguageServiceValidationResult {
  valid: boolean;
  errors: ILanguageServiceError[];
  warnings: ILanguageServiceError[];
  info: ILanguageServiceError[];
}

/**
 * A single validation error / warning / info entry.
 */
export interface ILanguageServiceError {
  code: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  startPosition: number;
  endPosition: number;
  suggestion?: string;
  category?: string;
}

/**
 * An autocomplete suggestion.
 */
export interface ILanguageServiceSuggestion {
  label: string;
  kind: string;
  detail?: string;
  documentation?: string;
  insertText?: string;
  priority: number;
  sortText?: string;
}

/**
 * Database definition used for schema context (language-agnostic shape).
 * Both SyndrQL and GraphQL language services consume this to provide
 * context-aware suggestions and validation.
 */
export interface ILanguageServiceDatabaseDefinition {
  name: string;
  bundles: Map<string, {
    name: string;
    database: string;
    fields: Map<string, {
      name: string;
      type: string;
      constraints: {
        nullable?: boolean;
        unique?: boolean;
        primary?: boolean;
        default?: any;
      };
    }>;
    relationships: Map<string, any>;
    indexes: string[];
  }>;
}

// ─── Interface ───────────────────────────────────────────────────────────────

export interface ILanguageService {
  // ── Lifecycle ──────────────────────────────────────────────────────────────

  /** One-time async initialization (load grammars, caches, etc.) */
  initialize(): Promise<void>;

  /** Tear down resources */
  dispose(): void;

  // ── Rendering (canvas-based) ───────────────────────────────────────────────

  /** Provide the canvas context and font metrics so the LS can draw tokens */
  initializeRenderer(
    ctx: CanvasRenderingContext2D,
    fontMetrics: FontMetrics,
    theme?: SyntaxTheme,
  ): void;

  /** Called when the editor's font changes */
  updateFontMetrics(fontMetrics: FontMetrics): void;

  /** Called when the canvas element is replaced (e.g. resize) */
  updateCanvasContext(ctx: CanvasRenderingContext2D): void;

  /** Replace the current syntax theme */
  setTheme(theme: SyntaxTheme): void;

  /**
   * Render a single line with syntax highlighting.
   * Called once per visible line during every editor repaint.
   */
  renderLine(
    lineContent: string,
    lineNumber: number,
    lineY: number,
    fontMetrics: FontMetrics,
    scrollOffset: { x: number; y: number },
  ): void;

  /**
   * Render a statement-level error underline on a line.
   * Called when validation determined the containing statement is invalid.
   */
  renderStatementError(
    lineContent: string,
    lineY: number,
    fontMetrics: FontMetrics,
    scrollOffset: { x: number; y: number },
  ): void;

  // ── Document analysis ──────────────────────────────────────────────────────

  /**
   * Notify the LS that the full document content changed.
   * The LS should re-tokenize and update any caches.
   */
  updateDocument(code: string): void;

  /**
   * Split the document into language-specific statements.
   * @param source Optional document identifier for caching.
   */
  parseStatements(code: string, source?: string): ILanguageServiceParsedStatement[];

  /**
   * Full validation pass over the given code.
   * @param documentUri Optional document identifier for caching.
   */
  validate(code: string, documentUri?: string): Promise<ILanguageServiceValidationResult>;

  // ── Suggestions ────────────────────────────────────────────────────────────

  /**
   * Produce autocomplete suggestions at the given character position.
   * @param filterText Partial text the user has typed (for filtering).
   */
  getSuggestions(
    code: string,
    cursorPosition: number,
    filterText?: string,
  ): Promise<ILanguageServiceSuggestion[]>;

  /** Record that the user accepted a suggestion (for priority ranking). */
  recordSuggestionUsage(label: string): void;

  // ── Schema context ─────────────────────────────────────────────────────────

  /** Set the active database for context-aware features. */
  setDatabaseContext(databaseName: string | null): void;

  /** Provide schema data (databases, bundles, fields) for context-aware features. */
  updateContextData(databases: ILanguageServiceDatabaseDefinition[]): void;
}
