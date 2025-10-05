/**
 * Font Metrics - Responsible for measuring text and calculating coordinates
 * Follows Single Responsibility Principle: Only handles font measurement and coordinate conversion
 */

import { FontMetrics, Position, Coordinates, ScrollOffset, CharacterPosition, ScreenPosition, CharacterGrid } from './types.js';

/**
 * Interface for coordinate system operations.
 * Separates coordinate calculations from rendering concerns.
 */
export interface ICoordinateSystem extends CharacterGrid {
  // Core coordinate conversion
  screenToPosition(screen: Coordinates): Position;
  positionToScreen(position: Position): Coordinates;
  
  // Enhanced coordinate conversion with precision
  screenToCharacterPosition(screen: Coordinates): CharacterPosition;
  characterPositionToScreen(position: CharacterPosition): ScreenPosition;
  
  // Scrolling support
  setScrollOffset(offset: ScrollOffset): void;
  getScrollOffset(): ScrollOffset;
  
  // Font metrics
  getFontMetrics(): FontMetrics;
  setFontMetrics(metrics: FontMetrics): void;
  
  // Viewport management
  setViewportSize(width: number, height: number): void;
  getViewportSize(): { width: number; height: number };
}

/**
 * Enhanced implementation of coordinate system for monospace fonts with Monaco-like precision.
 * Provides character-based grid system for accurate text positioning.
 */
export class MonospaceCoordinateSystem implements ICoordinateSystem {
  private fontMetrics: FontMetrics;
  private scrollOffset: ScrollOffset = { x: 0, y: 0 };
  private viewportSize = { width: 0, height: 0 };
  
  // TODO: Phase 2 - Add support for proportional fonts
  // TODO: Phase 3 - Add high DPI display support
  
  constructor(fontMetrics: FontMetrics) {
    this.fontMetrics = fontMetrics;
  }
  
  /**
   * Converts screen coordinates to document position.
   * Accounts for scrolling offset.
   */
  screenToPosition(screen: Coordinates): Position {
    // Adjust for scroll offset
    const adjustedX = screen.x + this.scrollOffset.x;
    const adjustedY = screen.y + this.scrollOffset.y;
    
    // Simple grid calculation for monospace
    const line = Math.floor(adjustedY / this.fontMetrics.lineHeight);
    const column = Math.floor(adjustedX / this.fontMetrics.characterWidth);
    
    // Ensure non-negative values
    return {
      line: Math.max(0, line),
      column: Math.max(0, column)
    };
  }
  
  /**
   * Enhanced coordinate conversion with sub-character precision.
   */
  screenToCharacterPosition(screen: Coordinates): CharacterPosition {
    // Adjust for scroll offset
    const adjustedX = screen.x + this.scrollOffset.x;
    const adjustedY = screen.y + this.scrollOffset.y;
    
    console.log('screenToCharacterPosition:', {
      input: screen,
      scrollOffset: this.scrollOffset,
      adjusted: { x: adjustedX, y: adjustedY },
      fontMetrics: { lineHeight: this.fontMetrics.lineHeight, characterWidth: this.fontMetrics.characterWidth }
    });
    
    // Calculate line and base column
    const line = Math.floor(adjustedY / this.fontMetrics.lineHeight);
    const exactColumn = adjustedX / this.fontMetrics.characterWidth;
    const column = Math.floor(exactColumn);
    
    // Calculate sub-character offset (0.0 to 1.0)
    const characterOffset = exactColumn - column;
    
    // Ensure non-negative values
    const result = {
      line: Math.max(0, line),
      column: Math.max(0, column),
      characterOffset: Math.max(0, Math.min(1, characterOffset))
    };
    
    console.log('screenToCharacterPosition result:', result);
    
    return result;
  }
  
  /**
   * Converts document position to screen coordinates.
   * Accounts for scrolling offset.
   */
  positionToScreen(position: Position): Coordinates {
    // Simple grid calculation for monospace
    const x = position.column * this.fontMetrics.characterWidth - this.scrollOffset.x;
    const y = position.line * this.fontMetrics.lineHeight - this.scrollOffset.y;
    
    return { x, y };
  }
  
  /**
   * Enhanced position to screen conversion with sub-character precision.
   */
  characterPositionToScreen(position: CharacterPosition): ScreenPosition {
    const offset = position.characterOffset || 0;
    const baseX = position.column * this.fontMetrics.characterWidth;
    const x = baseX + (offset * this.fontMetrics.characterWidth) - this.scrollOffset.x;
    const y = position.line * this.fontMetrics.lineHeight - this.scrollOffset.y;
    
    return {
      x,
      y,
      viewportX: x + this.scrollOffset.x,
      viewportY: y + this.scrollOffset.y
    };
  }
  
  /**
   * CharacterGrid implementation methods
   */
  screenToCharacter(screen: Coordinates): CharacterPosition {
    return this.screenToCharacterPosition(screen);
  }
  
  characterToScreen(position: CharacterPosition): ScreenPosition {
    return this.characterPositionToScreen(position);
  }
  
  /**
   * Snap screen coordinates to nearest character boundary.
   */
  snapToCharacter(screen: Coordinates): Coordinates {
    const adjustedX = screen.x + this.scrollOffset.x;
    const adjustedY = screen.y + this.scrollOffset.y;
    
    // Snap to character grid
    const snappedX = Math.round(adjustedX / this.fontMetrics.characterWidth) * this.fontMetrics.characterWidth;
    const snappedY = Math.round(adjustedY / this.fontMetrics.lineHeight) * this.fontMetrics.lineHeight;
    
    return {
      x: snappedX - this.scrollOffset.x,
      y: snappedY - this.scrollOffset.y
    };
  }
  
  /**
   * Snap screen coordinates to nearest line boundary.
   */
  snapToLine(screen: Coordinates): Coordinates {
    const adjustedY = screen.y + this.scrollOffset.y;
    const snappedY = Math.round(adjustedY / this.fontMetrics.lineHeight) * this.fontMetrics.lineHeight;
    
    return {
      x: screen.x,
      y: snappedY - this.scrollOffset.y
    };
  }
  
  /**
   * Get pixel bounds for a character at the given position.
   */
  getCharacterBounds(position: Position): { left: number; top: number; width: number; height: number } {
    const screenPos = this.positionToScreen(position);
    
    return {
      left: screenPos.x,
      top: screenPos.y,
      width: this.fontMetrics.characterWidth,
      height: this.fontMetrics.lineHeight
    };
  }
  
  setScrollOffset(offset: ScrollOffset): void {
    this.scrollOffset = { ...offset };
  }
  
  getScrollOffset(): ScrollOffset {
    return { ...this.scrollOffset };
  }
  
  getFontMetrics(): FontMetrics {
    return { ...this.fontMetrics };
  }
  
  setFontMetrics(metrics: FontMetrics): void {
    this.fontMetrics = { ...metrics };
  }
  
  setViewportSize(width: number, height: number): void {
    this.viewportSize = { width, height };
  }
  
  getViewportSize(): { width: number; height: number } {
    return { ...this.viewportSize };
  }
}

/**
 * Utility class for measuring font metrics.
 * Provides accurate measurements for different font configurations.
 */
export class FontMeasurer {
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  
  constructor() {
    this.canvas = document.createElement('canvas');
    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get 2D canvas context for font measurement');
    }
    this.context = ctx;
  }
  
  /**
   * Measures enhanced font metrics for a given font configuration.
   * Returns comprehensive measurements needed for precise coordinate calculations.
   */
  measureFont(fontFamily: string, fontSize: number, fontWeight: string = 'normal'): FontMetrics {
    const font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    this.context.font = font;
    
    // Measure a representative character for width (monospace assumption)
    const characterWidth = this.context.measureText('M').width;
    
    // Get actual font metrics from TextMetrics API
    const textMetrics = this.context.measureText('Mg');
    
    // Calculate actual line height using font metrics
    // For canvas rendering, line height should match the actual font bounding box
    let lineHeight: number;
    let ascent: number;
    let descent: number;
    
    if (textMetrics.fontBoundingBoxAscent !== undefined && textMetrics.fontBoundingBoxDescent !== undefined) {
      // Use actual font metrics if available (modern browsers)
      ascent = textMetrics.fontBoundingBoxAscent;
      descent = textMetrics.fontBoundingBoxDescent;
      lineHeight = ascent + descent;
      console.log('Using actual font metrics:', { ascent, descent, lineHeight, fontSize });
    } else {
      // Fallback to font size for line height (more accurate than arbitrary multiplier)
      lineHeight = fontSize;
      ascent = Math.ceil(fontSize * 0.8);
      descent = Math.ceil(fontSize * 0.2);
      console.log('Using fallback font metrics:', { ascent, descent, lineHeight, fontSize });
    }
    
    // Calculate baseline offset (distance from top to baseline)
    const baseline = ascent;
    
    // Enhanced metrics for precision positioning
    const xHeight = Math.ceil(fontSize * 0.5);   // Height of lowercase 'x'
    const capHeight = Math.ceil(fontSize * 0.7); // Height of uppercase letters
    
    const metrics = {
      characterWidth,
      lineHeight,
      baseline,
      ascent,
      descent,
      xHeight,
      capHeight
    };
    
    console.log('Final font metrics:', metrics);
    return metrics;
  }
  
  /**
   * Verifies that a font is truly monospace.
   * Helps catch configuration errors early.
   */
  verifyMonospace(fontFamily: string, fontSize: number): boolean {
    const font = `${fontSize}px ${fontFamily}`;
    this.context.font = font;
    
    // Test various characters to ensure they have the same width
    const testChars = ['M', 'i', 'W', '1', ' ', '.'];
    const widths = testChars.map(char => this.context.measureText(char).width);
    
    // All widths should be the same for monospace
    const firstWidth = widths[0];
    return widths.every(width => Math.abs(width - firstWidth) < 0.1);
  }
  
  // TODO: Phase 2 - Add proportional font measurement
  // measureTextWidth(text: string, font: string): number;
  // getCharacterPositions(text: string, font: string): number[];
}