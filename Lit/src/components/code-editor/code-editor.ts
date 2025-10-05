/**
 * Code Editor Component - Main orchestrator for the canvas-based editor
 * Follows Single Responsibility Principle: Only coordinates between subsystems
 */

import { html, css, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { InputCapture, InputProcessor } from './input-handler.js';
import { VirtualDocumentModel } from './virtual-dom.js';
import { MonospaceCoordinateSystem, FontMeasurer } from './font-metrics.js';
import { ViewportManager } from './viewport-manager.js';
import { Position, FontMetrics, KeyCommand, EditorTheme, ScrollOffset, ScrollbarDragState, Coordinates, MouseEventData, CharacterPosition } from './types.js';
import { createSyndrQLHighlighter, SyndrQLSyntaxHighlighter, SyntaxTheme } from './syndrQL-language-service/index.js';

@customElement('code-editor')
export class CodeEditor extends LitElement {
  // Component properties
  @property({ type: String })
  fontFamily: string = 'Monaco, "Cascadia Code", "Fira Code", monospace';
  
  @property({ type: Number })
  fontSize: number = 14;
  
  @property({ type: String })
  initialText: string = '';
  
  // Theme configuration properties
  @property({ type: String })
  selectionBackgroundColor: string = 'bg-accent-content';
  
  @property({ type: String })
  selectionTextColor: string = 'text-primary-content';
  
  @property({ type: String })
  backgroundColor: string = 'bg-info-content';
  
  @property({ type: String })
  textColor: string = '#ffffff';
  
  @property({ type: String })
  cursorColor: string = '#ffffff';
  
  @property({ type: Object })
  syntaxTheme: Partial<SyntaxTheme> = {};
  
  @property({ type: Boolean })
  enableSyntaxHighlighting: boolean = true;

  // Internal state
  @state()
  private isInitialized: boolean = false;
  
  // Scroll state
  @state()
  private scrollOffset: ScrollOffset = { x: 0, y: 0 };
  
  // Scrollbar drag state
  @state()
  private scrollbarDrag: ScrollbarDragState = {
    active: false,
    type: null,
    startMousePos: { x: 0, y: 0 },
    startScrollOffset: { x: 0, y: 0 },
    thumbOffset: 0
  };
  
  // Smooth drag state
  private lastMousePos: Coordinates = { x: 0, y: 0 };
  private dragUpdateScheduled: boolean = false;
  private globalMouseMoveHandler?: (event: MouseEvent) => void;
  private globalMouseUpHandler?: (event: MouseEvent) => void;
  
  // Cursor blinking state
  private cursorVisible: boolean = true;
  private cursorBlinkTimer: number | null = null;
  private readonly cursorBlinkInterval: number = 530; // Monaco's blink rate
  
  // Core subsystems
  private canvas!: HTMLCanvasElement;
  private context!: CanvasRenderingContext2D;
  private inputCapture!: InputCapture;
  private inputProcessor!: InputProcessor;
  private documentModel!: VirtualDocumentModel;
  private coordinateSystem!: MonospaceCoordinateSystem;
  private fontMeasurer!: FontMeasurer;
  private viewportManager!: ViewportManager;
  private resizeObserver!: ResizeObserver;
  
  // Syntax highlighter
  private syntaxHighlighter!: SyndrQLSyntaxHighlighter;

  // Disable Shadow DOM to allow global Tailwind CSS
  createRenderRoot() {
    return this;
  }
  
  firstUpdated() {
    this.initializeEditor();
  }
  
  /**
   * Handle property changes, especially font-related ones
   */
  willUpdate(changedProperties: Map<string, any>) {
    super.willUpdate(changedProperties);
    
    // If font properties changed, update font metrics
    if (changedProperties.has('fontFamily') || changedProperties.has('fontSize')) {
      if (this.isInitialized && this.fontMeasurer && this.syntaxHighlighter) {
        const fontMetrics = this.fontMeasurer.measureFont(this.fontFamily, this.fontSize);
        this.coordinateSystem.setFontMetrics(fontMetrics);
        this.syntaxHighlighter.updateFontMetrics(fontMetrics);
      }
    }
  }
  
  disconnectedCallback() {
    super.disconnectedCallback();
    this.cleanup();
  }
  
  /**
   * Initializes the editor subsystems.
   */
  private async initializeEditor(): Promise<void> {
    try {
      // Get canvas and context
      this.canvas = this.querySelector('canvas') as HTMLCanvasElement;
      if (!this.canvas) {
        throw new Error('Canvas element not found');
      }
      
      const ctx = this.canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Could not get 2D canvas context');
      }
      this.context = ctx;
      
      // Initialize font measurer and get metrics
      this.fontMeasurer = new FontMeasurer();
      const fontMetrics = this.fontMeasurer.measureFont(this.fontFamily, this.fontSize);
      
      // Verify monospace font
      if (!this.fontMeasurer.verifyMonospace(this.fontFamily, this.fontSize)) {
        console.warn('Font may not be truly monospace, coordinate calculations may be inaccurate');
      }
      
      // Initialize subsystems
      this.documentModel = new VirtualDocumentModel(this.initialText);
      this.coordinateSystem = new MonospaceCoordinateSystem(fontMetrics);
      this.inputCapture = new InputCapture(this.canvas);
      this.inputProcessor = new InputProcessor();
      this.viewportManager = new ViewportManager();
      
      // Initialize viewport with initial canvas size
      this.updateViewport();
      
      // Connect coordinate system to input processor
      this.inputProcessor.setCoordinateSystem(this.coordinateSystem);
      
      // Set up canvas sizing
      this.setupCanvasSizing();
      
      // Set up input handling
      this.setupInputHandling();
      
      // Set initial cursor style
      this.canvas.style.cursor = 'text';
      
      // Start cursor blinking
      this.startCursorBlinking();
      
      // Initial render
      this.renderEditor();
      
      this.isInitialized = true;
      // console.log('Code editor initialized successfully');

      // Initialize syntax highlighter
    this.syntaxHighlighter = createSyndrQLHighlighter({
        theme: {
            keyword: '#569CD6',
            identifier: '#9CDCFE',
            string: '#CE9178',
            comment: '#6A9955',
            literal: '#CE9178',
            operator: '#D4D4D4',
            punctuation: '#D4D4D4',
            number: '#B5CEA8',
            placeholder: '#B5CEA8',
            unknown: '#B5CEA8'
        }
    });
    this.syntaxHighlighter.initialize(this.context, fontMetrics);

    } catch (error) {
      console.error('Failed to initialize code editor:', error);
    }
  }
  
  /**
   * Sets up canvas sizing to fill parent container and handle resize events.
   */
  private setupCanvasSizing(): void {
    const container = this.canvas.parentElement;
    if (!container) {
      console.warn('Canvas parent container not found');
      return;
    }
    
    // Function to resize canvas to match container
    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      const devicePixelRatio = window.devicePixelRatio || 1;
      
      // Set canvas display size (CSS pixels)
      this.canvas.style.width = '100%';
      this.canvas.style.height = '100%';
      
      // Set canvas internal size (device pixels for crisp rendering)
      this.canvas.width = rect.width * devicePixelRatio;
      this.canvas.height = rect.height * devicePixelRatio;
      
      // Scale context to match device pixel ratio
      this.context.scale(devicePixelRatio, devicePixelRatio);
      
      // Re-render after resize
      this.renderEditor();
    };
    
    // Initial resize
    resizeCanvas();
    
    // Set up resize observer to handle container size changes
    this.resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
    });
    
    this.resizeObserver.observe(container);
  }
  
  /**
   * Sets up input event handling.
   */
  private setupInputHandling(): void {
    // Handle text input
    this.inputCapture.onTextInput((text: string) => {
      // console.log('Text input received:', JSON.stringify(text));
      
      // Process text input using InputProcessor
      this.inputProcessor.processTextInput(text, this.documentModel);
      
      // Clear syntax highlighting cache since document changed
      if (this.syntaxHighlighter) {
        this.syntaxHighlighter.clearCache();
      }
      
      // Ensure cursor remains visible
      this.ensureCursorVisible();
      
      // Reset cursor blinking and re-render
      this.resetCursorBlinking();
      this.renderEditor();
    });
    
    // Handle key commands (arrow keys, tab, enter, etc.)
    this.inputCapture.onKeyCommand((command: KeyCommand) => {
      // Process key command using InputProcessor
      this.inputProcessor.processKeyCommand(command, this.documentModel);
      
      // Clear syntax highlighting cache for content-modifying commands
      if (this.syntaxHighlighter && this.isContentModifyingCommand(command.key)) {
        this.syntaxHighlighter.clearCache();
      }
      
      // Ensure cursor remains visible after navigation
      this.ensureCursorVisible();
      
      // Reset cursor blinking and re-render
      this.resetCursorBlinking();
      this.renderEditor();
    });
    
    // Handle mouse events for text selection and scrollbar interactions
    this.inputCapture.onMouseDown((event) => {
      if (this.handleScrollbarMouseDown(event)) {
        return; // Event handled by scrollbar
      }
      
      this.inputProcessor.processMouseDown(event, this.documentModel);
      this.resetCursorBlinking();
      this.renderEditor();
    });
    
    this.inputCapture.onMouseMove((event) => {
      // Check if hovering over scrollbars and update cursor
      this.updateCursorForScrollbars(event);
      
      if (this.handleScrollbarMouseMove(event)) {
        return; // Event handled by scrollbar
      }
      
      this.inputProcessor.processMouseMove(event, this.documentModel);
      this.renderEditor();
    });
    
    this.inputCapture.onMouseUp((event) => {
      if (this.handleScrollbarMouseUp(event)) {
        return; // Event handled by scrollbar
      }
      
      this.inputProcessor.processMouseUp(event, this.documentModel);
      this.renderEditor();
    });
    
    // Add mouse leave handler to reset cursor
    this.canvas.addEventListener('mouseleave', () => {
      this.canvas.style.cursor = 'text';
    });
    
    // Handle mouse wheel for scrolling
    this.inputCapture.onWheel((deltaX, deltaY) => {
      this.handleWheelScroll(deltaX, deltaY);
    });
  }
  
  /**
   * Viewport Management
   */
  private updateViewport(): void {
    const fontMetrics = this.coordinateSystem.getFontMetrics();
    this.viewportManager.updateViewport(
      this.canvas.clientWidth,
      this.canvas.clientHeight,
      fontMetrics
    );
  }

  private ensureCursorVisible(): void {
    const cursorPosition = this.documentModel.getCursorPosition();
    const newScrollOffset = this.viewportManager.ensureCursorVisible(
      cursorPosition.line,
      cursorPosition.column
    );
    
    if (newScrollOffset && (newScrollOffset.x !== this.scrollOffset.x || newScrollOffset.y !== this.scrollOffset.y)) {
      this.scrollOffset = newScrollOffset;
      // Update ViewportManager's scroll offset to keep it in sync
      this.viewportManager.updateScrollOffset(newScrollOffset);
      // Update coordinate system with new scroll offset
      this.coordinateSystem.setScrollOffset(newScrollOffset);
      this.requestUpdate();
    }
  }
  
  /**
   * Mouse Wheel Scrolling
   */
  private handleWheelScroll(deltaX: number, deltaY: number): void {
    const scrollSensitivity = 3; // Lines per wheel step
    const fontMetrics = this.coordinateSystem.getFontMetrics();
    
    // Calculate scroll amounts
    const scrollX = deltaX * scrollSensitivity;
    const scrollY = deltaY * scrollSensitivity;
    
    // Apply scrolling through viewport manager
    const currentOffset = this.viewportManager.getScrollOffset();
    const newOffset = {
      x: currentOffset.x + scrollX,
      y: currentOffset.y + scrollY
    };
    
    // Get scroll bounds for clamping
    const bounds = this.viewportManager.getScrollBounds(this.documentModel);
    
    // Clamp to valid scroll bounds
    const clampedOffset = {
      x: Math.max(0, Math.min(newOffset.x, bounds.maxScrollX)),
      y: Math.max(0, Math.min(newOffset.y, bounds.maxScrollY))
    };
    
    // Update scroll position
    this.scrollOffset = clampedOffset;
    this.viewportManager.updateScrollOffset(clampedOffset);
    
    // Update coordinate system with new scroll offset
    this.coordinateSystem.setScrollOffset(clampedOffset);
    
    // Re-render with new scroll position
    this.renderEditor();
  }
  
  /**
   * Scrollbar Interaction Handling
   */
  private handleScrollbarMouseDown(event: MouseEventData): boolean {
    const mousePos: Coordinates = event.coordinates;
    const hitInfo = this.viewportManager.hitTestScrollbar(mousePos, this.documentModel);
    
    if (hitInfo.type !== 'none') {
      if (hitInfo.type === 'vertical-thumb' || hitInfo.type === 'horizontal-thumb') {
        // Start smooth dragging the thumb
        this.scrollbarDrag = {
          active: true,
          type: hitInfo.type === 'vertical-thumb' ? 'vertical' : 'horizontal',
          startMousePos: mousePos,
          startScrollOffset: { ...this.scrollOffset },
          thumbOffset: hitInfo.type === 'vertical-thumb' ? 
                      mousePos.y - hitInfo.region!.y : 
                      mousePos.x - hitInfo.region!.x
        };
        
        // Initialize smooth drag state
        this.lastMousePos = mousePos;
        this.setupGlobalMouseCapture();
        
      } else if (hitInfo.type === 'vertical-track' || hitInfo.type === 'horizontal-track') {
        // Jump to clicked position on track
        this.handleScrollbarTrackClick(mousePos, hitInfo.type);
      }
      
      this.requestUpdate();
      return true; // Event handled
    }
    
    return false; // Event not handled
  }
  
  private handleScrollbarMouseMove(event: MouseEventData): boolean {
    if (!this.scrollbarDrag.active) {
      return false; // Not dragging
    }
    
    const mousePos: Coordinates = event.coordinates;
    
    // Use direct positioning for precise thumb tracking
    const newScrollOffset = this.calculateDirectScrollFromMousePos(mousePos);
    
    // Schedule smooth update
    this.scheduleScrollUpdate(newScrollOffset);
    
    return true; // Event handled
  }
  
  private handleScrollbarMouseUp(event: MouseEventData): boolean {
    if (!this.scrollbarDrag.active) {
      return false; // Not dragging
    }
    
    // Clean up global mouse capture
    this.removeGlobalMouseCapture();
    
    // End dragging
    this.scrollbarDrag = {
      active: false,
      type: null,
      startMousePos: { x: 0, y: 0 },
      startScrollOffset: { x: 0, y: 0 },
      thumbOffset: 0
    };
    
    this.requestUpdate();
    return true; // Event handled
  }
  
  private handleScrollbarTrackClick(mousePos: Coordinates, trackType: string): void {
    const scrollbarWidth = 12;
    const viewportInfo = this.viewportManager.getViewportInfo();
    
    if (trackType === 'vertical-track') {
      // Calculate target scroll position based on click position
      const trackHeight = viewportInfo.height - scrollbarWidth;
      const clickRatio = mousePos.y / trackHeight;
      const maxScrollY = Math.max(0, this.getTotalContentHeight() - viewportInfo.height);
      
      this.scrollOffset = {
        x: this.scrollOffset.x,
        y: Math.max(0, Math.min(maxScrollY, clickRatio * maxScrollY))
      };
    } else if (trackType === 'horizontal-track') {
      // Calculate target scroll position based on click position
      const trackWidth = viewportInfo.width - scrollbarWidth;
      const clickRatio = mousePos.x / trackWidth;
      const maxScrollX = Math.max(0, this.getTotalContentWidth() - viewportInfo.width);
      
      this.scrollOffset = {
        x: Math.max(0, Math.min(maxScrollX, clickRatio * maxScrollX)),
        y: this.scrollOffset.y
      };
    }
    
    this.viewportManager.updateScrollOffset(this.scrollOffset);
    // Update coordinate system with new scroll offset
    this.coordinateSystem.setScrollOffset(this.scrollOffset);
    this.requestUpdate();
  }
  
    
  
  /**
   * Schedules a smooth scroll update using requestAnimationFrame.
   */
  private scheduleScrollUpdate(newScrollOffset: ScrollOffset): void {
    if (!this.dragUpdateScheduled) {
      this.dragUpdateScheduled = true;
      requestAnimationFrame(() => {
        if (newScrollOffset.x !== this.scrollOffset.x || newScrollOffset.y !== this.scrollOffset.y) {
          this.scrollOffset = newScrollOffset;
          this.viewportManager.updateScrollOffset(newScrollOffset);
          // Update coordinate system with new scroll offset
          this.coordinateSystem.setScrollOffset(newScrollOffset);
          this.renderEditorOptimized(); // Use optimized rendering during drag
        }
        this.dragUpdateScheduled = false;
      });
    }
  }
  
  /**
   * Sets up global mouse capture for smooth dragging outside canvas.
   */
  private setupGlobalMouseCapture(): void {
    this.globalMouseMoveHandler = (event: MouseEvent) => {
      if (this.scrollbarDrag.active) {
        const rect = this.canvas.getBoundingClientRect();
        const mousePos: Coordinates = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top
        };
        
        // Use direct positioning for precise tracking
        const newScrollOffset = this.calculateDirectScrollFromMousePos(mousePos);
        
        this.scheduleScrollUpdate(newScrollOffset);
      }
    };
    
    this.globalMouseUpHandler = (event: MouseEvent) => {
      if (this.scrollbarDrag.active) {
        this.removeGlobalMouseCapture();
        this.scrollbarDrag = {
          active: false,
          type: null,
          startMousePos: { x: 0, y: 0 },
          startScrollOffset: { x: 0, y: 0 },
          thumbOffset: 0
        };
        this.requestUpdate();
      }
    };
    
    document.addEventListener('mousemove', this.globalMouseMoveHandler);
    document.addEventListener('mouseup', this.globalMouseUpHandler);
  }
  
  /**
   * Removes global mouse capture event listeners.
   */
  private removeGlobalMouseCapture(): void {
    if (this.globalMouseMoveHandler) {
      document.removeEventListener('mousemove', this.globalMouseMoveHandler);
      this.globalMouseMoveHandler = undefined;
    }
    if (this.globalMouseUpHandler) {
      document.removeEventListener('mouseup', this.globalMouseUpHandler);
      this.globalMouseUpHandler = undefined;
    }
  }
  
  /**
   * Optimized rendering during drag operations.
   */
  private renderEditorOptimized(): void {
    if (!this.context) return;
    
    // During drag, skip expensive operations and just update scroll position
    this.updateViewport();
    
    // Clear canvas with theme background color
    this.context.fillStyle = this.getInfoContentColor();
    this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const fontMetrics = this.coordinateSystem.getFontMetrics();
    
    // Set font
    this.context.font = `${this.fontSize}px ${this.fontFamily}`;
    this.context.textBaseline = 'top';
    
    // Get viewport info for efficient rendering
    const viewportInfo = this.viewportManager.getViewportInfo();
    const scrollOffset = this.viewportManager.getScrollOffset();
    const lines = this.documentModel.getLines();
    
    // Calculate visible line range
    const firstVisibleLine = Math.floor(scrollOffset.y / fontMetrics.lineHeight);
    const lastVisibleLine = Math.min(
      firstVisibleLine + viewportInfo.visibleLines + 1,
      lines.length - 1
    );
    
    // Only render visible lines (skip selection rendering during drag)
    for (let lineIndex = firstVisibleLine; lineIndex <= lastVisibleLine; lineIndex++) {
      if (lineIndex >= 0 && lineIndex < lines.length) {
        const line = lines[lineIndex];
        const y = (lineIndex * fontMetrics.lineHeight) - scrollOffset.y;
        
        // Simple text rendering without selection
        this.context.fillStyle = this.textColor;
        this.context.fillText(line, 0, y);
      }
    }
    
    // Draw scrollbars
    this.renderScrollbars();
    
    // Draw cursor (simplified)
    this.drawCursor();
  }
  
  /**
   * Calculates scroll position directly from mouse position for precise thumb tracking.
   */
  private calculateDirectScrollFromMousePos(mousePos: Coordinates): ScrollOffset {
    const scrollbarWidth = 12;
    const bounds = this.viewportManager.getScrollBounds(this.documentModel);
    
    if (this.scrollbarDrag.type === 'vertical') {
      // Calculate where the top of the thumb should be based on mouse position
      const adjustedMouseY = mousePos.y - this.scrollbarDrag.thumbOffset;
      const trackHeight = this.viewportManager.getViewportInfo().height - scrollbarWidth;
      
      // Get scrollbar info to determine thumb height
      const scrollbarInfo = this.viewportManager.getScrollbarInfo(this.documentModel);
      const availableTrackSpace = trackHeight - scrollbarInfo.vertical.thumbHeight;
      
      // Map thumb position to scroll position
      const thumbRatio = Math.max(0, Math.min(1, adjustedMouseY / availableTrackSpace));
      const newScrollY = thumbRatio * bounds.maxScrollY;
      
      return {
        x: this.scrollOffset.x,
        y: newScrollY
      };
    } else { // horizontal
      // Calculate where the left of the thumb should be based on mouse position
      const adjustedMouseX = mousePos.x - this.scrollbarDrag.thumbOffset;
      const trackWidth = this.viewportManager.getViewportInfo().width - scrollbarWidth;
      
      // Get scrollbar info to determine thumb width
      const scrollbarInfo = this.viewportManager.getScrollbarInfo(this.documentModel);
      const availableTrackSpace = trackWidth - scrollbarInfo.horizontal.thumbWidth;
      
      // Map thumb position to scroll position
      const thumbRatio = Math.max(0, Math.min(1, adjustedMouseX / availableTrackSpace));
      const newScrollX = thumbRatio * bounds.maxScrollX;
      
      return {
        x: newScrollX,
        y: this.scrollOffset.y
      };
    }
  }
  
  /**
   * Updates cursor style based on scrollbar hover state.
   */
  private updateCursorForScrollbars(event: MouseEventData): void {
    const mousePos: Coordinates = event.coordinates;
    const hitInfo = this.viewportManager.hitTestScrollbar(mousePos, this.documentModel);
    
    if (hitInfo.type !== 'none') {
      // Mouse is over a scrollbar, change cursor to pointer
      this.canvas.style.cursor = 'default';
    } else {
      // Mouse is not over scrollbar, reset to default
      this.canvas.style.cursor = 'text';
    }
  }
  
  // Helper methods for content dimensions (temporary)
  private getTotalContentHeight(): number {
    const fontMetrics = this.coordinateSystem.getFontMetrics();
    return this.documentModel.getLineCount() * fontMetrics.lineHeight;
  }
  
  private getTotalContentWidth(): number {
    const fontMetrics = this.coordinateSystem.getFontMetrics();
    const lines = this.documentModel.getLines();
    const maxLineLength = lines.reduce((max, line) => Math.max(max, line.length), 0);
    return maxLineLength * fontMetrics.characterWidth;
  }
  
  /**
   * Gets the CSS color value for bg-info-content class.
   */
  private getInfoContentColor(): string {
    return this.getThemeColor(this.backgroundColor);
  }
  
    public updateSyntaxTheme(theme: Partial<SyntaxTheme>): void {
    this.syntaxTheme = { ...this.syntaxTheme, ...theme };
    if (this.syntaxHighlighter) {
        this.syntaxHighlighter.setTheme(theme);
        this.renderEditor(); // Re-render with new theme
    }
    }

  /**
   * Basic rendering with selection support.
   */
  private renderEditor(): void {
    if (!this.context) return;
    
    // Update viewport dimensions
    this.updateViewport();
    
    // Clear canvas with theme background color
    this.context.fillStyle = this.getInfoContentColor();
    this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const fontMetrics = this.coordinateSystem.getFontMetrics();    // Set font
    this.context.font = `${this.fontSize}px ${this.fontFamily}`;
    this.context.textBaseline = 'top';
    
    // Get viewport info for efficient rendering
    const viewportInfo = this.viewportManager.getViewportInfo();
    const scrollOffset = this.viewportManager.getScrollOffset();
    const lines = this.documentModel.getLines();
    
    // Calculate visible line range
    const firstVisibleLine = Math.floor(scrollOffset.y / fontMetrics.lineHeight);
    const lastVisibleLine = Math.min(
      firstVisibleLine + viewportInfo.visibleLines + 1, // +1 for partial lines
      lines.length - 1
    );
    
    // Only render visible lines
    for (let lineIndex = firstVisibleLine; lineIndex <= lastVisibleLine; lineIndex++) {
      if (lineIndex >= 0 && lineIndex < lines.length) {
        const line = lines[lineIndex];
        const y = (lineIndex * fontMetrics.lineHeight) - scrollOffset.y;
        this.renderLine(line, lineIndex, y, fontMetrics);
      }
    }
    
    // Draw scrollbars
    this.renderScrollbars();
    
    // Draw cursor
    this.drawCursor();
  }
  
  /**
   * Renders a single line with selection highlighting.
   */
  private renderLine(lineText: string, lineIndex: number, y: number, fontMetrics: FontMetrics): void {
    const selection = this.documentModel.getCurrentSelection();
    
    if (!selection || !this.documentModel.hasSelection()) {
      // No selection - render normally
      // Render with syntax highlighting instead of plain text
      if (this.enableSyntaxHighlighting && this.syntaxHighlighter) {
        // Render with syntax highlighting
        this.syntaxHighlighter.renderLine(
            this.context,
            lineText,
            lineIndex + 1,
            y,
            fontMetrics,
            this.viewportManager.getScrollOffset()
        );
        } else {
        // Fallback to plain text rendering
        this.context.fillStyle = this.getThemeColor(this.textColor);
        this.context.fillText(lineText, 0, y);
        }
        return;
    }
    
    // TODO: Implement selection + syntax highlighting combination

    // Line has selection - render with highlighting
    const lineStart = { line: lineIndex, column: 0 };
    const lineEnd = { line: lineIndex, column: lineText.length };
    
    // Calculate intersection of selection with current line
    const selectionStart = this.maxPosition(selection.start, lineStart);
    const selectionEnd = this.minPosition(selection.end, lineEnd);
    
    // Check if this line intersects with selection
    if (this.comparePositions(selectionStart, selectionEnd) < 0) {
      // Line has selection
      this.renderLineWithSelection(lineText, lineIndex, y, selectionStart, selectionEnd, fontMetrics);
    } else {
      // Line has no selection
      this.context.fillStyle = this.getThemeColor(this.textColor);
      this.context.fillText(lineText, 0, y);
    }
  }
  
  /**
   * Renders a line that has text selection.
   */
  private renderLineWithSelection(
    lineText: string, 
    lineIndex: number, 
    y: number, 
    selectionStart: Position, 
    selectionEnd: Position,
    fontMetrics: FontMetrics
  ): void {
    const startCol = selectionStart.line === lineIndex ? selectionStart.column : 0;
    const endCol = selectionEnd.line === lineIndex ? selectionEnd.column : lineText.length;
    
    // Render text before selection
    if (startCol > 0) {
      const beforeText = lineText.substring(0, startCol);
      this.context.fillStyle = this.getThemeColor(this.textColor);
      this.context.fillText(beforeText, 0, y);
    }
    
    // Render selection background
    if (endCol > startCol) {
      const selectionWidth = (endCol - startCol) * fontMetrics.characterWidth;
      const selectionX = startCol * fontMetrics.characterWidth;
      
      this.context.fillStyle = this.getThemeColor(this.selectionBackgroundColor);
      this.context.fillRect(selectionX, y, selectionWidth, fontMetrics.lineHeight);
      
      // Render selected text
      const selectedText = lineText.substring(startCol, endCol);
      this.context.fillStyle = this.getThemeColor(this.selectionTextColor);
      this.context.fillText(selectedText, selectionX, y);
    }
    
    // Render text after selection
    if (endCol < lineText.length) {
      const afterText = lineText.substring(endCol);
      const afterX = endCol * fontMetrics.characterWidth;
      this.context.fillStyle = this.getThemeColor(this.textColor);
      this.context.fillText(afterText, afterX, y);
    }
  }
  
  /**
   * Gets the computed CSS color for a theme property.
   */
  private getThemeColor(colorValue: string): string {
    // If it's already a color (starts with #), return it
    if (colorValue.startsWith('#')) {
      return colorValue;
    }
    
    // If it's a CSS class, get the computed color
    const tempElement = document.createElement('div');
    tempElement.className = colorValue;
    tempElement.style.visibility = 'hidden';
    tempElement.style.position = 'absolute';
    document.body.appendChild(tempElement);
    
    const computedStyle = window.getComputedStyle(tempElement);
    
    // Check if this is a text color class or background color class
    let resolvedColor: string;
    if (colorValue.includes('text-') || colorValue === this.selectionTextColor) {
      // Text color classes use the 'color' property
      resolvedColor = computedStyle.color;
    } else {
      // Background color classes use the 'backgroundColor' property
      resolvedColor = computedStyle.backgroundColor;
    }
    
    document.body.removeChild(tempElement);
    
    return resolvedColor || colorValue;
  }
  
  /**
   * Compares two positions to determine order.
   */
  private comparePositions(a: Position, b: Position): number {
    if (a.line !== b.line) {
      return a.line - b.line;
    }
    return a.column - b.column;
  }
  
  /**
   * Returns the maximum of two positions.
   */
  private maxPosition(a: Position, b: Position): Position {
    return this.comparePositions(a, b) > 0 ? a : b;
  }
  
  /**
   * Returns the minimum of two positions.
   */
  private minPosition(a: Position, b: Position): Position {
    return this.comparePositions(a, b) < 0 ? a : b;
  }
  
  /**
   * Renders scrollbars based on content size vs viewport.
   */
  private renderScrollbars(): void {
    if (!this.context) return;
    
    const scrollbarInfo = this.viewportManager.getScrollbarInfo(this.documentModel);
    const viewportInfo = this.viewportManager.getViewportInfo();
    
    const scrollbarWidth = 12;
    const scrollbarColor = '#CBD5E1'; // Tailwind slate-300
    const thumbColor = '#64748B'; // Tailwind slate-500
    
    // Draw vertical scrollbar if visible
    if (scrollbarInfo.vertical.visible) {
      const scrollbarX = viewportInfo.width - scrollbarWidth;
      
      // Draw scrollbar track
      this.context.fillStyle = scrollbarColor;
      this.context.fillRect(scrollbarX, 0, scrollbarWidth, viewportInfo.height);
      
      // Draw scrollbar thumb
      this.context.fillStyle = thumbColor;
      this.context.fillRect(
        scrollbarX + 2, 
        scrollbarInfo.vertical.thumbPosition, 
        scrollbarWidth - 4, 
        scrollbarInfo.vertical.thumbHeight
      );
    }
    
    // Draw horizontal scrollbar if visible  
    if (scrollbarInfo.horizontal.visible) {
      const scrollbarY = viewportInfo.height - scrollbarWidth;
      
      // Draw scrollbar track
      this.context.fillStyle = scrollbarColor;
      this.context.fillRect(0, scrollbarY, viewportInfo.width, scrollbarWidth);
      
      // Draw scrollbar thumb
      this.context.fillStyle = thumbColor;
      this.context.fillRect(
        scrollbarInfo.horizontal.thumbPosition, 
        scrollbarY + 2, 
        scrollbarInfo.horizontal.thumbWidth, 
        scrollbarWidth - 4
      );
    }
  }
  
  /**
   * Draws the text cursor at current position with blinking.
   */
  private drawCursor(): void {
    // Only draw cursor if it's visible (for blinking effect)
    if (!this.cursorVisible) return;
    
    const cursorPos = this.documentModel.getCursorPosition();
    const screenPos = this.coordinateSystem.positionToScreen(cursorPos);
    const fontMetrics = this.coordinateSystem.getFontMetrics();
    const scrollOffset = this.viewportManager.getScrollOffset();
    
    // Apply scroll offset to cursor position
    const x = screenPos.x - scrollOffset.x;
    const y = screenPos.y - scrollOffset.y;
    
    // Only draw cursor if it's in the visible area
    const viewportInfo = this.viewportManager.getViewportInfo();
    if (x >= -2 && x <= viewportInfo.width && y >= -fontMetrics.lineHeight && y <= viewportInfo.height) {
      this.context.fillStyle = this.getThemeColor(this.cursorColor);
      this.context.fillRect(
        x,
        y,
        2, // cursor width
        fontMetrics.lineHeight
      );
    }
  }
  
  /**
   * Starts the cursor blinking animation.
   */
  private startCursorBlinking(): void {
    this.stopCursorBlinking();
    
    this.cursorBlinkTimer = window.setInterval(() => {
      this.cursorVisible = !this.cursorVisible;
      this.renderEditor(); // Re-render to show/hide cursor
    }, this.cursorBlinkInterval);
  }
  
  /**
   * Stops the cursor blinking animation.
   */
  private stopCursorBlinking(): void {
    if (this.cursorBlinkTimer !== null) {
      clearInterval(this.cursorBlinkTimer);
      this.cursorBlinkTimer = null;
    }
  }
  
  private handleTextDrop(event: CustomEvent) {
    const { dropData, dropX, dropY } = event.detail;
    // console.log('Text dropped:', JSON.stringify(dropData), 'at window coordinates:', { x: dropX, y: dropY });

    // Convert window coordinates to canvas-relative coordinates
    const canvasRect = this.canvas.getBoundingClientRect();
    const canvasRelativeX = dropX - canvasRect.left;
    const canvasRelativeY = dropY - canvasRect.top;
    // console.log('Canvas-relative coordinates:', { x: canvasRelativeX, y: canvasRelativeY });

    // Get current scroll offset and font metrics for debugging
    const currentScrollOffset = this.viewportManager.getScrollOffset();
    const fontMetrics = this.coordinateSystem.getFontMetrics();
    // console.log('Current scroll offset:', currentScrollOffset);
    // console.log('Font metrics:', { lineHeight: fontMetrics.lineHeight, characterWidth: fontMetrics.characterWidth });

    // Update coordinate system with current scroll offset before calculations
    this.coordinateSystem.setScrollOffset(currentScrollOffset);

    // Snap to character grid for precise positioning (using canvas-relative coordinates)
    const snappedCoords = this.snapToCharacter({ x: canvasRelativeX, y: canvasRelativeY });
    // console.log('Snapped drop coordinates:', snappedCoords);

    // Manual calculation for verification (using canvas-relative coordinates)
    const adjustedX = canvasRelativeX + currentScrollOffset.x;
    const adjustedY = canvasRelativeY + currentScrollOffset.y;
    const manualLine = Math.floor(adjustedY / fontMetrics.lineHeight);
    const manualColumn = Math.floor(adjustedX / fontMetrics.characterWidth);
    // console.log('Manual calculation:', { adjustedX, adjustedY, manualLine, manualColumn });

    // Get insertion position with sub-character precision from snapped coordinates
    const insertionPos = this.inputProcessor.getInsertionPosition(snappedCoords, this.documentModel);
    // console.log('Raw insertion position from input processor:', insertionPos);
    
    // Determine final insertion position using character offset for snap direction
    let finalColumn = insertionPos.column;
    if (insertionPos.characterOffset && insertionPos.characterOffset >= 0.5) {
      finalColumn = insertionPos.column + 1;
    }
    
    // Validate insertion position and handle line overflow
    const finalPosition = this.validateAndHandleOverflow({
      line: insertionPos.line,
      column: finalColumn
    }, dropData);
    
    // console.log('Final position after validation:', finalPosition);

    // Insert dropped text directly at the target position (this will auto-expand the document)
    this.documentModel.insertText(finalPosition, dropData);
    
    // Clear syntax highlighting cache since document changed
    if (this.syntaxHighlighter) {
      this.syntaxHighlighter.clearCache();
    }
    
    // Ensure cursor is visible after insertion
    this.ensureCursorVisible();
    
    // Reset cursor blinking and re-render
    this.resetCursorBlinking();
    this.renderEditor();
  }
  
  /**
   * Validates insertion position and creates missing lines/padding as needed.
   * Implements Monaco-style behavior: create empty lines and pad target line with spaces.
   */
  private validateAndHandleOverflow(position: Position, textToInsert: string): Position {
    // Remove viewport width restriction - allow insertion anywhere
    // The document model/input processor will handle creating lines and padding
    
    // Simply return the position - let the document handle line creation and padding
    return {
      line: Math.max(0, position.line),
      column: Math.max(0, position.column)
    };
  }

  /**
   * Resets cursor blinking (shows cursor and restarts timer).
   * Called when user interacts with the editor.
   */
  private resetCursorBlinking(): void {
    this.cursorVisible = true;
    this.startCursorBlinking();
  }
  
  /**
   * Public API for Precise Coordinate System
   * Enables external components to access Monaco-like coordinate precision
   */
  
  /**
   * Convert mouse coordinates to text insertion position with sub-character precision.
   * Essential for drag-and-drop text operations.
   */
  public getInsertionPosition(mouseCoords: Coordinates): CharacterPosition {
    return this.inputProcessor.getInsertionPosition(mouseCoords, this.documentModel);
  }
  
  /**
   * Get pixel bounds for a character at the given position.
   * Useful for positioning UI elements relative to text.
   */
  public getCharacterBounds(position: Position): { left: number; top: number; width: number; height: number } | null {
    return this.inputProcessor.getCharacterBounds(position);
  }
  
  /**
   * Snap mouse coordinates to nearest character boundary.
   * Provides character-precise positioning feedback.
   */
  public snapToCharacter(mouseCoords: Coordinates): Coordinates {
    return this.inputProcessor.snapToCharacter(mouseCoords);
  }
  
  /**
   * Snap mouse coordinates to nearest line boundary.
   * Useful for line-based operations and selections.
   */
  public snapToLine(mouseCoords: Coordinates): Coordinates {
    return this.inputProcessor.snapToLine(mouseCoords);
  }
  
  /**
   * Access the coordinate system directly for advanced operations.
   */
  public getCoordinateSystem(): MonospaceCoordinateSystem {
    return this.coordinateSystem;
  }
  
  /**
   * Convert screen position to document position.
   * Standard precision for basic operations.
   */
  public screenToPosition(screen: Coordinates): Position {
    return this.coordinateSystem.screenToPosition(screen);
  }
  
  /**
   * Convert document position to screen coordinates.
   * Accounts for current scroll offset.
   */
  public positionToScreen(position: Position): Coordinates {
    return this.coordinateSystem.positionToScreen(position);
  }
  
  /**
   * Enhanced conversion with sub-character precision.
   * For drag-and-drop and precise text operations.
   */
  public screenToCharacterPosition(screen: Coordinates): CharacterPosition {
    return this.coordinateSystem.screenToCharacterPosition(screen);
  }
  
  /**
   * Helper method to determine if a key command modifies document content
   */
  private isContentModifyingCommand(key: string): boolean {
    return ['Enter', 'Backspace', 'Delete', 'Tab'].includes(key);
  }
  
  /**
   * Cleanup method to remove event listeners and DOM elements.
   */
  private cleanup(): void {
    this.stopCursorBlinking();
    
    if (this.inputCapture) {
      this.inputCapture.destroy();
    }
    
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }
  
  render() {
    return html`
    <droppable-component @drop-completed=${this.handleTextDrop}>
      <div class="border border-gray-600 rounded-lg bg-gray-900 relative h-full w-full">
        <canvas 
          class="block cursor-text w-full h-full bg-info-content"
          style="font-family: ${this.fontFamily}; font-size: ${this.fontSize}px;"
        ></canvas>
        ${!this.isInitialized ? html`
          <div class="absolute inset-0 flex items-center justify-center text-gray-400">
            Initializing editor...
          </div>
        ` : ''}
      </div>
      </droppable-component>
    `;
  }
}