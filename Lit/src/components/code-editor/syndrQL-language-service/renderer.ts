/**
 * Canvas-based Syntax Renderer for Code Editor
 * Follows Single Responsibility Principle: Only handles rendering syntax-highlighted tokens
 * Integrates with the canvas-based code editor rendering pipeline
 */

import { SyntaxToken, TokenType, SyntaxTheme, ISyntaxRenderer } from './types.js';
import { FontMetrics } from '../types.js';

/**
 * Renders syntax-highlighted tokens on canvas
 * Designed to integrate with the existing code editor rendering system
 */
export class CanvasSyntaxRenderer implements ISyntaxRenderer {
  private context: CanvasRenderingContext2D;
  private fontMetrics: FontMetrics;
  private theme: SyntaxTheme;

  constructor(
    context: CanvasRenderingContext2D,
    fontMetrics: FontMetrics,
    theme: SyntaxTheme
  ) {
    this.context = context;
    this.fontMetrics = fontMetrics;
    this.theme = theme;
  }

  /**
   * Render syntax-highlighted tokens on canvas
   */
  render(tokens: SyntaxToken[], theme: SyntaxTheme): void {
    this.theme = theme;
    
    for (const token of tokens) {
      this.renderToken(token);
    }
  }

  /**
   * Update the syntax theme
   */
  setTheme(theme: SyntaxTheme): void {
    this.theme = theme;
  }

  /**
   * Render a single token with appropriate styling
   */
  private renderToken(token: SyntaxToken): void {
    // Skip whitespace and newlines - they don't need visual rendering
    if (token.type === TokenType.WHITESPACE || token.type === TokenType.NEWLINE) {
      return;
    }

    const color = this.getTokenColor(token.type);
    const position = this.calculateTokenPosition(token);

    // Set the color for this token
    this.context.fillStyle = color;
    
    // Render the token text
    this.context.fillText(token.value, position.x, position.y);
  }

  /**
   * Get the color for a token type from the current theme
   */
  private getTokenColor(tokenType: TokenType): string {
    switch (tokenType) {
      case TokenType.KEYWORD:
        return this.theme.keyword;
      case TokenType.IDENTIFIER:
        return this.theme.identifier;
      case TokenType.LITERAL:
        return this.theme.literal;
      case TokenType.STRING:
        return this.theme.string;
      case TokenType.NUMBER:
        return this.theme.number;
      case TokenType.OPERATOR:
        return this.theme.operator;
      case TokenType.PUNCTUATION:
        return this.theme.punctuation;
      case TokenType.COMMENT:
        return this.theme.comment;
      case TokenType.PLACEHOLDER:
        return this.theme.placeholder;
      default:
        return this.theme.unknown;
    }
  }

  /**
   * Calculate the pixel position for a token based on line/column
   */
  private calculateTokenPosition(token: SyntaxToken): { x: number; y: number } {
    const x = (token.column - 1) * this.fontMetrics.characterWidth;
    const y = (token.line - 1) * this.fontMetrics.lineHeight;
    
    return { x, y };
  }

  /**
   * Update font metrics (called when font changes)
   */
  updateFontMetrics(fontMetrics: FontMetrics): void {
    this.fontMetrics = fontMetrics;
  }

  /**
   * Update canvas context (called when canvas changes)
   */
  updateContext(context: CanvasRenderingContext2D): void {
    this.context = context;
  }
}

/**
 * Utility function to convert line-based tokens to render-ready format
 * Handles integration with the code editor's line-by-line rendering
 */
export function organizeTokensByLine(tokens: SyntaxToken[]): Map<number, SyntaxToken[]> {
  const lineTokens = new Map<number, SyntaxToken[]>();

  for (const token of tokens) {
    const lineNumber = token.line;
    
    if (!lineTokens.has(lineNumber)) {
      lineTokens.set(lineNumber, []);
    }
    
    lineTokens.get(lineNumber)!.push(token);
  }

  // Sort tokens within each line by column position
  for (const [lineNumber, tokens] of lineTokens) {
    tokens.sort((a, b) => a.column - b.column);
  }

  return lineTokens;
}

/**
 * Render syntax-highlighted line with proper spacing
 * Integrates with the code editor's existing line rendering system
 */
export function renderSyntaxHighlightedLine(
  context: CanvasRenderingContext2D,
  lineTokens: SyntaxToken[],
  lineY: number,
  fontMetrics: FontMetrics,
  theme: SyntaxTheme,
  scrollOffset: { x: number; y: number }
): void {
  let currentX = -scrollOffset.x;
  let lastColumn = 1;

  for (const token of lineTokens) {
    // Handle spacing between tokens
    const columnGap = token.column - lastColumn;
    if (columnGap > 0) {
      currentX += columnGap * fontMetrics.characterWidth;
    }

    // Skip rendering whitespace and newlines
    if (token.type !== TokenType.WHITESPACE && token.type !== TokenType.NEWLINE) {
      const color = getTokenColorFromTheme(token.type, theme);
      context.fillStyle = color;
      context.fillText(token.value, currentX, lineY);
    }

    // Advance position
    currentX += token.value.length * fontMetrics.characterWidth;
    lastColumn = token.column + token.value.length;
  }
}

/**
 * Get token color from theme (utility function)
 */
function getTokenColorFromTheme(tokenType: TokenType, theme: SyntaxTheme): string {
  switch (tokenType) {
    case TokenType.KEYWORD:
      return theme.keyword;
    case TokenType.IDENTIFIER:
      return theme.identifier;
    case TokenType.LITERAL:
      return theme.literal;
    case TokenType.STRING:
      return theme.string;
    case TokenType.NUMBER:
      return theme.number;
    case TokenType.OPERATOR:
      return theme.operator;
    case TokenType.PUNCTUATION:
      return theme.punctuation;
    case TokenType.COMMENT:
      return theme.comment;
    case TokenType.PLACEHOLDER:
      return theme.placeholder;
    default:
      return theme.unknown;
  }
}

// TODO: Add support for syntax error highlighting
// TODO: Add support for semantic highlighting (variable references, etc.)
// TODO: Add performance optimizations for large documents
// TODO: Add support for background highlighting (selection, current line, etc.)