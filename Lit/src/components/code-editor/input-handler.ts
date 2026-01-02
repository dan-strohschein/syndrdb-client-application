/**
 * Input Handler - Responsible for capturing and processing user input
 * Follows Single Responsibility Principle: Only handles input capture and routing
 */

import { KeyCommand, Position, Coordinates, MouseEventData, SelectionState, CharacterPosition } from './types.js';
import type { VirtualDocumentModel } from './virtual-dom.js';
import type { ICoordinateSystem } from './font-metrics.js';

/**
 * Interface for handling different types of user input.
 * Separates input capture from input processing.
 */
export interface IInputHandler {
  handleKeyPress(event: KeyboardEvent): void;
  handleMouseClick(coordinates: Coordinates): void;
  handleTextInput(text: string): void;
  
  // TODO: Phase 2 - Add more input types
  // handleMouseDrag(start: Coordinates, end: Coordinates): void;
  // handleWheel(deltaX: number, deltaY: number): void;
}

/**
 * Interface for the hidden input element pattern.
 * This captures actual browser text input (including IME support).
 */
export interface IInputCapture {
  hiddenTextArea: HTMLTextAreaElement;  // Invisible, positioned off-screen
  focusElement: HTMLCanvasElement;      // Canvas that appears focused
  
  // Core input capture methods
  captureTextInput(): string;
  captureSpecialKeys(): KeyCommand[];
  
  // Focus management
  focus(): void;
  blur(): void;
  hasFocus(): boolean;
}

/**
 * Basic implementation of input capture using hidden textarea pattern.
 * This solves the fundamental problem that canvas elements can't receive text input.
 */
export class InputCapture implements IInputCapture {
  public readonly hiddenTextArea: HTMLTextAreaElement;
  public readonly focusElement: HTMLCanvasElement;
  
  private textInputCallback?: (text: string) => void;
  private keyCommandCallback?: (command: KeyCommand) => void;
  private mouseDownCallback?: (event: MouseEventData) => void;
  private mouseMoveCallback?: (event: MouseEventData) => void;
  private mouseUpCallback?: (event: MouseEventData) => void;
  private wheelCallback?: (deltaX: number, deltaY: number) => void;
  private currentKeyEvent?: KeyboardEvent; // Track current key event
  
  constructor(canvas: HTMLCanvasElement) {
    this.focusElement = canvas;
    this.hiddenTextArea = this.createHiddenTextArea();
    this.setupEventListeners();
    
    // TODO: Phase 2 - Add IME composition support
    // TODO: Phase 3 - Add touch/mobile input support
  }
  
  /**
   * Creates and positions the hidden textarea for input capture.
   * Must be in DOM to receive focus but invisible to user.
   */
  private createHiddenTextArea(): HTMLTextAreaElement {
    const textarea = document.createElement('textarea');
    
    // Make it invisible but focusable
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    textarea.style.width = '1px';
    textarea.style.height = '1px';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    
    // Prevent auto-corrections and suggestions
    textarea.setAttribute('autocomplete', 'off');
    textarea.setAttribute('autocorrect', 'off');
    textarea.setAttribute('autocapitalize', 'off');
    textarea.setAttribute('spellcheck', 'false');
    
    // Add to DOM so it can receive focus
    document.body.appendChild(textarea);
    
    return textarea;
  }
  
  /**
   * Sets up event listeners for input capture.
   * Routes canvas clicks to hidden textarea for focus management and handles mouse selection.
   */
  private setupEventListeners(): void {
    // Handle mouse down for starting selection
    this.focusElement.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.focus();
      
      if (this.mouseDownCallback) {
        const mouseEvent = this.createMouseEventData(e);
        this.mouseDownCallback(mouseEvent);
      }
    });
    
    // Handle mouse move for extending selection
    this.focusElement.addEventListener('mousemove', (e) => {
      if (this.mouseMoveCallback) {
        const mouseEvent = this.createMouseEventData(e);
        this.mouseMoveCallback(mouseEvent);
      }
    });
    
    // Handle mouse up for ending selection
    this.focusElement.addEventListener('mouseup', (e) => {
      if (this.mouseUpCallback) {
        const mouseEvent = this.createMouseEventData(e);
        this.mouseUpCallback(mouseEvent);
      }
    });
    
    // Prevent context menu on canvas
    this.focusElement.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
    
    // Handle mouse wheel for scrolling
    this.focusElement.addEventListener('wheel', (e) => {
      e.preventDefault(); // Prevent page scrolling
      if (this.wheelCallback) {
        this.wheelCallback(e.deltaX, e.deltaY);
      }
    });
    
    // Capture text input from hidden textarea
    this.hiddenTextArea.addEventListener('input', (e) => {
      const text = this.captureTextInput();
      if (text && this.textInputCallback) {
        this.textInputCallback(text);
      }
    });
    
    // Capture special keys before they modify textarea
    this.hiddenTextArea.addEventListener('keydown', (e) => {
      this.currentKeyEvent = e;
      
      // console.log('🔑 KEY EVENT:', {
      //   key: e.key,
      //   ctrlKey: e.ctrlKey,
      //   metaKey: e.metaKey,
      //   isSpecialKey: this.isSpecialKey(e.key),
      //   isModifierCombo: this.isModifierKeyCombo(e)
      // });
      
      // Check if this is a special key we want to handle
      if (this.isSpecialKey(e.key) || this.isModifierKeyCombo(e)) {
    //    console.log('🎯 HANDLING KEY COMMAND');
        e.preventDefault(); // Prevent default browser behavior
        
        const command = this.createKeyCommand(e);
        if (command && this.keyCommandCallback) {
          this.keyCommandCallback(command);
        }
      }
    });
    
    // TODO: Phase 2 - Add composition events for IME
    // this.hiddenTextArea.addEventListener('compositionstart', ...);
    // this.hiddenTextArea.addEventListener('compositionend', ...);
  }
  
  captureTextInput(): string {
    const text = this.hiddenTextArea.value;
    // Clear the textarea to capture next input
    this.hiddenTextArea.value = '';
    return text;
  }
  
  /**
   * Checks if a key should be handled as a special command.
   */
  private isSpecialKey(key: string): boolean {
    const specialKeys = [
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
      'Tab',
      'Enter',
      'Backspace', 'Delete',
      'Home', 'End',
      'PageUp', 'PageDown',
      'Escape'
    ];
    
    return specialKeys.includes(key);
  }

  /**
   * Checks if this is a modifier key combination we want to handle (like Ctrl+C, Cmd+V, etc.)
   */
  private isModifierKeyCombo(event: KeyboardEvent): boolean {
    // Check if Ctrl or Cmd (Meta) is pressed
    const hasModifier = event.ctrlKey || event.metaKey;
    
    if (!hasModifier) {
      return false;
    }
    
    // Define keys that we handle when combined with modifiers
    const modifierKeys = ['c', 'v', 'x', 'a', 'z', 'y']; // clipboard + select all + undo/redo
    
    return modifierKeys.includes(event.key.toLowerCase());
  }
  
  /**
   * Creates a KeyCommand from a keyboard event.
   */
  private createKeyCommand(event: KeyboardEvent): KeyCommand | null {
    let type: 'navigation' | 'editing' | 'special';
    
    // Categorize the key
    switch (event.key) {
      case 'ArrowUp':
      case 'ArrowDown':
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'Home':
      case 'End':
      case 'PageUp':
      case 'PageDown':
        type = 'navigation';
        break;
      case 'Tab':
      case 'Enter':
      case 'Backspace':
      case 'Delete':
        type = 'editing';
        break;
      default:
        type = 'special';
    }
    
    return {
      type,
      key: event.key,
      modifiers: {
        ctrl: event.ctrlKey,
        shift: event.shiftKey,
        alt: event.altKey,
        meta: event.metaKey
      }
    };
  }
  
  captureSpecialKeys(): KeyCommand[] {
    // This method is now handled in the keydown event listener
    // Keeping for interface compatibility
    if (this.currentKeyEvent && this.isSpecialKey(this.currentKeyEvent.key)) {
      const command = this.createKeyCommand(this.currentKeyEvent);
      return command ? [command] : [];
    }
    return [];
  }
  
  /**
   * Creates MouseEventData from a native mouse event.
   */
  private createMouseEventData(event: MouseEvent): MouseEventData {
    const rect = this.focusElement.getBoundingClientRect();
    
    return {
      coordinates: {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      },
      button: event.button,
      buttons: event.buttons,
      modifiers: {
        ctrl: event.ctrlKey,
        shift: event.shiftKey,
        alt: event.altKey,
        meta: event.metaKey
      }
    };
  }
  
  focus(): void {
    this.hiddenTextArea.focus();
  }
  
  blur(): void {
    this.hiddenTextArea.blur();
  }
  
  hasFocus(): boolean {
    return document.activeElement === this.hiddenTextArea;
  }
  
  /**
   * Sets callback for text input events.
   * Following dependency inversion - caller provides the handler.
   */
  onTextInput(callback: (text: string) => void): void {
    this.textInputCallback = callback;
  }
  
  /**
   * Sets callback for key command events.
   * Following dependency inversion - caller provides the handler.
   */
  onKeyCommand(callback: (command: KeyCommand) => void): void {
    this.keyCommandCallback = callback;
  }
  
  /**
   * Sets callback for mouse down events.
   */
  onMouseDown(callback: (event: MouseEventData) => void): void {
    this.mouseDownCallback = callback;
  }
  
  /**
   * Sets callback for mouse move events.
   */
  onMouseMove(callback: (event: MouseEventData) => void): void {
    this.mouseMoveCallback = callback;
  }
  
  /**
   * Sets callback for mouse up events.
   */
  onMouseUp(callback: (event: MouseEventData) => void): void {
    this.mouseUpCallback = callback;
  }
  
  /**
   * Sets callback for mouse wheel events.
   */
  onWheel(callback: (deltaX: number, deltaY: number) => void): void {
    this.wheelCallback = callback;
  }
  
  /**
   * Cleanup method to remove DOM elements and event listeners.
   * Important for memory management.
   */
  destroy(): void {
    this.hiddenTextArea.remove();
    // Event listeners are automatically removed when element is removed
  }
}

/**
 * Interface for processing input commands and applying them to document model.
 * Separates input processing logic from the main editor component.
 */
export interface IInputProcessor {
  processKeyCommand(command: KeyCommand, documentModel: VirtualDocumentModel): void;
  processTextInput(text: string, documentModel: VirtualDocumentModel): void;
}

/**
 * Input processor that handles key commands and text input.
 * Follows Single Responsibility Principle: Only processes input and updates document.
 */
export class InputProcessor implements IInputProcessor {
  private selectionState: SelectionState = {
    isSelecting: false,
    startPosition: null,
    currentSelection: null
  };
  
  // Coordinate system will be injected for position calculations
  private coordinateSystem?: ICoordinateSystem;
  private preferredColumn: number = 0; // Track the user's preferred column for up/down movement
  
  setCoordinateSystem(coordinateSystem: ICoordinateSystem): void {
    this.coordinateSystem = coordinateSystem;
  }
  
  /**
   * Enhanced coordinate conversion methods for drag-and-drop support
   */
  
  /**
   * Convert mouse coordinates to precise text position for drag-and-drop insertion.
   * Returns position with sub-character precision for accurate text placement.
   * Allows positions beyond current document bounds for Monaco-style expansion.
   */
  getInsertionPosition(mouseCoords: Coordinates, documentModel: VirtualDocumentModel): CharacterPosition {
    if (!this.coordinateSystem) {
      // Fallback to basic position
      return { line: 0, column: 0, characterOffset: 0 };
    }
    
    // Use enhanced coordinate conversion for sub-character precision
    const charPos = this.coordinateSystem.screenToCharacterPosition(mouseCoords);
    
    // For Monaco-style behavior, allow positions beyond current document bounds
    // The document model will handle creating lines and padding as needed
    console.log('Raw insertion position from coordinate system:', charPos);
    
    return {
      line: Math.max(0, charPos.line), // Only ensure non-negative
      column: Math.max(0, charPos.column), // Only ensure non-negative
      characterOffset: charPos.characterOffset
    };
  }
  
  /**
   * Get character bounds for visual feedback during drag operations.
   */
  getCharacterBounds(position: Position): { left: number; top: number; width: number; height: number } | null {
    if (!this.coordinateSystem) return null;
    
    return this.coordinateSystem.getCharacterBounds(position);
  }
  
  /**
   * Snap mouse coordinates to nearest character boundary.
   * Useful for character-precise selection and positioning.
   */
  snapToCharacter(mouseCoords: Coordinates): Coordinates {
    if (!this.coordinateSystem) return mouseCoords;
    
    return this.coordinateSystem.snapToCharacter(mouseCoords);
  }
  
  /**
   * Snap mouse coordinates to nearest line boundary.
   * Useful for line-based operations.
   */
  snapToLine(mouseCoords: Coordinates): Coordinates {
    if (!this.coordinateSystem) return mouseCoords;
    
    return this.coordinateSystem.snapToLine(mouseCoords);
  }
  
  /**
   * Processes key commands and updates the document model accordingly.
   */
  processKeyCommand(command: KeyCommand, documentModel: VirtualDocumentModel): void {
    // console.log('Processing key command:', command);
    
    const currentPos = documentModel.getCursorPosition();
    let newPos: Position | null = null;
    
    switch (command.key) {
      case 'ArrowLeft':
        newPos = this.moveCursorLeft(currentPos, documentModel);
        this.handleArrowKeyWithSelection(newPos, command.modifiers.shift, documentModel);
        return; // Skip normal cursor positioning since we handled it
        
      case 'ArrowRight':
        newPos = this.moveCursorRight(currentPos, documentModel);
        this.handleArrowKeyWithSelection(newPos, command.modifiers.shift, documentModel);
        return; // Skip normal cursor positioning since we handled it
        
      case 'ArrowUp':
        newPos = this.moveCursorUp(currentPos, documentModel);
        this.handleArrowKeyWithSelection(newPos, command.modifiers.shift, documentModel);
        return; // Skip normal cursor positioning since we handled it
        
      case 'ArrowDown':
        newPos = this.moveCursorDown(currentPos, documentModel);
        this.handleArrowKeyWithSelection(newPos, command.modifiers.shift, documentModel);
        return; // Skip normal cursor positioning since we handled it
        
      case 'Tab':
        this.handleTabInput(currentPos, documentModel);
        break;
        
      case 'Enter':
        this.handleEnterInput(currentPos, documentModel);
        break;
        
      case 'Backspace':
        this.handleBackspaceInput(currentPos, documentModel);
        break;
        
      case 'Delete':
        this.handleDeleteInput(currentPos, documentModel);
        break;
        
      // TODO: Phase 3 - Add more key commands
      case 'Home':
      case 'End':
        console.log(`${command.key} not implemented yet`);
        break;
        
      default:
        console.log('Unknown key command:', command.key);
    }
    
    // Update cursor position if navigation occurred
    if (newPos !== null) {
      documentModel.setCursorPosition(newPos);
    }
  }
  
  /**
   * Processes text input and inserts it into the document.
   * If text is selected, it deletes the selection first.
   */
  processTextInput(text: string, documentModel: VirtualDocumentModel): void {
    // If there's a selection, delete it first
    if (documentModel.hasSelection()) {
      const selection = documentModel.getCurrentSelection()!;
      documentModel.deleteText(selection.start, selection.end);
      documentModel.clearSelections();
    }
    
    const cursorPos = documentModel.getCursorPosition();
    documentModel.insertText(cursorPos, text);
    
    // Reset preferred column after text insertion
    this.resetPreferredColumn(documentModel);
  }
  
  /**
   * Moves cursor left by one character.
   */
  private moveCursorLeft(currentPos: Position, documentModel: VirtualDocumentModel): Position {
    let newPos: Position;
    if (currentPos.column > 0) {
      newPos = { line: currentPos.line, column: currentPos.column - 1 };
    } else if (currentPos.line > 0) {
      // Move to end of previous line
      const prevLine = documentModel.getLine(currentPos.line - 1);
      newPos = { line: currentPos.line - 1, column: prevLine.length };
    } else {
      newPos = currentPos; // Can't move further left
    }
    
    // Reset preferred column when moving horizontally
    this.preferredColumn = newPos.column;
    return newPos;
  }
  
  /**
   * Moves cursor right by one character.
   */
  private moveCursorRight(currentPos: Position, documentModel: VirtualDocumentModel): Position {
    const currentLine = documentModel.getLine(currentPos.line);
    let newPos: Position;
    
    if (currentPos.column < currentLine.length) {
      newPos = { line: currentPos.line, column: currentPos.column + 1 };
    } else if (currentPos.line < documentModel.getLineCount() - 1) {
      // Move to beginning of next line
      newPos = { line: currentPos.line + 1, column: 0 };
    } else {
      newPos = currentPos; // Can't move further right
    }
    
    // Reset preferred column when moving horizontally
    this.preferredColumn = newPos.column;
    return newPos;
  }
  
  /**
   * Moves cursor up by one line.
   */
  private moveCursorUp(currentPos: Position, documentModel: VirtualDocumentModel): Position {
    if (currentPos.line > 0) {
      // Update preferred column if this is the first vertical movement
      if (this.preferredColumn === 0 || this.preferredColumn === currentPos.column) {
        this.preferredColumn = currentPos.column;
      }
      
      const targetLine = documentModel.getLine(currentPos.line - 1);
      const newColumn = Math.min(this.preferredColumn, targetLine.length);
      return { line: currentPos.line - 1, column: newColumn };
    }
    return currentPos; // Can't move further up
  }
  
  /**
   * Moves cursor down by one line.
   */
  private moveCursorDown(currentPos: Position, documentModel: VirtualDocumentModel): Position {
    if (currentPos.line < documentModel.getLineCount() - 1) {
      // Update preferred column if this is the first vertical movement
      if (this.preferredColumn === 0 || this.preferredColumn === currentPos.column) {
        this.preferredColumn = currentPos.column;
      }
      
      const targetLine = documentModel.getLine(currentPos.line + 1);
      const newColumn = Math.min(this.preferredColumn, targetLine.length);
      return { line: currentPos.line + 1, column: newColumn };
    }
    return currentPos; // Can't move further down
  }
  
  /**
   * Handles tab input - inserts spaces or tab character.
   */
  private handleTabInput(currentPos: Position, documentModel: VirtualDocumentModel): void {
    // Insert 2 spaces for tab (common in many editors)
    const tabSpaces = '  ';
    documentModel.insertText(currentPos, tabSpaces);
  }
  
  /**
   * Handles enter input - creates new line.
   */
  private handleEnterInput(currentPos: Position, documentModel: VirtualDocumentModel): void {
    // Insert newline character
    documentModel.insertText(currentPos, '\n');
  }
  
  /**
   * Handles backspace input - deletes selected text or character before cursor.
   */
  private handleBackspaceInput(currentPos: Position, documentModel: VirtualDocumentModel): void {
    // If there's a selection, delete it instead of backspacing
    if (documentModel.hasSelection()) {
      const selection = documentModel.getCurrentSelection()!;
      documentModel.deleteText(selection.start, selection.end);
      documentModel.clearSelections();
      return;
    }
    
    // No selection - perform normal backspace
    if (currentPos.column > 0) {
      // Delete character to the left on same line
      const deleteStart = { line: currentPos.line, column: currentPos.column - 1 };
      const deleteEnd = currentPos;
      documentModel.deleteText(deleteStart, deleteEnd);
    } else if (currentPos.line > 0) {
      // Delete newline - merge with previous line
      const prevLine = documentModel.getLine(currentPos.line - 1);
      const deleteStart = { line: currentPos.line - 1, column: prevLine.length };
      const deleteEnd = currentPos;
      documentModel.deleteText(deleteStart, deleteEnd);
    }
    // If at beginning of document, do nothing
  }
  
  /**
   * Handles delete input - deletes selected text or character after cursor.
   */
  private handleDeleteInput(currentPos: Position, documentModel: VirtualDocumentModel): void {
    // If there's a selection, delete it instead of forward deleting
    if (documentModel.hasSelection()) {
      const selection = documentModel.getCurrentSelection()!;
      documentModel.deleteText(selection.start, selection.end);
      documentModel.clearSelections();
      return;
    }
    
    // No selection - perform normal delete
    const currentLine = documentModel.getLine(currentPos.line);
    
    if (currentPos.column < currentLine.length) {
      // Delete character to the right on same line
      const deleteStart = currentPos;
      const deleteEnd = { line: currentPos.line, column: currentPos.column + 1 };
      documentModel.deleteText(deleteStart, deleteEnd);
    } else if (currentPos.line < documentModel.getLineCount() - 1) {
      // Delete newline - merge with next line
      const deleteStart = currentPos;
      const deleteEnd = { line: currentPos.line + 1, column: 0 };
      documentModel.deleteText(deleteStart, deleteEnd);
    }
    // If at end of document, do nothing
  }
  
  /**
   * Processes mouse down events for starting text selection.
   */
  processMouseDown(event: MouseEventData, documentModel: VirtualDocumentModel): void {
    if (!this.coordinateSystem) return;
    
    // Convert screen coordinates to document position
    const position = this.coordinateSystem.screenToPosition(event.coordinates);
    
    // Validate position and clamp to document bounds
    const clampedPosition = this.clampPositionToDocument(position, documentModel);
    
    if (event.button === 0) { // Left mouse button
      if (!event.modifiers.shift) {
        // Start new selection
        this.selectionState.isSelecting = true;
        this.selectionState.startPosition = clampedPosition;
        
        // Set cursor position and clear any existing selection
        documentModel.setCursorPosition(clampedPosition);
        documentModel.clearSelections();
      } else {
        // Extend existing selection
        const currentSelection = documentModel.getCurrentSelection();
        if (currentSelection) {
          documentModel.setSelection(currentSelection.start, clampedPosition);
        }
      }
    }
  }
  
  /**
   * Processes mouse move events for extending text selection.
   */
  processMouseMove(event: MouseEventData, documentModel: VirtualDocumentModel): void {
    if (!this.coordinateSystem || !this.selectionState.isSelecting || !this.selectionState.startPosition) {
      return;
    }
    
    // Convert screen coordinates to document position
    const position = this.coordinateSystem.screenToPosition(event.coordinates);
    const clampedPosition = this.clampPositionToDocument(position, documentModel);
    
    // Create selection from start to current position
    documentModel.setSelection(this.selectionState.startPosition, clampedPosition);
    documentModel.setCursorPosition(clampedPosition);
  }
  
  /**
   * Processes mouse up events for ending text selection.
   */
  processMouseUp(event: MouseEventData, documentModel: VirtualDocumentModel): void {
    if (this.selectionState.isSelecting) {
      this.selectionState.isSelecting = false;
      this.selectionState.startPosition = null;
    }
  }
  
  /**
   * Clamps a position to valid document bounds.
   */
  private clampPositionToDocument(position: Position, documentModel: VirtualDocumentModel): Position {
    const lineCount = documentModel.getLineCount();
    const clampedLine = Math.max(0, Math.min(position.line, lineCount - 1));
    
    const line = documentModel.getLine(clampedLine);
    const clampedColumn = Math.max(0, Math.min(position.column, line.length));
    
    return { line: clampedLine, column: clampedColumn };
  }
  
  /**
   * Handles arrow key navigation with optional selection extension
   */
  private handleArrowKeyWithSelection(newPos: Position | null, shiftPressed: boolean, documentModel: VirtualDocumentModel): void {
    if (!newPos) return;
    
    const currentPos = documentModel.getCursorPosition();
    
    if (shiftPressed) {
      // Extend or create selection
      const currentSelection = documentModel.getCurrentSelection();
      
      if (currentSelection) {
        // Extend existing selection
        // We need to determine which end of the selection to extend based on cursor position
        const cursorAtStart = this.comparePositions(currentPos, currentSelection.start) === 0;
        const cursorAtEnd = this.comparePositions(currentPos, currentSelection.end) === 0;
        
        if (cursorAtEnd) {
          // Cursor is at the end, so extend from start to new position
          documentModel.setSelection(currentSelection.start, newPos);
        } else if (cursorAtStart) {
          // Cursor is at the start, so extend from new position to end
          documentModel.setSelection(newPos, currentSelection.end);
        } else {
          // Cursor is somewhere else (shouldn't happen but handle gracefully)
          // Use the closest end as the anchor
          const distToStart = Math.abs(currentPos.line - currentSelection.start.line) + Math.abs(currentPos.column - currentSelection.start.column);
          const distToEnd = Math.abs(currentPos.line - currentSelection.end.line) + Math.abs(currentPos.column - currentSelection.end.column);
          
          if (distToStart < distToEnd) {
            documentModel.setSelection(newPos, currentSelection.end);
          } else {
            documentModel.setSelection(currentSelection.start, newPos);
          }
        }
      } else {
        // Create new selection from current position to new position
        documentModel.setSelection(currentPos, newPos);
      }
      
      // Update cursor to new position
      documentModel.setCursorPosition(newPos);
    } else {
      // Clear any existing selection and move cursor
      documentModel.clearSelections();
      documentModel.setCursorPosition(newPos);
    }
  }
  
  /**
   * Compares two positions. Returns -1 if a < b, 0 if a === b, 1 if a > b
   */
  private comparePositions(a: Position, b: Position): number {
    if (a.line < b.line) return -1;
    if (a.line > b.line) return 1;
    if (a.column < b.column) return -1;
    if (a.column > b.column) return 1;
    return 0;
  }
  
  /**
   * Resets the preferred column to the current cursor position
   */
  private resetPreferredColumn(documentModel: VirtualDocumentModel): void {
    const currentPos = documentModel.getCursorPosition();
    this.preferredColumn = currentPos.column;
  }
}