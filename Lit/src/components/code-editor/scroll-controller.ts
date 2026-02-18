/**
 * Scroll Controller - Owns scroll offset, scrollbar drag state, wheel and scrollbar interaction.
 * Follows Single Responsibility Principle: only handles scroll and scrollbar behavior.
 * Used by CodeEditor to delegate all scroll/scrollbar logic.
 */

import type {
  ScrollOffset,
  ScrollbarDragState,
  Coordinates,
  MouseEventData,
  FontMetrics,
} from './types.js';
import type { ViewportManager } from './viewport-manager.js';
import type { VirtualDocumentModel } from './virtual-dom.js';

const SCROLLBAR_WIDTH = 12;

export interface ScrollControllerDeps {
  viewportManager: ViewportManager;
  documentModel: VirtualDocumentModel;
  getFontMetrics: () => FontMetrics;
  /** Called when scroll offset changes; host should update viewportManager, coordinateSystem, and requestUpdate. */
  applyScroll: (offset: ScrollOffset) => void;
  /** Called to request a full re-render (e.g. after wheel scroll). */
  requestRender: () => void;
  /** Called during drag for a lighter re-render. */
  requestRenderOptimized?: () => void;
  /** Optional: called from global mouseup (e.g. for selection end when mouse released outside editor). */
  onGlobalMouseUp?: (event: MouseEvent) => void;
}

/**
 * Manages scroll offset, scrollbar drag, wheel scroll, and scrollbar rendering.
 * Host component wires it to input events and calls renderScrollbars from the render loop.
 */
export class ScrollController {
  private scrollOffset: ScrollOffset = { x: 0, y: 0 };
  private scrollbarDrag: ScrollbarDragState = {
    active: false,
    type: null,
    startMousePos: { x: 0, y: 0 },
    startScrollOffset: { x: 0, y: 0 },
    thumbOffset: 0,
  };
  private dragUpdateScheduled = false;
  private globalMouseMoveHandler?: (event: MouseEvent) => void;
  private globalMouseUpHandler?: (event: MouseEvent) => void;

  constructor(private readonly deps: ScrollControllerDeps) {}

  getScrollOffset(): ScrollOffset {
    return { ...this.scrollOffset };
  }

  /**
   * Set scroll offset (e.g. from ensureCursorVisible). Updates internal state and calls applyScroll.
   */
  setScrollOffset(offset: ScrollOffset): void {
    this.scrollOffset = { ...offset };
    this.deps.applyScroll(this.scrollOffset);
  }

  /**
   * Handle mouse wheel. Clamps to bounds, updates scroll, and requests render.
   */
  handleWheel(deltaX: number, deltaY: number): void {
    const scrollSensitivity = 3;
    const scrollX = deltaX * scrollSensitivity;
    const scrollY = deltaY * scrollSensitivity;
    const newOffset = {
      x: this.scrollOffset.x + scrollX,
      y: this.scrollOffset.y + scrollY,
    };
    const bounds = this.deps.viewportManager.getScrollBounds(this.deps.documentModel);
    const clampedOffset = {
      x: Math.max(0, Math.min(newOffset.x, bounds.maxScrollX)),
      y: Math.max(0, Math.min(newOffset.y, bounds.maxScrollY)),
    };
    requestAnimationFrame(() => {
      this.scrollOffset = clampedOffset;
      this.deps.applyScroll(this.scrollOffset);
      this.deps.requestRender();
    });
  }

  handleScrollbarMouseDown(event: MouseEventData, canvas: HTMLCanvasElement): boolean {
    const mousePos: Coordinates = event.coordinates;
    const hitInfo = this.deps.viewportManager.hitTestScrollbar(mousePos, this.deps.documentModel);

    if (hitInfo.type !== 'none') {
      if (hitInfo.type === 'vertical-thumb' || hitInfo.type === 'horizontal-thumb') {
        requestAnimationFrame(() => {
          this.scrollbarDrag = {
            active: true,
            type: hitInfo.type === 'vertical-thumb' ? 'vertical' : 'horizontal',
            startMousePos: mousePos,
            startScrollOffset: { ...this.scrollOffset },
            thumbOffset:
              hitInfo.type === 'vertical-thumb'
                ? mousePos.y - hitInfo.region!.y
                : mousePos.x - hitInfo.region!.x,
          };
        });
        this.setupGlobalMouseCapture(canvas);
      } else if (hitInfo.type === 'vertical-track' || hitInfo.type === 'horizontal-track') {
        this.handleScrollbarTrackClick(mousePos, hitInfo.type);
      }
      return true;
    }
    return false;
  }

  handleScrollbarMouseMove(event: MouseEventData): boolean {
    if (!this.scrollbarDrag.active) return false;
    const newScrollOffset = this.calculateDirectScrollFromMousePos(event.coordinates);
    this.scheduleScrollUpdate(newScrollOffset);
    return true;
  }

  handleScrollbarMouseUp(event: MouseEventData): boolean {
    if (!this.scrollbarDrag.active) return false;
    this.removeGlobalMouseCapture();
    requestAnimationFrame(() => {
      this.scrollbarDrag = {
        active: false,
        type: null,
        startMousePos: { x: 0, y: 0 },
        startScrollOffset: { x: 0, y: 0 },
        thumbOffset: 0,
      };
    });
    return true;
  }

  handleScrollbarTrackClick(mousePos: Coordinates, trackType: string): void {
    const viewportInfo = this.deps.viewportManager.getViewportInfo();

    if (trackType === 'vertical-track') {
      const trackHeight = viewportInfo.height - SCROLLBAR_WIDTH;
      const clickRatio = mousePos.y / trackHeight;
      const maxScrollY = Math.max(
        0,
        this.getTotalContentHeight() - viewportInfo.height
      );
      const newY = Math.max(0, Math.min(maxScrollY, clickRatio * maxScrollY));
      requestAnimationFrame(() => {
        this.scrollOffset = { x: this.scrollOffset.x, y: newY };
        this.deps.applyScroll(this.scrollOffset);
      });
    } else if (trackType === 'horizontal-track') {
      const trackWidth = viewportInfo.width - SCROLLBAR_WIDTH;
      const clickRatio = mousePos.x / trackWidth;
      const maxScrollX = Math.max(
        0,
        this.getTotalContentWidth() - viewportInfo.width
      );
      const newX = Math.max(0, Math.min(maxScrollX, clickRatio * maxScrollX));
      requestAnimationFrame(() => {
        this.scrollOffset = { x: newX, y: this.scrollOffset.y };
        this.deps.applyScroll(this.scrollOffset);
      });
    }
  }

  scheduleScrollUpdate(newScrollOffset: ScrollOffset): void {
    if (this.dragUpdateScheduled) return;
    this.dragUpdateScheduled = true;
    requestAnimationFrame(() => {
      if (
        newScrollOffset.x !== this.scrollOffset.x ||
        newScrollOffset.y !== this.scrollOffset.y
      ) {
        requestAnimationFrame(() => {
          this.scrollOffset = newScrollOffset;
          this.deps.applyScroll(this.scrollOffset);
        });
        if (this.deps.requestRenderOptimized) {
          this.deps.requestRenderOptimized();
        }
      }
      this.dragUpdateScheduled = false;
    });
  }

  setupGlobalMouseCapture(canvas: HTMLCanvasElement): void {
    this.globalMouseMoveHandler = (event: MouseEvent) => {
      if (this.scrollbarDrag.active) {
        const rect = canvas.getBoundingClientRect();
        const mousePos: Coordinates = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        };
        const newScrollOffset = this.calculateDirectScrollFromMousePos(mousePos);
        this.scheduleScrollUpdate(newScrollOffset);
      }
    };

    this.globalMouseUpHandler = (event: MouseEvent) => {
      if (this.scrollbarDrag.active) {
        this.removeGlobalMouseCapture();
        requestAnimationFrame(() => {
          this.scrollbarDrag = {
            active: false,
            type: null,
            startMousePos: { x: 0, y: 0 },
            startScrollOffset: { x: 0, y: 0 },
            thumbOffset: 0,
          };
        });
      }
      this.deps.onGlobalMouseUp?.(event);
    };

    document.addEventListener('mousemove', this.globalMouseMoveHandler);
    document.addEventListener('mouseup', this.globalMouseUpHandler);
  }

  removeGlobalMouseCapture(): void {
    if (this.globalMouseMoveHandler) {
      document.removeEventListener('mousemove', this.globalMouseMoveHandler);
      this.globalMouseMoveHandler = undefined;
    }
    if (this.globalMouseUpHandler) {
      document.removeEventListener('mouseup', this.globalMouseUpHandler);
      this.globalMouseUpHandler = undefined;
    }
  }

  calculateDirectScrollFromMousePos(mousePos: Coordinates): ScrollOffset {
    const bounds = this.deps.viewportManager.getScrollBounds(this.deps.documentModel);
    const viewportInfo = this.deps.viewportManager.getViewportInfo();

    if (this.scrollbarDrag.type === 'vertical') {
      const adjustedMouseY = mousePos.y - this.scrollbarDrag.thumbOffset;
      const trackHeight = viewportInfo.height - SCROLLBAR_WIDTH;
      const scrollbarInfo = this.deps.viewportManager.getScrollbarInfo(
        this.deps.documentModel
      );
      const availableTrackSpace = trackHeight - scrollbarInfo.vertical.thumbHeight;
      const thumbRatio = Math.max(
        0,
        Math.min(1, adjustedMouseY / availableTrackSpace)
      );
      const newScrollY = thumbRatio * bounds.maxScrollY;
      return { x: this.scrollOffset.x, y: newScrollY };
    } else {
      const adjustedMouseX = mousePos.x - this.scrollbarDrag.thumbOffset;
      const trackWidth = viewportInfo.width - SCROLLBAR_WIDTH;
      const scrollbarInfo = this.deps.viewportManager.getScrollbarInfo(
        this.deps.documentModel
      );
      const availableTrackSpace = trackWidth - scrollbarInfo.horizontal.thumbWidth;
      const thumbRatio = Math.max(
        0,
        Math.min(1, adjustedMouseX / availableTrackSpace)
      );
      const newScrollX = thumbRatio * bounds.maxScrollX;
      return { x: newScrollX, y: this.scrollOffset.y };
    }
  }

  /**
   * Update canvas cursor style based on whether mouse is over scrollbar. Host calls this from mouse move.
   */
  updateCursorForScrollbars(event: MouseEventData): void {
    const hitInfo = this.deps.viewportManager.hitTestScrollbar(
      event.coordinates,
      this.deps.documentModel
    );
    // Return value is not used; host must set canvas.style.cursor. We need to expose the result.
  }

  /** Returns true if mouse is over a scrollbar region (host can set cursor to 'default'). */
  isOverScrollbar(event: MouseEventData): boolean {
    const hitInfo = this.deps.viewportManager.hitTestScrollbar(
      event.coordinates,
      this.deps.documentModel
    );
    return hitInfo.type !== 'none';
  }

  getTotalContentHeight(): number {
    const fontMetrics = this.deps.getFontMetrics();
    return this.deps.documentModel.getLineCount() * fontMetrics.lineHeight;
  }

  getTotalContentWidth(): number {
    const fontMetrics = this.deps.getFontMetrics();
    const lines = this.deps.documentModel.getLines();
    const maxLineLength = lines.reduce((max, line) => Math.max(max, line.length), 0);
    return maxLineLength * fontMetrics.characterWidth;
  }

  /**
   * Draw scrollbars on the given 2D context. Host calls this from render loop.
   */
  renderScrollbars(ctx: CanvasRenderingContext2D): void {
    const scrollbarInfo = this.deps.viewportManager.getScrollbarInfo(
      this.deps.documentModel
    );
    const viewportInfo = this.deps.viewportManager.getViewportInfo();
    const scrollbarColor = '#CBD5E1';
    const thumbColor = '#64748B';

    if (scrollbarInfo.vertical.visible) {
      const scrollbarX = viewportInfo.width - SCROLLBAR_WIDTH;
      ctx.fillStyle = scrollbarColor;
      ctx.fillRect(scrollbarX, 0, SCROLLBAR_WIDTH, viewportInfo.height);
      ctx.fillStyle = thumbColor;
      ctx.fillRect(
        scrollbarX + 2,
        scrollbarInfo.vertical.thumbPosition,
        SCROLLBAR_WIDTH - 4,
        scrollbarInfo.vertical.thumbHeight
      );
    }

    if (scrollbarInfo.horizontal.visible) {
      const scrollbarY = viewportInfo.height - SCROLLBAR_WIDTH;
      ctx.fillStyle = scrollbarColor;
      ctx.fillRect(0, scrollbarY, viewportInfo.width, SCROLLBAR_WIDTH);
      ctx.fillStyle = thumbColor;
      ctx.fillRect(
        scrollbarInfo.horizontal.thumbPosition,
        scrollbarY + 2,
        scrollbarInfo.horizontal.thumbWidth,
        SCROLLBAR_WIDTH - 4
      );
    }
  }
}
