/**
 * Core types and interfaces shared across the code editor components.
 * Following Single Responsibility Principle - this file contains only type definitions.
 */

// Core document position and selection types
export interface Position {
  line: number;     // 0-based line index
  column: number;   // 0-based character index
}

export interface Selection {
  start: Position;
  end: Position;
  active: Position;  // The end that moves when extending selection
}

// Input handling types
export interface KeyCommand {
  type: 'navigation' | 'editing' | 'special';
  key: string;
  modifiers: {
    ctrl: boolean;
    shift: boolean;
    alt: boolean;
    meta: boolean;
  };
}

// Font and rendering metrics
export interface FontMetrics {
  characterWidth: number;   // Fixed width for monospace
  lineHeight: number;       // Height including line spacing
  baseline: number;         // Text baseline offset from top
  
  // Enhanced metrics for precision
  ascent: number;          // Height above baseline
  descent: number;         // Depth below baseline
  xHeight: number;         // Height of lowercase 'x'
  capHeight: number;       // Height of uppercase letters
  
  // TODO: Phase 2 - Add proportional font support
  // measureText(text: string): number;
}

// Coordinate system for mouse/screen interactions
export interface Coordinates {
  x: number;
  y: number;
}

export interface ScrollOffset {
  x: number;
  y: number;
}

// Enhanced coordinate system for precise positioning
export interface CharacterPosition extends Position {
  // Character offset within the line for sub-character precision
  characterOffset?: number; // 0.0 to 1.0 representing position within character
}

export interface ScreenPosition {
  x: number;
  y: number;
  // Viewport-relative coordinates (before scroll offset)
  viewportX: number;
  viewportY: number;
}

// Grid system for character-based positioning
export interface CharacterGrid {
  // Convert between coordinate systems
  screenToCharacter(screen: Coordinates): CharacterPosition;
  characterToScreen(position: CharacterPosition): ScreenPosition;
  
  // Snap to character boundaries
  snapToCharacter(screen: Coordinates): Coordinates;
  snapToLine(screen: Coordinates): Coordinates;
  
  // Get character bounds
  getCharacterBounds(position: Position): {
    left: number;
    top: number;
    width: number;
    height: number;
  };
}

// Viewport and scrolling types
export interface ViewportInfo {
  width: number;           // Viewport width in pixels
  height: number;          // Viewport height in pixels
  visibleLines: number;    // Number of lines that fit in viewport
  visibleColumns: number;  // Number of characters that fit in viewport
}

export interface ScrollBounds {
  maxScrollX: number;      // Maximum horizontal scroll (content width - viewport width)
  maxScrollY: number;      // Maximum vertical scroll (content height - viewport height)
  canScrollLeft: boolean;
  canScrollRight: boolean;
  canScrollUp: boolean;
  canScrollDown: boolean;
}

export interface VisibleRange {
  startLine: number;       // First visible line (0-based)
  endLine: number;         // Last visible line (0-based, inclusive)
  startColumn: number;     // First visible column (0-based) 
  endColumn: number;       // Last visible column (0-based, inclusive)
}

export interface ScrollbarInfo {
  vertical: {
    visible: boolean;
    height: number;        // Scrollbar track height
    thumbHeight: number;   // Scrollbar thumb height
    thumbPosition: number; // Scrollbar thumb position
  };
  horizontal: {
    visible: boolean;
    width: number;         // Scrollbar track width
    thumbWidth: number;    // Scrollbar thumb width
    thumbPosition: number; // Scrollbar thumb position
  };
}

// Scrollbar interaction types
export interface ScrollbarRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScrollbarHitInfo {
  type: 'none' | 'vertical-thumb' | 'vertical-track' | 'horizontal-thumb' | 'horizontal-track';
  region: ScrollbarRegion | null;
}

export interface ScrollbarDragState {
  active: boolean;
  type: 'vertical' | 'horizontal' | null;
  startMousePos: Coordinates;
  startScrollOffset: ScrollOffset;
  thumbOffset: number; // Offset from mouse to thumb start
}

// Theme configuration for visual styling
export interface EditorTheme {
  selectionBackgroundColor: string;   // bg-accent-content equivalent
  selectionTextColor: string;         // text-primary-content equivalent
  backgroundColor: string;            // bg-info-content equivalent
  textColor: string;                  // Default text color
  cursorColor: string;               // Cursor color
}

// Mouse event types for selection handling
export interface MouseEventData {
  coordinates: Coordinates;
  button: number;
  buttons: number;
  modifiers: {
    ctrl: boolean;
    shift: boolean;
    alt: boolean;
    meta: boolean;
  };
}

export interface SelectionRange {
  start: Position;
  end: Position;
}

// Selection state for tracking active selections
export interface SelectionState {
  isSelecting: boolean;
  startPosition: Position | null;
  currentSelection: Selection | null;
}

// Viewport and rendering
export interface LineRange {
  start: number;  // Inclusive
  end: number;    // Exclusive
}

export interface RenderRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Editor state
export interface CursorState {
  position: Position;
  visible: boolean;         // For blinking animation
  blinkTimer: number;       // Animation timing ID
  width: number;            // Visual width in pixels
  color: string;            // Theme-based color
}

// Document model
export interface DocumentModel {
  lines: string[];          // Array of line strings
  cursorPosition: Position; // Current cursor location
  selections: Selection[];  // Multiple selection support (future)
}

// TODO: Phase 2 - Add syntax highlighting types
// export interface SyntaxToken {
//   start: number;
//   end: number;
//   type: string;
//   color: string;
// }