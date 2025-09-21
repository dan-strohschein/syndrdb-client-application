import { html, css, LitElement, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { queryContext, QueryContextValue } from './queryContext';
import { consume, provide } from '@lit/context';
import { QueryResult } from '../../drivers/syndrdb-driver';
import { connectionManager } from '../../services/connection-manager';
import { ConnectionContext, connectionContext } from '../../context/connectionContext';
import { Connect } from 'vite';
import { ElectronAPI } from '../../types/electron-api';

@customElement('query-editor-container')
export class QueryEditorContainer extends LitElement {
 
@property({ type: Boolean }) 
public isActive: boolean = false;

@property({ type: String })
public tabName: string = 'Query Editor';

@property({ type: String })
public initialQuery: string = '';

@property({ type: String })
public databaseName: string = '';

@property({ type: String })
public connectionId: string = '';

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
    
    // Initialize query with initialQuery value
    firstUpdated() {
        if (this.initialQuery) {
            this.query = this.initialQuery;
        }
        
        // Set connection context if connectionId is provided
        if (this.connectionId) {
            this._selectedConnectionId = this.connectionId;
        }
        
        this.requestUpdate();
    }
    
    // Handle property changes, especially when tab becomes active
    updated(changedProperties: PropertyValues) {
        super.updated(changedProperties);
        
        // If the tab just became active, force child components to recalculate
        if (changedProperties.has('isActive') && this.isActive) {
            // Small delay to ensure DOM is updated
            setTimeout(() => {
                // Trigger a resize event to help child components recalculate dimensions
                window.dispatchEvent(new Event('resize'));
                this.requestUpdate();
            }, 0);
        }
    }
    
    
    
    
    
    private async executeQuery() {
        if (!this.query || !this.query.trim()) {
            console.warn('No query to execute');
            return;
        }

        this.executing = true;
        
        try {
            let result: QueryResult;
            
            // If we have a connectionId and databaseName, use context-aware execution
            if (this.connectionId && this.databaseName) {
                // Set database context first if needed
                await connectionManager.setDatabaseContext(this.connectionId, this.databaseName);
                // Execute with context
                result = await connectionManager.executeQueryWithContext(this.connectionId, this.query);
            } else if (this.connectionId) {
                // Execute on specific connection without database context
                result = await connectionManager.executeQueryOnConnectionId(this.connectionId, this.query);
            } else {
                // Fallback to general execute method
                result = await connectionManager.executeQuery(this.query);
            }
            
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

        private async saveQuery() {
        // TODO: Implement query saving functionality
            console.log('Saving query:', this.query);


            const electronAPI = window.electronAPI as ElectronAPI;
            if (!electronAPI?.fileDialog) {
                console.warn('File dialog API not available');
                return;
            }

            const result = await electronAPI.fileDialog.showSaveDialog({
                title: "Save Results",
                filters: [
                    { name: 'JSON Files', extensions: ['json'] },
                    { name: 'All Files', extensions: ['*'] }
                ]
            });
    

if (!result.canceled && result.filePath) {
            this.dispatchEvent(new CustomEvent('file-save-requested', {
                detail: { 
                    panelType: 'query-editor',
                    title: "Save Query",
                    filePath: "./saved_query.sql"
                },
                bubbles: true,
                composed: true
        }));
        }
    }

    private handleQueryChange(event: CustomEvent) {
        const { query } = event.detail;
        this.query = query;
        
        // Emit query state change for main panel to track
        this.dispatchEvent(new CustomEvent('query-state-changed', {
            detail: { queryText: query },
            bubbles: true,
            composed: true
        }));
    }

    private async handleSaveResults() {
        
        try {
            // Check if electronAPI is available
            const electronAPI = window.electronAPI as ElectronAPI;
            if (!electronAPI?.fileDialog) {
                console.warn('File dialog API not available');
                return;
            }

            const result = await electronAPI.fileDialog.showSaveDialog({
                title: "Save Results",
                filters: [
                    { name: 'JSON Files', extensions: ['json'] },
                    { name: 'All Files', extensions: ['*'] }
                ]
            });
    
            if (!result.canceled && result.filePath) {
                console.log('File selected for saving:', result.filePath);
                
                // Emit event with the selected file path
                this.dispatchEvent(new CustomEvent('file-save-requested', {
                    detail: { 
                        panelType: "save-results",
                        title: "Save Results",
                        filePath: "./saved_results.json"
                    },
                    bubbles: true,
                    composed: true
                }));
            }
        } catch (error) {
            console.error('Error opening save dialog:', error);
        }
        
        
    }
  
// Disable Shadow DOM to allow global Tailwind CSS
  createRenderRoot() {
    return this;
  }

  render() {
    const connection = connectionManager.getConnection(this._selectedConnectionId || '');
    
    return html`
      <div class="h-full flex flex-col">
        <!-- Query Editor (Top Half) -->
        <div class="flex-1 border-b border-base-300 min-h-0 h-1/2">
          <div class="h-full p-4 flex flex-col">
            <div class="flex items-center justify-between mb-3">
              <div class="flex flex-col">
                <h3 class="text-sm font-semibold text-base-content">Query Editor</h3>
                ${this.databaseName ? html`
                  <div class="text-xs text-base-content opacity-70 flex items-center mt-1">
                    <i class="fa-solid fa-database mr-1"></i>
                    <span>Database: <span class="font-medium">${this.databaseName}</span></span>
                  </div>
                ` : ''}
              </div>
              <div class="flex items-center space-x-2">
                <!-- Execute Query Button (Play Icon) -->
                <button 
                  class="btn btn-soft btn-primary btn-sm ${this.executing ? 'loading' : ''}" 
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
                  class="btn btn-soft btn-secondary btn-sm" 
                  title="Save Query"
                  @click=${this.saveQuery}
                >
                  <span class="cursor-pointer"><i class="fa-solid fa-floppy-disk"></i> </span>
              
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
              <h3 class="text-sm font-semibold text-base-content">
                Query Results
                <button class="btn btn-soft btn-secondary btn-sm" 
                @click=${this.handleSaveResults}
                title="Save Results To File">
                  <i class="fa-solid fa-floppy-disk"></i> 
                </button>
              </h3>
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