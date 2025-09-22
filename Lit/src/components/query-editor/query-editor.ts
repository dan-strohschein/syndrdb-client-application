import { html, css, LitElement, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { SyndrQLTokenizer, Suggestion } from './syndrQL-language-service/syndrql-tokenizer';
import './suggestion-complete/suggestion-dropdown';


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
      `;
      document.head.appendChild(style);
    }
    return this;
  }
    
  @property({ type: String })
  public activeTab: 'syndrql' | 'graphql' = 'syndrql';
  
  @state()
  public queryText: string = '';

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

  private resizeHandler = () => {
    // Force re-render when resize occurs
    this.requestUpdate();
  };

  connectedCallback() {
    super.connectedCallback();
    // Listen for window resize events
    window.addEventListener('resize', this.resizeHandler);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    // Clean up resize listener
    window.removeEventListener('resize', this.resizeHandler);
  }

  updated(changedProperties: PropertyValues) {
    super.updated(changedProperties);
    
    // If any properties changed, ensure proper layout recalculation
    if (changedProperties.has('activeTab') || changedProperties.has('queryText')) {
      // Small timeout to ensure DOM is updated
      setTimeout(() => {
        this.requestUpdate();
      }, 0);
    }
  }

  firstUpdated(changedProperties: PropertyValues) {
    super.firstUpdated(changedProperties);
    
    // Find and store reference to the SyndrQL editor and initialize content
    const syndrqlEditor = this.shadowRoot?.querySelector('.custom-editor[data-placeholder*="SyndrQL"]') as HTMLElement;
    if (syndrqlEditor) {
      this.editorRef = syndrqlEditor;
      // Set initial content if we have queryText
      if (this.queryText && syndrqlEditor.textContent !== this.queryText) {
        syndrqlEditor.textContent = this.queryText;
      }
    }
  }

  private handleQueryChange(event: Event) {
    const target = event.target as HTMLElement;
    const newText = target.textContent || '';
    
    // Only update if text actually changed to avoid unnecessary updates
    if (this.queryText !== newText) {
      const oldText = this.queryText;
      this.queryText = newText;
      this.updateCursorPosition();
      
      // Only reset dismissed state if text was actually added (not deleted)
      // This prevents suggestions from reappearing when deleting text after escape
      if (newText.length > oldText.length) {
        this.suggestionsDismissed = false;
      }
      
      // Trigger suggestion checking for SyndrQL tab
      if (this.activeTab === 'syndrql') {
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
        case 'Enter':
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
    this.showSuggestions = false;
    this.suggestions = [];
    // Note: We don't set suggestionsDismissed here as this might be called
    // for other reasons (like no matches found)
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
      // Simple approach: use execCommand which preserves DOM structure
      // This is deprecated but still works and is much safer
      if (document.queryCommandSupported && document.queryCommandSupported('insertText')) {
        // First, select the partial word if there is one
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
        
        // Use execCommand to insert the text (preserves DOM structure)
        document.execCommand('insertText', false, insertText);
        
      } else {
        // Fallback: manual insertion
        const textNode = document.createTextNode(insertText);
        range.insertNode(textNode);
        
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
      
      // Ultimate fallback: just append the text
      const textNode = document.createTextNode(insertText);
      range.insertNode(textNode);
      
      const newRange = document.createRange();
      newRange.setStartAfter(textNode);
      newRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(newRange);
      
      this.queryText = this.editorRef.textContent || '';
    }
    
    // Hide suggestions and reset state
    this.hideSuggestions();
    this.suggestionsDismissed = false;
    
    // Focus the editor
    this.editorRef.focus();
    
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

  private handleTabClick(tab: 'syndrql' | 'graphql') {
    if (this.activeTab !== tab) {
      this.activeTab = tab;
      
      // Update editor reference when tab changes
      setTimeout(() => {
        const editorSelector = tab === 'syndrql' 
          ? '.custom-editor[data-placeholder*="SyndrQL"]'
          : '.custom-editor[data-placeholder*="GraphQL"]';
        
        const editor = this.shadowRoot?.querySelector(editorSelector) as HTMLElement;
        if (editor) {
          this.editorRef = editor;
          // Ensure editor has current content
          if (editor.textContent !== this.queryText) {
            editor.textContent = this.queryText;
          }
          // Focus the new editor
          editor.focus();
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

  render() {
    return html`
      <div class="h-full flex flex-col relative">
        <!-- Tab Content -->
        <div class="flex-1 relative">
          <div class="h-full absolute inset-0 p-4 ${this.activeTab === 'syndrql' ? 'visible z-10' : 'invisible z-0'}">
            <div 
              class="custom-editor w-full h-full font-mono resize-none"
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
          </div>
          <div class="h-full absolute inset-0 p-4 ${this.activeTab === 'graphql' ? 'visible z-10' : 'invisible z-0'}">
            <div 
              class="custom-editor w-full h-full font-mono resize-none"
              contenteditable="true"
              data-placeholder="Enter your GraphQL query..."
              @input=${this.handleQueryChange}
            ></div>
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
        </div>
          </button>
        </div>
      </div>
    `;
  }
}