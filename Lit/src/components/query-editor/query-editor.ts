import { html, css, LitElement, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { 
  SyndrQLTokenizer, 
  Suggestion, 
  ClassifiedToken, 
  tokenizeAndClassify, 
  generateSyntaxHighlighting 
} from './syndrQL-language-service/syndrql-tokenizer';
import './suggestion-complete/suggestion-dropdown';
import '../dragndrop/droppable';
import { TextPositionCalculator } from './text-position-calculator';
import { text } from 'stream/consumers';

@customElement('query-editor')
export class QueryEditor extends LitElement {

  static styles = css`
    .custom-textarea {
      border: 1px solid #6b7280 !important; /* Dark grey border */
      border-radius: 0.375rem;
      padding: 0.75rem;
      background-color: transparent;
      color: inherit;
      outline: none !important;
      box-shadow: none !important;
      transition: border-color 0.2s ease-in-out;
    }
    
    .custom-textarea:focus {
      border-color: white !important;
      box-shadow: none !important;
      outline: none !important;
    }
    
    .custom-textarea:focus-visible {
      outline: none !important;
      box-shadow: none !important;
    }
  `;

  // Disable Shadow DOM to allow global Tailwind CSS but inject our custom styles
  createRenderRoot() {
    // Add custom styles to document head
    if (!document.querySelector('#query-editor-custom-styles')) {
      const style = document.createElement('style');
      style.id = 'query-editor-custom-styles';
      style.textContent = `
        .custom-editor {
          border: 1px solid #6b7280 !important;
          border-radius: 0.375rem;
          padding: 0.75rem;
          background-color: transparent;
          color: inherit;
          outline: none !important;
          box-shadow: none !important;
          transition: border-color 0.2s ease-in-out;
          min-height: 100%;
          white-space: pre-wrap;
          word-wrap: break-word;
          overflow-y: auto;
          font-family: ui-monospace, SFMono-Regular, 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace;
        }
        
        .custom-editor:focus {
          border-color: white !important;
          box-shadow: none !important;
          outline: none !important;
        }
        
        .custom-editor:focus-visible {
          outline: none !important;
          box-shadow: none !important;
        }

        .custom-editor:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }

        /* Syntax Highlighting Styles */
        .syndrql-keyword { color: #569cd6; font-weight: bold; }
        .syndrql-identifier { color: #9cdcfe; }
        .syndrql-literal { color: #ce9178; }
        .syndrql-operator { color: #d4d4d4; }
        .syndrql-punctuation { color: #d4d4d4; }
        .syndrql-comment { color: #6a9955; font-style: italic; }
        .syndrql-ddl { color: #c586c0; } /* DDL keywords - purple */
        .syndrql-dql { color: #4ec9b0; } /* DQL keywords - teal */
        .syndrql-dml { color: #ffcb6b; } /* DML keywords - yellow */
        .syndrql-objects { color: #82aaff; } /* Database objects - light blue */
        .syndrql-fields { color: #f78c6c; } /* Field keywords - orange */
        .syndrql-control { color: #c792ea; } /* Control flow - light purple */
        .syndrql-security { color: #ff5370; } /* Security keywords - red */
        .syndrql-system { color: #89ddff; } /* System commands - cyan */
        .syndrql-operators { color: #89ddff; } /* Operators - cyan */
        .syndrql-reserved { text-decoration: underline; }
        .syndrql-literal_string { color: #ce9178; }
        .syndrql-literal_number { color: #b5cea8; }
        .syndrql-literal_boolean { color: #569cd6; }
        .syndrql-comment_single { color: #6a9955; }
        .syndrql-comment_multi { color: #6a9955; opacity: 0.8; }
        .syndrql-identifier_quoted { color: #9cdcfe; font-style: italic; }
        .syndrql-identifier_unquoted { color: #9cdcfe; }
      `;
      document.head.appendChild(style);
    }
    return this;
  }
    
  @property({ type: String })
  public activeTab: 'syndrql' | 'graphql' | 'new-editor' = 'syndrql';
  
  @property({ type: String })
  public databaseName: string = '';
  
  @state()
  public queryText: string = '';

  @state()
  private syndrqlQueryText: string = '';

  @state()
  private graphqlQueryText: string = '';

  @state()
  private showSuggestions: boolean = false;

  @state()
  private suggestions: Suggestion[] = [];

  @state()
  private suggestionX: number = 0;

  @state()
  private suggestionY: number = 0;

  @state()
  private suggestionsDismissed: boolean = false;

  private tokenizer: SyndrQLTokenizer = new SyndrQLTokenizer();
  private editorRef: HTMLElement | null = null;
  private currentCursorPosition: number = 0;
  
  // Syntax highlighting state
  private currentTokens: ClassifiedToken[] = [];
  private lastHighlightedText: string = '';
  private isHighlighting: boolean = false;
  private highlightingTimeout: number | null = null;
  private lastInputTime: number = 0;

  private resizeHandler = () => {
    // Force re-render when resize occurs
    this.requestUpdate();
  };

  connectedCallback() {
    super.connectedCallback();
    // Initialize SyndrQL query text with database name if provided
    if (this.databaseName && !this.syndrqlQueryText) {
      this.syndrqlQueryText = `USE "${this.databaseName}";`;
    } else if (!this.syndrqlQueryText) {
      this.syndrqlQueryText = 'USE "<Database_Name>";';
    }
    // Initialize queryText with the active tab's content
    this.queryText = this.activeTab === 'syndrql' ? this.syndrqlQueryText : this.graphqlQueryText;
    // Listen for window resize events
    window.addEventListener('resize', this.resizeHandler);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    // Clean up resize listener
    window.removeEventListener('resize', this.resizeHandler);
    
    // Clean up highlighting timeout
    if (this.highlightingTimeout) {
      clearTimeout(this.highlightingTimeout);
      this.highlightingTimeout = null;
    }
  }

  updated(changedProperties: PropertyValues) {
    super.updated(changedProperties);
    
    // Handle database name changes
    if (changedProperties.has('databaseName') && this.databaseName) {
      // Update SyndrQL query text only if it's still the default/empty
      if (!this.syndrqlQueryText || this.syndrqlQueryText === 'USE "<Database_Name>";' || this.syndrqlQueryText.match(/^USE\s+"[^"]+";?\s*$/)) {
        this.syndrqlQueryText = `USE "${this.databaseName}";`;
        // Update main query text if SyndrQL tab is active
        if (this.activeTab === 'syndrql') {
          this.queryText = this.syndrqlQueryText;
        }
      }
    }
    
    // If any properties changed, ensure proper layout recalculation
    if (changedProperties.has('activeTab') || changedProperties.has('queryText')) {
      // Small timeout to ensure DOM is updated
      setTimeout(() => {
        this.requestUpdate();
        
        // Reconfigure after tab switch
        if (changedProperties.has('activeTab')) {
         // console.log('TAB SWITCHED - reconfiguring contenteditable behavior');
          this.configureContentEditableBehavior();
        }
      }, 0);
    }
  }

  firstUpdated() {
    // Find and configure the editor elements to use <br> tags only, never <div> tags
   // console.log('FIRST UPDATED - configuring contenteditable behavior');
    this.configureContentEditableBehavior();
    
    // Set initial content in the active editor
    setTimeout(() => {
      const activeEditor = this.getActiveEditor();
      if (activeEditor && this.queryText && !activeEditor.textContent) {
        activeEditor.textContent = this.queryText;
        
        // Initialize syntax highlighting for SyndrQL tab if needed
        if (this.activeTab === 'syndrql' && this.queryText.length > 0) {
          this.initializeSyntaxHighlighting(activeEditor);
        }
      }
    }, 0);
  }

  private configureContentEditableBehavior() {
    console.log('CONFIGURING contenteditable behavior');
    
    // Get the current active editor directly
    const activeEditor = this.getActiveEditor();
    if (activeEditor) {
      console.log('CONFIGURING active editor:', activeEditor.dataset.placeholder);
      this.setupEditorBehavior(activeEditor);
    } else {
      console.log('ERROR: No active editor found');
    }
  }

  private getActiveEditor(): HTMLElement | null {
    // First try to use the stored editorRef
    if (this.editorRef) {
     // console.log('Using stored editorRef');
      return this.editorRef;
    }

    // Since we're not using Shadow DOM, we need to search for the active tab ancestor
    // Look for the closest ancestor with .syndrql-active-tab class
    const activeTabElement = this.closest('.syndrql-active-tab');
    //console.log('FOUND Active tab ancestor element:', activeTabElement);
    if (activeTabElement) {
      const editor = activeTabElement.querySelector('.custom-editor') as HTMLElement;
      if (editor) {
       // console.log('Found active editor within syndrql-active-tab ancestor');
        this.editorRef = editor; // Store it for future use
        return editor;
      } else {
       // console.log('No .custom-editor found within .syndrql-active-tab ancestor');
      }
    } else {
      // console.log('No ancestor element with .syndrql-active-tab class found');
    }

    // Fallback: just find any custom editor within this component
    const fallbackEditor = this.querySelector('.custom-editor') as HTMLElement;
    if (fallbackEditor) {
      console.log('Found fallback editor within component');
      this.editorRef = fallbackEditor;
      return fallbackEditor;
    }

    //console.log('No active editor found');
    return null;
  }

  private setupEditorBehavior(editor: HTMLElement) {
    //console.log('SETTING UP behavior for editor');
    
    // Remove existing listeners by cloning (clean slate approach)
    const clonedEditor = editor.cloneNode(true) as HTMLElement;
    editor.parentNode?.replaceChild(clonedEditor, editor);
    
    // Update our reference to the fresh editor
    this.editorRef = clonedEditor;

    // Handle paste events to strip formatting
    clonedEditor.addEventListener("paste", (e: ClipboardEvent) => {
      e.preventDefault();
      
      // Get plain text from clipboard
      const paste = e.clipboardData?.getData('text/plain') || '';
      
      // Insert as plain text using execCommand (preserves contenteditable structure)
      if (paste) {
        document.execCommand('insertText', false, paste);
        
        // Force cleanup and syntax highlighting after paste
        setTimeout(() => {
   //       this.cleanupDivStructures(clonedEditor);
          if (this.activeTab === 'syndrql') {
            this.scheduleHighlighting(clonedEditor);
          }
        }, 0);
      }
    });

    // Set contenteditable configuration immediately and repeatedly
    this.enforceBreakOnlyBehavior(clonedEditor);
    
    // Configure contenteditable to use <br> tags only on focus
    clonedEditor.addEventListener("focus", (e) => {
     // console.log('FOCUS EVENT - enforcing br-only behavior');
      this.enforceBreakOnlyBehavior(clonedEditor);
      // Also handle the original focus behavior
      this.editorRef = e.target as HTMLElement;
    });

    // Intercept Enter key to ensure we always insert <br> tags
    clonedEditor.addEventListener("keydown", (e: KeyboardEvent) => {
      // Handle contenteditable behavior first
      if (e.key === "Enter") {
        e.preventDefault();
        
        // Instead of using execCommand which might insert inside spans,
        // manually create and insert a <br> element
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          
          // Create a <br> element
          const br = document.createElement('br');
          
          // If we're inside a span, move the insertion point outside the span
          let insertionPoint = range.startContainer;
          let offset = range.startOffset;
          
          // If we're inside a text node within a span, we need to split and insert after the span
          if (insertionPoint.nodeType === Node.TEXT_NODE && 
              insertionPoint.parentElement && 
              insertionPoint.parentElement.tagName.toLowerCase() === 'span') {
            
            const span = insertionPoint.parentElement;
            const textNode = insertionPoint as Text;
            
            // If we're at the end of the text node, insert after the span
            if (offset === textNode.textContent?.length) {
              // Insert the <br> after the span
              if (span.parentNode) {
                span.parentNode.insertBefore(br, span.nextSibling);
                
                // Position cursor after the <br>
                const newRange = document.createRange();
                newRange.setStartAfter(br);
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);
              }
            } else {
              // We're in the middle of text, split the text and span
              const beforeText = textNode.textContent?.substring(0, offset) || '';
              const afterText = textNode.textContent?.substring(offset) || '';
              
              // Update the current span with the before text
              textNode.textContent = beforeText;
              
              // Create a new span for the after text if it exists
              if (afterText) {
                const newSpan = span.cloneNode(false) as HTMLElement;
                newSpan.textContent = afterText;
                
                // Insert: <br>, then new span
                if (span.parentNode) {
                  span.parentNode.insertBefore(br, span.nextSibling);
                  span.parentNode.insertBefore(newSpan, br.nextSibling);
                }
              } else {
                // Just insert the <br> after the span
                if (span.parentNode) {
                  span.parentNode.insertBefore(br, span.nextSibling);
                }
              }
              
              // Position cursor after the <br>
              const newRange = document.createRange();
              newRange.setStartAfter(br);
              newRange.collapse(true);
              selection.removeAllRanges();
              selection.addRange(newRange);
            }
          } else {
            // We're not inside a span, just insert normally
            range.deleteContents();
            range.insertNode(br);
            
            // Position cursor after the <br>
            const newRange = document.createRange();
            newRange.setStartAfter(br);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
          }
        }
        
        // Force cleanup immediately after
        setTimeout(() => {
//          this.cleanupDivStructures(clonedEditor);
        }, 0);
      }
      
      // Then handle the original keydown behavior for suggestions
      this.handleKeyDown(e);
    });

    // Handle keyup for suggestions
    clonedEditor.addEventListener("keyup", (e: KeyboardEvent) => {
      this.handleKeyUp(e);
    });

    // Handle input for both div cleanup and syntax highlighting/suggestions
    clonedEditor.addEventListener("input", (e) => {
     // console.log('INPUT EVENT - input type:', (e as InputEvent).inputType);
     // console.log('INPUT EVENT - Cleaning up divs');
  //    this.cleanupDivStructures(clonedEditor);
      
      // Also handle the original input behavior
      this.handleQueryChange(e);
    });

    // Handle click for cursor position updates
    clonedEditor.addEventListener("click", (e: Event) => {
      this.editorRef = e.target as HTMLElement;
      this.updateCursorPosition();
    });

    // Use MutationObserver to catch DIV creation immediately
    const observer = new MutationObserver((mutations) => {
      let hasNewDivs = false;
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            if (element.tagName === 'DIV' || element.querySelector('div')) {
              hasNewDivs = true;
            }
          }
        });
      });
      if (hasNewDivs) {
//        console.log('MUTATION OBSERVER - DIVs detected, cleaning up');
//        this.cleanupDivStructures(clonedEditor);
      }
    });

    observer.observe(clonedEditor, {
      childList: true,
      subtree: true
    });

   // console.log('SETUP COMPLETE for editor');
  }

  private enforceBreakOnlyBehavior(editor: HTMLElement) {
    // Set multiple contenteditable configurations
    document.execCommand("defaultParagraphSeparator", false, "br");
    document.execCommand("insertBrOnReturn", false, "true");
    
    // Also try setting CSS styles that might help
    editor.style.whiteSpace = 'pre-wrap';
  }

  // private cleanupDivStructures(editor: HTMLElement) {
  //   const divs = editor.querySelectorAll('div');
  //   if (divs.length > 0) {
  //    // console.log(`CLEANUP: Found ${divs.length} div elements to convert`);
  //     //console.log('CLEANUP: HTML before:', editor.innerHTML);
  //   }
    
  //   divs.forEach((div, index) => {
  //     console.log(`CLEANUP: Converting div ${index}:`, div.outerHTML);
      
  //     // Extract all the text content from the div
  //     const textContent = div.textContent || '';
      
  //     if (textContent.trim()) {
  //       // If div has text content, create a text node and a br
  //       const textNode = document.createTextNode(textContent);
  //       div.parentNode?.insertBefore(textNode, div);
  //       const br = document.createElement('br');
  //       div.parentNode?.insertBefore(br, div);
  //       console.log(`CLEANUP: Replaced div with text "${textContent}" + <br>`);
  //     } else {
  //       // Empty div or div with only br, just replace with br
  //       const br = document.createElement('br');
  //       div.parentNode?.insertBefore(br, div);
  //       console.log(`CLEANUP: Replaced empty div with <br>`);
  //     }
  //     div.remove();
  //   });
    
  //   if (divs.length > 0) {
  //     console.log('CLEANUP: HTML after:', editor.innerHTML);
  //   }
  // }

  private handleQueryChange(event: Event) {
    const target = event.target as HTMLElement;
    const newText = target.textContent || '';
    
    // Track input timing for highlighting decisions
    this.lastInputTime = Date.now();
    
    // Only update if text actually changed to avoid unnecessary updates
    if (this.queryText !== newText) {
      const oldText = this.queryText;
      this.queryText = newText;
      
      // Also save to the tab-specific state
      if (this.activeTab === 'syndrql') {
        this.syndrqlQueryText = newText;
      } else {
        this.graphqlQueryText = newText;
      }
      
      this.updateCursorPosition();
      
      // Only reset dismissed state if text was actually added (not deleted)
      // This prevents suggestions from reappearing when deleting text after escape
      if (newText.length > oldText.length) {
        this.suggestionsDismissed = false;
      }
      
      // Apply syntax highlighting for SyndrQL tab with debouncing
      if (this.activeTab === 'syndrql') {
        this.scheduleHighlighting(target);
        
        // Use setTimeout to allow the input event to complete first
        setTimeout(() => {
          this.checkForSuggestions(target);
        }, 0);
      }
      
      // Emit custom event with the new query text
      this.dispatchEvent(new CustomEvent('query-changed', {
        detail: {
          query: this.queryText,
          activeTab: this.activeTab
        },
        bubbles: true,
        composed: true
      }));
    }
  }

  private handleKeyUp(event: KeyboardEvent) {
    this.updateCursorPosition();
    
    // Don't check for suggestions if they were manually dismissed
    // or if this was the escape key that just dismissed them
    if (this.suggestionsDismissed || event.key === 'Escape') {
      return;
    }
    
    // Check for suggestions on key up (for SyndrQL only)
    if (this.activeTab === 'syndrql') {
      this.checkForSuggestions(event.target as HTMLElement);
    }
  }

  private updateCursorPosition() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !this.editorRef) {
      this.currentCursorPosition = 0;
      return;
    }

    const range = selection.getRangeAt(0);
    
    // Calculate cursor position as character offset from start of editor content
    try {
      // Create a range from start of editor to current cursor position
      const fullRange = document.createRange();
      fullRange.setStart(this.editorRef, 0);
      fullRange.setEnd(range.startContainer, range.startOffset);
      
      // Get the text content up to the cursor
      const textBeforeCursor = fullRange.toString();
      this.currentCursorPosition = textBeforeCursor.length;
    } catch (error) {
      console.warn('Error calculating cursor position:', error);
      // Fallback: use text length
      this.currentCursorPosition = (this.editorRef.textContent || '').length;
    }
  }

  private handleKeyDown(event: KeyboardEvent) {
    // Handle suggestion dropdown navigation
    if (this.showSuggestions) {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          // Let the dropdown handle this
          return;
        case 'ArrowUp':
          event.preventDefault();
          // Let the dropdown handle this
          return;
        case 'Tab':
        //case 'Enter':
          if (this.showSuggestions) {
            event.preventDefault();
            // Let the dropdown handle this
            return;
          }
          break;
        case 'Escape':
          if (this.showSuggestions) {
            event.preventDefault();
            this.hideSuggestions();
            this.suggestionsDismissed = true; // Mark as manually dismissed
            return;
          }
          break;
        default:
          // For printable characters, reset dismissed state
          if (this.isPrintableCharacter(event.key)) {
            this.suggestionsDismissed = false;
          }
          break;
      }
    } else {
      // If suggestions are not showing and user types a printable character, reset dismissed state
      if (this.isPrintableCharacter(event.key)) {
        this.suggestionsDismissed = false;
      }
    }
  }

  private async checkForSuggestions(editor: HTMLElement) {
    try {
      // Don't show suggestions if they were manually dismissed
      if (this.suggestionsDismissed) {
        this.hideSuggestions();
        return;
      }

      const textContent = editor.textContent || '';
      const cursorPos = this.currentCursorPosition;
      
      // Check if the statement appears to be complete (ends with semicolon)
      const trimmedText = textContent.trim();
      if (trimmedText.endsWith(';')) {
        // Check if cursor is at the very end or only followed by whitespace
        const textAfterCursor = textContent.substring(cursorPos).trim();
        if (textAfterCursor === '' || textAfterCursor === ';') {
          this.hideSuggestions();
          return;
        }
      }
      
      // Get the word being typed (look backward from cursor for word characters)
      let wordStart = cursorPos;
      while (wordStart > 0 && /\w/.test(textContent[wordStart - 1])) {
        wordStart--;
      }
      
      const currentWord = textContent.substring(wordStart, cursorPos).toUpperCase();
      
      // Only show suggestions if there's a partial word being typed
      if (currentWord.length === 0) {
        this.hideSuggestions();
        return;
      }
      
      // Get suggestions from tokenizer
      const suggestions = await this.tokenizer.getSuggestions(textContent, cursorPos);
      
      // Check if the current word could potentially match any keywords
      // Only show suggestions if at least one keyword starts with the current word
      const hasMatches = suggestions.some(suggestion => 
        suggestion.value.toUpperCase().startsWith(currentWord)
      );
      
      if (!hasMatches) {
        this.hideSuggestions();
        return;
      }
      
      this.suggestions = suggestions;
      
      if (this.suggestions.length > 0) {
        // Get cursor coordinates for suggestion dropdown
        const coords = this.getCursorCoordinates(editor);
        if (coords) {
          this.suggestionX = coords.x;
          this.suggestionY = coords.y;
          this.showSuggestions = true;
        }
      } else {
        this.hideSuggestions();
      }
    } catch (error) {
      console.warn('Error getting suggestions:', error);
      this.hideSuggestions();
    }
  }

  private getCursorCoordinates(editor: HTMLElement): { x: number, y: number } | null {
    try {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        // Fallback to editor position
        const editorRect = editor.getBoundingClientRect();
        const containerRect = this.getBoundingClientRect();
        return { 
          x: editorRect.left - containerRect.left + 10, 
          y: editorRect.top - containerRect.top + 20 
        };
      }

      const range = selection.getRangeAt(0);
      
      // If the range is collapsed (cursor, not selection)
      if (range.collapsed) {
        // Create a temporary span at the cursor position to get coordinates
        const span = document.createElement('span');
        span.textContent = '\u200B'; // Zero-width space
        range.insertNode(span);
        
        const spanRect = span.getBoundingClientRect();
        const containerRect = this.getBoundingClientRect();
        
        const coords = {
          x: spanRect.left - containerRect.left,
          y: spanRect.bottom - containerRect.top + 2 // Small offset below cursor line
        };
        
        // Clean up the temporary span
        span.remove();
        range.collapse(true);
        
        return coords;
      }
      
      // For selections, use the end position
      const rangeRect = range.getBoundingClientRect();
      const containerRect = this.getBoundingClientRect();
      
      return {
        x: rangeRect.right - containerRect.left,
        y: rangeRect.bottom - containerRect.top + 2
      };
      
    } catch (error) {
      console.warn('Error calculating cursor position:', error);
      // Fallback to editor position
      const editorRect = editor.getBoundingClientRect();
      const containerRect = this.getBoundingClientRect();
      return { 
        x: editorRect.left - containerRect.left + 10, 
        y: editorRect.top - containerRect.top + 20 
      };
    }
  }

  private hideSuggestions() {
    const wasShowing = this.showSuggestions;
    this.showSuggestions = false;
    this.suggestions = [];
    
    // Schedule highlighting after suggestions are hidden with a longer delay
    // This ensures user has finished interacting before we modify DOM
    if (wasShowing && this.activeTab === 'syndrql' && this.editorRef) {
      setTimeout(() => {
        if (this.editorRef && !this.showSuggestions) {
          this.scheduleHighlighting(this.editorRef);
        }
      }, 500); // Longer delay to ensure stable state
    }
    
    // Note: We don't set suggestionsDismissed here as this might be called
    // for other reasons (like no matches found)
  }

  // =============================================================================
  // SYNTAX HIGHLIGHTING SYSTEM
  // =============================================================================
  
  /**
   * Schedules syntax highlighting with debouncing for performance
   */
  private scheduleHighlighting(editor: HTMLElement) {
    // Clear existing timeout
    if (this.highlightingTimeout) {
      clearTimeout(this.highlightingTimeout);
    }
    
    // Debounce highlighting to avoid excessive processing during rapid typing
    // Use longer debounce to protect whitespace during active typing
    const debounceTime = 400; // Longer delay to let user finish typing
    
    this.highlightingTimeout = window.setTimeout(() => {
      this.applySyntaxHighlighting(editor);
    }, debounceTime);
  }
  
  /**
   * Gets text content from editor, preserving the exact formatting including trailing newlines
   * Now simplified to only handle <br> tags since we've configured contenteditable to use only <br>
   */
  private getEditorTextContent(editor: HTMLElement): string {
//    console.log('DEBUG: Original HTML structure:', JSON.stringify(editor.innerHTML));
    
    // Create a temporary element for processing
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = editor.innerHTML;
    
    // Simplified processing since we only expect <br> tags and spans now
    const processElement = (element: Element): string => {
      let result = '';
      
      for (let i = 0; i < element.childNodes.length; i++) {
        const node = element.childNodes[i];
        
        if (node.nodeType === Node.TEXT_NODE) {
          result += node.textContent || '';
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as Element;
          const tagName = el.tagName.toLowerCase();
          
          if (tagName === 'br') {
            result += '\n';
          } else if (tagName === 'span') {
            // For spans (syntax highlighting), just process the text content
            result += processElement(el);
          } else {
            // For any other unexpected elements, process children
            console.warn('Unexpected element in contenteditable:', tagName);
            result += processElement(el);
          }
        }
      }
      
      return result;
    };
    
    const text = processElement(tempDiv);
    
    // Remove the zero-width space we added to preserve trailing <br>
    const cleanText = text.replace(/\u200B/g, '');
    
//    console.log('DEBUG: Converted text:', JSON.stringify(cleanText));
    return cleanText;
  }

  /**
   * Applies syntax highlighting to the editor content
   */
  private applySyntaxHighlighting(editor: HTMLElement) {
    if (!editor || this.isHighlighting) return;
    
    const textContent = this.getEditorTextContent(editor);
    
    // Skip highlighting if content hasn't changed
    if (textContent === this.lastHighlightedText) {
      return;
    }
    
    // Skip highlighting during active suggestion sessions to avoid interference
    if (this.showSuggestions) {
      return;
    }
    
    // Skip very short content
    if (textContent.length < 3) {
      return;
    }
    
    this.isHighlighting = true;
    
    try {
      // Store cursor position before highlighting
      const cursorPos = this.currentCursorPosition;
      
      // Apply highlighting
      this.applyFullHighlighting(editor, textContent);
      
      // Restore cursor position after a brief delay to let DOM settle
      requestAnimationFrame(() => {
        this.setCursorPosition(cursorPos);
      });
      
      this.lastHighlightedText = textContent;
      
    } catch (error) {
      console.warn('Error applying syntax highlighting:', error);
    } finally {
      this.isHighlighting = false;
    }
  }
  
  /**
   * Determines if incremental highlighting can be used based on text changes
   */
  private canUseIncrementalHighlighting(newText: string): boolean {
    // Use incremental highlighting if:
    // 1. We have previous tokens
    // 2. Text change is relatively small (< 20% of total content)
    // 3. Change appears to be localized (not a complete rewrite)
    
    if (this.currentTokens.length === 0) {
      return false;
    }
    
    const oldText = this.lastHighlightedText;
    const lengthDiff = Math.abs(newText.length - oldText.length);
    const changePercentage = lengthDiff / Math.max(oldText.length, 1);
    
    // If change is more than 20% of content, do full re-highlighting
    if (changePercentage > 0.2) {
      return false;
    }
    
    // Use incremental highlighting for small changes
    return true;
  }
  
  /**
   * Applies incremental syntax highlighting (optimized for performance)
   */
  private applyIncrementalHighlighting(editor: HTMLElement, textContent: string) {
    try {
      // For now, fall back to full highlighting
      // TODO: Implement true incremental highlighting with change detection
      this.applyFullHighlighting(editor, textContent);
    } catch (error) {
      console.warn('Incremental highlighting failed, falling back to full highlighting:', error);
      this.applyFullHighlighting(editor, textContent);
    }
  }
  
  /**
   * Applies full syntax highlighting by re-tokenizing entire content
   */
  private applyFullHighlighting(editor: HTMLElement, textContent: string) {
    try {
      // Special debugging for the specific case: USE "TestDB";\n
      // if (textContent.includes('USE "TestDB"')) {
      //   // console.log('=== DEBUGGING USE TestDB CASE ===');
      //   // console.log('Editor innerHTML before:', JSON.stringify(editor.innerHTML));
      //   // console.log('Extracted text content:', JSON.stringify(textContent));
      //   // console.log('Text length:', textContent.length);
      //   // console.log('Text ends with newline?', textContent.endsWith('\n'));
      //   // console.log('Character by character:');
      //   for (let i = 0; i < textContent.length; i++) {
      //     const char = textContent[i];
      //     if (char === '\n') {
      //       console.log(`  [${i}]: NEWLINE`);
      //     } else if (char === ' ') {
      //       console.log(`  [${i}]: SPACE`);
      //     } else {
      //       console.log(`  [${i}]: "${char}"`);
      //     }
      //   }
      // }

      // Debug newline handling - especially trailing newlines and empty lines
      if (textContent.includes('\n')) {
        //console.log('=== NEWLINE DEBUG ===');
        //console.log('Editor innerHTML before:', JSON.stringify(editor.innerHTML));
        
        // Check for <div> elements which indicate line breaks
        const divCount = (editor.innerHTML.match(/<div>/g) || []).length;
        const brCount = (editor.innerHTML.match(/<br>/g) || []).length;
        // console.log('DIV elements found:', divCount, 'BR elements found:', brCount);
        
        // console.log('Extracted text content:', JSON.stringify(textContent));
        // console.log('Text length:', textContent.length);
        // console.log('Text chars:', textContent.split('').map((c, i) => 
        //   c === '\n' ? `[NEWLINE-${i}]` : c === ' ' ? `[SPACE-${i}]` : c
        // ));
        
        const newlineCount = (textContent.match(/\n/g) || []).length;
       // console.log('Total newlines found:', newlineCount);
        
        // Check for trailing newlines specifically
        const endsWithNewline = textContent.endsWith('\n');
        const trailingNewlines = textContent.match(/\n+$/);
       // console.log('Ends with newline:', endsWithNewline);
        if (trailingNewlines) {
//          console.log('Trailing newlines count:', trailingNewlines[0].length);
        }
        
        // Check for consecutive newlines (empty lines)
        const emptyLines = textContent.match(/\n\n+/g);
        if (emptyLines) {
//          console.log('Empty line sequences found:', emptyLines.length);
          emptyLines.forEach((seq, i) => {
//            console.log(`Empty line sequence ${i}: ${seq.length - 1} empty lines`);
          });
        }
      }
      
      // Tokenize and classify the text
      const classifiedTokens = tokenizeAndClassify(textContent);
      this.currentTokens = classifiedTokens;
      
      // Debug tokens - focus on newline tokens and their positions
      if (textContent.includes('\n')) {
        //console.log('=== DETAILED TOKEN ANALYSIS ===');
        //console.log('Total tokens:', classifiedTokens.length);
        
        // Show ALL tokens with their positions
        classifiedTokens.forEach((token, i) => {
          const isNewline = token.type === 'newline';
          const surroundingContext = textContent.substring(
            Math.max(0, token.startPosition - 2), 
            Math.min(textContent.length, token.endPosition + 2)
          ).replace(/\n/g, '\\n');
          
//          console.log(`Token ${i}: ${token.type} = ${JSON.stringify(token.value)} at pos ${token.startPosition}-${token.endPosition} context:"${surroundingContext}"`);
        });
        
        // Check for gaps in positions (missing tokens)
        for (let i = 1; i < classifiedTokens.length; i++) {
          const prevToken = classifiedTokens[i - 1];
          const currentToken = classifiedTokens[i];
          const gap = currentToken.startPosition - prevToken.endPosition;
          
          if (gap > 0) {
            const missingText = textContent.substring(prevToken.endPosition, currentToken.startPosition);
            console.log(`⚠️ GAP DETECTED between tokens ${i-1} and ${i}: missing "${JSON.stringify(missingText)}" at positions ${prevToken.endPosition}-${currentToken.startPosition}`);
          }
        }
        
        const newlineTokens = classifiedTokens.filter(t => t.type === 'newline');
        //console.log('Newline tokens found:', newlineTokens.length);
        //console.log('=== END DETAILED ANALYSIS ===');
      }
      
      // Generate highlighted HTML
      const highlightedHtml = generateSyntaxHighlighting(classifiedTokens, {
        preserveWhitespace: true,
        cssClassPrefix: 'syndrql'
      });
      
      // Special debugging for USE "TestDB" case
      // if (textContent.includes('USE "TestDB"')) {
      //   // console.log('=== DEBUGGING USE TestDB HTML GENERATION ===');
      //   // console.log('Generated HTML:', JSON.stringify(highlightedHtml));
      //   // console.log('HTML character by character:');
      //   for (let i = 0; i < highlightedHtml.length; i++) {
      //     const char = highlightedHtml[i];
      //     if (char === '<') {
      //       const tagEnd = highlightedHtml.indexOf('>', i);
      //       if (tagEnd !== -1) {
      //         const tag = highlightedHtml.substring(i, tagEnd + 1);
      //         console.log(`  [${i}-${tagEnd}]: TAG "${tag}"`);
      //         i = tagEnd;
      //       }
      //     } else if (char === '\n') {
      //       console.log(`  [${i}]: NEWLINE`);
      //     } else if (char === ' ') {
      //       console.log(`  [${i}]: SPACE`);
      //     } else {
      //       console.log(`  [${i}]: "${char}"`);
      //     }
      //   }
      // }
      
      // Debug HTML generation
      if (textContent.includes('\n')) {
        //console.log('Generated HTML:', JSON.stringify(highlightedHtml));
        const brCount = (highlightedHtml.match(/<br>/g) || []).length;
        //console.log('Number of <br> tags generated:', brCount);
        
        // Check if HTML ends with <br> for trailing newlines
        const endsWithBr = highlightedHtml.endsWith('<br>');
        const endsWithBrAndZws = highlightedHtml.endsWith('<br>&#8203;');
        ////console.log('Generated HTML ends with <br>:', endsWithBr);
        //console.log('Generated HTML ends with <br> + zero-width space:', endsWithBrAndZws);
      }
      
      // Only apply if we have actual highlighting and content matches
      const currentText = this.getEditorTextContent(editor);
      const currentHtml = editor.innerHTML;
      
      if (currentText === textContent && 
          currentHtml !== highlightedHtml && 
          highlightedHtml.includes('<span') &&
          highlightedHtml !== textContent) {
        
        // Don't update during rapid typing
        const timeSinceInput = Date.now() - this.lastInputTime;
        if (timeSinceInput > 300) { // Only update after user pauses typing
          if (textContent.includes('\n')) {
            console.log('APPLYING highlighted HTML...');
          }
          
          editor.innerHTML = highlightedHtml;
          
          if (textContent.includes('\n')) {
            //console.log('After setting innerHTML:', JSON.stringify(editor.innerHTML));
            const newTextContent = this.getEditorTextContent(editor);
            // console.log('New extracted text:', JSON.stringify(newTextContent));
            // console.log('New text length:', newTextContent.length);
            // console.log('Length preserved?', newTextContent.length === textContent.length);
            // console.log('Newlines preserved?', newTextContent === textContent);
            
            // Check specifically for trailing newlines after the operation
            const newEndsWithNewline = newTextContent.endsWith('\n');
            // console.log('Still ends with newline after highlighting:', newEndsWithNewline);

            // console.log('=== END NEWLINE DEBUG ===');
          }
          
          // Update tracking
          this.lastHighlightedText = textContent;
        }
      }
      
    } catch (error) {
      console.warn('Full highlighting failed:', error);
    }
  }
  
  /**
   * Gets the plain text content from highlighted HTML
   */
  private getPlainTextFromHighlighted(element: HTMLElement): string {
    // Create a temporary element to extract text content
    const temp = document.createElement('div');
    temp.innerHTML = element.innerHTML;
    return temp.textContent || '';
  }
  
  /**
   * Initializes syntax highlighting for the editor
   */
  private initializeSyntaxHighlighting(editor: HTMLElement) {
    if (!editor || this.activeTab !== 'syndrql') return;
    
    const textContent = editor.textContent || '';
    if (textContent.trim().length > 0) {
      this.scheduleHighlighting(editor);
    }
  }

  private isPrintableCharacter(key: string): boolean {
    // Check if the key is a single printable character
    // Exclude special keys like 'Shift', 'Control', 'Alt', 'Meta', 'ArrowLeft', etc.
    return key.length === 1 && !key.match(/[\x00-\x1f\x7f]/);
  }

  private handleSuggestionSelected(event: CustomEvent) {
    const { suggestion } = event.detail;
    
    if (!this.editorRef) return;
    
    // Get the current selection
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0);
    const insertText = suggestion.insertText || suggestion.value;
    
    try {
      // Modern approach: Use Selection API directly for text insertion
      const textContent = this.editorRef.textContent || '';
      const cursorPos = this.currentCursorPosition;
      
      // Find word start
      let wordStart = cursorPos;
      let wordLength = 0;
      while (wordStart > 0 && /\w/.test(textContent[wordStart - 1])) {
        wordStart--;
        wordLength++;
      }
      
      // If there's a partial word, select it for replacement
      if (wordLength > 0) {
        // Move the selection to cover the partial word
        const currentRange = selection.getRangeAt(0);
        
        // Try to select backward by the word length
        try {
          currentRange.setStart(currentRange.startContainer, Math.max(0, currentRange.startOffset - wordLength));
        } catch (e) {
          // If that fails, just insert at cursor
        }
      }
      
      // Try modern execCommand first (still works in most browsers)
      let insertSuccess = false;
      try {
        insertSuccess = document.execCommand('insertText', false, insertText);
      } catch (e) {
        // execCommand failed, fall back to manual insertion
      }
      
      // If execCommand failed or isn't supported, use manual insertion
      if (!insertSuccess) {
        // Delete any selected content first
        if (!selection.isCollapsed) {
          selection.deleteFromDocument();
        }
        
        // Create and insert text node
        const textNode = document.createTextNode(insertText);
        const insertRange = selection.getRangeAt(0);
        insertRange.insertNode(textNode);
        
        // Position cursor after inserted text
        const newRange = document.createRange();
        newRange.setStartAfter(textNode);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
      }
      
      // Update internal state
      this.queryText = this.editorRef.textContent || '';
      this.updateCursorPosition();
      
    } catch (error) {
      console.warn('Error in suggestion insertion:', error);
      
      // Ultimate fallback: manual text node insertion
      try {
        const textNode = document.createTextNode(insertText);
        range.insertNode(textNode);
        
        const newRange = document.createRange();
        newRange.setStartAfter(textNode);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
        
        this.queryText = this.editorRef.textContent || '';
      } catch (fallbackError) {
        console.error('All text insertion methods failed:', fallbackError);
      }
    }
    
    // Hide suggestions and reset state
    this.hideSuggestions();
    this.suggestionsDismissed = false;
    
    // Focus the editor
    this.editorRef.focus();
    
    // Apply syntax highlighting after suggestion insertion with delay
    if (this.activeTab === 'syndrql') {
      // Wait longer to ensure DOM is stable and user isn't immediately typing
      setTimeout(() => {
        if (this.editorRef && !this.showSuggestions) {
          this.scheduleHighlighting(this.editorRef);
        }
      }, 600);
    }
    
    // Emit the change event
    this.dispatchEvent(new CustomEvent('query-changed', {
      detail: {
        query: this.queryText,
        activeTab: this.activeTab
      },
      bubbles: true,
      composed: true
    }));
  }

  private setCursorPosition(position: number) {
    if (!this.editorRef) return;
    
    const textContent = this.editorRef.textContent || '';
    const range = document.createRange();
    const selection = window.getSelection();
    
    if (!selection) return;
    
    try {
      // Ensure position is within bounds
      const safePosition = Math.max(0, Math.min(position, textContent.length));
      
      // If editor is empty or position is 0, set at start
      if (textContent.length === 0 || safePosition === 0) {
        range.setStart(this.editorRef, 0);
        range.setEnd(this.editorRef, 0);
      } else {
        // Find the text node and offset for the given position
        let currentPos = 0;
        let found = false;
        
        const walker = document.createTreeWalker(
          this.editorRef,
          NodeFilter.SHOW_TEXT,
          null
        );
        
        let node;
        while (node = walker.nextNode()) {
          const nodeLength = node.textContent?.length || 0;
          if (currentPos + nodeLength >= safePosition) {
            const offset = safePosition - currentPos;
            range.setStart(node, offset);
            range.setEnd(node, offset);
            found = true;
            break;
          }
          currentPos += nodeLength;
        }
        
        // If we didn't find a suitable text node, set at the end
        if (!found) {
          range.selectNodeContents(this.editorRef);
          range.collapse(false);
        }
      }
      
      selection.removeAllRanges();
      selection.addRange(range);
      this.currentCursorPosition = position;
      
    } catch (error) {
      console.warn('Error setting cursor position:', error);
      // Fallback: set cursor at end
      try {
        range.selectNodeContents(this.editorRef);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      } catch (fallbackError) {
        console.warn('Fallback cursor positioning failed:', fallbackError);
      }
    }
  }

  private handleSuggestionDropdownHidden() {
    this.hideSuggestions();
  }

  private handleTabClick(tab: 'syndrql' | 'graphql' | 'new-editor') {
    if (this.activeTab !== tab) {
      // Save current tab's content before switching
      if (this.activeTab === 'syndrql') {
        this.syndrqlQueryText = this.queryText;
      } else {
        this.graphqlQueryText = this.queryText;
      }
      
      this.activeTab = tab;
      
      // Load the content for the new tab
      const newTabQueryText = tab === 'syndrql' || tab === 'new-editor' ? this.syndrqlQueryText : this.graphqlQueryText;
      this.queryText = newTabQueryText;
      
      // Update editor reference when tab changes
      setTimeout(() => {
        // let editorSelector = '';
        
        // if (tab === 'syndrql') {
        //   editorSelector = '.custom-editor[data-placeholder*="SyndrQL"]';
        // } else if (tab === 'graphql') {
        //   editorSelector = '.custom-editor[data-placeholder*="GraphQL"]';
        // }
        const editorSelector = tab === 'syndrql' 
          ? '.custom-editor[data-placeholder*="SyndrQL"]'
          : '.custom-editor[data-placeholder*="GraphQL"]';
        
        const editor = this.querySelector(editorSelector) as HTMLElement;
        if (editor) {
          this.editorRef = editor;
          // Ensure editor has the correct content for this tab
          if (editor.textContent !== newTabQueryText) {
            editor.textContent = newTabQueryText;
          }
          
          // Initialize syntax highlighting for SyndrQL tab
          if (tab === 'syndrql') {
            this.initializeSyntaxHighlighting(editor);
          }
          
          // Focus the new editor
          editor.focus();
        }
        
        // Special handling for the new code-editor component
        if (tab === 'new-editor') {
          
          const codeEditor = this.querySelector('code-editor') as any;
          
          if (codeEditor && codeEditor.inputCapture) {
            // Focus the canvas-based editor using its InputCapture system
            codeEditor.inputCapture.focus();
          }
        }
      }, 0);
      
      // Emit tab change event
      this.dispatchEvent(new CustomEvent('tab-changed', {
        detail: {
          activeTab: tab,
          query: this.queryText
        },
        bubbles: true,
        composed: true
      }));
    }
  }

  private handleTextDrop = (event: CustomEvent) => {
    const { dropData, dropX, dropY } = event.detail;
    
    // Insert the dropped text at the mouse cursor position with intelligent padding
    const textarea = this.querySelector('.custom-editor[data-placeholder*="SyndrQL"]') as HTMLDivElement;
    if (textarea) {
      console.log('🎯 Handling text drop:', { dropData, dropX, dropY });
      
      // Use the TextPositionCalculator for intelligent positioning
      const calculator = new TextPositionCalculator(textarea);
      const { updatedTextContent, updatedHTMLContent, caretPosition } = calculator.calculateDropPosition(dropX, dropY, dropData);
      
      console.log('🎯 Calculator updated content and caret position:', { 
        contentLength: updatedTextContent.length, 
        caretPosition 
      });
      
      // The calculator has already updated the textarea content
      // Now we just need to update our state and set the caret position
     
      //textarea.textContent = updatedTextContent;
      textarea.innerHTML = updatedHTMLContent;
      this.queryText = updatedTextContent;
      this.currentCursorPosition = caretPosition;

      // Set cursor to the calculated position
      this.setCursorPosition(caretPosition);
      textarea.focus();
      
      // Apply syntax highlighting after drop
      if (this.activeTab === 'syndrql') {
        setTimeout(() => {
          if (this.editorRef && !this.showSuggestions) {
            this.scheduleHighlighting(this.editorRef);
          }
        }, 100);
      }
    }
  }

  render() {
    return html`
      <div class="h-full flex flex-col relative">
        <!-- Tab Content -->
        <div class="flex-1 relative">
          <div class="h-full absolute inset-0 p-4 ${this.activeTab === 'syndrql' ? 'visible z-10' : 'invisible z-0'}">
             <droppable-component @drop-completed=${this.handleTextDrop}>
            <div 
              class="custom-editor w-full h-full font-mono resize-none"
              style="white-space: pre-wrap; overflow-wrap: break-word;"
              contenteditable="true"
              data-placeholder="Enter your SyndrQL query..."
              @input=${this.handleQueryChange}
              @keyup=${this.handleKeyUp}
              @keydown=${this.handleKeyDown}
              @click=${(e: Event) => {
                this.editorRef = e.target as HTMLElement;
                this.updateCursorPosition();
              }}
              @focus=${(e: Event) => {
                this.editorRef = e.target as HTMLElement;
              }}
            ></div>
            </droppable-component>
          </div>
          <div class="h-full absolute inset-0 p-4 ${this.activeTab === 'graphql' ? 'visible z-10' : 'invisible z-0'}">
            <div 
              class="custom-editor w-full h-full font-mono resize-none"
              contenteditable="true"
              data-placeholder="Enter your GraphQL query..."
              @input=${this.handleQueryChange}
            ></div>
          </div>

          <div class="h-full absolute inset-0 p-4 ${this.activeTab === 'new-editor' ? 'visible z-10' : 'invisible z-0'}">
           <code-editor data-placeholder="New Editor"></code-editor>
          </div>
        </div>
        
        <!-- Suggestion Dropdown -->
        <suggestion-dropdown
          .visible=${this.showSuggestions}
          .suggestions=${this.suggestions}
          .x=${this.suggestionX}
          .y=${this.suggestionY}
          @suggestion-selected=${this.handleSuggestionSelected}
          @suggestion-dropdown-hidden=${this.handleSuggestionDropdownHidden}
        ></suggestion-dropdown>
        
        <!-- Tab Headers (Bottom) -->
        <div class="flex border-t border-base-300 bg-base-50">
          <button 
            class="px-3 py-2 border-t-2 font-medium text-xs transition-colors duration-200 ${
              this.activeTab === 'syndrql' 
                ? 'border-primary text-base-content bg-base-100' 
                : 'border-transparent text-base-content opacity-30 hover:text-base-content hover:opacity-100 hover:bg-base-100'
            }"
            @click=${() => this.handleTabClick('syndrql')}
          >
            <i class="fa-solid fa-database mr-1"></i>SyndrQL
          </button>
          <button 
            class="px-3 py-2 border-t-2 font-medium text-xs transition-colors duration-200 ${
              this.activeTab === 'graphql' 
                ? 'border-primary text-base-content bg-base-100' 
                : 'border-transparent text-base-content opacity-30 hover:text-base-content hover:opacity-100 hover:bg-base-100'
            }"
            @click=${() => this.handleTabClick('graphql')}
          >
            <i class="fa-solid fa-diagram-project mr-1"></i>GraphQL
         
          </button>
          <button
          class="px-3 py-2 border-t-2 font-medium text-xs transition-colors duration-200 
          ${
              this.activeTab === 'graphql' 
                ? 'border-primary text-base-content bg-base-100' 
                : 'border-transparent text-base-content opacity-30 hover:text-base-content hover:opacity-100 hover:bg-base-100'
            }"
          @click=${() => this.handleTabClick('new-editor')}
          >
          New Editor
          </button>
        </div>
      </div>
    `;
  }
}