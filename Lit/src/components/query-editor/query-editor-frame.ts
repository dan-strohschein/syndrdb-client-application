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
import '../results-grid/results-grid';

interface StatementResult {
  statementText: string;
  result: QueryResult;
  index: number; // 1-based
}

interface MultiStatementResult {
  statements: StatementResult[];
  totalExecutionTime: number;
  totalDocumentCount: number;
  allSucceeded: boolean;
}

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
    private resultsTab: 'text' | 'grid' | 'json' = 'text';

    @state()
    private executing = false;

    @state()
    private resultAnimating = false;

    @state()
    private executionStartTime: number | null = null;

    @state()
    private elapsedDisplay = '';

    @state()
    private multiResult: MultiStatementResult | null = null;

    @state()
    private activeStatementIndex: number = 0;

    @state()
    private resultHistory: Array<{query: string, result: QueryResult, multiResult: MultiStatementResult | null, timestamp: number}> = [];

    @state()
    private selectedHistoryIndex = -1;

    private elapsedTimerFrame: number | null = null;

    private _abortController: AbortController | null = null;

    /** Which editor tab is currently active (tracked via tab-changed event). */
    @state()
    private activeQueryTab: 'syndrql' | 'graphql' = 'syndrql';

    @state() private editorHeightPct: number = parseInt(localStorage.getItem('editor-split-pct') || '50', 10);
    private _verticalResizing = false;

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

        // Derive queryResult from multiResult when statement selection changes
        if (changedProperties.has('multiResult') || changedProperties.has('activeStatementIndex')) {
            if (this.multiResult && this.activeStatementIndex >= 0 &&
                this.activeStatementIndex < this.multiResult.statements.length) {
                this.queryResult = this.multiResult.statements[this.activeStatementIndex].result;
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
        document.removeEventListener('mousemove', this._onVerticalResizeMove);
        document.removeEventListener('mouseup', this._onVerticalResizeEnd);
    }

    private _onExecuteRequested = () => {
        this.executeQuery();
    };

    private _startVerticalResize = (e: MouseEvent) => {
        e.preventDefault();
        this._verticalResizing = true;
        document.body.style.cursor = 'row-resize';
        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', this._onVerticalResizeMove);
        document.addEventListener('mouseup', this._onVerticalResizeEnd);
    };

    private _onVerticalResizeMove = (e: MouseEvent) => {
        if (!this._verticalResizing) return;
        const rect = this.getBoundingClientRect();
        const breadcrumb = this.querySelector('.border-b.bg-surface-1') as HTMLElement;
        const offsetTop = breadcrumb ? breadcrumb.offsetHeight : 0;
        const availableHeight = rect.height - offsetTop;
        const relativeY = e.clientY - rect.top - offsetTop;
        const pct = (relativeY / availableHeight) * 100;
        this.editorHeightPct = Math.max(20, Math.min(80, pct));
    };

    private _onVerticalResizeEnd = () => {
        this._verticalResizing = false;
        document.removeEventListener('mousemove', this._onVerticalResizeMove);
        document.removeEventListener('mouseup', this._onVerticalResizeEnd);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        localStorage.setItem('editor-split-pct', String(Math.round(this.editorHeightPct)));
        window.dispatchEvent(new Event('resize'));
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
            { query, result, multiResult: this.multiResult, timestamp: Date.now() },
            ...this.resultHistory.slice(0, 9),
        ];
        this.selectedHistoryIndex = -1;
    }

    private selectHistoryEntry(index: number) {
        this.selectedHistoryIndex = index;
        if (index >= 0 && index < this.resultHistory.length) {
            const entry = this.resultHistory[index];
            this.multiResult = entry.multiResult;
            this.activeStatementIndex = 0;
            this.queryResult = entry.result;
            this.resultAnimating = true;
            setTimeout(() => { this.resultAnimating = false; }, 200);
        }
    }

    private selectStatementTab(index: number): void {
        if (!this.multiResult) return;
        if (index === -1) {
            // Summary view — keep queryResult as-is, just change index
            this.activeStatementIndex = -1;
            this.resultAnimating = true;
            setTimeout(() => { this.resultAnimating = false; }, 200);
            return;
        }
        if (index >= 0 && index < this.multiResult.statements.length) {
            this.activeStatementIndex = index;
            this.queryResult = this.multiResult.statements[index].result;
        }
        this.resultAnimating = true;
        setTimeout(() => { this.resultAnimating = false; }, 200);
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
        this.multiResult = null;
        this.activeStatementIndex = 0;
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

            // Use aggregate totals from multiResult when available
            // Cast needed: TS control-flow doesn't track that the awaited methods above set multiResult
            const mr = this.multiResult as MultiStatementResult | null;
            const totalDocs = mr
                ? mr.totalDocumentCount
                : (this.queryResult?.documentCount || this.queryResult?.data?.length || 0);
            const totalTime = mr
                ? mr.totalExecutionTime
                : (this.queryResult?.executionTime || 0);
            const overallSuccess = mr
                ? mr.allSucceeded
                : (this.queryResult?.success ?? false);

            // Push to result history (local + persistent)
            if (this.queryResult) {
                this.pushResultHistory(this.query, this.queryResult);
                queryHistoryService.addEntry(
                    this.query,
                    this.connectionId || null,
                    this.databaseName || null,
                    overallSuccess,
                    totalDocs,
                    totalTime,
                );
            }

            // Dispatch query-executed event to update status bar
            if (this.queryResult) {
                this.dispatchEvent(new CustomEvent('query-executed', {
                    detail: {
                        executionTime: totalTime,
                        ResultCount: totalDocs,
                        success: overallSuccess
                    },
                    bubbles: true
                }));
            }
        } catch (error) {
            this.stopElapsedTimer();
            console.error('Query execution failed:', error);
            // If multiResult is already populated (mid-execution failure), don't overwrite
            if (!this.multiResult) {
                this.queryResult = {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    executionTime: 0
                };
            }
        }

        this.executing = false;
        this.dispatchEvent(new CustomEvent('query-executing', {
          detail: { executing: false },
          bubbles: true,
        }));
    }

    /**
     * Execute a SyndrQL query — validate, parse statements, execute sequentially.
     * Builds a MultiStatementResult so each statement's results are individually accessible.
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

        const statementResults: StatementResult[] = [];
        let failedIndex = -1;

        for (let i = 0; i < statements.length; i++) {
            const statementText = statements[i].text;
            console.log(`Executing statement ${i + 1}/${statements.length}:`, statementText);

            let result: QueryResult;

            if (this.connectionId && this.databaseName) {
                await connectionManager.setDatabaseContext(this.connectionId, this.databaseName);
                result = await connectionManager.executeQueryWithContext(this.connectionId, statementText);
            } else if (this.connectionId) {
                result = await connectionManager.executeQueryOnConnectionId(this.connectionId, statementText);
            } else {
                result = await connectionManager.executeQuery(statementText);
            }

            statementResults.push({
                statementText,
                result,
                index: i + 1,
            });

            if (!result.success) {
                console.warn(`Statement ${i + 1} failed: ${result.error}`);
                failedIndex = i;
                break;
            }

            console.log(`Statement ${i + 1} completed successfully`);
        }

        const totalExecutionTime = statementResults.reduce((sum, s) => sum + (s.result.executionTime || 0), 0);
        const totalDocumentCount = statementResults.reduce((sum, s) => sum + (s.result.documentCount || 0), 0);

        this.multiResult = {
            statements: statementResults,
            totalExecutionTime,
            totalDocumentCount,
            allSucceeded: failedIndex === -1,
        };

        // Jump to the failed statement if any, otherwise first statement
        this.activeStatementIndex = failedIndex >= 0 ? failedIndex : 0;
        // queryResult is derived via willUpdate

        if (failedIndex >= 0) {
            // Don't throw — partial results are preserved and accessible via tabs.
            // Set queryResult directly for the catch block to see the error.
            this.queryResult = statementResults[failedIndex].result;
        }

        console.log(`Executed ${statementResults.length}/${statements.length} statements${failedIndex >= 0 ? ` (failed at #${failedIndex + 1})` : ' successfully'}`);
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

        // Wrap in multiResult for uniform template logic
        this.multiResult = {
            statements: [{
                statementText: this.query,
                result,
                index: 1,
            }],
            totalExecutionTime: result.executionTime || 0,
            totalDocumentCount: result.documentCount || result.data?.length || 0,
            allSucceeded: result.success ?? true,
        };
        this.activeStatementIndex = 0;

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
        <!-- Query Editor (Top) -->
        <div class="border-b border-base-300 min-h-0 overflow-hidden" style="height: ${this.editorHeightPct}%">
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

        <!-- Resize Handle -->
        <div
          class="h-1 cursor-row-resize hover:bg-accent/30 active:bg-accent/50 transition-colors flex-shrink-0 relative group"
          @mousedown=${this._startVerticalResize}
          @dblclick=${() => { this.editorHeightPct = 50; localStorage.setItem('editor-split-pct', '50'); window.dispatchEvent(new Event('resize')); }}
        >
          <div class="absolute inset-x-0 -top-1 -bottom-1"></div>
        </div>

        <!-- Query Results (Bottom) -->
        <div class="flex-1 min-h-0 flex flex-col overflow-hidden">
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
                  ${this.multiResult && this.multiResult.statements.length > 1 ? html`
                    <span class="badge badge-outline badge-sm">
                      ${this.multiResult.statements.length} stmts / ${this.multiResult.totalDocumentCount} total docs
                    </span>
                  ` : ''}
                  ${this.queryResult.executionTime ? html`
                    <span class="text-xs text-base-content/70">Execution time: ${this.multiResult ? this.multiResult.totalExecutionTime : this.queryResult.executionTime}ms</span>
                  ` : ''}
                ` : html`
                  <span class="text-xs text-base-content/70">No query executed</span>
                `}
              </div>
            </div>

            <!-- 7a. Statement tabs bar — only shown for multi-statement results -->
            ${this.multiResult && this.multiResult.statements.length > 1 ? html`
              <div class="flex items-center gap-1 px-2 py-1.5 bg-surface-1 border border-base-300 rounded-t overflow-x-auto flex-shrink-0">
                <button
                  class="badge badge-sm cursor-pointer whitespace-nowrap transition-colors ${this.activeStatementIndex === -1 ? 'badge-accent' : 'badge-outline hover:badge-accent'}"
                  @click=${() => this.selectStatementTab(-1)}
                  title="View summary of all statements"
                >
                  <i class="fa-solid fa-list-check mr-1"></i> Summary
                </button>
                ${this.multiResult.statements.map((stmt, i) => html`
                  <button
                    class="badge badge-sm cursor-pointer whitespace-nowrap transition-colors ${this.activeStatementIndex === i ? 'badge-accent' : stmt.result.success ? 'badge-outline hover:badge-accent' : 'badge-error'}"
                    @click=${() => this.selectStatementTab(i)}
                    title="${stmt.statementText}"
                  >
                    <i class="fa-solid ${stmt.result.success ? 'fa-check' : 'fa-xmark'} mr-1"></i>
                    Stmt ${stmt.index}
                    <span class="ml-1 opacity-70">(${stmt.result.documentCount || stmt.result.data?.length || 0})</span>
                  </button>
                `)}
              </div>
            ` : ''}

            <div class="flex-1 flex flex-col min-h-0 rounded ${this.multiResult && this.multiResult.statements.length > 1 ? 'rounded-t-none' : ''} border border-base-300 bg-base-100 overflow-hidden ${this.resultAnimating ? 'db-results-enter' : ''}">
              <div class="flex-1 p-4 overflow-auto min-h-0 min-w-0">
                ${this.multiResult && this.activeStatementIndex === -1 ? html`
                  <!-- 7b. Summary view -->
                  <div class="space-y-1">
                    <table class="table table-xs w-full">
                      <thead>
                        <tr class="text-xs text-base-content/70">
                          <th class="w-12">#</th>
                          <th>Statement</th>
                          <th class="w-20 text-center">Status</th>
                          <th class="w-20 text-right">Docs</th>
                          <th class="w-24 text-right">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${this.multiResult.statements.map((stmt, i) => html`
                          <tr class="hover:bg-surface-3 cursor-pointer transition-colors" @click=${() => this.selectStatementTab(i)}>
                            <td class="font-mono text-xs">${stmt.index}</td>
                            <td class="font-mono text-xs truncate max-w-[300px]" title="${stmt.statementText}">${stmt.statementText.length > 60 ? stmt.statementText.substring(0, 60) + '...' : stmt.statementText}</td>
                            <td class="text-center">
                              <span class="badge badge-xs ${stmt.result.success ? 'badge-success' : 'badge-error'}">
                                ${stmt.result.success ? 'OK' : 'Error'}
                              </span>
                            </td>
                            <td class="text-right text-xs font-mono">${stmt.result.documentCount || stmt.result.data?.length || 0}</td>
                            <td class="text-right text-xs font-mono">${stmt.result.executionTime || 0}ms</td>
                          </tr>
                        `)}
                      </tbody>
                      <tfoot>
                        <tr class="font-semibold border-t border-base-300">
                          <td></td>
                          <td class="text-xs">Total (${this.multiResult.statements.length} statements)</td>
                          <td class="text-center">
                            <span class="badge badge-xs ${this.multiResult.allSucceeded ? 'badge-success' : 'badge-warning'}">
                              ${this.multiResult.allSucceeded ? 'All OK' : 'Partial'}
                            </span>
                          </td>
                          <td class="text-right text-xs font-mono">${this.multiResult.totalDocumentCount}</td>
                          <td class="text-right text-xs font-mono">${this.multiResult.totalExecutionTime}ms</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ` : html`
                  <!-- 7c. Statement text preview — shown when viewing a specific statement in multi-mode -->
                  ${this.multiResult && this.multiResult.statements.length > 1 && this.activeStatementIndex >= 0 ? html`
                    <div class="font-mono text-xs text-base-content/60 bg-surface-2 rounded px-2 py-1 mb-3 truncate" title="${this.multiResult.statements[this.activeStatementIndex]?.statementText}">
                      ${this.multiResult.statements[this.activeStatementIndex]?.statementText}
                    </div>
                  ` : ''}

                  ${this.queryResult ? html`
                    ${this.queryResult.success ? html`
                      <!-- 7d. DDL success state — no data means DDL/admin statement -->
                      ${!this.queryResult.data || (Array.isArray(this.queryResult.data) && this.queryResult.data.length === 0) ? html`
                        <div class="text-center text-success py-8">
                          <div class="text-4xl mb-2"><i class="fa-solid fa-circle-check"></i></div>
                          <div class="font-semibold">Statement executed successfully</div>
                          ${this.queryResult.executionTime ? html`
                            <div class="text-sm text-base-content/50 mt-1">${this.queryResult.executionTime}ms</div>
                          ` : ''}
                        </div>
                      ` : html`
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
                        ` : this.resultsTab === 'grid' ? html`
                          <results-grid
                            .data=${Array.isArray(this.queryResult.data) ? this.queryResult.data as Record<string, unknown>[] : [this.queryResult.data as Record<string, unknown>]}
                          ></results-grid>
                        ` : html`
                          <json-tree-view
                            .data=${this.queryResult.data}
                            default-expanded-depth="1"
                          ></json-tree-view>
                        `}
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
                  class="flex-1 py-2 px-3 text-sm font-medium transition-colors ${this.resultsTab === 'grid' ? 'bg-base-100 text-accent border-b-2 border-accent' : 'text-base-content/50 hover:text-base-content hover:bg-base-300/30'}"
                  @click=${() => { this.resultsTab = 'grid'; }}
                >
                  <i class="fa-solid fa-table-cells text-xs mr-1"></i>Grid
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