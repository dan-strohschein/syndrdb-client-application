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
import { createSyndrQLHighlighter, SyndrQLSyntaxHighlighter, SyntaxTheme, SyntaxToken, CodeStatement, CodeCache } from './syndrQL-language-service/index.js';
import { StatementParser } from './syndrQL-language-service/statement-parser.js';
import { SyndrQLGrammarValidator } from './syndrQL-language-service/grammar-validator.js';
import './error-pop-up/error-pop-up.js';
import './line-numbers/line-numbers.js';

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
  
  // Statement cache for granular validation
  private statementParser!: StatementParser;
  private grammarValidator!: SyndrQLGrammarValidator;
  private codeCache: CodeCache = { statements: [] };
  private validationResults = new Map<string, any>(); // Store validation results by statement key
  private statementValidationTimeout: number | null = null;
  private readonly STATEMENT_VALIDATION_DELAY = 200;
  
  // Error popover for invalid token/statement details
  private errorPopup!: HTMLElement;
  private hoveredInvalidElement: { type: 'token' | 'statement', data: any } | null = null;
  private popoverHideTimeout: number | null = null;
  private currentHoveredToken: { line: number, column: number, statement: any } | null = null;
  private isPopoverVisible: boolean = false;
  private isMouseOverPopover: boolean = false;

  // Line numbers tracking
  @state()
  private lineCount: number = 1;
  
  @state()
  private editorScrollTop: number = 0;
  
  @state()
  private editorHeight: number = 400;

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
            unknown: '#B5CEA8',
             errorUnderline: {
                color: '#ff0000',     // Red color
                thickness: 1,         // Line thickness
                amplitude: 1,         // Height of squiggles  
                frequency: 4          // Pixels per wave
            }
        }
    });
    this.syntaxHighlighter.initialize(this.context, fontMetrics);

    // Initialize statement parser for granular validation
    this.statementParser = new StatementParser();
    this.grammarValidator = new SyndrQLGrammarValidator();

    // Set up grammar validation callback to re-render when validation completes
    this.syntaxHighlighter.setGrammarValidationCallback((code: string, tokens: SyntaxToken[]) => {
      // Re-render the editor when grammar validation completes
      this.renderEditor();
    });

    // Initialize document context and statement cache
    this.updateStatementCache();
    this.updateSyntaxHighlighterContext();

    } catch (error) {
      console.error('Failed to initialize code editor:', error);
    }
  }
  
  /**
   * Sets up canvas sizing to fill parent container and handle resize events.
   */
  /**
   * Update syntax highlighter with current document context for grammar validation
   */
  private updateSyntaxHighlighterContext(): void {
    if (this.syntaxHighlighter && this.documentModel) {
      const lines = this.documentModel.getLines();
      const fullText = lines.join('\n');
      this.syntaxHighlighter.updateDocumentContext(fullText);
    }
  }

  /**
   * Update statement cache by parsing the current document
   */
  private updateStatementCache(): void {
    if (this.documentModel && this.statementParser) {
      const lines = this.documentModel.getLines();
      const fullText = lines.join('\n');
      
      // Parse document into statements
      const statements = this.statementParser.parseStatements(fullText);
      this.codeCache = { statements };
      
     // console.log('🔥 Statement cache updated:', statements.length, 'statements');
    }
  }

  /**
   * Find which statement contains the current cursor position
   */
  private getCurrentStatement(): CodeStatement | null {
    if (!this.documentModel || this.codeCache.statements.length === 0) {
      return null;
    }
    
    const cursorPosition = this.documentModel.getCursorPosition();
    return this.statementParser.findStatementAtPosition(
      this.codeCache.statements,
      cursorPosition.line,
      cursorPosition.column
    );
  }

  /**
   * Mark the current statement as dirty and schedule validation
   */
  private markCurrentStatementDirty(): void {
    const currentStatement = this.getCurrentStatement();
    if (currentStatement) {
      // Mark statement as dirty if not already dirty
      if (!currentStatement.isDirty) {
        this.codeCache.statements = this.statementParser.markStatementDirty(
          this.codeCache.statements,
          currentStatement
        );
        console.log('🔥 Statement marked dirty:', currentStatement.code.substring(0, 50) + '...');
      }
      
      // Always schedule validation (debounced) - this reschedules on each keystroke
      this.scheduleStatementValidation(currentStatement);
    }
  }

  /**
   * Schedule validation for a specific statement with debounce
   */
  private scheduleStatementValidation(statement: CodeStatement): void {
    // Clear existing timeout
    if (this.statementValidationTimeout) {
      clearTimeout(this.statementValidationTimeout);
    }
    
    // Schedule new validation
    this.statementValidationTimeout = window.setTimeout(() => {
      this.validateStatement(statement);
    }, this.STATEMENT_VALIDATION_DELAY);
  }

  /**
   * Validate a specific statement and update cache
   * Enhanced with comprehensive error analysis and detailed logging
   */
  private validateStatement(statement: CodeStatement): void {
    // Find the current version of this statement in the cache
    // (content may have changed since validation was scheduled)
    const currentStatement = this.codeCache.statements.find(s => 
      s.lineStart === statement.lineStart && s.lineEnd === statement.lineEnd
    );
    
    if (!currentStatement || !currentStatement.isDirty) {
      return; // Statement not found or already clean
    }

    // console.log('🔥 VALIDATING STATEMENT:', currentStatement.code);

    // Use the grammar validator with statement line offset for accurate error reporting
    const validationResult = this.grammarValidator.validate(
      currentStatement.tokens, 
      currentStatement.lineStart
    );
    const isValid = validationResult.isValid;
    
    // console.log('🔥 VALIDATION RESULT:', {
    //   valid: isValid, 
    //   invalidTokens: Array.from(validationResult.invalidTokens),
    //   errorCount: validationResult.errorDetails?.length || 0
    // });
    
    // Log detailed error information for debugging and future UI implementation
    if (validationResult.errorDetails && validationResult.errorDetails.length > 0) {
      //console.log('🔥 DETAILED ERRORS:');
      validationResult.errorDetails.forEach((error, index) => {
        // console.log(`  ${index + 1}. [${error.code}] ${error.message}`);
        // console.log(`     Location: Line ${error.line + 1}, Column ${error.column + 1}`);
        // console.log(`     Source: "${error.source}"`);
        // if (error.suggestion) {
        //   console.log(`     Suggestion: ${error.suggestion}`);
        // }
        // console.log('');
      });
    }
    
    // Mark statement as clean with validation result
    this.codeCache.statements = this.statementParser.markStatementClean(
      this.codeCache.statements,
      currentStatement,
      isValid
    );
    
    // Store validation results for hover error display
    const statementKey = `${currentStatement.lineStart}-${currentStatement.lineEnd}`;
    this.validationResults.set(statementKey, validationResult);
    
    // Re-render to show validation results
    this.renderEditor();
  }

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
      
      // Update statement cache and mark current statement as dirty
      this.updateStatementCache();
      this.markCurrentStatementDirty();
      
      // Keep the old syntax highlighter system for now (will be replaced later)
      if (this.syntaxHighlighter) {
        this.syntaxHighlighter.markDirty();
        this.syntaxHighlighter.clearCache();
        this.updateSyntaxHighlighterContext();
      }
      
      // Ensure cursor remains visible
      this.ensureCursorVisible();
      
      // Reset cursor blinking and re-render
      this.resetCursorBlinking();
      this.renderEditor();
    });
    
    // Handle key commands (arrow keys, tab, enter, etc.)
    this.inputCapture.onKeyCommand((command: KeyCommand) => {
        
      // Handle clipboard operations first (Ctrl+C, Ctrl+V, Ctrl+X)
      if (this.handleClipboardCommand(command)) {
        return; // Command was handled by clipboard operations
      }
      
      // Process key command using InputProcessor
      this.inputProcessor.processKeyCommand(command, this.documentModel);
      
      // Update statement cache and mark current statement as dirty for content-modifying commands
      if (this.isContentModifyingCommand(command.key)) {
        this.updateStatementCache();
        this.markCurrentStatementDirty();
      }
      
      // Keep the old syntax highlighter system for now (will be replaced later)
      if (this.syntaxHighlighter && this.isContentModifyingCommand(command.key)) {
        this.syntaxHighlighter.markDirty();
        this.syntaxHighlighter.clearCache();
        this.updateSyntaxHighlighterContext();
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
      
      // Check for hover over invalid tokens/statements for error popover
      this.handleErrorHoverAlternative(event);
      
      this.renderEditor();
    });

    // Listen for popover hover events
    this.addEventListener('popover-mouse-enter', () => {
     // console.log('🖱️ Mouse entered popover');
      this.isMouseOverPopover = true;
      
      // Cancel any pending hide timeout when mouse enters popover
      if (this.popoverHideTimeout) {
        clearTimeout(this.popoverHideTimeout);
        this.popoverHideTimeout = null;
        console.log('✅ Cancelled popover hide timeout due to mouse enter');
      }
    });

    this.addEventListener('popover-mouse-leave', () => {
     // console.log('🖱️ Mouse left popover');
      this.isMouseOverPopover = false;
      
      // Hide popover when mouse leaves it (with small delay)
      this.hideErrorPopover();
    });

    // Listen for popover dismissed by escape key
    this.addEventListener('popover-dismissed', () => {
      console.log('⌨️ Popover dismissed by escape key');
      this.isPopoverVisible = false;
      this.isMouseOverPopover = false;
      this.currentHoveredToken = null;
      
      // Clear any pending hide timeout
      if (this.popoverHideTimeout) {
        clearTimeout(this.popoverHideTimeout);
        this.popoverHideTimeout = null;
      }
    });

    // Handle mouse leaving the entire editor area
    this.canvas.addEventListener('mouseleave', () => {
        this.canvas.style.cursor = 'text';
      // Hide popover when mouse leaves the editor completely
    
      this.hideErrorPopoverImmediate();
    });
    
    this.inputCapture.onMouseUp((event) => {
      if (this.handleScrollbarMouseUp(event)) {
        return; // Event handled by scrollbar
      }
      
      this.inputProcessor.processMouseUp(event, this.documentModel);
      this.renderEditor();
    });
    
    // Add mouse leave handler to reset cursor
    // this.canvas.addEventListener('mouseleave', () => {
     
    // });
    
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
   * Handle mouse hover events for showing error popovers on invalid tokens/statements
   */
  private handleErrorHover(event: MouseEventData): void {
    const canvasRect = this.canvas?.getBoundingClientRect();
    if (!canvasRect) {
      return;
    }

    // Convert mouse coordinates to canvas coordinates
    const canvasX = event.coordinates.x - canvasRect.left;
    const canvasY = event.coordinates.y - canvasRect.top;

    // Convert canvas coordinates to document position
    const position = this.coordinateSystem.screenToPosition({ x: canvasX, y: canvasY });
    
    // console.log('🖱️ HOVER DEBUG:', {
    //   mouseScreen: { x: event.coordinates.x, y: event.coordinates.y },
    //   canvasRect: { left: canvasRect.left, top: canvasRect.top, width: canvasRect.width, height: canvasRect.height },
    //   canvasCoords: { x: canvasX, y: canvasY },
    //   documentPosition: position,
    //   scrollOffset: this.scrollOffset
    // });
    
    // Find the statement at this position
    const statement = this.statementParser.findStatementAtPosition(
      this.codeCache.statements,
      position.line,
      position.column
    );

    // console.log('📋 STATEMENT DEBUG:', {
    //   foundStatement: !!statement,
    //   statement: statement ? {
    //     code: statement.code,
    //     lineStart: statement.lineStart,
    //     lineEnd: statement.lineEnd,
    //     isValid: statement.isValid,
    //     isDirty: statement.isDirty
    //   } : null,
    //   allStatements: this.codeCache.statements.map(s => ({
    //     code: s.code.trim(),
    //     lines: `${s.lineStart}-${s.lineEnd}`,
    //     isValid: s.isValid,
    //     isDirty: s.isDirty
    //   }))
    // });

    // Check if we're over a different token than before
    const currentTokenKey = statement ? `${position.line}-${position.column}-${statement.lineStart}-${statement.lineEnd}` : null;
    const previousTokenKey = this.currentHoveredToken ? `${this.currentHoveredToken.line}-${this.currentHoveredToken.column}-${this.currentHoveredToken.statement.lineStart}-${this.currentHoveredToken.statement.lineEnd}` : null;
    
    // If we're over the same token as before, do nothing
    if (currentTokenKey === previousTokenKey) {
      return;
    }
    
    // We've moved to a different token (or no token), hide current popover
    this.hideErrorPopover();
    
    // Update current hovered token
    this.currentHoveredToken = statement ? { line: position.line, column: position.column, statement } : null;
    
    // Check if this new token/statement has validation errors
    if (statement && !statement.isValid && !statement.isDirty) {
      console.log('✅ Found invalid statement, showing popover');
      
      // Get stored validation results for this statement
      const statementKey = `${statement.lineStart}-${statement.lineEnd}`;
      const validationResult = this.validationResults.get(statementKey);
      
      let errors = [];
      if (validationResult && validationResult.errorDetails && validationResult.errorDetails.length > 0) {
        // Use detailed error information from validation
        errors = validationResult.errorDetails;
      } else {
        // Fallback to generic error message
        errors = [{
          message: `Invalid SyndrQL statement detected on lines ${statement.lineStart + 1}-${statement.lineEnd + 1}`,
          code: 'INVALID_STATEMENT'
        }];
      }
      
      // Calculate exact token position for popover placement
      const tokenScreenPos = this.calculateTokenScreenPosition(position);
      console.log('📍 TOKEN POSITION:', { 
        calculatedPosition: tokenScreenPos,
        originalPosition: position 
      });
      
      this.showErrorPopover(tokenScreenPos.x, tokenScreenPos.y, errors);
    } else {
      console.log('❌ No invalid statement or statement is valid/dirty');
    }
  }

  /**
   * Alternative hover detection using direct line calculation
   */
  private handleErrorHoverAlternative(event: MouseEventData): void {
    // event.coordinates is already relative to the canvas (from InputCapture.createMouseEventData)
    const mouseCanvas = event.coordinates;
    
    // console.log('� MOUSE CANVAS COORDINATES:', {
    //   mouseCanvas,
    //   note: 'These coordinates are already relative to canvas from InputCapture'
    // });

    // Early exit for negative coordinates (indicates positioning issues)
    if (mouseCanvas.x < 0 || mouseCanvas.y < 0) {
      console.log('❌ Negative coordinates detected, skipping hover detection');
      return;
    }
    
    // Get font metrics
    const fontMetrics = this.coordinateSystem.getFontMetrics();
    
    // Calculate which line we're hovering over using direct math
    // Account for scroll offset
    const scrollAdjustedY = mouseCanvas.y + this.scrollOffset.y;
    const lineIndex = Math.floor(scrollAdjustedY / fontMetrics.lineHeight);
    
    // Calculate column (rough estimate)
    const scrollAdjustedX = mouseCanvas.x + this.scrollOffset.x;
    const columnIndex = Math.floor(scrollAdjustedX / fontMetrics.characterWidth);
    
    // console.log('🔄 ALTERNATIVE HOVER DEBUG:', {
    //   mouseCanvas,
    //   scrollOffset: this.scrollOffset,
    //   scrollAdjusted: { x: scrollAdjustedX, y: scrollAdjustedY },
    //   calculated: { line: lineIndex, column: columnIndex },
    //   fontMetrics: { lineHeight: fontMetrics.lineHeight, charWidth: fontMetrics.characterWidth }
    // });
    
    // Find statement at this calculated position
    const statement = this.statementParser.findStatementAtPosition(
      this.codeCache.statements,
      lineIndex,
      columnIndex
    );
    
    // console.log('📋 ALT STATEMENT DEBUG:', {
    //   foundStatement: !!statement,
    //   calculatedLine: lineIndex,
    //   calculatedColumn: columnIndex,
    //   statement: statement ? {
    //     code: statement.code.trim(),
    //     lines: `${statement.lineStart}-${statement.lineEnd}`,
    //     isValid: statement.isValid
    //   } : null
    // });
    
    // Rest of hover logic...
    if (statement && !statement.isValid && !statement.isDirty) {
      //console.log('✅ ALT: Found invalid statement');
      
      // Find the actual token being hovered over
      const hoveredTokenPosition = this.findTokenAtPosition(lineIndex, columnIndex);
      
      if (hoveredTokenPosition) {
        // Create a token key for tracking purposes
        const currentTokenKey = `${hoveredTokenPosition.line}-${hoveredTokenPosition.startColumn}-${statement.lineStart}-${statement.lineEnd}`;
        const previousTokenKey = this.currentHoveredToken ? `${this.currentHoveredToken.line}-${this.currentHoveredToken.column}-${this.currentHoveredToken.statement.lineStart}-${this.currentHoveredToken.statement.lineEnd}` : null;
        
        // console.log('🔄 TOKEN TRACKING:', {
        //   currentKey: currentTokenKey,
        //   previousKey: previousTokenKey,
        //   isNewToken: currentTokenKey !== previousTokenKey
        // });
        
        // If we're over the same token as before, do nothing
        if (currentTokenKey === previousTokenKey) {
          return;
        }
        
        // Update current hovered token
        this.currentHoveredToken = { 
          line: hoveredTokenPosition.line, 
          column: hoveredTokenPosition.startColumn, 
          statement 
        };
        
        // Calculate screen position for the START of the hovered token
        const canvasRect = this.canvas.getBoundingClientRect();
        const tokenStartX = canvasRect.left + (hoveredTokenPosition.startColumn * fontMetrics.characterWidth) - this.scrollOffset.x;
        const tokenStartY = canvasRect.top + (hoveredTokenPosition.line * fontMetrics.lineHeight) - this.scrollOffset.y;
        
        // console.log('🎯 TOKEN POSITIONING:', {
        //   hoveredToken: hoveredTokenPosition,
        //   screenPosition: { x: tokenStartX, y: tokenStartY },
        //   calculation: `canvas(${canvasRect.left}) + startCol(${hoveredTokenPosition.startColumn}) * charWidth(${fontMetrics.characterWidth}) - scrollX(${this.scrollOffset.x})`
        // });
        
        const errors = [{
          message: `Invalid SyndrQL statement detected on lines ${statement.lineStart + 1}-${statement.lineEnd + 1}`,
          code: 'INVALID_STATEMENT'
        }];
        
        this.showErrorPopover(tokenStartX, tokenStartY, errors);
      } else {
       // console.log('❌ Could not find token at position for popover positioning');
        this.currentHoveredToken = null;
       
        //this.hideErrorPopover();
        
      }
    } else {
      // Not hovering over an invalid token, but don't hide immediately if popover is visible
      // This allows user to move mouse from token to popover without it disappearing
      if (this.isPopoverVisible && this.currentHoveredToken) {
        console.log('⏸️ Not over token but popover is visible, giving time to reach popover');
        // Only start hide timer if we're not already over the popover
        if (!this.isMouseOverPopover) {
          this.hideErrorPopover();
        }
      } else {
        
        // No popover visible or no previous token, safe to clear state
       // console.log('❌ Not hovering over invalid token, hiding popover');
        this.currentHoveredToken = null;
        this.hideErrorPopover();
      }
    }
  }

  /**
   * Find the token at a specific line and column position
   */
  private findTokenAtPosition(lineIndex: number, columnIndex: number): { line: number, startColumn: number, endColumn: number, text: string } | null {
    // Get the content of the specified line
    const lines = this.documentModel.getLines();
    if (lineIndex < 0 || lineIndex >= lines.length) {
      return null;
    }
    
    const lineContent = lines[lineIndex];
    if (columnIndex < 0 || columnIndex >= lineContent.length) {
      return null;
    }
    
    // Simple tokenization - find word boundaries
    // This handles basic tokens separated by spaces, punctuation, etc.
    let startColumn = columnIndex;
    let endColumn = columnIndex;
    
    // Find start of token (move backwards until we hit a delimiter)
    while (startColumn > 0 && this.isTokenCharacter(lineContent[startColumn - 1])) {
      startColumn--;
    }
    
    // Find end of token (move forwards until we hit a delimiter)
    while (endColumn < lineContent.length && this.isTokenCharacter(lineContent[endColumn])) {
      endColumn++;
    }
    
    // If we didn't find any token characters, try to find the nearest token
    if (startColumn === endColumn) {
      // Check if we're hovering over whitespace - find the nearest token
      // Look forward first
      let nextTokenStart = columnIndex;
      while (nextTokenStart < lineContent.length && !this.isTokenCharacter(lineContent[nextTokenStart])) {
        nextTokenStart++;
      }
      
      if (nextTokenStart < lineContent.length) {
        startColumn = nextTokenStart;
        endColumn = nextTokenStart;
        while (endColumn < lineContent.length && this.isTokenCharacter(lineContent[endColumn])) {
          endColumn++;
        }
      } else {
        return null; // No token found
      }
    }
    
    const tokenText = lineContent.substring(startColumn, endColumn);
    
    // console.log('🔍 TOKEN DETECTION:', {
    //   lineIndex,
    //   columnIndex,
    //   lineContent: `"${lineContent}"`,
    //   foundToken: {
    //     text: `"${tokenText}"`,
    //     start: startColumn,
    //     end: endColumn
    //   }
    // });
    
    return {
      line: lineIndex,
      startColumn,
      endColumn,
      text: tokenText
    };
  }

  /**
   * Check if a character is part of a token (alphanumeric, underscore, etc.)
   */
  private isTokenCharacter(char: string): boolean {
    return /[a-zA-Z0-9_]/.test(char);
  }

  private calculateTokenScreenPosition(position: any): { x: number, y: number } {
    // Get font metrics for accurate positioning
    const fontMetrics = this.coordinateSystem.getFontMetrics();
    
    console.log('🔧 POSITION CALC DEBUG:', {
      inputPosition: position,
      fontMetrics: {
        lineHeight: fontMetrics.lineHeight,
        ascent: fontMetrics.ascent,
        descent: fontMetrics.descent,
        characterWidth: fontMetrics.characterWidth
      },
      scrollOffset: this.scrollOffset
    });
    
    // Convert document position to screen coordinates (this gives us the character position)
    const screenPos = this.coordinateSystem.positionToScreen({
      line: position.line,
      column: position.column
    });
    
    console.log('📐 SCREEN POS DEBUG:', {
      screenPos,
      beforeCanvasAdjustment: screenPos
    });
    
    // Get canvas rectangle to convert to absolute screen coordinates
    const canvasRect = this.canvas?.getBoundingClientRect();
    if (!canvasRect) {
      return { x: 0, y: 0 };
    }
    
    // Calculate the exact top-left pixel of the token/character
    // screenPos gives us the baseline position, we need to adjust to top-left
    const tokenTopLeftX = canvasRect.left + screenPos.x;
    const tokenTopLeftY = canvasRect.top + screenPos.y - fontMetrics.ascent; // Move up from baseline to top
    
    console.log('📍 FINAL POSITION DEBUG:', {
      canvasRect: { left: canvasRect.left, top: canvasRect.top },
      tokenTopLeft: { x: tokenTopLeftX, y: tokenTopLeftY },
      ascentAdjustment: fontMetrics.ascent
    });
    
    return {
      x: tokenTopLeftX,
      y: tokenTopLeftY
    };
  }

  /**
   * Show error popover at specified screen coordinates
   */
  private showErrorPopover(screenX: number, screenY: number, errors: any[]): void {
    // Clear any existing timeout
    if (this.popoverHideTimeout) {
      clearTimeout(this.popoverHideTimeout);
      this.popoverHideTimeout = null;
    }

    // Get the error popup component (CodeEditor uses direct rendering, no shadow DOM)
    const errorPopup = this.querySelector('error-pop-up') as any;
    
    if (errorPopup) {
      // Format errors for display
      const errorMessages = errors.map(error => error.message || error.description || 'Unknown error').join('\n');
      errorPopup.show(screenX, screenY, errorMessages);
      this.isPopoverVisible = true;
    }
  }

  /**
   * Test method to verify error popover functionality
   * This method can be called from the browser console for testing
   */
  public testErrorPopover(): void {
    console.log('🧪 Testing error popover functionality...');
    
    // Find an invalid statement for testing
    const invalidStatement = this.codeCache.statements.find(s => !s.isValid && !s.isDirty);
    
    if (invalidStatement) {
      console.log('🔍 Found invalid statement:', invalidStatement);
      
      // Get stored validation results
      const statementKey = `${invalidStatement.lineStart}-${invalidStatement.lineEnd}`;
      const validationResult = this.validationResults.get(statementKey);
      
      let mockErrors = [];
      if (validationResult && validationResult.errorDetails && validationResult.errorDetails.length > 0) {
        mockErrors = validationResult.errorDetails;
        console.log('📋 Using stored validation errors:', mockErrors);
      } else {
        // Create mock error data as fallback
        mockErrors = [{
          message: `Invalid SyndrQL statement on lines ${invalidStatement.lineStart + 1}-${invalidStatement.lineEnd + 1}`,
          code: 'INCOMPLETE_STATEMENT',
          line: invalidStatement.lineStart,
          column: 0
        }];
        console.log('📋 Using fallback mock errors:', mockErrors);
      }
      
      // Calculate position for first character of invalid statement
      const tokenPosition = this.calculateTokenScreenPosition({
        line: invalidStatement.lineStart,
        column: 0
      });
      
      // Show popover at calculated token position
      this.showErrorPopover(tokenPosition.x, tokenPosition.y, mockErrors);
      
      console.log('✅ Error popover displayed at token position:', tokenPosition);
      
      // Hide after 3 seconds for testing
      setTimeout(() => {
        this.hideErrorPopoverImmediate();
        console.log('✅ Error popover hidden');
      }, 3000);
    } else {
      console.log('⚠️ No invalid statements found. Try typing an incomplete statement like "SELECT" and then call this method.');
      
      // Show available statements for debugging
    //   console.log('Available statements:', this.codeCache.statements.map(s => ({
    //     code: s.code,
    //     isValid: s.isValid,
    //     isDirty: s.isDirty,
    //     lines: `${s.lineStart}-${s.lineEnd}`
    //   })));
    }
  }

  /**
   * Hide error popover with smart logic
   */
  private hideErrorPopover(): void {
    // Don't try to hide if popover is already hidden
    if (!this.isPopoverVisible) {
      //console.log('✋ Popover already hidden, skipping hide');
      return;
    }
    
    // Use a small delay to prevent flickering when moving between invalid tokens
    if (this.popoverHideTimeout) {
      clearTimeout(this.popoverHideTimeout);
    }
    
    //console.log('🔄 hideErrorPopover called, isMouseOverPopover:', this.isMouseOverPopover);
    
    this.popoverHideTimeout = window.setTimeout(() => {
     // console.log('🕰️ Hide timeout fired, isMouseOverPopover:', this.isMouseOverPopover);
      // Only hide if mouse is not over the popover
      if (!this.isMouseOverPopover) {
     //   console.log('🫥 Hiding popover - mouse not over popover');
        const errorPopup = this.querySelector('error-pop-up') as any;
        if (errorPopup) {
          errorPopup.hide();
        }
        this.isPopoverVisible = false;
        this.currentHoveredToken = null;
      } else {
        console.log('⏸️ NOT hiding popover - mouse is over popover');
      }
      this.popoverHideTimeout = null;
    }, 200); // Increased delay to give more time for mouse to reach popover
  }

  /**
   * Immediately hide the popover without delay (used when definitely leaving token area)
   */
  private hideErrorPopoverImmediate(): void {
    if (this.popoverHideTimeout) {
      clearTimeout(this.popoverHideTimeout);
      this.popoverHideTimeout = null;
    }
    
    const errorPopup = this.querySelector('error-pop-up') as any;
    if (errorPopup) {
      errorPopup.hide();
    }
    this.isPopoverVisible = false;
    this.isMouseOverPopover = false; // Reset popover hover state
    this.currentHoveredToken = null;
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
   * Handle clipboard commands (Ctrl+C, Ctrl+V, Ctrl+X)
   * @param command - The key command to check
   * @returns true if the command was handled, false otherwise
   */
  private handleClipboardCommand(command: KeyCommand): boolean {

       
    // Only handle Ctrl combinations
    if (!command.modifiers.ctrl && !command.modifiers.meta) {
        
      return false;
    }


    switch (command.key.toLowerCase()) {
      case 'c':
        // Copy selected text
        
        this.copyToClipboard();
        return true;
        
      case 'v':
        
        // Paste from clipboard
        this.pasteFromClipboard();
        return true;
        
      case 'x':
        
        // Cut selected text
        this.cutToClipboard();
        return true;
        
      default:
        return false;
    }
  }

  /**
   * Copy selected text to clipboard
   */
  private async copyToClipboard(): Promise<void> {
    if (!this.documentModel.hasSelection()) {
      return; // Nothing to copy
    }

    const selectedText = this.documentModel.getSelectedText();
    
    try {
      await navigator.clipboard.writeText(selectedText);
      console.log('📋 Copied to clipboard:', selectedText);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      // Fallback for browsers that don't support clipboard API
      this.fallbackCopyToClipboard(selectedText);
    }
  }

  /**
   * Paste text from clipboard at cursor position
   */
  private async pasteFromClipboard(): Promise<void> {
    try {
      const clipboardText = await navigator.clipboard.readText();
      
      if (clipboardText) {
        // If there's a selection, replace it; otherwise insert at cursor
        if (this.documentModel.hasSelection()) {
          const selection = this.documentModel.getCurrentSelection();
          if (selection) {
            // Delete selected text first
            this.documentModel.deleteText(selection.start, selection.end);
            // Insert clipboard text at the start position
            this.documentModel.insertText(selection.start, clipboardText);
            // Clear selection
            this.documentModel.clearSelections();
          }
        } else {
          // Insert at cursor position
          const cursorPosition = this.documentModel.getCursorPosition();
          this.documentModel.insertText(cursorPosition, clipboardText);
        }
        
        // Update editor state
        this.updateStatementCache();
        this.markCurrentStatementDirty();
        this.updateSyntaxHighlighterContext();
        this.renderEditor();
        
        console.log('📋 Pasted from clipboard:', clipboardText);
      }
    } catch (err) {
      console.error('Failed to read from clipboard:', err);
    }
  }

  /**
   * Cut selected text to clipboard and delete from editor
   */
  private async cutToClipboard(): Promise<void> {
    if (!this.documentModel.hasSelection()) {
      return; // Nothing to cut
    }

    const selectedText = this.documentModel.getSelectedText();
    const selection = this.documentModel.getCurrentSelection();
    
    if (!selection) {
      return;
    }

    try {
      // Copy to clipboard first
      await navigator.clipboard.writeText(selectedText);
      
      // Delete the selected text
      this.documentModel.deleteText(selection.start, selection.end);
      
      // Clear selection
      this.documentModel.clearSelections();
      
      // Update editor state
      this.updateStatementCache();
      this.markCurrentStatementDirty();
      this.updateSyntaxHighlighterContext();
      this.renderEditor();
      
      console.log('✂️ Cut to clipboard:', selectedText);
    } catch (err) {
      console.error('Failed to cut to clipboard:', err);
      // Fallback for browsers that don't support clipboard API
      this.fallbackCopyToClipboard(selectedText);
    }
  }

  /**
   * Fallback copy method for browsers without clipboard API support
   */
  private fallbackCopyToClipboard(text: string): void {
    // Create a temporary textarea element
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    
    // Select and copy
    textArea.focus();
    textArea.select();
    
    try {
      document.execCommand('copy');
      console.log('📋 Copied to clipboard (fallback):', text);
    } catch (err) {
      console.error('Fallback copy failed:', err);
    }
    
    // Clean up
    document.body.removeChild(textArea);
  }

  /**
   * Update line numbers display data
   */
  private updateLineNumbersData(): void {
    if (this.documentModel && this.canvas) {
      this.lineCount = this.documentModel.getLines().length;
      this.editorScrollTop = this.scrollOffset.y;
      this.editorHeight = this.canvas.clientHeight;
    }
  }

  /**
   * Basic rendering with selection support.
   */
  private renderEditor(): void {
    if (!this.context) return;
    
    // Update line numbers data for synchronization
    this.updateLineNumbersData();
    
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
        // Get full document text for grammar validation context
        const lines = this.documentModel.getLines();
        const fullText = lines.join('\n');
        
        // Find which statement this line belongs to
        const statement = this.statementParser.findStatementAtLine(this.codeCache.statements, lineIndex);
        const hasStatementError = statement && !statement.isValid && !statement.isDirty;
        
        // Render with syntax highlighting and statement-level error information
        this.syntaxHighlighter.renderLine(
            this.context,
            lineText,
            lineIndex + 1,
            y,
            fontMetrics,
            this.viewportManager.getScrollOffset(),
            fullText
        );
        
        // Render statement-level error underlines if needed
        if (hasStatementError) {
          this.renderStatementErrorUnderline(lineText, lineIndex, y, fontMetrics);
        }
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
   * Render error underline for a statement that failed validation
   */
  private renderStatementErrorUnderline(lineText: string, lineIndex: number, y: number, fontMetrics: FontMetrics): void {
    if (!this.context) return;
    
    const scrollOffset = this.viewportManager.getScrollOffset();
    
    // Error underline style
    const errorStyle = {
      color: '#ff0000',     // Red color
      thickness: 2,         // Line thickness
      amplitude: 2,         // Height of squiggles  
      frequency: 6          // Pixels per wave
    };

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
    const underlineY = y + fontMetrics.descent + fontMetrics.lineHeight - 4;

    this.context.save();
    this.context.strokeStyle = errorStyle.color;
    this.context.lineWidth = errorStyle.thickness;
    this.context.beginPath();

    // Draw squiggly line
    let currentX = startX;
    let isUp = true;

    this.context.moveTo(currentX, underlineY);

    while (currentX < endX) {
      currentX += errorStyle.frequency;
      const nextY = isUp ? underlineY - errorStyle.amplitude : underlineY + errorStyle.amplitude;
      this.context.lineTo(Math.min(currentX, endX), nextY);
      isUp = !isUp;
    }

    this.context.stroke();
    this.context.restore();
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
      <div class="border border-gray-600 rounded-lg bg-gray-900 relative h-full w-full flex">
        <!-- Line Numbers Column -->
        <line-numbers
          .totalLines=${this.lineCount}
          .lineHeight=${this.coordinateSystem?.getFontMetrics()?.lineHeight || 20}
          .scrollTop=${this.editorScrollTop}
          .visibleHeight=${this.editorHeight}
          .fontSize=${this.fontSize}
        ></line-numbers>
        
        <!-- Code Editor Canvas -->
        <div class="flex-1 relative">
          <canvas 
            class="block cursor-text w-full h-full bg-info-content"
            style="font-family: ${this.fontFamily}; font-size: ${this.fontSize}px;"
          ></canvas>
          ${!this.isInitialized ? html`
            <div class="absolute inset-0 flex items-center justify-center text-gray-400">
              Initializing editor...
            </div>
          ` : ''}
          
          <!-- Error popover for invalid tokens/statements -->
          <error-pop-up></error-pop-up>
        </div>
      </div>
      </droppable-component>
    `;
  }
}