/**
 * GraphQL Language Service — Main class implementing ILanguageService
 *
 * Composes: GraphQLTokenizer, GraphQLValidator, GraphQLSuggestionEngine,
 * GraphQLSchemaContext. Provides syntax highlighting, validation,
 * and autocomplete for GraphQL queries & mutations.
 */

import type {
  ILanguageService,
  ILanguageServiceParsedStatement,
  ILanguageServiceValidationResult,
  ILanguageServiceSuggestion,
  ILanguageServiceDatabaseDefinition,
} from '../language-service-interface.js';
import type { FontMetrics } from '../types.js';
import type { SyntaxTheme } from '../syndrQL-language-serviceV2/rendering-types.js';
import { getColorForCategory } from '../syndrQL-language-serviceV2/rendering-types.js';
import { renderStatementErrorUnderline } from '../syndrQL-language-serviceV2/renderer.js';

import { GraphQLTokenizer } from './graphql-tokenizer.js';
import { GraphQLTokenType, type GraphQLToken } from './graphql-token-types.js';
import { getGraphQLRenderingCategory, shouldSkipGraphQLRendering } from './graphql-token-mapping.js';
import { GraphQLValidator } from './graphql-validator.js';
import { GraphQLSuggestionEngine } from './graphql-suggestion-engine.js';
import { GraphQLSchemaContext } from './graphql-schema-context.js';
import { DEFAULT_GRAPHQL_THEME } from './graphql-rendering-types.js';

export class GraphQLLanguageService implements ILanguageService {
  private tokenizer = new GraphQLTokenizer();
  private validator = new GraphQLValidator();
  private suggestionEngine = new GraphQLSuggestionEngine();
  private schemaContext = new GraphQLSchemaContext();

  private initialized = false;
  private currentDocument = '';

  // Rendering state
  private canvasContext: CanvasRenderingContext2D | null = null;
  private fontMetrics: FontMetrics | null = null;
  private theme: SyntaxTheme = DEFAULT_GRAPHQL_THEME;

  /** Tokens organized by line for efficient rendering. */
  private tokensByLine = new Map<number, GraphQLToken[]>();

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    if (this.initialized) return;
    // Wire schema context into validator & suggestion engine
    this.validator.setSchemaContext(this.schemaContext);
    this.suggestionEngine.setSchemaContext(this.schemaContext);
    this.initialized = true;
  }

  dispose(): void {
    this.initialized = false;
    this.tokensByLine.clear();
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  initializeRenderer(
    ctx: CanvasRenderingContext2D,
    fontMetrics: FontMetrics,
    theme?: SyntaxTheme,
  ): void {
    this.canvasContext = ctx;
    this.fontMetrics = fontMetrics;
    if (theme) this.theme = theme;
  }

  updateFontMetrics(fontMetrics: FontMetrics): void {
    this.fontMetrics = fontMetrics;
  }

  updateCanvasContext(ctx: CanvasRenderingContext2D): void {
    this.canvasContext = ctx;
  }

  setTheme(theme: SyntaxTheme): void {
    this.theme = theme;
  }

  renderLine(
    lineContent: string,
    lineNumber: number,
    lineY: number,
    fontMetrics: FontMetrics,
    scrollOffset: { x: number; y: number },
  ): void {
    if (!this.canvasContext) return;

    const ctx = this.canvasContext;
    let lineTokens = this.tokensByLine.get(lineNumber) ?? [];

    // Fall back to tokenizing just this line if no cached tokens
    if (lineTokens.length === 0 && lineContent.length > 0) {
      lineTokens = this.tokenizer.tokenize(lineContent).map(t => ({
        ...t,
        Line: lineNumber,
      }));
    }

    let currentX = -scrollOffset.x;
    let lastColumn = 1;

    for (const token of lineTokens) {
      // Spacing gap between tokens
      const columnGap = token.Column - lastColumn;
      if (columnGap > 0) {
        currentX += columnGap * fontMetrics.characterWidth;
      }

      // Handle multi-line tokens (block strings)
      let value = token.Value;
      if (value.includes('\n')) {
        const lines = value.split('\n');
        const lineIdx = lineNumber - token.Line;
        if (lineIdx >= 0 && lineIdx < lines.length) {
          value = lines[lineIdx];
        } else {
          continue;
        }
      }

      if (!shouldSkipGraphQLRendering(token.Type)) {
        const category = getGraphQLRenderingCategory(token.Type);
        ctx.fillStyle = getColorForCategory(category, this.theme);
        ctx.fillText(value, currentX, lineY);
      }

      currentX += value.length * fontMetrics.characterWidth;
      lastColumn = token.Column + value.length;
    }
  }

  renderStatementError(
    lineContent: string,
    lineY: number,
    fontMetrics: FontMetrics,
    scrollOffset: { x: number; y: number },
  ): void {
    if (!this.canvasContext) return;
    // Reuse the shared squiggly-line renderer from SyndrQL
    renderStatementErrorUnderline(this.canvasContext, lineContent, lineY, fontMetrics, scrollOffset);
  }

  // ── Document analysis ──────────────────────────────────────────────────────

  updateDocument(code: string): void {
    this.currentDocument = code;

    // Tokenize the full document
    const tokens = this.tokenizer.tokenize(code);

    // Organize tokens by line
    this.tokensByLine.clear();
    for (const token of tokens) {
      const startLine = token.Line;

      if (token.Value.includes('\n')) {
        // Multi-line token: add to each line it spans
        const lines = token.Value.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const ln = startLine + i;
          if (!this.tokensByLine.has(ln)) this.tokensByLine.set(ln, []);
          this.tokensByLine.get(ln)!.push(token);
        }
      } else {
        if (!this.tokensByLine.has(startLine)) this.tokensByLine.set(startLine, []);
        this.tokensByLine.get(startLine)!.push(token);
      }
    }

    // Sort each line's tokens by column
    for (const [, lineTokens] of this.tokensByLine) {
      lineTokens.sort((a, b) => a.Column - b.Column);
    }
  }

  /**
   * Parse the document into "statements". In GraphQL each top-level
   * operation (query/mutation) or anonymous block is one statement,
   * delimited by balanced brace counting.
   */
  parseStatements(code: string, source?: string): ILanguageServiceParsedStatement[] {
    const tokens = this.tokenizer.tokenize(code);
    const significant = tokens.filter(
      t =>
        t.Type !== GraphQLTokenType.WHITESPACE &&
        t.Type !== GraphQLTokenType.NEWLINE &&
        t.Type !== GraphQLTokenType.COMMENT &&
        t.Type !== GraphQLTokenType.COMMA &&
        t.Type !== GraphQLTokenType.EOF,
    );

    const statements: ILanguageServiceParsedStatement[] = [];
    let i = 0;

    while (i < significant.length) {
      const startToken = significant[i];
      const isOp =
        startToken.Type === GraphQLTokenType.QUERY ||
        startToken.Type === GraphQLTokenType.MUTATION ||
        startToken.Type === GraphQLTokenType.SUBSCRIPTION ||
        startToken.Type === GraphQLTokenType.FRAGMENT;

      let depth = 0;
      const stmtTokens: GraphQLToken[] = [];
      let foundBrace = false;
      const startIdx = i;

      // Collect tokens for this operation
      while (i < significant.length) {
        const tok = significant[i];
        stmtTokens.push(tok);

        if (tok.Type === GraphQLTokenType.LBRACE) {
          depth++;
          foundBrace = true;
        } else if (tok.Type === GraphQLTokenType.RBRACE) {
          depth--;
          if (depth <= 0 && foundBrace) {
            i++;
            break;
          }
        }
        i++;

        // If we started with an op keyword and haven't found a brace yet, keep going
        // If we started with a non-op non-brace token, consume just that one token
        if (!isOp && startToken.Type !== GraphQLTokenType.LBRACE && !foundBrace) {
          break;
        }
      }

      if (stmtTokens.length > 0) {
        const first = stmtTokens[0];
        const last = stmtTokens[stmtTokens.length - 1];
        const text = code.substring(first.StartPosition, last.EndPosition);

        statements.push({
          text,
          startLine: first.Line,
          endLine: last.Line,
          tokens: stmtTokens as any[],
        });
      }
    }

    return statements;
  }

  async validate(code: string, documentUri?: string): Promise<ILanguageServiceValidationResult> {
    const tokens = this.tokenizer.tokenize(code);
    return this.validator.validate(tokens, code);
  }

  // ── Suggestions ────────────────────────────────────────────────────────────

  async getSuggestions(
    code: string,
    cursorPosition: number,
    filterText?: string,
  ): Promise<ILanguageServiceSuggestion[]> {
    const tokens = this.tokenizer.tokenize(code);
    let suggestions = this.suggestionEngine.getSuggestions(tokens, cursorPosition, code);

    if (filterText) {
      const lower = filterText.toLowerCase();
      suggestions = suggestions.filter(s => s.label.toLowerCase().startsWith(lower));
    }

    return suggestions;
  }

  recordSuggestionUsage(label: string): void {
    this.suggestionEngine.recordUsage(label);
  }

  // ── Schema context ─────────────────────────────────────────────────────────

  setDatabaseContext(databaseName: string | null): void {
    this.schemaContext.setDatabaseContext(databaseName);
  }

  updateContextData(databases: ILanguageServiceDatabaseDefinition[]): void {
    this.schemaContext.updateContextData(databases);
  }
}
