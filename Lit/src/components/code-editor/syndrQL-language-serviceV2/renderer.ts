/**
 * Canvas-based Syntax Renderer for V2 Language Service
 * 
 * Renders syntax-highlighted tokens from V2 tokenizer on canvas with error decorations.
 * Adapted from V1 renderer to work with V2's token structure (capitalized properties).
 */

import { TokenType } from './token_types.js';
import type { Token } from './tokenizer.js';
import { FontMetrics } from '../types.js';
import { 
  SyntaxTheme, 
  ErrorUnderlineStyle,
  STATEMENT_ERROR_STYLE,
  getColorForCategory 
} from './rendering-types.js';
import { 
  getRenderingCategory, 
  shouldRenderTokenError, 
  shouldSkipRendering 
} from './token-mapping.js';

/**
 * Renders syntax-highlighted V2 tokens on canvas
 * Integrates with the code editor's line-by-line rendering system
 */
export function renderSyntaxHighlightedLine(
  context: CanvasRenderingContext2D,
  lineTokens: Token[],
  lineNumber: number,
  lineY: number,
  fontMetrics: FontMetrics,
  theme: SyntaxTheme,
  scrollOffset: { x: number; y: number }
): void {
  let currentX = -scrollOffset.x;
  let lastColumn = 1;

  for (const token of lineTokens) {
    // Handle spacing between tokens
    const columnGap = token.Column - lastColumn;
    if (columnGap > 0) {
      currentX += columnGap * fontMetrics.characterWidth;
    }

    // Handle multi-line tokens: extract only the portion for this line
    let tokenValueToRender = token.Value;
    
    // Check if token contains newlines (multi-line token like multi-line comments)
    if (token.Value.includes('\n')) {
      // Split by newlines
      const lines = token.Value.split('\n');
      
      // Calculate which line of the token we're on
      // If token starts on line 1 and we're rendering line 1, use lines[0]
      // If token starts on line 1 and we're rendering line 2, use lines[1]
      const tokenLineIndex = lineNumber - token.Line;
      
      if (tokenLineIndex >= 0 && tokenLineIndex < lines.length) {
        tokenValueToRender = lines[tokenLineIndex];
      } else {
        // This token doesn't have content on this line, skip it
        continue;
      }
    }

    // Skip rendering whitespace and newlines
    if (!shouldSkipRendering(token.Type)) {
      // Get rendering category and color
      const category = getRenderingCategory(token.Type);
      const color = getColorForCategory(category, theme);
      
      context.fillStyle = color;
      context.fillText(tokenValueToRender, currentX, lineY);
      
      // Add small squiggly underline for unknown/illegal tokens
      if (shouldRenderTokenError(token.Type)) {
        renderTokenErrorUnderline(
          context,
          currentX,
          lineY,
          tokenValueToRender.length * fontMetrics.characterWidth,
          fontMetrics,
          theme
        );
      }
    }

    // Advance position based on the rendered content
    currentX += tokenValueToRender.length * fontMetrics.characterWidth;
    lastColumn = token.Column + tokenValueToRender.length;
  }
}

/**
 * Render a small squiggly red underline for token-level syntax errors (unknown/illegal tokens)
 * 
 * @param context Canvas rendering context
 * @param x X position of the token
 * @param y Y position (baseline) of the line
 * @param width Width of the underline
 * @param fontMetrics Font metrics for positioning
 * @param theme Syntax theme containing error styling
 */
export function renderTokenErrorUnderline(
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
  
  drawSquigglyLine(context, x, underlineY, width, errorStyle);
}

/**
 * Render a large squiggly red underline for statement-level validation errors
 * 
 * @param context Canvas rendering context
 * @param lineText Full text of the line
 * @param lineY Y position (baseline) of the line
 * @param fontMetrics Font metrics for positioning
 * @param scrollOffset Current scroll offset
 */
export function renderStatementErrorUnderline(
  context: CanvasRenderingContext2D,
  lineText: string,
  lineY: number,
  fontMetrics: FontMetrics,
  scrollOffset: { x: number; y: number }
): void {
  // Find significant content (non-whitespace) on this line
  const trimmedLine = lineText.trim();
  if (trimmedLine.length === 0) {
    return; // Don't render underlines on empty lines
  }
  
  // Calculate the position of the first and last non-whitespace characters
  const firstNonWhitespace = lineText.search(/\S/);
  const lastNonWhitespace = lineText.search(/\S\s*$/);
  
  if (firstNonWhitespace === -1) {
    return; // No content to underline
  }
  
  // Calculate start and end positions
  const startX = (firstNonWhitespace * fontMetrics.characterWidth) - scrollOffset.x;
  const endX = ((lastNonWhitespace + 1) * fontMetrics.characterWidth) - scrollOffset.x;
  
  // Position the underline below the text
  const underlineY = lineY + fontMetrics.descent + fontMetrics.lineHeight - 4;
  const width = endX - startX;
  
  drawSquigglyLine(context, startX, underlineY, width, STATEMENT_ERROR_STYLE);
}

/**
 * Draw a squiggly line (wave pattern) on the canvas
 * 
 * @param context Canvas rendering context
 * @param x Starting X position
 * @param y Y position for the wave center
 * @param width Width of the squiggly line
 * @param style Error underline style configuration
 */
function drawSquigglyLine(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  style: ErrorUnderlineStyle
): void {
  context.save();
  context.strokeStyle = style.color;
  context.lineWidth = style.thickness;
  context.beginPath();
  
  // Draw squiggly line
  let currentX = x;
  let isUp = true;
  
  context.moveTo(currentX, y);
  
  while (currentX < x + width) {
    currentX += style.frequency;
    const nextY = isUp ? y - style.amplitude : y + style.amplitude;
    context.lineTo(Math.min(currentX, x + width), nextY);
    isUp = !isUp;
  }
  
  context.stroke();
  context.restore();
}

/**
 * Organize tokens by line number for efficient rendering
 * Multi-line tokens (containing newlines) are added to each line they span
 * 
 * @param tokens Array of V2 tokens
 * @returns Map of line numbers to token arrays
 */
export function organizeTokensByLine(tokens: Token[]): Map<number, Token[]> {
  const lineTokens = new Map<number, Token[]>();

  for (const token of tokens) {
    const startLine = token.Line;
    
    // Check if token spans multiple lines
    if (token.Value.includes('\n')) {
      const lines = token.Value.split('\n');
      
      // Add this token to each line it spans
      for (let i = 0; i < lines.length; i++) {
        const lineNumber = startLine + i;
        
        if (!lineTokens.has(lineNumber)) {
          lineTokens.set(lineNumber, []);
        }
        
        lineTokens.get(lineNumber)!.push(token);
      }
    } else {
      // Single-line token, just add to its line
      if (!lineTokens.has(startLine)) {
        lineTokens.set(startLine, []);
      }
      
      lineTokens.get(startLine)!.push(token);
    }
  }

  // Sort tokens within each line by column position
  for (const [lineNumber, tokens] of lineTokens) {
    tokens.sort((a, b) => a.Column - b.Column);
  }

  return lineTokens;
}

/**
 * Check if a line has any validation errors based on V2's enhanced error details
 * 
 * @param lineNumber Line number (1-based)
 * @param errors Array of enhanced error details from V2 validation
 * @returns true if line contains errors
 */
export function lineHasValidationErrors(
  lineNumber: number,
  errors: Array<{ Line?: number, startPosition?: number, endPosition?: number }>
): boolean {
  return errors.some(error => 
    error.Line === lineNumber || 
    (error.startPosition !== undefined && error.endPosition !== undefined)
  );
}
