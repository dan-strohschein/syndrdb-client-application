

interface TextRenderer {
  renderVisibleLines(startLine: number, endLine: number): void;
  measureCharacter(char: string): { width: number, height: number };
  coordinateToPosition(x: number, y: number): { line: number, column: number };
  positionToCoordinate(line: number, column: number): { x: number, y: number };
}

/*


Layered Rendering System

Background Layer: Canvas for background colors, selection highlights
Text Layer: DOM elements for actual text (for accessibility and text selection)
Overlay Layer: Canvas for cursors, line numbers, decorations
Scrolling Container: Manages viewport and virtual scrolling

Virtual Scrolling

Only render visible lines (viewport culling)
Use transform/translate for smooth scrolling
Calculate visible range based on scroll position
*/