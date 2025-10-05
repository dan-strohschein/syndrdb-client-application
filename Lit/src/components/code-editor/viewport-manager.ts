/**
 * Viewport Manager - Responsible for managing viewport calculations and scrolling
 * Follows Single Responsibility Principle: Only handles viewport and scroll operations
 */

import { ViewportInfo, ScrollOffset, ScrollBounds, VisibleRange, ScrollbarInfo, FontMetrics, ScrollbarHitInfo, ScrollbarRegion, Coordinates } from './types.js';
import type { VirtualDocumentModel } from './virtual-dom.js';

/**
 * Interface for viewport management operations.
 */
export interface IViewportManager {
  updateViewport(width: number, height: number, fontMetrics: FontMetrics): void;
  updateScrollOffset(offset: ScrollOffset): void;
  getViewportInfo(): ViewportInfo;
  getScrollOffset(): ScrollOffset;
  getScrollBounds(documentModel: VirtualDocumentModel): ScrollBounds;
  getVisibleRange(): VisibleRange;
  getScrollbarInfo(documentModel: VirtualDocumentModel): ScrollbarInfo;
  
  // Auto-scroll methods
  ensureCursorVisible(cursorLine: number, cursorColumn: number): ScrollOffset | null;
  scrollToLine(lineNumber: number): ScrollOffset;
  scrollToColumn(columnNumber: number): ScrollOffset;
  
  // Scrollbar interaction methods
  hitTestScrollbar(mousePos: Coordinates, documentModel: VirtualDocumentModel): ScrollbarHitInfo;
  calculateScrollFromDrag(mousePos: Coordinates, dragStartPos: Coordinates, dragType: 'vertical' | 'horizontal', documentModel: VirtualDocumentModel): ScrollOffset;
  calculateIncrementalScrollFromDrag(currentMousePos: Coordinates, lastMousePos: Coordinates, dragType: 'vertical' | 'horizontal', documentModel: VirtualDocumentModel): ScrollOffset;
}

/**
 * Manages viewport calculations, scroll bounds, and visible content ranges.
 */
export class ViewportManager implements IViewportManager {
  private viewport: ViewportInfo;
  private scrollOffset: ScrollOffset;
  private fontMetrics: FontMetrics;
  
  constructor() {
    this.viewport = {
      width: 0,
      height: 0,
      visibleLines: 0,
      visibleColumns: 0
    };
    
    this.scrollOffset = {
      x: 0,
      y: 0
    };
    
    this.fontMetrics = {
      characterWidth: 8,
      lineHeight: 16,
      baseline: 12,
      ascent: 10,
      descent: 4,
      capHeight: 10,
      xHeight: 7
    };
  }
  
  updateViewport(width: number, height: number, fontMetrics: FontMetrics): void {
    this.fontMetrics = fontMetrics;
    
    // Reserve space for potential scrollbars (12px each)
    const scrollbarWidth = 12;
    const effectiveWidth = width - scrollbarWidth;
    const effectiveHeight = height - scrollbarWidth;
    
    this.viewport = {
      width,
      height,
      visibleLines: Math.floor(effectiveHeight / fontMetrics.lineHeight),
      visibleColumns: Math.floor(effectiveWidth / fontMetrics.characterWidth)
    };
  }
  
  updateScrollOffset(offset: ScrollOffset): void {
    this.scrollOffset = { ...offset };
  }
  
  getViewportInfo(): ViewportInfo {
    return { ...this.viewport };
  }
  
  getScrollOffset(): ScrollOffset {
    return { ...this.scrollOffset };
  }
  
  getScrollBounds(documentModel: VirtualDocumentModel): ScrollBounds {
    const lineCount = documentModel.getLineCount();
    const maxLineLength = this.getMaxLineLength(documentModel);
    
    // Calculate content dimensions
    const contentHeight = lineCount * this.fontMetrics.lineHeight;
    const contentWidth = maxLineLength * this.fontMetrics.characterWidth;
    
    // Calculate maximum scroll offsets
    const maxScrollY = Math.max(0, contentHeight - this.viewport.height);
    const maxScrollX = Math.max(0, contentWidth - this.viewport.width);
    
    return {
      maxScrollX,
      maxScrollY,
      canScrollLeft: this.scrollOffset.x > 0,
      canScrollRight: this.scrollOffset.x < maxScrollX,
      canScrollUp: this.scrollOffset.y > 0,
      canScrollDown: this.scrollOffset.y < maxScrollY
    };
  }
  
  getVisibleRange(): VisibleRange {
    const startLine = Math.floor(this.scrollOffset.y / this.fontMetrics.lineHeight);
    const endLine = startLine + this.viewport.visibleLines;
    
    const startColumn = Math.floor(this.scrollOffset.x / this.fontMetrics.characterWidth);
    const endColumn = startColumn + this.viewport.visibleColumns;
    
    return {
      startLine: Math.max(0, startLine),
      endLine,
      startColumn: Math.max(0, startColumn),
      endColumn
    };
  }
  
  getScrollbarInfo(documentModel: VirtualDocumentModel): ScrollbarInfo {
    const bounds = this.getScrollBounds(documentModel);
    
    // Vertical scrollbar
    const vScrollVisible = bounds.maxScrollY > 0;
    const vScrollHeight = this.viewport.height;
    const vContentRatio = this.viewport.height / (bounds.maxScrollY + this.viewport.height);
    const vThumbHeight = Math.max(20, vScrollHeight * vContentRatio);
    const vThumbPosition = bounds.maxScrollY > 0 ? 
      (this.scrollOffset.y / bounds.maxScrollY) * (vScrollHeight - vThumbHeight) : 0;
    
    // Horizontal scrollbar
    const hScrollVisible = bounds.maxScrollX > 0;
    const hScrollWidth = this.viewport.width;
    const hContentRatio = this.viewport.width / (bounds.maxScrollX + this.viewport.width);
    const hThumbWidth = Math.max(20, hScrollWidth * hContentRatio);
    const hThumbPosition = bounds.maxScrollX > 0 ? 
      (this.scrollOffset.x / bounds.maxScrollX) * (hScrollWidth - hThumbWidth) : 0;
    
    return {
      vertical: {
        visible: vScrollVisible,
        height: vScrollHeight,
        thumbHeight: vThumbHeight,
        thumbPosition: vThumbPosition
      },
      horizontal: {
        visible: hScrollVisible,
        width: hScrollWidth,
        thumbWidth: hThumbWidth,
        thumbPosition: hThumbPosition
      }
    };
  }
  
  /**
   * Ensures cursor is visible by scrolling if necessary.
   * Returns new scroll offset if scrolling occurred, null otherwise.
   */
  ensureCursorVisible(cursorLine: number, cursorColumn: number): ScrollOffset | null {
    const cursorY = cursorLine * this.fontMetrics.lineHeight;
    const cursorX = cursorColumn * this.fontMetrics.characterWidth;
    
    let newScrollX = this.scrollOffset.x;
    let newScrollY = this.scrollOffset.y;
    let scrolled = false;
    
    // Check vertical scrolling
    const viewportTop = this.scrollOffset.y;
    const viewportBottom = this.scrollOffset.y + this.viewport.height;
    
    if (cursorY < viewportTop) {
      // Cursor is above viewport - scroll up
      newScrollY = cursorY;
      scrolled = true;
    } else if (cursorY + this.fontMetrics.lineHeight > viewportBottom) {
      // Cursor is below viewport - scroll down
      newScrollY = cursorY - this.viewport.height + this.fontMetrics.lineHeight;
      scrolled = true;
    }
    
    // Check horizontal scrolling
    const viewportLeft = this.scrollOffset.x;
    const viewportRight = this.scrollOffset.x + this.viewport.width;
    
    if (cursorX < viewportLeft) {
      // Cursor is left of viewport - scroll left
      newScrollX = cursorX;
      scrolled = true;
    } else if (cursorX + this.fontMetrics.characterWidth > viewportRight) {
      // Cursor is right of viewport - scroll right
      newScrollX = cursorX - this.viewport.width + this.fontMetrics.characterWidth;
      scrolled = true;
    }
    
    if (scrolled) {
      // Clamp to valid scroll bounds
      newScrollX = Math.max(0, newScrollX);
      newScrollY = Math.max(0, newScrollY);
      
      return { x: newScrollX, y: newScrollY };
    }
    
    return null;
  }
  
  scrollToLine(lineNumber: number): ScrollOffset {
    const targetY = lineNumber * this.fontMetrics.lineHeight;
    const centeredY = targetY - (this.viewport.height / 2) + (this.fontMetrics.lineHeight / 2);
    
    return {
      x: this.scrollOffset.x,
      y: Math.max(0, centeredY)
    };
  }
  
  scrollToColumn(columnNumber: number): ScrollOffset {
    const targetX = columnNumber * this.fontMetrics.characterWidth;
    const centeredX = targetX - (this.viewport.width / 2) + (this.fontMetrics.characterWidth / 2);
    
    return {
      x: Math.max(0, centeredX),
      y: this.scrollOffset.y
    };
  }
  
  /**
   * Calculates incremental scroll offset from drag movement (smooth dragging).
   */
  calculateIncrementalScrollFromDrag(currentMousePos: Coordinates, lastMousePos: Coordinates, dragType: 'vertical' | 'horizontal', documentModel: VirtualDocumentModel): ScrollOffset {
    const scrollbarWidth = 12;
    const bounds = this.getScrollBounds(documentModel);
    
    if (dragType === 'vertical') {
      const dragDelta = currentMousePos.y - lastMousePos.y;
      const trackHeight = this.viewport.height - scrollbarWidth;
      
      // Calculate incremental scroll change
      const dragRatio = dragDelta / trackHeight;
      const scrollDelta = dragRatio * bounds.maxScrollY;
      const newScrollY = Math.max(0, Math.min(bounds.maxScrollY, this.scrollOffset.y + scrollDelta));
      
      return {
        x: this.scrollOffset.x,
        y: newScrollY
      };
    } else { // horizontal
      const dragDelta = currentMousePos.x - lastMousePos.x;
      const trackWidth = this.viewport.width - scrollbarWidth;
      
      // Calculate incremental scroll change
      const dragRatio = dragDelta / trackWidth;
      const scrollDelta = dragRatio * bounds.maxScrollX;
      const newScrollX = Math.max(0, Math.min(bounds.maxScrollX, this.scrollOffset.x + scrollDelta));
      
      return {
        x: newScrollX,
        y: this.scrollOffset.y
      };
    }
  }
  
  /**
   * Gets the maximum line length in the document.
   */
  private getMaxLineLength(documentModel: VirtualDocumentModel): number {
    const lines = documentModel.getLines();
    return lines.reduce((max, line) => Math.max(max, line.length), 0);
  }
  
  /**
   * Hit tests mouse coordinates against scrollbar regions.
   */
  hitTestScrollbar(mousePos: Coordinates, documentModel: VirtualDocumentModel): ScrollbarHitInfo {
    const scrollbarWidth = 12;
    const scrollbarInfo = this.getScrollbarInfo(documentModel);
    
    // Check vertical scrollbar (if visible)
    if (scrollbarInfo.vertical.visible) {
      const verticalScrollbarX = this.viewport.width - scrollbarWidth;
      if (mousePos.x >= verticalScrollbarX && mousePos.x <= this.viewport.width) {
        // Check if clicking on thumb
        if (mousePos.y >= scrollbarInfo.vertical.thumbPosition && 
            mousePos.y <= scrollbarInfo.vertical.thumbPosition + scrollbarInfo.vertical.thumbHeight) {
          return {
            type: 'vertical-thumb',
            region: {
              x: verticalScrollbarX,
              y: scrollbarInfo.vertical.thumbPosition,
              width: scrollbarWidth,
              height: scrollbarInfo.vertical.thumbHeight
            }
          };
        } else if (mousePos.y >= 0 && mousePos.y <= this.viewport.height) {
          return {
            type: 'vertical-track',
            region: {
              x: verticalScrollbarX,
              y: 0,
              width: scrollbarWidth,
              height: this.viewport.height
            }
          };
        }
      }
    }
    
    // Check horizontal scrollbar (if visible)
    if (scrollbarInfo.horizontal.visible) {
      const horizontalScrollbarY = this.viewport.height - scrollbarWidth;
      if (mousePos.y >= horizontalScrollbarY && mousePos.y <= this.viewport.height) {
        // Check if clicking on thumb
        if (mousePos.x >= scrollbarInfo.horizontal.thumbPosition && 
            mousePos.x <= scrollbarInfo.horizontal.thumbPosition + scrollbarInfo.horizontal.thumbWidth) {
          return {
            type: 'horizontal-thumb',
            region: {
              x: scrollbarInfo.horizontal.thumbPosition,
              y: horizontalScrollbarY,
              width: scrollbarInfo.horizontal.thumbWidth,
              height: scrollbarWidth
            }
          };
        } else if (mousePos.x >= 0 && mousePos.x <= this.viewport.width) {
          return {
            type: 'horizontal-track',
            region: {
              x: 0,
              y: horizontalScrollbarY,
              width: this.viewport.width,
              height: scrollbarWidth
            }
          };
        }
      }
    }
    
    return {
      type: 'none',
      region: null
    };
  }
  
  /**
   * Calculates scroll offset from drag coordinates.
   */
  calculateScrollFromDrag(mousePos: Coordinates, dragStartPos: Coordinates, dragType: 'vertical' | 'horizontal', documentModel: VirtualDocumentModel): ScrollOffset {
    const scrollbarWidth = 12;
    const bounds = this.getScrollBounds(documentModel);
    
    if (dragType === 'vertical') {
      const dragDelta = mousePos.y - dragStartPos.y;
      const trackHeight = this.viewport.height - scrollbarWidth;
      
      // Calculate the ratio of drag movement to available track space
      const dragRatio = dragDelta / trackHeight;
      
      // Apply the ratio to the maximum scroll range
      const scrollDelta = dragRatio * bounds.maxScrollY;
      const newScrollY = Math.max(0, Math.min(bounds.maxScrollY, this.scrollOffset.y + scrollDelta));
      
      return {
        x: this.scrollOffset.x,
        y: newScrollY
      };
    } else { // horizontal
      const dragDelta = mousePos.x - dragStartPos.x;
      const trackWidth = this.viewport.width - scrollbarWidth;
      
      // Calculate the ratio of drag movement to available track space
      const dragRatio = dragDelta / trackWidth;
      
      // Apply the ratio to the maximum scroll range
      const scrollDelta = dragRatio * bounds.maxScrollX;
      const newScrollX = Math.max(0, Math.min(bounds.maxScrollX, this.scrollOffset.x + scrollDelta));
      
      return {
        x: newScrollX,
        y: this.scrollOffset.y
      };
    }
  }
}