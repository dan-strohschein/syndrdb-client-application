/**
 * SyndrQL Syntax Highlighting Service
 * Follows Single Responsibility Principle: Orchestrates tokenization and rendering
 * Main entry point for syntax highlighting functionality
 */

import { SyntaxToken, SyntaxTheme, SyntaxHighlightConfig, DEFAULT_SYNDRQL_THEME } from './types.js';
import { SyndrQLTokenizer } from './tokenizer.js';
import { CanvasSyntaxRenderer, organizeTokensByLine, renderSyntaxHighlightedLine } from './renderer.js';
import { FontMetrics } from '../types.js';

/**
 * Main syntax highlighting service for SyndrQL
 * Integrates tokenization and rendering for the code editor
 */
export class SyndrQLSyntaxHighlighter {
  private tokenizer: SyndrQLTokenizer;
  private renderer: CanvasSyntaxRenderer | null = null;
  private config: SyntaxHighlightConfig;
  private cachedTokens: Map<string, SyntaxToken[]> = new Map();

  constructor(config?: Partial<SyntaxHighlightConfig>) {
    this.tokenizer = new SyndrQLTokenizer();
    this.config = {
      theme: DEFAULT_SYNDRQL_THEME,
      enableSemanticHighlighting: true,
      ...config
    };
  }

  /**
   * Initialize renderer with canvas context and font metrics
   */
  initialize(context: CanvasRenderingContext2D, fontMetrics: FontMetrics): void {
    this.renderer = new CanvasSyntaxRenderer(context, fontMetrics, this.config.theme);
  }

  /**
   * Tokenize SyndrQL code and return syntax tokens
   */
  tokenize(code: string): SyntaxToken[] {
    // Check cache first for performance
    if (this.cachedTokens.has(code)) {
      return this.cachedTokens.get(code)!;
    }

    const tokens = this.tokenizer.tokenize(code);
    
    // Cache tokens for repeated rendering
    // TODO: Implement cache eviction strategy for memory management
    this.cachedTokens.set(code, tokens);
    
    return tokens;
  }

  /**
   * Render syntax-highlighted code on canvas
   */
  render(code: string): void {
    if (!this.renderer) {
      console.warn('SyndrQL syntax highlighter not initialized with canvas context');
      return;
    }

    const tokens = this.tokenize(code);
    this.renderer.render(tokens, this.config.theme);
  }

  /**
   * Render syntax-highlighted line (for integration with code editor)
   */
  renderLine(
    context: CanvasRenderingContext2D,
    lineContent: string,
    lineNumber: number,
    lineY: number,
    fontMetrics: FontMetrics,
    scrollOffset: { x: number; y: number }
  ): void {
    // Tokenize just this line for efficiency
    const tokens = this.tokenizer.tokenize(lineContent);
    
    // Adjust token positions to match the line number
    const adjustedTokens = tokens.map(token => ({
      ...token,
      line: lineNumber
    }));

    renderSyntaxHighlightedLine(
      context,
      adjustedTokens,
      lineY,
      fontMetrics,
      this.config.theme,
      scrollOffset
    );
  }

  /**
   * Get tokens organized by line for efficient rendering
   */
  getTokensByLine(code: string): Map<number, SyntaxToken[]> {
    const tokens = this.tokenize(code);
    return organizeTokensByLine(tokens);
  }

  /**
   * Update syntax highlighting theme
   */
  setTheme(theme: Partial<SyntaxTheme>): void {
    this.config.theme = { ...this.config.theme, ...theme };
    if (this.renderer) {
      this.renderer.setTheme(this.config.theme);
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SyntaxHighlightConfig>): void {
    this.config = { ...this.config, ...config };
    if (this.renderer && config.theme) {
      this.renderer.setTheme(this.config.theme);
    }
  }

  /**
   * Update font metrics (called when font changes)
   */
  updateFontMetrics(fontMetrics: FontMetrics): void {
    if (this.renderer) {
      this.renderer.updateFontMetrics(fontMetrics);
    }
  }

  /**
   * Update canvas context (called when canvas changes)
   */
  updateContext(context: CanvasRenderingContext2D): void {
    if (this.renderer) {
      this.renderer.updateContext(context);
    }
  }

  /**
   * Clear token cache (call when document changes significantly)
   */
  clearCache(): void {
    this.cachedTokens.clear();
  }

  /**
   * Get current theme
   */
  getTheme(): SyntaxTheme {
    return { ...this.config.theme };
  }

  /**
   * Get configuration
   */
  getConfig(): SyntaxHighlightConfig {
    return { ...this.config };
  }

  /**
   * Validate SyndrQL syntax and return errors
   * TODO: Implement syntax validation
   */
  validateSyntax(code: string): { isValid: boolean; errors: string[] } {
    // Placeholder for syntax validation
    // TODO: Implement proper syntax validation using grammar rules
    return { isValid: true, errors: [] };
  }

  /**
   * Get suggestions for code completion
   * TODO: Implement intelligent code completion
   */
  getSuggestions(code: string, position: number): string[] {
    // Placeholder for code completion
    // TODO: Implement context-aware suggestions
    return [];
  }
}

/**
 * Create a configured SyndrQL syntax highlighter instance
 */
export function createSyndrQLHighlighter(config?: Partial<SyntaxHighlightConfig>): SyndrQLSyntaxHighlighter {
  return new SyndrQLSyntaxHighlighter(config);
}

// Export all types and utilities for external use
export * from './types.js';
export * from './keywords.js';
export * from './tokenizer.js';
export * from './renderer.js';

// TODO: Add incremental tokenization for large documents
// TODO: Add language server protocol support
// TODO: Add configurable syntax highlighting rules
// TODO: Add support for multiple SyndrQL dialects