import { html, css, LitElement, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { queryContext, QueryContextValue } from './queryContext';
import { consume, provide } from '@lit/context';
import { QueryResult } from '../../drivers/syndrdb-driver';
import { connectionManager } from '../../services/connection-manager';
import { ConnectionContext, connectionContext } from '../../context/connectionContext';
import { Connect } from 'vite';
import { ElectronAPI } from '../../types/electron-api';
import { LanguageServiceV2, ParsedStatement } from '../code-editor/syndrQL-language-serviceV2/index';
import { GraphQLLanguageService } from '../code-editor/graphql-language-service/index';
import { DEFAULT_CONFIG } from '../../config/config-types';
import { queryHistoryService } from '../../services/query-history-service';
import '../json-tree-view/json-tree-view';

@customElement('query-editor-frame')
export class QueryEditorFrame extends LitElement {
 
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

  private _queryContextProvider: QueryContextValue;

  @provide({context: queryContext})
  get queryContextProvider(): QueryContextValue {
    return this._queryContextProvider;
  }

    @state()
    private _selectedConnectionId: string | null = this.connectionCtxt?.selectedConnectionId || null;

    @state()
    private query = '';

    @state()
    private queryResult: QueryResult | null = null;

    /** Active results view: 'text' (default) or 'json' (tree). */
    @state()
    private resultsTab: 'text' | 'json' = 'text';

    @state()
    private executing = false;

    @state()
    private resultAnimating = false;

    @state()
    private executionStartTime: number | null = null;

    @state()
    private elapsedDisplay = '';

    @state()
    private resultHistory: Array<{query: string, result: QueryResult, timestamp: number}> = [];

    @state()
    private selectedHistoryIndex = -1;

    private elapsedTimerFrame: number | null = null;

    private _abortController: AbortController | null = null;

    /** Which editor tab is currently active (tracked via tab-changed event). */
    @state()
    private activeQueryTab: 'syndrql' | 'graphql' = 'syndrql';

    private languageService: LanguageServiceV2;
    private graphqlLanguageService: GraphQLLanguageService;

    constructor() {
        super();
        // Initialize language services
        this.languageService = new LanguageServiceV2(DEFAULT_CONFIG);
        this.languageService.initialize();
        this.graphqlLanguageService = new GraphQLLanguageService();
        this.graphqlLanguageService.initialize();
        
        // Initialize context provider once
        this._queryContextProvider = {
            selectedConnectionId: this._selectedConnectionId,
            setSelectedConnectionId: (id) => {
                this._selectedConnectionId = id;
                this._queryContextProvider.selectedConnectionId = id;
            },
            query: this.query,
            setQuery: (query) => {
                this.query = query;
                this._queryContextProvider.query = query;
            },
        };
    }

  private _initialized = false;

  willUpdate(changedProperties: PropertyValues) {
        // Initialize properties only once when they first arrive
        if (!this._initialized && (this.initialQuery || this.connectionId)) {
            if (this.initialQuery) {
                this.query = this.initialQuery;
            }

            if (this.connectionId) {
                this._selectedConnectionId = this.connectionId;
            }

            this._initialized = true;
        }

        // Handle connectionId being remapped after initialization (e.g. on restart)
        if (this._initialized && changedProperties.has('connectionId') && this.connectionId) {
            const currentConn = connectionManager.getConnection(this._selectedConnectionId || '');
            if (!currentConn) {
                this._selectedConnectionId = this.connectionId;
            }
        }

        // Update context provider when relevant state changes
        if (changedProperties.has('_selectedConnectionId')) {
            this._queryContextProvider.selectedConnectionId = this._selectedConnectionId;
        }
        if (changedProperties.has('query')) {
            this._queryContextProvider.query = this.query;
        }
    }
    
    // Detect platform for shortcut display
    private get modKey(): string {
        return navigator.platform?.includes('Mac') ? '\u2318' : 'Ctrl';
    }

    // Initialize query with initialQuery value
    firstUpdated() {
        // Initialization now handled in willUpdate to prevent cascading updates
        // No state changes needed here
    }

    connectedCallback() {
        super.connectedCallback();
        // Listen for Ctrl+Enter from code editor
        this.addEventListener('execute-query-requested', this._onExecuteRequested as EventListener);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.removeEventListener('execute-query-requested', this._onExecuteRequested as EventListener);
    }

    private _onExecuteRequested = () => {
        this.executeQuery();
    };

    private startElapsedTimer() {
        this.executionStartTime = Date.now();
        this.elapsedDisplay = '0.0s';
        const tick = () => {
            if (!this.executionStartTime) return;
            const elapsed = (Date.now() - this.executionStartTime) / 1000;
            this.elapsedDisplay = `${elapsed.toFixed(1)}s`;
            this.elapsedTimerFrame = requestAnimationFrame(tick);
        };
        this.elapsedTimerFrame = requestAnimationFrame(tick);
    }

    private stopElapsedTimer() {
        if (this.elapsedTimerFrame != null) {
            cancelAnimationFrame(this.elapsedTimerFrame);
            this.elapsedTimerFrame = null;
        }
        this.executionStartTime = null;
    }

    private cancelExecution() {
        if (this._abortController) {
            this._abortController.abort();
            this._abortController = null;
        }
        this.stopElapsedTimer();
        this.executing = false;
        import('../toast-notification').then(({ ToastNotification }) => {
            ToastNotification.warning('Query execution cancelled');
        });
    }

    private pushResultHistory(query: string, result: QueryResult) {
        this.resultHistory = [
            { query, result, timestamp: Date.now() },
            ...this.resultHistory.slice(0, 9),
        ];
        this.selectedHistoryIndex = -1;
    }

    private selectHistoryEntry(index: number) {
        this.selectedHistoryIndex = index;
        if (index >= 0 && index < this.resultHistory.length) {
            this.queryResult = this.resultHistory[index].result;
            this.resultAnimating = true;
            setTimeout(() => { this.resultAnimating = false; }, 200);
        }
    }

    private async copyResultToClipboard(doc: unknown) {
        try {
            await navigator.clipboard.writeText(JSON.stringify(doc, null, 2));
            import('../toast-notification').then(({ ToastNotification }) => {
                ToastNotification.success('Result copied to clipboard');
            });
        } catch {
            console.error('Failed to copy to clipboard');
        }
    }

    /**
     * Copy all results as tab-separated values with column headers.
     */
    private async copyResultsWithHeaders() {
        if (!this.queryResult?.data || !Array.isArray(this.queryResult.data)) return;

        const docs = this.queryResult.data as Record<string, unknown>[];
        if (docs.length === 0) return;

        // Collect all unique keys across all documents
        const headerSet = new Set<string>();
        for (const doc of docs) {
            for (const key of Object.keys(doc)) {
                headerSet.add(key);
            }
        }
        const headers = Array.from(headerSet);

        // Build TSV: header row + data rows
        const rows: string[] = [];
        rows.push(headers.join('\t'));
        for (const doc of docs) {
            const values = headers.map(h => {
                const val = doc[h];
                if (val === undefined || val === null) return '';
                if (typeof val === 'object') return JSON.stringify(val);
                return String(val);
            });
            rows.push(values.join('\t'));
        }

        try {
            await navigator.clipboard.writeText(rows.join('\n'));
            import('../toast-notification').then(({ ToastNotification }) => {
                ToastNotification.success(`Copied ${docs.length} rows with headers`);
            });
        } catch {
            console.error('Failed to copy results with headers');
        }
    }

    // Handle property changes, especially when tab becomes active
    updated(changedProperties: PropertyValues) {
        super.updated(changedProperties);
        
        // If the tab just became active, dispatch resize event to help child components
        if (changedProperties.has('isActive') && this.isActive) {
            // Use requestAnimationFrame instead of setTimeout for better performance
            requestAnimationFrame(() => {
                // Trigger a resize event to help child components recalculate dimensions
                window.dispatchEvent(new Event('resize'));
                // No requestUpdate needed - this is after the update cycle
            });
        }
    }
    
    
    
    
    
    private async executeQuery() {
        // Prevent double execution
        if (this.executing) {
            console.warn('Query already executing, skipping duplicate request');
            return;
        }

        // Get the query text from the correct code editor based on active tab
        const queryEditorContainer = this.querySelector('query-editor-tab-container') as any;
        const editorSelector = this.activeQueryTab === 'graphql'
            ? '#graphql-editor code-editor'
            : '#syndrql-editor code-editor';
        const codeEditor = queryEditorContainer?.querySelector(editorSelector) as any;

        if (codeEditor && codeEditor.getText) {
            this.query = codeEditor.getText();
        }

        if (!this.query || !this.query.trim()) {
            console.warn('No query to execute');
            return;
        }

        this.executing = true;
        this.dispatchEvent(new CustomEvent('query-executing', {
          detail: { executing: true },
          bubbles: true,
        }));
        this._abortController = new AbortController();
        this.startElapsedTimer();

        try {
            if (this.activeQueryTab === 'graphql') {
                await this.executeGraphQLQuery();
            } else {
                await this.executeSyndrQLQuery();
            }

            this.stopElapsedTimer();

            // Trigger slide-in animation on new results
            this.resultAnimating = true;
            setTimeout(() => { this.resultAnimating = false; }, 200);

            // Push to result history (local + persistent)
            if (this.queryResult) {
                this.pushResultHistory(this.query, this.queryResult);
                queryHistoryService.addEntry(
                    this.query,
                    this.connectionId || null,
                    this.databaseName || null,
                    this.queryResult.success ?? false,
                    this.queryResult.documentCount || this.queryResult.data?.length || 0,
                    this.queryResult.executionTime || 0,
                );
            }

            // Dispatch query-executed event to update status bar
            if (this.queryResult) {
                this.dispatchEvent(new CustomEvent('query-executed', {
                    detail: {
                        executionTime: this.queryResult.executionTime || 0,
                        ResultCount: this.queryResult.ResultCount || 0,
                        success: this.queryResult.success
                    },
                    bubbles: true
                }));
            }
        } catch (error) {
            this.stopElapsedTimer();
            console.error('Query execution failed:', error);
            this.queryResult = {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                executionTime: 0
            };
        }

        this.executing = false;
        this.dispatchEvent(new CustomEvent('query-executing', {
          detail: { executing: false },
          bubbles: true,
        }));
    }

    /**
     * Execute a SyndrQL query — validate, parse statements, execute sequentially.
     */
    private async executeSyndrQLQuery(): Promise<void> {
        await this.languageService.initialize();
        console.log('Validating SyndrQL query with V2:', this.query);
        const validationResult = await this.languageService.validate(this.query);

        if (!validationResult.valid) {
            const errorMessages = validationResult.errors.map(e => e.message).join(', ');
            throw new Error(`Query validation failed: ${errorMessages}`);
        }

        const statements = this.languageService.parseStatements(this.query);

        if (statements.length === 0) {
            throw new Error('No valid statements found in query');
        }

        console.log(`Found ${statements.length} statement(s) to execute:`, statements.map((s: ParsedStatement) => s.text));

        let finalResult: QueryResult | null = null;
        const allResults: QueryResult[] = [];

        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i].text;
            console.log(`Executing statement ${i + 1}/${statements.length}:`, statement);

            let result: QueryResult;

            if (this.connectionId && this.databaseName) {
                await connectionManager.setDatabaseContext(this.connectionId, this.databaseName);
                result = await connectionManager.executeQueryWithContext(this.connectionId, statement);
            } else if (this.connectionId) {
                result = await connectionManager.executeQueryOnConnectionId(this.connectionId, statement);
            } else {
                result = await connectionManager.executeQuery(statement);
            }

            allResults.push(result);
            finalResult = result;

            if (!result.success) {
                throw new Error(`Statement ${i + 1} failed: ${result.error}`);
            }

            console.log(`Statement ${i + 1} completed successfully`);
        }

        if (statements.length > 1) {
            const totalExecutionTime = allResults.reduce((sum, r) => sum + (r.executionTime || 0), 0);
            const totalDocumentCount = allResults.reduce((sum, r) => sum + (r.documentCount || 0), 0);

            this.queryResult = {
                success: true,
                data: finalResult?.data,
                executionTime: totalExecutionTime,
                documentCount: totalDocumentCount,
                ResultCount: finalResult?.ResultCount
            };
        } else {
            this.queryResult = finalResult;
        }

        console.log('All statements executed successfully');
    }

    /**
     * Execute a GraphQL query — validate, prefix with `GraphQL::`, send as a single call.
     */
    private async executeGraphQLQuery(): Promise<void> {
        await this.graphqlLanguageService.initialize();
        console.log('Validating GraphQL query:', this.query);
        const validationResult = await this.graphqlLanguageService.validate(this.query);

        if (!validationResult.valid) {
            const errorMessages = validationResult.errors.map(e => e.message).join(', ');
            throw new Error(`GraphQL validation failed: ${errorMessages}`);
        }

        // Prefix with GRAPHQL:: and send as a single execution call
        const prefixedQuery = `GRAPHQL::${this.query}`;
        console.log('Executing GraphQL query:', prefixedQuery);
        console.log('GraphQL exec context — connectionId:', this.connectionId, 'databaseName:', this.databaseName);

        let result: QueryResult;

        if (this.connectionId && this.databaseName) {
            console.log('GraphQL: using executeQueryWithContext');
            await connectionManager.setDatabaseContext(this.connectionId, this.databaseName);
            result = await connectionManager.executeQueryWithContext(this.connectionId, prefixedQuery);
        } else if (this.connectionId) {
            console.log('GraphQL: using executeQueryOnConnectionId');
            result = await connectionManager.executeQueryOnConnectionId(this.connectionId, prefixedQuery);
        } else {
            console.log('GraphQL: using executeQuery (active connection fallback)');
            result = await connectionManager.executeQuery(prefixedQuery);
        }

        console.log('GraphQL result:', result);

        if (!result.success) {
            throw new Error(`GraphQL execution failed: ${result.error}`);
        }

        this.queryResult = result;
        console.log('GraphQL query executed successfully');
    }        private async saveQuery() {
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

    private handleTabChanged(event: CustomEvent) {
        const { activeTab } = event.detail;
        this.activeQueryTab = activeTab;
    }

    /**
     * Handle user selecting a connection from the breadcrumb dropdown
     */
    private _onConnectionSelected(e: Event) {
        const select = e.target as HTMLSelectElement;
        const newConnectionId = select.value;
        if (!newConnectionId) return;

        const conn = connectionManager.getConnection(newConnectionId);
        if (!conn) return;

        this._selectedConnectionId = newConnectionId;
        this.connectionId = newConnectionId;

        // Notify parent to persist the new connectionId/name
        this.dispatchEvent(new CustomEvent('tab-connection-changed', {
            detail: { connectionId: newConnectionId, connectionName: conn.name },
            bubbles: true,
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
    const serverName = connection?.name || 'No Connection';
    const availableConnections = connectionManager.getConnections();

    return html`
      <div class="h-full flex flex-col ${this.isActive ? 'syndrql-active-tab' : ''}">
        <!-- Breadcrumb Context Indicator -->
        <div class="text-xs text-feedback-muted px-3 py-1 border-b border-db-border bg-surface-1 flex items-center gap-1 flex-shrink-0">
          <i class="fa-solid fa-server text-[10px]"></i>
          ${connection ? html`
            <span class="hover:text-accent cursor-pointer transition-colors" title="Connection: ${serverName}">${serverName}</span>
          ` : html`
            <select
              class="bg-surface-2 border border-db-border rounded text-xs text-feedback-muted px-1 py-0.5 cursor-pointer hover:text-accent transition-colors"
              title="Select a connection"
              @change=${this._onConnectionSelected}
            >
              <option value="">No Connection — select one</option>
              ${availableConnections.map(c => html`
                <option value="${c.id}">${c.name}${c.status === 'connected' ? ' (connected)' : ''}</option>
              `)}
            </select>
          `}
          ${this.databaseName ? html`
            <span class="opacity-50">/</span>
            <i class="fa-solid fa-database text-[10px]"></i>
            <span class="hover:text-accent cursor-pointer transition-colors" title="Database: ${this.databaseName}">${this.databaseName}</span>
          ` : ''}
          <span class="opacity-50">/</span>
          <span>${this.activeQueryTab === 'graphql' ? 'GraphQL' : 'SyndrQL'}</span>
        </div>
        <!-- Query Editor (Top Half) -->
        <div class="flex-1 border-b border-base-300 min-h-0 h-1/2">
          <div class="h-full p-4 flex flex-col">
            <div class="flex items-center justify-between mb-3">
              <div class="flex flex-col">
                <h3 class="text-sm font-semibold text-base-content">Query Editor</h3>
              </div>
              <div class="flex items-center space-x-2">
                <!-- Execute Query Button (Play Icon) -->
                <button
                  class="btn btn-soft btn-primary btn-sm ${this.executing ? 'loading' : ''}"
                  title="Execute Query (${this.modKey}+Enter)"
                  @click=${this.executeQuery}
                  ?disabled=${this.executing}
                >
                  ${!this.executing ? html`
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                    <span class="text-xs opacity-70 ml-1">${this.modKey}+Enter</span>
                  ` : ''}
                </button>
                ${this.executing ? html`
                  <span class="text-xs text-feedback-muted font-mono">${this.elapsedDisplay}</span>
                  <button
                    class="btn btn-ghost btn-xs text-feedback-error hover:bg-feedback-error/20"
                    title="Cancel Execution"
                    @click=${this.cancelExecution}
                  >
                    <i class="fa-solid fa-xmark"></i>
                  </button>
                ` : ''}
                <!-- Save Button (Disk Icon) -->
                <button
                  class="btn btn-soft btn-secondary btn-sm"
                  title="Save Query"
                  @click=${this.saveQuery}
                >
                  <span class="cursor-pointer"><i class="fa-solid fa-floppy-disk"></i></span>
                </button>
              </div>
            </div>
            <div class="flex-1 bg-base-100 rounded border border-base-300">
              <query-editor-tab-container .activeTab='syndrql' .queryText=${this.query} .databaseName=${this.databaseName} @query-changed=${this.handleQueryChange} @tab-changed=${this.handleTabChanged}></query-editor-tab-container>
            </div>
          </div>
        </div>
        
        <!-- JSON Results (Bottom Half) -->
        <div class="flex-1 min-h-0 h-1/2 flex flex-col overflow-hidden">
          <div class="p-4 flex flex-col min-h-0 flex-1">
            <div class="flex items-center justify-between mb-3 flex-shrink-0">
              <div class="flex items-center gap-2">
                <h3 class="text-sm font-semibold text-base-content">Query Results</h3>
                <button class="btn btn-soft btn-secondary btn-xs"
                  @click=${this.handleSaveResults}
                  title="Save Results To File">
                  <i class="fa-solid fa-floppy-disk"></i>
                </button>
                ${this.queryResult?.success && Array.isArray(this.queryResult.data) && this.queryResult.data.length > 0 ? html`
                  <button class="btn btn-soft btn-secondary btn-xs"
                    @click=${this.copyResultsWithHeaders}
                    title="Copy All Results with Headers (TSV)">
                    <i class="fa-solid fa-table-columns"></i>
                    <span class="text-xs ml-1">Copy with Headers</span>
                  </button>
                ` : ''}
                ${this.resultHistory.length > 0 ? html`
                  <select
                    class="bg-surface-2 border border-db-border rounded text-xs text-base-content px-1 py-0.5"
                    @change=${(e: Event) => {
                      const val = (e.target as HTMLSelectElement).value;
                      this.selectHistoryEntry(parseInt(val, 10));
                    }}
                  >
                    <option value="-1" ?selected=${this.selectedHistoryIndex === -1}>Current</option>
                    ${this.resultHistory.map((entry, i) => html`
                      <option value="${i}" ?selected=${this.selectedHistoryIndex === i}>
                        ${new Date(entry.timestamp).toLocaleTimeString()} — ${entry.query.substring(0, 30)}${entry.query.length > 30 ? '...' : ''}
                      </option>
                    `)}
                  </select>
                ` : ''}
              </div>
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

            <div class="flex-1 flex flex-col min-h-0 rounded border border-base-300 bg-base-100 overflow-hidden ${this.resultAnimating ? 'db-results-enter' : ''}">
              <div class="flex-1 p-4 overflow-auto min-h-0 min-w-0">
                ${this.queryResult ? html`
                  ${this.queryResult.success ? html`
                    ${this.resultsTab === 'text' ? html`
                      ${Array.isArray(this.queryResult.data) ? html`
                        ${this.queryResult.data.map((doc: unknown) => html`
                          <div class="group relative hover:bg-surface-3 rounded p-2 mb-1 transition-colors">
                            <button
                              class="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-feedback-muted hover:text-white p-1"
                              title="Copy document"
                              @click=${() => this.copyResultToClipboard(doc)}
                            >
                              <i class="fa-solid fa-copy"></i>
                            </button>
                            <pre class="text-sm font-mono text-base-content whitespace-pre-wrap"><code>${JSON.stringify(doc, null, 2)}</code></pre>
                          </div>
                        `)}
                      ` : html`
                        <div class="group relative hover:bg-surface-3 rounded p-2 transition-colors">
                          <button
                            class="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-feedback-muted hover:text-white p-1"
                            title="Copy result"
                            @click=${() => this.copyResultToClipboard(this.queryResult?.data)}
                          >
                            <i class="fa-solid fa-copy"></i>
                          </button>
                          <pre class="text-sm font-mono text-base-content whitespace-pre-wrap"><code>${JSON.stringify(this.queryResult.data, null, 2)}</code></pre>
                        </div>
                      `}
                    ` : html`
                      <json-tree-view
                        .data=${this.queryResult.data}
                        default-expanded-depth="1"
                      ></json-tree-view>
                    `}
                  ` : html`
                    <div class="text-error">
                      <div class="font-semibold mb-2">Query Error:</div>
                      <div class="text-sm">${this.queryResult.error}</div>
                    </div>
                  `}
                ` : html`
                  <div class="text-center text-base-content/50 py-8">
                    <div class="text-4xl mb-2"><i class="fa-solid fa-table-list"></i></div>
                    <div>Query results will appear here</div>
                    <div class="text-sm mt-1">Execute a query to see results</div>
                  </div>
                `}
              </div>
              <div class="flex border-t border-base-300 bg-base-200/50 flex-shrink-0">
                <button
                  class="flex-1 py-2 px-3 text-sm font-medium transition-colors ${this.resultsTab === 'text' ? 'bg-base-100 text-accent border-b-2 border-accent' : 'text-base-content/50 hover:text-base-content hover:bg-base-300/30'}"
                  @click=${() => { this.resultsTab = 'text'; }}
                >
                  Text
                </button>
                <button
                  class="flex-1 py-2 px-3 text-sm font-medium transition-colors ${this.resultsTab === 'json' ? 'bg-base-100 text-accent border-b-2 border-accent' : 'text-base-content/50 hover:text-base-content hover:bg-base-300/30'}"
                  @click=${() => { this.resultsTab = 'json'; }}
                >
                  JSON
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}