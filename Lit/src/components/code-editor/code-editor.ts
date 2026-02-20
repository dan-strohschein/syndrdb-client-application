/**
 * Code Editor Component - Main orchestrator for the canvas-based editor
 * Follows Single Responsibility Principle: Only coordinates between subsystems
 *
 * ARCHITECTURAL OUTLINE
 * --------------------
 * Responsibilities:
 *   - Orchestration: wiring input → document → viewport → render
 *   - Canvas/document/viewport coordination and lifecycle (init, resize, cleanup)
 *   - Delegating to subsystems for input, scroll, suggestions, error popover, statement validation
 *
 * Key private fields:
 *   - canvas, context: canvas element and 2D context
 *   - documentModel (VirtualDocumentModel): lines, cursor, selection
 *   - inputCapture, inputProcessor (input-handler): key/mouse capture and command processing
 *   - coordinateSystem, fontMeasurer (font-metrics): monospace coordinates and font metrics
 *   - viewportManager: viewport dimensions, scroll offset, visible range, scrollbar hit-test
 *   - languageService (LanguageServiceV2): syntax, validation, suggestions, renderLine
 *   - statementValidationController (statement-validation-controller.ts): statement cache and validation
 *   - scrollController (scroll-controller.ts): scroll offset and scrollbar drag state
 *   - suggestionController (suggestion-controller.ts): suggestions list, visibility, position, keyboard
 *   - errorPopoverController (error-popover-controller.ts): popover hover and visibility
 *
 * Module responsibilities:
 *   - Input capture and key/mouse commands → input-handler.js (InputCapture, InputProcessor)
 *   - Viewport math, scroll bounds, visible range → viewport-manager.js
 *   - Scrollbar drag, wheel scroll, scrollbar rendering → scroll-controller.ts (B.2)
 *   - Suggestions UI (show/hide, position, keyboard, apply) → suggestion-controller.ts (B.3)
 *   - Error popover hover and visibility → error-popover-controller.ts (B.4)
 *   - Statement cache and validation → statement-validation-controller.ts (B.5)
 *   - Line rendering (syntax + selection) → inline + languageService.renderLine
 *   - Font metrics and monospace coordinates → font-metrics.js
 */

import { html, css, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { InputCapture, InputProcessor } from './input-handler.js';
import { VirtualDocumentModel } from './virtual-dom.js';
import { MonospaceCoordinateSystem, FontMeasurer } from './font-metrics.js';
import { ViewportManager } from './viewport-manager.js';
import { ScrollController } from './scroll-controller.js';
import { ErrorPopoverController } from './error-popover-controller.js';
import { SuggestionController } from './suggestion-controller.js';
import { StatementValidationController } from './statement-validation-controller.js';
import { Position, FontMetrics, KeyCommand, EditorTheme, ScrollOffset, Coordinates, MouseEventData, CharacterPosition } from './types.js';
import { LanguageServiceV2, type SyntaxTheme, DEFAULT_SYNDRQL_THEME } from './syndrQL-language-serviceV2/index.js';
import type { ILanguageService, ILanguageServiceError } from './language-service-interface.js';
import type { Suggestion } from './suggestion-controller.js';
import { DEFAULT_CONFIG } from '../../config/config-types.js';
import type { Bundle } from '../../types/bundle';
import type { FieldDefinition } from '../../types/field-definition';
import './error-pop-up/error-pop-up.js';
import './line-numbers/line-numbers.js';
import './suggestion-complete/suggestion-dropdown.js';

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

  /**
   * Pluggable language service. When provided, the editor uses this LS for
   * syntax highlighting, validation, and suggestions. When null (default),
   * a SyndrQL LanguageServiceV2 is auto-created for backward compatibility.
   */
  @property({ type: Object, attribute: false })
  externalLanguageService: ILanguageService | null = null;

  // Internal state
  @state()
  private isInitialized: boolean = false;
  
  // Scroll and scrollbar — delegated to ScrollController
  private scrollController!: ScrollController;
  
  // Error popover — delegated to ErrorPopoverController
  private errorPopoverController!: ErrorPopoverController;
  
  // Suggestions — delegated to SuggestionController
  private suggestionController!: SuggestionController;
  
  // Statement cache and validation — delegated to StatementValidationController
  private statementValidationController!: StatementValidationController;
  
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
  
  // Language service — either externally provided or auto-created SyndrQL LS
  private languageService!: ILanguageService;
  /** True when we auto-created the LS (so we know to dispose it) */
  private ownsLanguageService = false;
  
  // Line numbers tracking - lineCount needs to be reactive for child component updates
  @state()
  private lineCount: number = 1;
  
  private editorScrollTop: number = 0;
  
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
      if (this.isInitialized && this.fontMeasurer && this.languageService) {
        const fontMetrics = this.fontMeasurer.measureFont(this.fontFamily, this.fontSize);
        this.coordinateSystem.setFontMetrics(fontMetrics);
        this.languageService.updateFontMetrics(fontMetrics);
      }
    }

    // If external language service changed, swap it in
    if (changedProperties.has('externalLanguageService') && this.isInitialized) {
      this.swapLanguageService();
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
      
      // Scroll and scrollbar — owned by ScrollController
      this.scrollController = new ScrollController({
        viewportManager: this.viewportManager,
        documentModel: this.documentModel,
        getFontMetrics: () => this.coordinateSystem.getFontMetrics(),
        applyScroll: (offset) => {
          this.viewportManager.updateScrollOffset(offset);
          this.coordinateSystem.setScrollOffset(offset);
          this.requestUpdate();
        },
        requestRender: () => this.renderEditor(),
        requestRenderOptimized: () => this.renderEditorOptimized(),
        onGlobalMouseUp: (event) => {
          if (this.inputProcessor && this.documentModel) {
            const rect = this.canvas.getBoundingClientRect();
            const mouseEventData: MouseEventData = {
              coordinates: {
                x: event.clientX - rect.left,
                y: event.clientY - rect.top,
              },
              button: event.button,
              buttons: event.buttons,
              modifiers: {
                shift: event.shiftKey,
                ctrl: event.ctrlKey,
                alt: event.altKey,
                meta: event.metaKey,
              },
            };
            this.inputProcessor.processMouseUp(mouseEventData, this.documentModel);
            this.renderEditor();
          }
        },
      });
      
      // Error popover — owned by ErrorPopoverController
      this.errorPopoverController = new ErrorPopoverController({
        getStatements: () => this.statementValidationController.getStatements(),
        getValidationResult: (key) => {
          const r = this.statementValidationController.getValidationResult(key);
          if (!r) return undefined;
          return {
            errors: (r.errors ?? []).map((e: { message: string; code?: string; suggestion?: string }) => ({
              message: e.message,
              code: e.code,
              suggestion: e.suggestion,
            })),
          };
        },
        getScrollOffset: () => this.scrollController?.getScrollOffset?.() ?? { x: 0, y: 0 },
        getFontMetrics: () => this.coordinateSystem.getFontMetrics(),
        getCanvas: () => this.canvas,
        getLines: () => this.documentModel.getLines(),
        getErrorPopup: () => {
          const el = this.querySelector('error-pop-up') as HTMLElement & { show: (x: number, y: number, msg: unknown) => void; hide: () => void } | null;
          return el ? { show: (x: number, y: number, msg: unknown) => el.show(x, y, msg), hide: () => el.hide() } : null;
        },
      });

      // Suggestions — owned by SuggestionController
      this.suggestionController = new SuggestionController({
        getDocumentLines: () => this.documentModel.getLines(),
        getCursorPosition: () => this.documentModel.getCursorPosition(),
        getSuggestionsFromService: (fullText, charPosition) =>
          this.languageService.getSuggestions(fullText, charPosition),
        getCoordinateSystem: () => this.coordinateSystem,
        requestUpdate: () => this.requestUpdate(),
        onApplySuggestion: (suggestion) => this.applySuggestion(suggestion),
      });
      
      // Connect coordinate system to input processor
      this.inputProcessor.setCoordinateSystem(this.coordinateSystem);
      
      // Set up canvas sizing
      this.setupCanvasSizing();
      
      // Set up input handling
      this.setupInputHandling();
      
      // Set initial cursor style
      this.canvas.style.cursor = 'text';
      
      // Set up focus/blur handlers for cursor visibility
      this.setupFocusHandlers();
      
      // Initial render
      this.renderEditor();
      
      this.isInitialized = true;

      // Initialize language service (external or default SyndrQL)
      await this.initializeLanguageService(fontMetrics);

      // Statement cache and validation — owned by StatementValidationController
      this.statementValidationController = new StatementValidationController({
        getDocumentLines: () => this.documentModel.getLines(),
        getCursorPosition: () => this.documentModel.getCursorPosition(),
        getLanguageService: () => this.languageService,
        onValidationComplete: () => this.renderEditor(),
      });

    // Initialize document context and statement cache
    this.statementValidationController.updateStatementCache();

    // Listen for database context changes from connection manager
    this.setupDatabaseContextListener();

    } catch (error) {
      console.error('Failed to initialize code editor:', error);
    }
  }
  
  /**
   * Initialize or re-initialize the language service.
   * If an external LS was provided, use it; otherwise create a default SyndrQL LS.
   */
  private async initializeLanguageService(fontMetrics: FontMetrics): Promise<void> {
    // Dispose previous LS if we own it
    if (this.languageService && this.ownsLanguageService) {
      this.languageService.dispose();
    }

    if (this.externalLanguageService) {
      this.languageService = this.externalLanguageService;
      this.ownsLanguageService = false;
    } else {
      // Default: create SyndrQL language service
      const ls = new LanguageServiceV2(DEFAULT_CONFIG);
      await ls.initialize();
      this.languageService = ls;
      this.ownsLanguageService = true;
    }

    // Initialize renderer on the LS
    const syntaxTheme: SyntaxTheme = {
      ...DEFAULT_SYNDRQL_THEME,
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
        color: '#ff0000',
        thickness: 1,
        amplitude: 1,
        frequency: 4
      }
    };
    this.languageService.initializeRenderer(this.context, fontMetrics, syntaxTheme);
    console.log('Language service initialized with rendering');
  }

  /**
   * Swap the language service at runtime (called when externalLanguageService changes).
   */
  private async swapLanguageService(): Promise<void> {
    if (!this.context || !this.fontMeasurer) return;
    const fontMetrics = this.fontMeasurer.measureFont(this.fontFamily, this.fontSize);
    await this.initializeLanguageService(fontMetrics);

    // Rebuild statement validation controller with the new LS
    if (this.statementValidationController) {
      this.statementValidationController.updateStatementCache();
    }
    this.renderEditor();
  }

  /**
   * Set up listener for database context changes
   */
  private async setupDatabaseContextListener(): Promise<void> {
    try {
//      console.log('🎯 CodeEditor: Setting up database context listener...');
      const { connectionManager } = await import('../../services/connection-manager');
      
 //     console.log('🎯 CodeEditor: Connection manager imported, registering listeners...');
      
      // Listen for database context changes
      connectionManager.addEventListener('databaseContextChanged', ({ databaseName }: { databaseName: string }) => {
//        console.log(`🎯 CodeEditor: Received databaseContextChanged event for "${databaseName}"`);
        if (this.languageService) {
          this.languageService.setDatabaseContext(databaseName);
        }
      });

      // Listen for bundles loaded events to update context data
      connectionManager.addEventListener('bundlesLoaded', async ({ databaseName, bundles }: { databaseName: string, bundles: Bundle[] }) => {
 //       console.log(`🎯 CodeEditor: Received bundlesLoaded event for "${databaseName}" with ${bundles.length} bundles`);

        if (this.languageService) {
          // Convert bundles to DatabaseDefinition format
          const bundleDefs = bundles.map((bundle: Bundle) => {
            const bundleName = bundle.Name;

            // Extract fields — use bundle.FieldDefinitions (already normalised by bundle-manager)
            const fieldsMap = new Map<string, { name: string; type: string; constraints: { nullable?: boolean; unique?: boolean; primary?: boolean; default?: string | number | boolean | null } }>();

            const fieldDefs = bundle.FieldDefinitions;

            if (Array.isArray(fieldDefs)) {
              for (const field of fieldDefs) {
                fieldsMap.set(field.Name, {
                  name: field.Name,
                  type: field.Type || 'text',
                  constraints: {
                    nullable: !field.IsRequired,
                    unique: field.IsUnique === true,
                    primary: field.Name === 'DocumentID',
                    default: field.DefaultValue
                  }
                });
              }
            }
            
//            console.log(`🎯 CodeEditor: Bundle "${bundleName}" has ${fieldsMap.size} fields`);
            
            return {
              name: bundleName,
              database: databaseName,
              fields: fieldsMap,
              relationships: new Map(),
              indexes: (Array.isArray(bundle.Indexes) ? bundle.Indexes : []).map(idx => idx.IndexName)
            };
          });

          // Update context with database and bundle data
          this.languageService.updateContextData([{
            name: databaseName,
            bundles: new Map(bundleDefs.map(b => [b.name, b]))
          }]);
          
//          console.log(`🎯 CodeEditor: Context updated with ${bundleDefs.length} bundles`);
        }
      });

    //  console.log('✅ Database context listeners registered successfully');
    } catch (error) {
      console.error('Failed to set up database context listener:', error);
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
      
      // Update statement cache and mark current statement as dirty
    this.statementValidationController.updateStatementCache();
    this.statementValidationController.markCurrentStatementDirty();
      
      // Update line count for line-numbers component
      this.updateLineCount();
      
      // Trigger autocomplete suggestions (debounced)
      this.suggestionController.scheduleUpdate();
      
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
      
      // Handle suggestion navigation if suggestions are visible
      if (this.suggestionController.getShowSuggestions()) {
        if (this.suggestionController.handleKeyCommand(command)) {
          return; // Command was handled by suggestion system
        }
      }
      
      // Process key command using InputProcessor
      this.inputProcessor.processKeyCommand(command, this.documentModel);
      
      // Hide suggestions on certain navigation commands
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(command.key)) {
        this.suggestionController.hideSuggestions();
      }
      
      // Update statement cache and mark current statement as dirty for content-modifying commands
      if (this.isContentModifyingCommand(command.key)) {
    this.statementValidationController.updateStatementCache();
    this.statementValidationController.markCurrentStatementDirty();
        this.updateLineCount();
      }
      
      // Ensure cursor remains visible after navigation
      this.ensureCursorVisible();
      
      // Reset cursor blinking and re-render
      this.resetCursorBlinking();
      this.renderEditor();
    });
    
    // Handle mouse events for text selection and scrollbar interactions
    this.inputCapture.onMouseDown((event) => {
      if (this.scrollController.handleScrollbarMouseDown(event, this.canvas)) {
        return; // Event handled by scrollbar
      }
      
      this.inputProcessor.processMouseDown(event, this.documentModel);
      this.resetCursorBlinking();
      this.renderEditor();
    });
    
    this.inputCapture.onMouseMove((event) => {
      // Cursor over scrollbar vs text
      this.canvas.style.cursor = this.scrollController.isOverScrollbar(event)
        ? 'default'
        : 'text';
      
      if (this.scrollController.handleScrollbarMouseMove(event)) {
        return; // Event handled by scrollbar
      }
      
      this.inputProcessor.processMouseMove(event, this.documentModel);
      
      // Error popover hover (delegated to ErrorPopoverController)
      this.errorPopoverController.handleMouseMove(event);
      
      this.renderEditor();
    });

    // Listen for popover hover events (delegate to controller)
    this.addEventListener('popover-mouse-enter', () => {
      this.errorPopoverController.setMouseOverPopover(true);
    });

    this.addEventListener('popover-mouse-leave', () => {
      this.errorPopoverController.setMouseOverPopover(false);
      this.errorPopoverController.hidePopover();
    });

    this.addEventListener('popover-dismissed', () => {
      this.errorPopoverController.onPopoverDismissed();
    });

    // Handle mouse leaving the entire editor area
    this.canvas.addEventListener('mouseleave', () => {
        this.canvas.style.cursor = 'text';
      // Don't immediately hide popover - it may be rendered outside the canvas
      // Let the normal hover detection handle hiding with proper delay
      // this.hideErrorPopoverImmediate();
    });
    
    this.inputCapture.onMouseUp((event) => {
      if (this.scrollController.handleScrollbarMouseUp(event)) {
        return; // Event handled by scrollbar
      }
      
      this.inputProcessor.processMouseUp(event, this.documentModel);
      this.renderEditor();
    });
    
    // Handle mouse wheel for scrolling
    this.inputCapture.onWheel((deltaX, deltaY) => {
      this.scrollController.handleWheel(deltaX, deltaY);
    });
  }
  
  /**
   * Sets up focus and blur handlers to control cursor visibility and border glow.
   */
  private setupFocusHandlers(): void {
    // Get the hidden textarea from inputCapture
    const hiddenTextArea = this.inputCapture['hiddenTextArea'] as HTMLTextAreaElement;
    
    // Get the container div for border styling
    const container = this.querySelector('.border') as HTMLDivElement;
    
    // Start cursor blinking when editor gains focus
    hiddenTextArea.addEventListener('focus', () => {
      this.cursorVisible = true;
      this.startCursorBlinking();
      
      // Add orange glow effect
      if (container) {
        container.style.boxShadow = '0 0 0 2px rgba(255, 165, 0, 0.5)';
        container.style.borderColor = 'rgb(255, 165, 0)';
      }
      
      this.renderEditor();
    });
    
    // Stop cursor blinking when editor loses focus
    hiddenTextArea.addEventListener('blur', () => {
      this.stopCursorBlinking();
      this.cursorVisible = false;
      
      // Remove glow effect
      if (container) {
        container.style.boxShadow = '';
        container.style.borderColor = '';
      }
      
      this.renderEditor();
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
    if (!this.scrollController) return;
    const cursorPosition = this.documentModel.getCursorPosition();
    const newScrollOffset = this.viewportManager.ensureCursorVisible(
      cursorPosition.line,
      cursorPosition.column
    );
    if (newScrollOffset) {
      const current = this.scrollController.getScrollOffset();
      if (
        newScrollOffset.x !== current.x ||
        newScrollOffset.y !== current.y
      ) {
        requestAnimationFrame(() => {
          this.scrollController.setScrollOffset(newScrollOffset);
        });
      }
    }
  }

  /**
   * Test method to verify error popover functionality (e.g. from browser console).
   */
  public testErrorPopover(): void {
    const invalidStatement = this.statementValidationController.getStatements().find((s) => !s.isValid && !s.isDirty);
    if (invalidStatement) {
      const statementKey = `${invalidStatement.lineStart}-${invalidStatement.lineEnd}`;
      const validationResult = this.statementValidationController.getValidationResult(statementKey);
      const errors =
        validationResult?.errors?.length
          ? validationResult!.errors.map((err: ILanguageServiceError) => ({
              message: err.message,
              code: err.code,
              suggestion: err.suggestion,
            }))
          : [
              {
                message: `Invalid SyndrQL statement on lines ${invalidStatement.lineStart + 1}-${invalidStatement.lineEnd + 1}`,
                code: 'INCOMPLETE_STATEMENT',
              },
            ];
      const screenPos = this.coordinateSystem.positionToScreen({
        line: invalidStatement.lineStart,
        column: 0,
      });
      const canvasRect = this.canvas?.getBoundingClientRect();
      if (canvasRect) {
        const fontMetrics = this.coordinateSystem.getFontMetrics();
        const x = canvasRect.left + screenPos.x;
        const y = canvasRect.top + screenPos.y - fontMetrics.ascent;
        this.errorPopoverController.showAt(x, y, errors);
        setTimeout(() => this.errorPopoverController.hidePopoverImmediate(), 3000);
      }
    } else {
      console.log(
        'No invalid statements found. Try typing an incomplete statement like "SELECT" and then call this method.'
      );
    }
  }

  /**
   * Optimized rendering during drag operations.
   */
  private renderEditorOptimized(): void {
    if (!this.context || !this.scrollController) return;
    
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
    
    // Draw scrollbars (via ScrollController)
    if (this.scrollController) {
      this.scrollController.renderScrollbars(this.context);
    }
    
    // Draw cursor (simplified)
    this.drawCursor();
  }
  
  /**
   * Gets the CSS color value for bg-info-content class.
   */
  private getInfoContentColor(): string {
    return this.getThemeColor(this.backgroundColor);
  }
  
  public updateSyntaxTheme(theme: Partial<SyntaxTheme>): void {
    this.syntaxTheme = { ...this.syntaxTheme, ...theme };
    if (this.languageService) {
        this.languageService.setTheme({ ...DEFAULT_SYNDRQL_THEME, ...this.syntaxTheme, ...theme } as SyntaxTheme);
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
    this.statementValidationController.updateStatementCache();
    this.statementValidationController.markCurrentStatementDirty();
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
    this.statementValidationController.updateStatementCache();
    this.statementValidationController.markCurrentStatementDirty();
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
    if (this.documentModel && this.canvas && this.scrollController) {
      this.lineCount = this.documentModel.getLines().length;
      this.editorScrollTop = this.scrollController.getScrollOffset().y;
      this.editorHeight = this.canvas.clientHeight;
    }
  }

  /**
   * Update line count only if it changed (for line-numbers component)
   * Deferred to avoid cascading updates during event handlers
   */
  private updateLineCount(): void {
    if (this.documentModel) {
      const newLineCount = this.documentModel.getLines().length;
      if (newLineCount !== this.lineCount) {
        // Use requestAnimationFrame to defer state update after the current update cycle
        requestAnimationFrame(() => {
          this.lineCount = newLineCount;
        });
      }
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
    
    // Draw scrollbars (via ScrollController)
    if (this.scrollController) {
      this.scrollController.renderScrollbars(this.context);
    }
    
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
      // Render with syntax highlighting using V2 language service
      if (this.enableSyntaxHighlighting && this.languageService) {
        // Render line with V2 language service (just syntax highlighting)
        this.languageService.renderLine(
          lineText,
          lineIndex + 1,
          y,
          fontMetrics,
          this.viewportManager.getScrollOffset()
        );
        
        // Check if this line's statement has validation errors
        const statement = this.statementValidationController.getStatementForLine(lineIndex);
        if (statement) {
          const statementKey = `${statement.lineStart}-${statement.lineEnd}`;
          const validationResult = this.statementValidationController.getValidationResult(statementKey);
          
          // Render statement-level error underlines if this statement has errors
          if (validationResult && !validationResult.valid && validationResult.errors.length > 0) {
            this.languageService.renderStatementError(
              lineText,
              y,
              fontMetrics,
              this.viewportManager.getScrollOffset()
            );
          }
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
   * Draws the text cursor at current position with blinking.
   */
  private drawCursor(): void {
    // Only draw cursor if it's visible (for blinking effect)
    if (!this.cursorVisible) return;
    
    const cursorPos = this.documentModel.getCursorPosition();
    // positionToScreen already applies scroll offset, don't apply it again
    const screenPos = this.coordinateSystem.positionToScreen(cursorPos);
    const fontMetrics = this.coordinateSystem.getFontMetrics();
    
    // Use screen position directly (scroll already applied in positionToScreen)
    const x = screenPos.x;
    const y = screenPos.y;
    
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
   * Get the full document text.
   * Returns all text from the editor as a single string.
   */
  public getText(): string {
    if (!this.documentModel) {
      return '';
    }
    return this.documentModel.getFullDocumentText();
  }

  /**
   * Get the position at the end of the document (after the last character).
   * Used for appending text (e.g. AI-generated SyndrQL).
   */
  public getEndPosition(): Position {
    if (!this.documentModel) {
      return { line: 0, column: 0 };
    }
    const lineCount = this.documentModel.getLineCount();
    if (lineCount === 0) {
      return { line: 0, column: 0 };
    }
    const lastLineIndex = lineCount - 1;
    const lastLine = this.documentModel.getLine(lastLineIndex);
    return { line: lastLineIndex, column: lastLine.length };
  }

  /**
   * Insert text at the given position. Use getEndPosition() to append at end of document.
   * Updates cursor and triggers re-render and validation.
   */
  public insertText(position: Position, text: string): void {
    if (!this.documentModel) return;
    this.documentModel.insertText(position, text);
    const lines = text.split('\n');
    const newLine = position.line + lines.length - 1;
    const newColumn = lines.length === 1
      ? position.column + text.length
      : lines[lines.length - 1].length;
    this.documentModel.setCursorPosition({ line: newLine, column: newColumn });
    this.statementValidationController.updateStatementCache();
    this.statementValidationController.markCurrentStatementDirty();
    this.requestUpdate();
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
    
    if (this.scrollController) {
      this.scrollController.removeGlobalMouseCapture();
    }
    
    if (this.inputCapture) {
      this.inputCapture.destroy();
    }
    
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    
    // Dispose language service only if we created it
    if (this.languageService && this.ownsLanguageService) {
      this.languageService.dispose();
    }
  }

  /**
   * Handle suggestion selection from dropdown
   */
  private handleSuggestionSelected = (event: CustomEvent): void => {
    const selectedSuggestion = event.detail.suggestion as Suggestion;
    this.suggestionController.selectSuggestion(selectedSuggestion);
  };

  /**
   * Handle suggestion dropdown dismissal
   */
  private handleSuggestionDismissed = (): void => {
    this.suggestionController.hideSuggestions();
  };

  /**
   * Handle mouse hover over suggestion items
   */
  private handleSuggestionHover = (event: CustomEvent): void => {
    this.suggestionController.setSelectedIndex(event.detail.index);
  };

  /**
   * Apply a selected suggestion to the editor (called by SuggestionController via onApplySuggestion).
   * Records usage in V2 for ranking.
   */
  private applySuggestion(suggestion: Suggestion): void {
    if (!this.documentModel || !this.inputProcessor) {
      return;
    }

    try {
      this.suggestionController.hideSuggestions();
      
      // Get current cursor position
      const cursorPosition = this.documentModel.getCursorPosition();
      
      // Get text up to cursor to find partial token to replace
      const textUpToCursor = this.documentModel.getTextUpToCursor(cursorPosition);
      
      // Find the start of the current partial token (only alphanumeric, not whitespace)
      // This matches a sequence of word characters at the END of the string
      const tokenMatch = textUpToCursor.match(/([a-zA-Z_][a-zA-Z0-9_]*)$/);
      
      // Get the insert text
      const insertText = suggestion.insertText || suggestion.label;
      
      // Only replace if we have a non-empty partial token
      if (tokenMatch && tokenMatch[1] && tokenMatch[1].length > 0) {
        // Replace the partial token
        const partialToken = tokenMatch[1];
        const startPosition: Position = {
          line: cursorPosition.line,
          column: cursorPosition.column - partialToken.length
        };
        
        // Delete the partial token
        this.documentModel.deleteText(startPosition, cursorPosition);
        
        // Insert the suggestion
        this.documentModel.insertText(startPosition, insertText);
        
        // Update cursor position
        this.documentModel.setCursorPosition({
          line: startPosition.line,
          column: startPosition.column + insertText.length
        });
      } else {
        // No partial token - check if cursor is right after whitespace
        // In this case, just insert at cursor position (don't delete anything)
        this.documentModel.insertText(cursorPosition, insertText);
        
        // Update cursor position
        this.documentModel.setCursorPosition({
          line: cursorPosition.line,
          column: cursorPosition.column + insertText.length
        });
      }
      
      // Record usage in V2 for ranking
      this.languageService.recordSuggestionUsage(suggestion.label);
      
      // Update syntax highlighting and re-render
    this.statementValidationController.updateStatementCache();
    this.statementValidationController.markCurrentStatementDirty();
      
      this.renderEditor();
      
    } catch (error) {
      console.error('Error applying suggestion:', error);
    }
  }

  /**
   * Utility method for debouncing function calls
   */
  private debounce<T extends (...args: any[]) => void>(func: T, delay: number): (...args: Parameters<T>) => void {
    let timeoutId: number;
    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => func.apply(this, args), delay);
    };
  }

  /**
   * Safe scroll top for template use. Never throws; use when scrollController may not be initialized yet.
   */
  private getScrollTopForRender(): number {
    if (!this.scrollController) return 0;
    const offset = this.scrollController.getScrollOffset();
    return offset?.y ?? 0;
  }

  /**
   * Safe line height for template use. Never throws; use when coordinateSystem may not be initialized yet.
   */
  private getLineHeightForRender(): number {
    if (!this.coordinateSystem) return 20;
    const metrics = this.coordinateSystem.getFontMetrics();
    return metrics?.lineHeight ?? 20;
  }
  
  render() {
    const editorScrollTop = this.getScrollTopForRender();
    const editorHeight = this.canvas?.clientHeight ?? 400;
    const showSuggestions = this.suggestionController?.getShowSuggestions?.() ?? false;
    
    return html`
    <droppable-component @drop-completed=${this.handleTextDrop}>
      <div class="border border-gray-600 rounded-lg bg-gray-900 relative h-full w-full flex">
        <!-- Line Numbers Column -->
        <line-numbers
          .totalLines=${this.lineCount}
          .lineHeight=${this.getLineHeightForRender()}
          .scrollTop=${editorScrollTop}
          .visibleHeight=${editorHeight}
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
          
          <!-- Autocomplete suggestion dropdown -->
          ${showSuggestions && this.suggestionController ? html`
            <code-editor-suggestion-dropdown
              .suggestions=${this.suggestionController.getSuggestions()}
              .visible=${true}
              .x=${this.suggestionController.getSuggestionPosition().x}
              .y=${this.suggestionController.getSuggestionPosition().y}
              .selectedIndex=${this.suggestionController.getSelectedIndex()}
              @suggestion-selected=${this.handleSuggestionSelected}
              @suggestion-dismissed=${this.handleSuggestionDismissed}
              @suggestion-hover=${this.handleSuggestionHover}
            ></code-editor-suggestion-dropdown>
          ` : ''}
        </div>
      </div>
      </droppable-component>
    `;
  }
}