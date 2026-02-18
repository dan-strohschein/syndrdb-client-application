/**
 * Error Popover Controller - Owns hover detection, token lookup, and popover show/hide for invalid statements.
 * Follows Single Responsibility Principle: only handles error popover visibility and content.
 * Used by CodeEditor to delegate error hover and popover logic.
 */

import type { FontMetrics, MouseEventData, ScrollOffset } from './types.js';

/** Minimal statement shape used for hover detection (matches CodeStatement from code-editor). */
export interface StatementForPopover {
  lineStart: number;
  lineEnd: number;
  isValid: boolean;
  isDirty: boolean;
}

/** Minimal validation error shape. */
export interface PopoverError {
  message: string;
  code?: string;
  suggestion?: string;
}

export interface ValidationResultForPopover {
  errors: PopoverError[];
}

export interface ErrorPopoverControllerDeps {
  getStatements: () => StatementForPopover[];
  getValidationResult: (statementKey: string) => ValidationResultForPopover | undefined;
  getScrollOffset: () => ScrollOffset;
  getFontMetrics: () => FontMetrics;
  getCanvas: () => HTMLCanvasElement | null;
  getLines: () => readonly string[];
  getErrorPopup: () => { show(x: number, y: number, message: string): void; hide(): void } | null;
}

export class ErrorPopoverController {
  private popoverHideTimeout: number | null = null;
  private currentHoveredToken: {
    line: number;
    column: number;
    statement: StatementForPopover;
  } | null = null;
  private isPopoverVisible = false;
  private isMouseOverPopover = false;
  private isMouseOverInvalidStatement = false;
  private readonly HIDE_DELAY_MS = 500;

  constructor(private readonly deps: ErrorPopoverControllerDeps) {}

  /**
   * Call when mouse enters the popover element (so we don't hide while user reads).
   */
  setMouseOverPopover(value: boolean): void {
    this.isMouseOverPopover = value;
    if (value && this.popoverHideTimeout) {
      clearTimeout(this.popoverHideTimeout);
      this.popoverHideTimeout = null;
    }
  }

  /**
   * Call when popover is dismissed (e.g. Escape). Resets visibility and hover state.
   */
  onPopoverDismissed(): void {
    this.isPopoverVisible = false;
    this.isMouseOverPopover = false;
    this.currentHoveredToken = null;
    if (this.popoverHideTimeout) {
      clearTimeout(this.popoverHideTimeout);
      this.popoverHideTimeout = null;
    }
  }

  /**
   * Handle mouse move over the editor canvas. Shows popover when over an invalid statement token.
   */
  handleMouseMove(event: MouseEventData): void {
    const mouseCanvas = event.coordinates;
    if (mouseCanvas.x < 0 || mouseCanvas.y < 0) return;

    const canvas = this.deps.getCanvas();
    if (!canvas) return;

    const fontMetrics = this.deps.getFontMetrics();
    const scrollOff = this.deps.getScrollOffset();
    const scrollAdjustedY = mouseCanvas.y + scrollOff.y;
    const lineIndex = Math.floor(scrollAdjustedY / fontMetrics.lineHeight);
    const scrollAdjustedX = mouseCanvas.x + scrollOff.x;
    const columnIndex = Math.floor(scrollAdjustedX / fontMetrics.characterWidth);

    const statements = this.deps.getStatements();
    const statement = statements.find(
      (stmt) => lineIndex >= stmt.lineStart && lineIndex <= stmt.lineEnd
    );

    if (statement && !statement.isValid && !statement.isDirty) {
      this.isMouseOverInvalidStatement = true;
      const hoveredTokenPosition = this.findTokenAtPosition(lineIndex, columnIndex);
      if (hoveredTokenPosition) {
        const currentTokenKey = `${hoveredTokenPosition.line}-${hoveredTokenPosition.startColumn}-${statement.lineStart}-${statement.lineEnd}`;
        const previousKey = this.currentHoveredToken
          ? `${this.currentHoveredToken.line}-${this.currentHoveredToken.column}-${this.currentHoveredToken.statement.lineStart}-${this.currentHoveredToken.statement.lineEnd}`
          : null;
        if (currentTokenKey === previousKey) return;

        this.currentHoveredToken = {
          line: hoveredTokenPosition.line,
          column: hoveredTokenPosition.startColumn,
          statement,
        };

        const canvasRect = canvas.getBoundingClientRect();
        const tokenStartX =
          canvasRect.left +
          hoveredTokenPosition.startColumn * fontMetrics.characterWidth -
          scrollOff.x;
        const tokenStartY =
          canvasRect.top +
          hoveredTokenPosition.line * fontMetrics.lineHeight -
          scrollOff.y;

        const statementKey = `${statement.lineStart}-${statement.lineEnd}`;
        const validationResult = this.deps.getValidationResult(statementKey);
        const errors: PopoverError[] = [];
        if (validationResult?.errors?.length) {
          validationResult.errors.forEach((err) => {
            errors.push({
              message: err.message,
              code: err.code,
              suggestion: err.suggestion,
            });
          });
        } else {
          errors.push({
            message: `Invalid SyndrQL statement detected on lines ${statement.lineStart + 1}-${statement.lineEnd + 1}`,
            code: 'INVALID_STATEMENT',
          });
        }
        this.showPopover(tokenStartX, tokenStartY, errors);
      } else {
        this.currentHoveredToken = null;
      }
    } else {
      this.isMouseOverInvalidStatement = false;
      if (this.isPopoverVisible) {
        if (!this.isMouseOverPopover && !this.popoverHideTimeout) {
          this.hidePopover();
        }
      } else {
        this.currentHoveredToken = null;
      }
    }
  }

  hidePopover(): void {
    if (!this.isPopoverVisible) return;
    if (this.popoverHideTimeout) clearTimeout(this.popoverHideTimeout);
    this.popoverHideTimeout = window.setTimeout(() => {
      if (!this.isMouseOverPopover && !this.isMouseOverInvalidStatement) {
        const popup = this.deps.getErrorPopup();
        if (popup) popup.hide();
        this.isPopoverVisible = false;
        this.currentHoveredToken = null;
      }
      this.popoverHideTimeout = null;
    }, this.HIDE_DELAY_MS);
  }

  hidePopoverImmediate(): void {
    if (this.popoverHideTimeout) {
      clearTimeout(this.popoverHideTimeout);
      this.popoverHideTimeout = null;
    }
    const popup = this.deps.getErrorPopup();
    if (popup) popup.hide();
    this.isPopoverVisible = false;
    this.isMouseOverPopover = false;
    this.isMouseOverInvalidStatement = false;
    this.currentHoveredToken = null;
  }

  /** Show popover at screen coordinates (e.g. for tests). */
  showAt(screenX: number, screenY: number, errors: PopoverError[]): void {
    this.showPopover(screenX, screenY, errors);
  }

  private showPopover(screenX: number, screenY: number, errors: PopoverError[]): void {
    if (this.popoverHideTimeout) {
      clearTimeout(this.popoverHideTimeout);
      this.popoverHideTimeout = null;
    }
    const popup = this.deps.getErrorPopup();
    if (!popup) return;
    const message = errors
      .map((error, i) => {
        let msg = `${i + 1}. [${error.code ?? 'ERROR'}] ${error.message}`;
        if (error.suggestion) msg += `\n   Suggestion: ${error.suggestion}`;
        return msg;
      })
      .join('\n\n');
    popup.show(screenX, screenY, message);
    this.isPopoverVisible = true;
  }

  private findTokenAtPosition(
    lineIndex: number,
    columnIndex: number
  ): { line: number; startColumn: number; endColumn: number; text: string } | null {
    const lines = this.deps.getLines();
    if (lineIndex < 0 || lineIndex >= lines.length) return null;
    const lineContent = lines[lineIndex];
    if (columnIndex < 0 || columnIndex >= lineContent.length) return null;

    let startColumn = columnIndex;
    let endColumn = columnIndex;
    while (startColumn > 0 && this.isTokenCharacter(lineContent[startColumn - 1])) {
      startColumn--;
    }
    while (endColumn < lineContent.length && this.isTokenCharacter(lineContent[endColumn])) {
      endColumn++;
    }
    if (startColumn === endColumn) {
      let nextTokenStart = columnIndex;
      while (
        nextTokenStart < lineContent.length &&
        !this.isTokenCharacter(lineContent[nextTokenStart])
      ) {
        nextTokenStart++;
      }
      if (nextTokenStart < lineContent.length) {
        startColumn = nextTokenStart;
        endColumn = nextTokenStart;
        while (
          endColumn < lineContent.length &&
          this.isTokenCharacter(lineContent[endColumn])
        ) {
          endColumn++;
        }
      } else {
        return null;
      }
    }
    return {
      line: lineIndex,
      startColumn,
      endColumn,
      text: lineContent.substring(startColumn, endColumn),
    };
  }

  private isTokenCharacter(char: string): boolean {
    return /[a-zA-Z0-9_]/.test(char);
  }
}
