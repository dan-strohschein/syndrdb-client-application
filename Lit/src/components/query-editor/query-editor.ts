import { html, css, LitElement, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { SyndrQLTokenizer, Suggestion } from './syndrQL-language-service/syndrql-tokenizer';
import './suggestion-complete/suggestion-dropdown';


@customElement('query-editor')
export class QueryEditor extends LitElement {
// Disable Shadow DOM to allow global Tailwind CSS
  createRenderRoot() {
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

  private tokenizer: SyndrQLTokenizer = new SyndrQLTokenizer();
  private textareaRef: HTMLTextAreaElement | null = null;
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

  private handleQueryChange(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    this.queryText = target.value;
    this.currentCursorPosition = target.selectionStart;
    
    // Trigger suggestion checking for SyndrQL tab
    if (this.activeTab === 'syndrql') {
      this.checkForSuggestions(target);
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

  private handleKeyUp(event: KeyboardEvent) {
    const target = event.target as HTMLTextAreaElement;
    this.currentCursorPosition = target.selectionStart;
    
    // Check for suggestions on key up (for SyndrQL only)
    if (this.activeTab === 'syndrql') {
      this.checkForSuggestions(target);
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
            return;
          }
          break;
        default:
          // For other keys (typing), let them through and update suggestions
          break;
      }
    }
  }

  private checkForSuggestions(textarea: HTMLTextAreaElement) {
    try {
      const suggestions = this.tokenizer.getSuggestions(this.queryText, this.currentCursorPosition);
      
      if (suggestions && suggestions.length > 0) {
        // Calculate cursor position on screen
        const coords = this.getCursorCoordinates(textarea, this.currentCursorPosition);
        if (coords) {

          let things = textarea.getBoundingClientRect();
          let bobX = coords.x - things.left;
          let bobY = coords.y - things.top;
          console.log('Cursor coordinates:', coords, 'for position:', this.currentCursorPosition);
          console.log('Textarea rect:', textarea.getBoundingClientRect());
          this.suggestionX = bobX + 20;
          this.suggestionY = bobY + 15; // Offset below cursor line height
          this.suggestions = suggestions;
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

  private getCursorCoordinates(textarea: HTMLTextAreaElement, position: number): { x: number, y: number } | null {
    try {
      // Save current selection
      const originalStart = textarea.selectionStart;
      const originalEnd = textarea.selectionEnd;
      
      // Set cursor to the position we want to measure
      textarea.setSelectionRange(position, position);
      // Don't call focus() here to avoid stealing focus from textarea
      
      // Create a temporary span to measure text
      const span = document.createElement('span');
      span.style.visibility = 'hidden';
      span.style.position = 'absolute';
      span.style.whiteSpace = 'pre';
      span.style.font = getComputedStyle(textarea).font;
      document.body.appendChild(span);
      
      const textareaRect = textarea.getBoundingClientRect();
      const textareaStyle = getComputedStyle(textarea);
      
      // Get text before cursor and split into lines
      const beforeCursor = textarea.value.substring(0, position);
      const lines = beforeCursor.split('\n');
      const currentLine = lines[lines.length - 1];
      const lineNumber = lines.length - 1;
      
      // Calculate Y position (line height * line number + padding)
      const lineHeight = parseInt(textareaStyle.lineHeight) || parseInt(textareaStyle.fontSize) * 1.2;
      const paddingTop = parseInt(textareaStyle.paddingTop) || 0;
      const y = textareaRect.top + paddingTop + (lineNumber * lineHeight) + lineHeight;
      
      // Calculate X position (width of text before cursor on current line + padding)
      span.textContent = currentLine;
      const textWidth = span.offsetWidth;
      const paddingLeft = parseInt(textareaStyle.paddingLeft) || 0;
      const x = textareaRect.left + paddingLeft + textWidth;
      
      // Cleanup
      document.body.removeChild(span);
      
      // Restore original selection
      textarea.setSelectionRange(originalStart, originalEnd);
      
      return { x, y };
    } catch (error) {
      console.warn('Error calculating cursor position:', error);
      // Fallback: use textarea position + offset
      const rect = textarea.getBoundingClientRect();
      const style = getComputedStyle(textarea);
      const fontSize = parseInt(style.fontSize || '16');
      return { 
        x: rect.left + parseInt(style.paddingLeft || '8'), 
        y: rect.top + fontSize + parseInt(style.paddingTop || '8')
      };
    }
  }

  private hideSuggestions() {
    this.showSuggestions = false;
    this.suggestions = [];
  }

  private handleSuggestionSelected(event: CustomEvent) {
    const { insertText } = event.detail;
    
    if (this.textareaRef && insertText) {
      // Get the current input context to determine what to replace
      const textarea = this.textareaRef;
      const cursorPos = this.currentCursorPosition;
      const textBefore = this.queryText.substring(0, cursorPos);
      
      // Find the start of the current word being typed
      const match = textBefore.match(/([a-zA-Z_][a-zA-Z0-9_]*)$/);
      const currentWord = match ? match[1] : '';
      const wordStart = match ? cursorPos - currentWord.length : cursorPos;
      
      // Replace from start of current word to cursor position
      const newText = this.queryText.substring(0, wordStart) + insertText + this.queryText.substring(cursorPos);
      this.queryText = newText;
      
      // Update the textarea value and cursor position
      textarea.value = this.queryText;
      const newCursorPos = wordStart + insertText.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      this.currentCursorPosition = newCursorPos;
      
      // Hide suggestions
      this.hideSuggestions();
      
      // Focus back to textarea
      textarea.focus();
      
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
  }

  private handleSuggestionDropdownHidden() {
    this.hideSuggestions();
  }


    private handleTabChange(tab: 'syndrql' | 'graphql') {
    this.activeTab = tab;
    
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

  render() {
    return html`
      <div class="h-full flex flex-col relative">
        <!-- Tab Content -->
        <div class="flex-1 relative">
          <div class="h-full absolute inset-0 p-4 ${this.activeTab === 'syndrql' ? 'visible z-10' : 'invisible z-0'}">
            <textarea 
              class="textarea textarea-bordered w-full h-full font-mono resize-none"
              placeholder="Enter your SyndrQL query..."
              .value=${this.queryText}
              @input=${this.handleQueryChange}
              @keyup=${this.handleKeyUp}
              @keydown=${this.handleKeyDown}
              @click=${(e: Event) => {
                const target = e.target as HTMLTextAreaElement;
                this.currentCursorPosition = target.selectionStart;
                this.textareaRef = target;
              }}
              @focus=${(e: Event) => {
                this.textareaRef = e.target as HTMLTextAreaElement;
              }}
            ></textarea>
          </div>
          <div class="h-full absolute inset-0 p-4 ${this.activeTab === 'graphql' ? 'visible z-10' : 'invisible z-0'}">
            <textarea 
              class="textarea textarea-bordered w-full h-full font-mono resize-none"
              placeholder="Enter your GraphQL query..."
              .value=${this.queryText}
              @input=${this.handleQueryChange}
            ></textarea>
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
            @click=${() => this.handleTabChange('syndrql')}
          >
            <i class="fa-solid fa-database mr-1"></i>SyndrQL
          </button>
          <button 
            class="px-3 py-2 border-t-2 font-medium text-xs transition-colors duration-200 ${
              this.activeTab === 'graphql' 
                ? 'border-primary text-base-content bg-base-100' 
                : 'border-transparent text-base-content opacity-30 hover:text-base-content hover:opacity-100 hover:bg-base-100'
            }"
            @click=${() => this.handleTabChange('graphql')}
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