import { html, css, LitElement } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { Suggestion } from '../syndrQL-language-service/syndrql-tokenizer';

@customElement('suggestion-dropdown')
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

  @state()
  private selectedIndex: number = 0;

  constructor() {
    super();
    this.addEventListener('keydown', this.handleKeyDown);
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('keydown', this.handleGlobalKeyDown);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this.handleGlobalKeyDown);
  }

  updated(changedProperties: any) {
    super.updated(changedProperties);
    
    // Reset selected index when suggestions change
    if (changedProperties.has('suggestions') && this.suggestions.length > 0) {
      this.selectedIndex = 0;
    }

    // Focus the dropdown when it becomes visible
    if (changedProperties.has('visible') && this.visible) {
      // Don't focus the dropdown - let the textarea keep focus
      // const dropdown = this.querySelector('.suggestion-dropdown') as HTMLElement;
      // if (dropdown) {
      //   dropdown.focus();
      // }
    }
  }

  private handleGlobalKeyDown = (event: KeyboardEvent) => {
    if (!this.visible) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.selectedIndex = Math.min(this.selectedIndex + 1, this.suggestions.length - 1);
        this.requestUpdate();
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        this.requestUpdate();
        break;
      case 'Tab':
      case 'Enter':
        event.preventDefault();
        this.selectSuggestion(this.selectedIndex);
        break;
      case 'Escape':
        event.preventDefault();
        this.hide();
        break;
    }
  };

  private handleKeyDown = (event: KeyboardEvent) => {
    // Handle keyboard events when dropdown has focus
    this.handleGlobalKeyDown(event);
  };

  private selectSuggestion(index: number) {
    if (index >= 0 && index < this.suggestions.length) {
      const suggestion = this.suggestions[index];
      
      // Emit a custom event with the selected suggestion
      this.dispatchEvent(new CustomEvent('suggestion-selected', {
        detail: {
          suggestion: suggestion,
          insertText: suggestion.insertText || suggestion.value
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
        ${this.suggestions.map((suggestion, index) => html`
          <div 
            class="suggestion-item px-3 py-2 cursor-pointer hover:bg-blue-100 flex justify-between items-center ${index === this.selectedIndex ? 'bg-blue-50 border-l-2 border-blue-500' : ''}"
            @click=${() => this.handleSuggestionClick(index)}
            @mouseenter=${() => { this.selectedIndex = index; this.requestUpdate(); }}
          >
            <div class="flex flex-col">
              <span class="suggestion-value font-mono text-sm font-semibold text-gray-800">${suggestion.value}</span>
              ${suggestion.description ? html`<span class="suggestion-description text-xs text-gray-600">${suggestion.description}</span>` : ''}
            </div>
            <div class="flex flex-col items-end">
              ${suggestion.category ? html`<span class="suggestion-category text-xs px-2 py-1 bg-gray-100 rounded text-gray-600">${suggestion.category}</span>` : ''}
              ${suggestion.kind ? html`<span class="suggestion-kind text-xs text-gray-500 mt-1">${suggestion.kind}</span>` : ''}
            </div>
          </div>
        `)}
      </div>
    `;
  }
}