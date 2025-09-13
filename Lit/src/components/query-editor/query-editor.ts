import { html, css, LitElement } from 'lit';
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
     
      <div class="tabs tabs-lift tabs-bottom">
        <label class="tab">
          <span><i class="fa-solid fa-database"></i> SyndrQL</span>
          <input type="radio" name="my_tabs_5" class="tab" aria-label="SyndrQL Editor" ?checked=${this.activeTab === 'syndrql'}
            @change=${() => this.handleTabChange('syndrql')} />
        </label>
        <div class="tab-content bg-base-100 border-base-300 p-6">
         <textarea 
            class="textarea textarea-bordered w-full h-64 font-mono"
            placeholder="Enter your SyndrQL query..."
            .value=${this.queryText}
            @input=${this.handleQueryChange}
          ></textarea>
        </div>
        <label class="tab">
          <span><i class="fa-solid fa-diagram-project"></i> GraphQL</span>
          <input type="radio" name="my_tabs_5" class="tab" aria-label="GraphQL Editor" ?checked=${this.activeTab === 'graphql'}
            @change=${() => this.handleTabChange('graphql')} />
        </label>
        <div class="tab-content bg-base-100 border-base-300 p-6">
         <textarea 
            class="textarea textarea-bordered w-full h-64 font-mono"
            placeholder="Enter your GraphQL query..."
            .value=${this.queryText}
            @input=${this.handleQueryChange}
          ></textarea>
        </div>
      </div>
      `;
}
}