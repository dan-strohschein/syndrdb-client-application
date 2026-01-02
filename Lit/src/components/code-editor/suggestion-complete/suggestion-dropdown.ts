import { html, css, LitElement } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { Suggestion } from '../syndrQL-language-serviceV2/suggestion-engine';

@customElement('code-editor-suggestion-dropdown')
export class SuggestionDropdown extends LitElement {
  // Disable Shadow DOM to allow global Tailwind CSS
  createRenderRoot() {
    return this;
  }

  @property({ type: Array })
  public suggestions: Suggestion[] = [];

  @property({ type: Boolean })
  public visible: boolean = false;

  @property({ type: Number })
  public x: number = 0;

  @property({ type: Number })
  public y: number = 0;

  @property({ type: Number })
  public selectedIndex: number = 0;

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
  }

  updated(changedProperties: any) {
    super.updated(changedProperties);
    
    // Parent component now controls selectedIndex
    // No need to reset it here
  }

  // Arrow key navigation is now handled by parent CodeEditor component
  // This dropdown only handles mouse interactions

  private selectSuggestion(index: number) {
    if (index >= 0 && index < this.suggestions.length) {
      const suggestion = this.suggestions[index];
      
      // Support both V1 and V2 suggestion formats
      const insertText = (suggestion as any).insertText || (suggestion as any).value || (suggestion as any).label || '';
      
      // Emit a custom event with the selected suggestion
      this.dispatchEvent(new CustomEvent('suggestion-selected', {
        detail: {
          suggestion: suggestion,
          insertText: insertText
        },
        bubbles: true,
        composed: true
      }));
      
      this.hide();
    }
  }

  private handleSuggestionClick(index: number) {
    this.selectSuggestion(index);
  }

  private handleSuggestionHover(index: number) {
    // Emit event to parent to update selected index
    this.dispatchEvent(new CustomEvent('suggestion-hover', {
      detail: { index },
      bubbles: true,
      composed: true
    }));
  }

  public show(x: number, y: number, suggestions: Suggestion[]) {
    this.x = x;
    this.y = y;
    this.suggestions = suggestions;
    this.selectedIndex = 0;
    this.visible = true;
    this.requestUpdate();
  }

  public hide() {
    this.visible = false;
    this.suggestions = [];
    this.selectedIndex = 0;
    this.requestUpdate();
    
    // Emit hide event to notify parent
    this.dispatchEvent(new CustomEvent('suggestion-dropdown-hidden', {
      bubbles: true,
      composed: true
    }));
  }

  render() {
    if (!this.visible || this.suggestions.length === 0) {
      return html``;
    }

    return html`
      <div 
        class="suggestion-dropdown absolute bg-white border border-gray-300 shadow-lg rounded-md max-h-48 overflow-y-auto"
        style="left: ${this.x}px; top: ${this.y}px; min-width: 200px; z-index:1000;"
        tabindex="-1"
        @mousedown=${(e: Event) => e.preventDefault()}
      >
        ${this.suggestions.map((suggestion, index) => {
          // Support both V1 (value) and V2 (label) suggestion formats
          const displayText = (suggestion as any).label || (suggestion as any).value || '';
          const detail = (suggestion as any).detail || (suggestion as any).description || '';
          const category = (suggestion as any).category || '';
          const kind = (suggestion as any).kind || '';
          
          return html`
            <div 
              class="suggestion-item px-3 py-2 cursor-pointer hover:bg-blue-100 flex justify-between items-center ${index === this.selectedIndex ? 'bg-blue-50 border-l-2 border-blue-500' : ''}"
              @click=${() => this.handleSuggestionClick(index)}
              @mouseenter=${() => this.handleSuggestionHover(index)}
            >
              <div class="flex flex-col">
                <span class="suggestion-value font-mono text-sm font-semibold text-gray-800">${displayText}</span>
                ${detail ? html`<span class="suggestion-description text-xs text-gray-600">${detail}</span>` : ''}
              </div>
              <div class="flex flex-col items-end">
                ${category ? html`<span class="suggestion-category text-xs px-2 py-1 bg-gray-100 rounded text-gray-600">${category}</span>` : ''}
                ${kind ? html`<span class="suggestion-kind text-xs text-gray-500 mt-1">${kind}</span>` : ''}
              </div>
            </div>
          `;
        })}
      </div>
    `;
  }
}