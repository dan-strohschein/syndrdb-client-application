import { html, css, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { connectionManager } from '../services/connection-manager';
import { QueryResult } from '../drivers/syndrdb-driver';

@customElement('main-panel')
export class MainPanel extends LitElement {
  // Disable Shadow DOM to allow global Tailwind CSS
  createRenderRoot() {
    return this;
  }

  @state()
  private query = '';

  @state()
  private queryResult: QueryResult | null = null;

  @state()
  private executing = false;

  private async executeQuery() {
    if (!this.query.trim()) {
      return;
    }

    this.executing = true;
    
    try {
      const result = await connectionManager.executeQuery(this.query);
      this.queryResult = result;
    } catch (error) {
      console.error('Query execution failed:', error);
      this.queryResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: 0
      };
    }

    this.executing = false;
  }

  private saveQuery() {
    // TODO: Implement query saving functionality
    console.log('Saving query:', this.query);
  }

  private handleQueryChange(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    this.query = target.value;
  }

  render() {
    return html`
      <div class="h-full flex flex-col">
        <!-- Toolbar -->
        <div class="p-4 border-b border-base-300 bg-base-200">
          <div class="flex items-center justify-between">
            <span class="text-sm text-base-content/70">SyndrDB Query Interface</span>
          </div>
        </div>
        
        <!-- Query Editor (Top Half) -->
        <div class="h-1/2 border-b border-base-300">
          <div class="h-full p-4 flex flex-col">
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-sm font-semibold text-base-content">Query Editor</h3>
              <div class="flex items-center space-x-2">
                <!-- Execute Query Button (Play Icon) -->
                <button 
                  class="btn btn-primary btn-sm ${this.executing ? 'loading' : ''}" 
                  title="Execute Query"
                  @click=${this.executeQuery}
                  ?disabled=${this.executing}
                >
                  ${!this.executing ? html`
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  ` : ''}
                </button>
                <!-- Save Button (Disk Icon) -->
                <button 
                  class="btn btn-secondary btn-sm" 
                  title="Save Query"
                  @click=${this.saveQuery}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 0V4a1 1 0 00-1-1H9a1 1 0 00-1 1v3M8 7h8" />
                  </svg>
                </button>
              </div>
            </div>
            <div class="flex-1 bg-base-100 rounded border border-base-300">
              <textarea 
                class="textarea w-full h-full resize-none font-mono text-sm bg-transparent border-0 focus:outline-none"
                placeholder="# Enter your SyndrDB query here&#10;&#10;find: { collection: 'users' }&#10;filter: { age: { $gt: 18 } }&#10;limit: 10&#10;&#10;# Example queries:&#10;# find: { collection: 'orders', filter: { status: 'active' } }&#10;# aggregate: { collection: 'products', pipeline: [...] }&#10;# insert: { collection: 'customers', document: {...} }"
                .value=${this.query}
                @input=${this.handleQueryChange}
              ></textarea>
            </div>
          </div>
        </div>
        
        <!-- JSON Results (Bottom Half) -->
        <div class="h-1/2 overflow-auto">
          <div class="p-4 h-full flex flex-col">
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-sm font-semibold text-base-content">Query Results</h3>
              <div class="flex items-center space-x-2">
                ${this.queryResult ? html`
                  <span class="badge ${this.queryResult.success ? 'badge-success' : 'badge-error'} badge-sm">
                    ${this.queryResult.success ? 
                      `${this.queryResult.documentCount || this.queryResult.data?.length || 0} documents` : 
                      'Error'
                    }
                  </span>
                  ${this.queryResult.executionTime ? html`
                    <span class="text-xs text-base-content/70">Execution time: ${this.queryResult.executionTime}ms</span>
                  ` : ''}
                ` : html`
                  <span class="text-xs text-base-content/70">No query executed</span>
                `}
              </div>
            </div>
            
                        <div class="flex-1 bg-base-100 rounded border border-base-300 p-4 overflow-auto">
              ${this.queryResult ? html`
                ${this.queryResult.success ? html`
                  <pre class="text-sm font-mono text-base-content whitespace-pre-wrap"><code>${JSON.stringify(this.queryResult.data, null, 2)}</code></pre>
                ` : html`
                  <div class="text-error">
                    <div class="font-semibold mb-2">Query Error:</div>
                    <div class="text-sm">${this.queryResult.error}</div>
                  </div>
                `}
              ` : html`
                <div class="text-center text-base-content/50 py-8">
                  <div class="text-4xl mb-2">📊</div>
                  <div>Query results will appear here</div>
                  <div class="text-sm mt-1">Execute a query to see results</div>
                </div>
              `}
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'main-panel': MainPanel;
  }
}
