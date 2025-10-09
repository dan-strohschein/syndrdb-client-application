/**
 * SyndrQL Syntax Highlighting Service
 * Follows Single Responsibility Principle: Orchestrates tokenization and rendering
 * Main entry point for syntax highlighting functionality
 */

import { SyntaxToken, SyntaxTheme, SyntaxHighlightConfig, DEFAULT_SYNDRQL_THEME, TokenType } from './types.js';
import { SyndrQLTokenizer } from './tokenizer.js';
import { CanvasSyntaxRenderer, organizeTokensByLine, renderSyntaxHighlightedLine } from './renderer.js';
import { FontMetrics } from '../types.js';
import { GrammarValidationResult } from './grammar-validator.js';

/**
 * Main syntax highlighting service for SyndrQL
 * Integrates tokenization and rendering for the code editor
 */
export class SyndrQLSyntaxHighlighter {
  private tokenizer: SyndrQLTokenizer;
  private renderer: CanvasSyntaxRenderer | null = null;
  private config: SyntaxHighlightConfig;
  private cachedTokens: Map<string, SyntaxToken[]> = new Map();
  private grammarValidatedTokens: Map<string, SyntaxToken[]> = new Map();
  private grammarValidationResults: Map<string, GrammarValidationResult> = new Map();
  private onGrammarValidationCallback?: (code: string, tokens: SyntaxToken[]) => void;
  private isDirty: boolean = false; // Track if content has changed

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
    if (this.isDirty === false) {
      return this.cachedTokens.get(code) || [];
    }

    // Check grammar-validated cache first
    if (this.grammarValidatedTokens.has(code)) {
      return this.grammarValidatedTokens.get(code)!;
    }

    // Check basic token cache
    if (this.cachedTokens.has(code)) {
      return this.cachedTokens.get(code)!;
    }

    // Tokenize without grammar validation (returns immediately)
    const tokens = this.tokenizer.tokenize(code);
    
    // Cache basic tokens
    this.cachedTokens.set(code, tokens);
    
    return tokens;
  }

  /**
   * Handle completion of grammar validation
   */
  private handleGrammarValidationComplete(validatedTokens: SyntaxToken[], result: GrammarValidationResult): void {
    // console.log('🔥 handleGrammarValidationComplete called - invalidLines:', Array.from(result.invalidLines));
    
    // Find the code that corresponds to these tokens by comparing token content
    const tokenContent = validatedTokens
      .map(token => token.value)
      .join('');
    
    // console.log('🔥 Caching validation result for content:', tokenContent);
    
    // Cache the grammar-validated tokens and results
    this.grammarValidatedTokens.set(tokenContent, validatedTokens);
    this.grammarValidationResults.set(tokenContent, result);
    
    // Clear the basic token cache for this content since we now have validated tokens
    this.cachedTokens.delete(tokenContent);
    
    // Reset dirty flag - content has been validated
    this.isDirty = false;
    console.log('🔥 Validation complete - isDirty reset to false');
    
    // Notify external callback if set
    if (this.onGrammarValidationCallback) {
      this.onGrammarValidationCallback(tokenContent, validatedTokens);
    }
  }

  /**
   * Set callback for when grammar validation completes
   */
  setGrammarValidationCallback(callback: (code: string, tokens: SyntaxToken[]) => void): void {
    this.onGrammarValidationCallback = callback;
  }

  /**
   * Force immediate grammar validation for a code string
   * Note: Actual validation is now handled by CodeEditor statement system
   */
  forceGrammarValidation(code: string): SyntaxToken[] {
    // Just tokenize and return tokens - validation happens in CodeEditor
    return this.tokenizer.tokenize(code);
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
        const validationResult = this.grammarValidationResults.get(code);
   
        this.renderer.render(tokens, this.config.theme);
     
  }

  /**
   * Mark content as dirty (should be called on alphanumeric/symbol keypresses)
   */
  markDirty(): void {
    this.isDirty = true;
    //console.log('🔥 Content marked as dirty');
  }

  /**
   * Check if content is dirty
   */
  isDirtyContent(): boolean {
    return this.isDirty;
  }

  /**
   * Update the full document context for grammar validation
   * This should be called whenever the document changes
   */
  updateDocumentContext(fullText: string): void {
    // Trigger tokenization with grammar validation
    
    this.tokenize(fullText);
  }

  /**
   * Get grammar validation result for current document
   */
  getGrammarValidationResult(code: string): GrammarValidationResult | undefined {
    return this.grammarValidationResults.get(code);
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
    scrollOffset: { x: number; y: number },
    fullDocumentText?: string
  ): void {
    // If we have full document text, check for grammar validation results
    let hasErrors = false;
    if (fullDocumentText) {
      const validationResult = this.grammarValidationResults.get(fullDocumentText);
      hasErrors = validationResult ? !validationResult.isValid : false;
    }

    // Tokenize just this line for syntax highlighting
    const tokens = this.tokenizer.tokenize(lineContent);
    
    // Adjust token positions to match the line number
    const adjustedTokens = tokens.map(token => ({
      ...token,
      line: lineNumber
    }));

    // Render the line with syntax highlighting
    renderSyntaxHighlightedLine(
      context,
      adjustedTokens,
      lineY,
      fontMetrics,
      this.config.theme,
      scrollOffset
    );

    // If this line has grammar errors, render line-level error underlines
    if (hasErrors) {
      this.renderLineErrorUnderline(
        context,
        adjustedTokens,
        lineY,
        fontMetrics,
        scrollOffset
      );
    }
  }

  /**
   * Render error underline for an entire line
   */
  private renderLineErrorUnderline(
    context: CanvasRenderingContext2D,
    tokens: SyntaxToken[],
    lineY: number,
    fontMetrics: FontMetrics,
    scrollOffset: { x: number; y: number }
  ): void {
    const errorStyle = this.config.theme.errorUnderline || {
      color: '#ff0000',
      thickness: 2,
      amplitude: 2,
      frequency: 6
    };

    // Find significant tokens (non-whitespace)
    const significantTokens = tokens.filter(token => 
      token.type !== TokenType.WHITESPACE && 
      token.type !== TokenType.NEWLINE &&
      token.value.trim().length > 0
    );

    if (significantTokens.length === 0) return;

    // Calculate line bounds
    const startX = -scrollOffset.x; // Start from beginning of line
    let endX = startX;
    
    // Find the end of the last significant token
    significantTokens.forEach(token => {
      const tokenEndX = (token.column - 1 + token.value.length) * fontMetrics.characterWidth - scrollOffset.x;
      endX = Math.max(endX, tokenEndX);
    });

    // Position the underline below the text
    const underlineY = lineY + fontMetrics.descent + 14;

    context.save();
    context.strokeStyle = errorStyle.color;
    context.lineWidth = errorStyle.thickness;
    context.beginPath();

    // Draw squiggly line spanning the line content
    let currentX = startX;
    let isUp = true;

    context.moveTo(currentX, underlineY);

    while (currentX < endX) {
      currentX += errorStyle.frequency;
      const nextY = isUp ? underlineY - errorStyle.amplitude : underlineY + errorStyle.amplitude;
      context.lineTo(Math.min(currentX, endX), nextY);
      isUp = !isUp;
    }

    context.stroke();
    context.restore();
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
    // console.log('🔥 Clearing all caches (tokens and validation results)');
    this.cachedTokens.clear();
    this.grammarValidatedTokens.clear();
    this.grammarValidationResults.clear();
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
export * from './error-codes.js';
export * from './error-analyzer.js';

// TODO: Add incremental tokenization for large documents
// TODO: Add language server protocol support
// TODO: Add configurable syntax highlighting rules
// TODO: Add support for multiple SyndrQL dialects