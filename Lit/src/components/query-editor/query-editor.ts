import { html, css, LitElement, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';


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
      <div class="h-full flex flex-col">
        <!-- Tab Content -->
        <div class="flex-1 relative">
          <div class="h-full absolute inset-0 p-4 ${this.activeTab === 'syndrql' ? 'visible z-10' : 'invisible z-0'}">
            <textarea 
              class="textarea textarea-bordered w-full h-full font-mono resize-none"
              placeholder="Enter your SyndrQL query..."
              .value=${this.queryText}
              @input=${this.handleQueryChange}
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