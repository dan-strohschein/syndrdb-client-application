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
  render(tokens: SyntaxToken[], theme: SyntaxTheme, invalidLines?: Set<number>): void {
    this.theme = theme;
    
    for (const token of tokens) {
      this.renderToken(token);
    }
    
    // Render line-level error underlines if provided
    if (invalidLines && invalidLines.size > 0) {
      this.renderLineErrorUnderlines(tokens, invalidLines);
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
    
    // Add squiggly underline for unknown tokens
    if (token.type === TokenType.UNKNOWN) {
      this.renderErrorUnderline(token, position);
    }
  }
  
  /**
   * Render a squiggly red underline for syntax errors
   */
  private renderErrorUnderline(token: SyntaxToken, position: { x: number; y: number }): void {
    const errorStyle = this.theme.errorUnderline || {
      color: '#ff0000',
      thickness: 1,
      amplitude: 1,
      frequency: 4
    };
    
    // Position the underline well below the text
    // Use descent plus additional padding to ensure it's clearly below
    const underlineY = position.y + this.fontMetrics.descent + 12; // Increased to put it clearly below
    const width = token.value.length * this.fontMetrics.characterWidth;
    
    this.context.save();
    this.context.strokeStyle = errorStyle.color;
    this.context.lineWidth = errorStyle.thickness;
    this.context.beginPath();
    
    // Draw squiggly line
    let currentX = position.x;
    let isUp = true;
    
    this.context.moveTo(currentX, underlineY);
    
    while (currentX < position.x + width) {
      currentX += errorStyle.frequency;
      const nextY = isUp ? underlineY - errorStyle.amplitude : underlineY + errorStyle.amplitude;
      this.context.lineTo(Math.min(currentX, position.x + width), nextY);
      isUp = !isUp;
    }
    
    this.context.stroke();
    this.context.restore();
  }

  /**
   * Render squiggly red underlines for entire lines with grammar errors
   */
  private renderLineErrorUnderlines(tokens: SyntaxToken[], invalidLines: Set<number>): void {
    const errorStyle = this.theme.errorUnderline || {
      color: '#ff0000',
      thickness: 2, // Slightly thicker for line errors
      amplitude: 2,
      frequency: 6
    };
    
    // Group tokens by line
    const tokensByLine = new Map<number, SyntaxToken[]>();
    tokens.forEach(token => {
      if (!tokensByLine.has(token.line)) {
        tokensByLine.set(token.line, []);
      }
      tokensByLine.get(token.line)!.push(token);
    });
    
    // Render underlines for invalid lines
    invalidLines.forEach(lineNumber => {
      const lineTokens = tokensByLine.get(lineNumber);
      if (lineTokens && lineTokens.length > 0) {
        this.renderLineUnderline(lineTokens, errorStyle);
      }
    });
  }
  
  /**
   * Render an underline spanning an entire line of tokens
   */
  private renderLineUnderline(lineTokens: SyntaxToken[], errorStyle: any): void {
    // Find the bounds of the line content
    const significantTokens = lineTokens.filter(token => 
      token.type !== TokenType.WHITESPACE && 
      token.type !== TokenType.NEWLINE &&
      token.value.trim().length > 0
    );
    
    if (significantTokens.length === 0) return;
    
    const firstToken = significantTokens[0];
    const lastToken = significantTokens[significantTokens.length - 1];
    
    const startPosition = this.calculateTokenPosition(firstToken);
    const endPosition = this.calculateTokenPosition(lastToken);
    const endX = endPosition.x + (lastToken.value.length * this.fontMetrics.characterWidth);
    
    // Position the underline below the text line
    const underlineY = startPosition.y + this.fontMetrics.descent + 14;
    const lineWidth = endX - startPosition.x;
    
    this.context.save();
    this.context.strokeStyle = errorStyle.color;
    this.context.lineWidth = errorStyle.thickness;
    this.context.beginPath();
    
    // Draw squiggly line spanning the entire line content
    let currentX = startPosition.x;
    let isUp = true;
    
    this.context.moveTo(currentX, underlineY);
    
    while (currentX < endX) {
      currentX += errorStyle.frequency;
      const nextY = isUp ? underlineY - errorStyle.amplitude : underlineY + errorStyle.amplitude;
      this.context.lineTo(Math.min(currentX, endX), nextY);
      isUp = !isUp;
    }
    
    this.context.stroke();
    this.context.restore();
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
      
      // Add squiggly underline for unknown tokens
      if (token.type === TokenType.UNKNOWN) {
        renderSyntaxErrorUnderline(
          context,
          currentX,
          lineY,
          token.value.length * fontMetrics.characterWidth,
          fontMetrics,
          theme
        );
      }
    }

    // Advance position
    currentX += token.value.length * fontMetrics.characterWidth;
    lastColumn = token.column + token.value.length;
  }
}

/**
 * Render a squiggly red underline for syntax errors
 */
function renderSyntaxErrorUnderline(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  fontMetrics: FontMetrics,
  theme: SyntaxTheme
): void {
  const errorStyle = theme.errorUnderline || {
    color: '#ff0000',
    thickness: 1,
    amplitude: 1,
    frequency: 4
  };
  
  // Position the underline below the text
  // y is baseline, descent is how far text goes below baseline, +12 for clear separation
  const underlineY = y + fontMetrics.descent + 12;
  
  context.save();
  context.strokeStyle = errorStyle.color;
  context.lineWidth = errorStyle.thickness;
  context.beginPath();
  
  // Draw squiggly line
  let currentX = x;
  let isUp = true;
  
  context.moveTo(currentX, underlineY);
  
  while (currentX < x + width) {
    currentX += errorStyle.frequency;
    const nextY = isUp ? underlineY - errorStyle.amplitude : underlineY + errorStyle.amplitude;
    context.lineTo(Math.min(currentX, x + width), nextY);
    isUp = !isUp;
  }
  
  context.stroke();
  context.restore();
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

// TODO: Add support for semantic highlighting (variable references, etc.)
// TODO: Add performance optimizations for large documents
// TODO: Add support for background highlighting (selection, current line, etc.)
// TODO: Add configuration options for error underline styling (color, thickness, etc.)