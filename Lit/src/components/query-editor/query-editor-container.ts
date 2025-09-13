import { html, css, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { queryContext, QueryContextValue } from './queryContext';
import { consume, provide } from '@lit/context';
import { QueryResult } from '../../drivers/syndrdb-driver';
import { connectionManager } from '../../services/connection-manager';
import { ConnectionContext, connectionContext } from '../../context/connectionContext';
import { Connect } from 'vite';

@customElement('query-editor-container')
export class QueryEditorContainer extends LitElement {
 
@property({ type: Boolean }) 
public isActive: boolean = false;

@property({ type: String })
public tabName: string = 'Query Editor';

@consume({ context: connectionContext })
  @state() connectionCtxt?: ConnectionContext;

@provide({context: queryContext})
  get queryContextProvider(): QueryContextValue {
    return {
      selectedConnectionId: this._selectedConnectionId,
      setSelectedConnectionId: (id) => {
        this._selectedConnectionId = id;
        this.requestUpdate();
      },
      query: this.query,
      setQuery: (query) => {
        this.query = query;
        this.requestUpdate();
      },
    };
  }

    @state()
    private _selectedConnectionId: string | null = this.connectionCtxt?.selectedConnectionId || null;

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

  
// Disable Shadow DOM to allow global Tailwind CSS
  createRenderRoot() {
    return this;
  }

  render() {

    const connection = connectionManager.getConnection(this._selectedConnectionId || '');
console.log('The tab is active:', this.isActive);
      return html`
        <label class="tab ${this.isActive ? 'bg-base-100' : ''}">
          <input type="radio" name="editors" ${this.isActive ? ' checked="checked" ' : ''} />
          ${connection?.name || `${this.tabName} - Disconnected`}
        </label>
        <div class="tab-content bg-base-100 border-base-300 p-0 h-full flex flex-col">

            <!-- Query Editor (Top Half) -->
            <div class="flex-1 border-b border-base-300 min-h-0 h-1/2">
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
                <query-editor .activeTab='syndrql' .queryText=${this.query} @query-changed=${this.handleQueryChange}></query-editor>

                </div>
            </div>
            </div>
            
            <!-- JSON Results (Bottom Half) -->
            <div class="flex-1 overflow-auto min-h-0 h-1/2">
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