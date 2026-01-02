
/**
 * Virtual Document Model - Responsible for maintaining document state
 * Follows Single Responsibility Principle: Only manages document data structure
 */

import { DocumentModel, Position, Selection } from './types.js';

/**
 * Interface for document operations.
 * Separates document state from rendering concerns.
 */
export interface IDocumentModel {
  // Text content access
  getLines(): readonly string[];
  getLine(lineNumber: number): string;
  getLineCount(): number;
  
  // Text modification
  insertText(position: Position, text: string): void;
  deleteText(start: Position, end: Position): void;
  
  // Cursor management
  getCursorPosition(): Position;
  setCursorPosition(position: Position): void;
  
  // Selection management (future)
  getSelections(): readonly Selection[];
  setSelections(selections: Selection[]): void;
  
  // TODO: Phase 2 - Add undo/redo support
  // undo(): void;
  // redo(): void;
  // canUndo(): boolean;
  // canRedo(): boolean;
}

/**
 * Basic implementation of the document model.
 * Uses line-based storage for efficient editing and rendering.
 */
export class VirtualDocumentModel implements IDocumentModel {
  private document: DocumentModel;
  
  // TODO: Phase 2 - Add change tracking for undo/redo
  // private changeHistory: DocumentChange[];
  // private historyIndex: number;
  
  constructor(initialContent: string = '') {
    this.document = {
      lines: initialContent ? initialContent.split('\n') : [''],
      cursorPosition: { line: 0, column: 0 },
      selections: []
    };
  }
  
  getLines(): readonly string[] {
    return this.document.lines;
  }
  
  getLine(lineNumber: number): string {
    if (lineNumber < 0 || lineNumber >= this.document.lines.length) {
      throw new Error(`Line number ${lineNumber} out of bounds`);
    }
    return this.document.lines[lineNumber];
  }
  
  getLineCount(): number {
    return this.document.lines.length;
  }
  
  /**
   * Inserts text at the specified position.
   * Handles multi-line text by splitting on newlines.
   * Implements Monaco-style behavior: creates missing lines and pads with spaces.
   */
  insertText(position: Position, text: string): void {
   // console.log('VirtualDocumentModel.insertText called with:', { position, text, currentLineCount: this.document.lines.length });
    
    // Ensure the target line exists by creating empty lines if needed
    this.ensureLineExists(position.line);
    
    // Ensure the target column exists by padding the line with spaces if needed
    this.ensureColumnExists(position.line, position.column);
    
    //console.log('After ensuring line/column exists:', { linesAfterEnsure: this.document.lines.length, targetLine: this.document.lines[position.line] });
    
    const line = this.document.lines[position.line];
    const before = line.substring(0, position.column);
    const after = line.substring(position.column);
    
    if (text.includes('\n')) {
      // Multi-line insertion
      const newLines = text.split('\n');
      const firstLine = before + newLines[0];
      const lastLine = newLines[newLines.length - 1] + after;
      const middleLines = newLines.slice(1, -1);
      
      // Replace current line with first line
      this.document.lines[position.line] = firstLine;
      
      // Insert middle lines and last line
      this.document.lines.splice(position.line + 1, 0, ...middleLines, lastLine);
      
      // Update cursor position to end of inserted text
      this.document.cursorPosition = {
        line: position.line + newLines.length - 1,
        column: lastLine.length - after.length
      };
    } else {
      // Single-line insertion
      this.document.lines[position.line] = before + text + after;
      
      // Update cursor position
      this.document.cursorPosition = {
        line: position.line,
        column: position.column + text.length
      };
    }
    
   // console.log('After text insertion:', { finalLineCount: this.document.lines.length, cursorPosition: this.document.cursorPosition });
    
    // TODO: Phase 2 - Add change tracking for undo/redo
    // this.recordChange('insert', position, text);
  }
  
  /**
   * Ensures the specified line exists by creating empty lines if needed.
   * Monaco-style behavior: create missing lines as empty lines.
   */
  private ensureLineExists(lineIndex: number): void {
    const originalLineCount = this.document.lines.length;
    while (this.document.lines.length <= lineIndex) {
      this.document.lines.push('');
    }
    if (this.document.lines.length > originalLineCount) {
      console.log(`ensureLineExists: Created ${this.document.lines.length - originalLineCount} empty lines. Line count: ${originalLineCount} -> ${this.document.lines.length}`);
    }
  }
  
  /**
   * Ensures the specified column exists by padding the line with spaces if needed.
   * Monaco-style behavior: pad target line with spaces to reach exact position.
   */
  private ensureColumnExists(lineIndex: number, columnIndex: number): void {
    const line = this.document.lines[lineIndex];
    if (line.length < columnIndex) {
      // Pad with spaces to reach the target column
      const spacesToAdd = columnIndex - line.length;
      console.log(`ensureColumnExists: Padding line ${lineIndex} with ${spacesToAdd} spaces. Line length: ${line.length} -> ${columnIndex}`);
      this.document.lines[lineIndex] = line + ' '.repeat(spacesToAdd);
    }
  }
  
  /**
   * Deletes text between start and end positions.
   * Handles multi-line deletions.
   */
  deleteText(start: Position, end: Position): void {
    this.validatePosition(start);
    this.validatePosition(end);
    
    // Ensure start comes before end
    if (this.comparePositions(start, end) > 0) {
      [start, end] = [end, start];
    }
    
    if (start.line === end.line) {
      // Single-line deletion
      const line = this.document.lines[start.line];
      const before = line.substring(0, start.column);
      const after = line.substring(end.column);
      this.document.lines[start.line] = before + after;
    } else {
      // Multi-line deletion
      const startLine = this.document.lines[start.line];
      const endLine = this.document.lines[end.line];
      const before = startLine.substring(0, start.column);
      const after = endLine.substring(end.column);
      
      // Replace start line with merged content
      this.document.lines[start.line] = before + after;
      
      // Remove lines in between
      this.document.lines.splice(start.line + 1, end.line - start.line);
    }
    
    // Update cursor position to start of deletion
    this.document.cursorPosition = start;
    
    // TODO: Phase 2 - Add change tracking for undo/redo
    // this.recordChange('delete', start, deletedText);
  }
  
  getCursorPosition(): Position {
    return { ...this.document.cursorPosition }; // Return copy to prevent mutation
  }
  
  setCursorPosition(position: Position): void {
    this.validatePosition(position);
    this.document.cursorPosition = { ...position };
  }
  
  getSelections(): readonly Selection[] {
    return [...this.document.selections]; // Return copy to prevent mutation
  }
  
  setSelections(selections: Selection[]): void {
    // TODO: Phase 2 - Implement selection validation
    this.document.selections = [...selections];
  }
  
  /**
   * Gets the current active selection, if any.
   */
  getCurrentSelection(): Selection | null {
    return this.document.selections.length > 0 ? this.document.selections[0] : null;
  }
  
  /**
   * Sets a single selection from start to end position.
   */
  setSelection(start: Position, end: Position): void {
    // Clamp positions to valid bounds instead of throwing errors
    start = this.clampPosition(start);
    end = this.clampPosition(end);
    
    // Ensure start comes before end
    if (this.comparePositions(start, end) > 0) {
      [start, end] = [end, start];
    }
    
    const selection: Selection = {
      start,
      end,
      active: end // The end position is the active cursor
    };
    
    this.document.selections = [selection];
  }
  
  /**
   * Clears all selections.
   */
  clearSelections(): void {
    this.document.selections = [];
  }
  
  /**
   * Checks if there is any active selection.
   */
  hasSelection(): boolean {
    return this.document.selections.length > 0 && 
           this.document.selections.some(sel => !this.positionsEqual(sel.start, sel.end));
  }
  
  /**
   * Gets the selected text content.
   */
  getSelectedText(): string {
    const selection = this.getCurrentSelection();
    if (!selection || this.positionsEqual(selection.start, selection.end)) {
      return '';
    }
    
    return this.getTextRange(selection.start, selection.end);
  }
  
  /**
   * Gets text content between two positions.
   */
  private getTextRange(start: Position, end: Position): string {
    if (start.line === end.line) {
      // Single line selection
      const line = this.document.lines[start.line];
      return line.substring(start.column, end.column);
    } else {
      // Multi-line selection
      const result: string[] = [];
      
      // First line
      const firstLine = this.document.lines[start.line];
      result.push(firstLine.substring(start.column));
      
      // Middle lines
      for (let i = start.line + 1; i < end.line; i++) {
        result.push(this.document.lines[i]);
      }
      
      // Last line
      const lastLine = this.document.lines[end.line];
      result.push(lastLine.substring(0, end.column));
      
      return result.join('\n');
    }
  }
  
  /**
   * Checks if two positions are equal.
   */
  private positionsEqual(a: Position, b: Position): boolean {
    return a.line === b.line && a.column === b.column;
  }
  
  /**
   * Validates that a position is within document bounds.
   * Helps catch bugs early and provides clear error messages.
   */
  private validatePosition(position: Position): void {
    if (position.line < 0 || position.line >= this.document.lines.length) {
      throw new Error(`Line ${position.line} out of bounds (0 to ${this.document.lines.length - 1})`);
    }
    
    const lineLength = this.document.lines[position.line].length;
    if (position.column < 0 || position.column > lineLength) {
      throw new Error(`Column ${position.column} out of bounds (0 to ${lineLength})`);
    }
  }

  /**
   * Clamps a position to valid document bounds.
   * Used when positions might be out of bounds due to text deletion or other operations.
   */
  private clampPosition(position: Position): Position {
    // Ensure we have at least one line
    if (this.document.lines.length === 0) {
      return { line: 0, column: 0 };
    }

    // Clamp line to valid range
    let line = Math.max(0, Math.min(position.line, this.document.lines.length - 1));
    
    // Clamp column to valid range for the line
    const lineLength = this.document.lines[line].length;
    let column = Math.max(0, Math.min(position.column, lineLength));
    
    return { line, column };
  }
  
  /**
   * Compares two positions to determine order.
   * Returns negative if a < b, positive if a > b, zero if equal.
   */
  private comparePositions(a: Position, b: Position): number {
    if (a.line !== b.line) {
      return a.line - b.line;
    }
    return a.column - b.column;
  }

  /**
   * Get the complete document text as a single string
   * Used for autocomplete/suggestion generation
   */
  getFullDocumentText(): string {
    return this.document.lines.join('\n');
  }

  /**
   * Get text from start of document up to the specified cursor position
   * Used for contextual autocomplete suggestions
   */
  getTextUpToCursor(cursorPosition: Position): string {
    const lines = this.document.lines;
    let text = '';
    
    for (let i = 0; i < cursorPosition.line; i++) {
      if (i < lines.length) {
        text += lines[i] + '\n';
      }
    }
    
    if (cursorPosition.line < lines.length) {
      text += lines[cursorPosition.line].substring(0, cursorPosition.column);
    }
    
    return text;
  }
}