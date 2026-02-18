import { html, LitElement, PropertyValues } from 'lit';
import { provide } from '@lit/context';
import { customElement, property, state } from 'lit/decorators.js';
import { Connection, connectionManager } from '../services/connection-manager';
import { QueryResult } from '../drivers/syndrdb-driver';
import { queryEditorContext, QueryEditorContext } from '../context/queryEditorContext';
import { configLoader } from '../config/config-loader';
import './ai-assistant/ai-assistant-panel';

@customElement('main-panel')
export class MainPanel extends LitElement {
  @provide({context: queryEditorContext})
  private queryEditorContextProvider: QueryEditorContext;

  @state()
  private _selectedConnectionId: string | null = null;
  
  // Disable Shadow DOM to allow global Tailwind CSS
  createRenderRoot() {
    return this;
  }

  @state()
  private query = '';

  @state()
  private connection: Connection | undefined = undefined;

  @state()
  private queryEditors: Array<{
    name: string, 
    initialQuery?: string, 
    queryState?: string,
    databaseName?: string,
    connectionId?: string
  }> = [];

  @property({ type: Boolean })
  aiPanelOpen = false;

  @state()
  private activeTabIndex: number = 0;

  @state()
  private queryResult: QueryResult | null = null;

  @state()
  private executing = false;

  constructor() {
    super();
    // Initialize context provider once in constructor
    this.queryEditorContextProvider = {
      selectedConnectionId: this._selectedConnectionId,
      setSelectedConnectionId: (id) => {
        this._selectedConnectionId = id;
        this.updateContextProvider();
      },
      connection: connectionManager.getConnection(this._selectedConnectionId || ''),
      setConnection: (connection) => {
        this.connection = connection;
        this.updateContextProvider();
      },
      queryEditors: this.queryEditors,
      setQueryEditors: (editors) => {
        this.queryEditors = editors;
        this.updateContextProvider();
      }
    };
  }

  private updateContextProvider() {
    // Update the context provider properties without replacing the object
    this.queryEditorContextProvider.selectedConnectionId = this._selectedConnectionId;
    this.queryEditorContextProvider.connection = connectionManager.getConnection(this._selectedConnectionId || '');
    this.queryEditorContextProvider.queryEditors = this.queryEditors;
  }

  willUpdate(changedProperties: PropertyValues) {
    // Update context provider when relevant state changes
    if (changedProperties.has('_selectedConnectionId') || 
        changedProperties.has('queryEditors') || 
        changedProperties.has('connection')) {
      this.updateContextProvider();
    }
  }

  firstUpdated() {
    // Initialize with default editor if none exist
    if (this.queryEditors.length === 0) {
      this.queryEditors = [
        {name: "Default Query Editor"},
        
      ];
    }
    
    // Add event listener for add-query-editor events
    this.addEventListener('add-query-editor', (event: Event) => {
      this.handleAddQueryEditor(event as CustomEvent);
    });
  }

  private handleAddQueryEditor(event: CustomEvent) {
    const { query, databaseName, connectionId } = event.detail;
    const editorName = `Query Editor ${this.queryEditors.length + 1}`;
    
    // Build initial query with database context
    let initialQuery = '';
    if (databaseName) {
      initialQuery = `USE "${databaseName}";\n\n${query || '-- Your query here'}`;
    } else {
      initialQuery = query || '-- Your query here';
    }
    
    // Create new array to ensure Lit detects the change
    this.queryEditors = [...this.queryEditors, {
      name: editorName, 
      initialQuery: initialQuery,
      databaseName: databaseName,
      connectionId: connectionId
    }];
    this.activeTabIndex = this.queryEditors.length - 1; // Switch to new tab
    
    console.log(`Added new query editor: ${editorName} with database context:`, {
      databaseName,
      connectionId,
      initialQuery
    });
  }

  private switchToTab(index: number) {
    this.activeTabIndex = index;
    // Lit automatically handles updates for @state properties
  }

  private closeTab(index: number) {
    if (this.queryEditors.length <= 1) {
      // Prevent closing the last tab
      return;
    }
    
    // Create new array to ensure Lit detects the change
    this.queryEditors = this.queryEditors.filter((_, i) => i !== index);
    
    // Adjust activeTabIndex if necessary
    if (this.activeTabIndex >= this.queryEditors.length) {
      this.activeTabIndex = this.queryEditors.length - 1;
    }
  }

  private handleQueryStateChanged(event: CustomEvent, editorIndex: number) {
    const { queryText } = event.detail;
    this.queryEditors = this.queryEditors.map((editor, index) =>
      index === editorIndex ? { ...editor, queryState: queryText } : editor
    );
  }

  private get showAIPanel(): boolean {
    try {
      return configLoader.getConfig().aiAssistant?.premiumEnabled !== false;
    } catch {
      return true;
    }
  }

  private get aiEndpoint(): string {
    try {
      return configLoader.getConfig().aiAssistant?.endpoint ?? '';
    } catch {
      return '';
    }
  }

  private get aiRequestTimeout(): number {
    try {
      return configLoader.getConfig().aiAssistant?.requestTimeout ?? 30000;
    } catch {
      return 30000;
    }
  }

  private get activeEditorDatabase(): string {
    const editor = this.queryEditors[this.activeTabIndex];
    return editor?.databaseName ?? '';
  }

  private handleAIQueryInsertRequested(event: CustomEvent<{ syndrql: string }>) {
    const frames = this.querySelectorAll('query-editor-frame');
    const activeFrame = frames[this.activeTabIndex] as HTMLElement | undefined;
    const codeEditor = activeFrame?.querySelector?.('query-editor-tab-container')?.querySelector?.('code-editor') as
      | { getEndPosition?: () => { line: number; column: number }; insertText?: (pos: { line: number; column: number }, text: string) => void }
      | null
      | undefined;
    if (!codeEditor?.getEndPosition || !codeEditor?.insertText) return;
    const endPosition = codeEditor.getEndPosition();
    codeEditor.insertText(endPosition, event.detail.syndrql);
  }

  render() {
    return html`
      <div class="h-full flex flex-row min-w-0">
        <!-- Center: Tabs + query editor content -->
        <div class="flex-1 min-w-0 flex flex-col">
          <!-- Tab Headers -->
          <div class="flex border-b border-base-300 bg-base-200 px-4 flex-shrink-0">
            ${this.queryEditors.map((editor, index) => html`
              <button
                class="px-4 py-2 border-b-2 font-medium text-sm transition-colors duration-200 ${this.activeTabIndex === index
                  ? 'border-primary text-primary bg-base-100'
                  : 'border-transparent text-base-content hover:text-primary hover:bg-base-100'}"
                @click=${() => this.switchToTab(index)}
              >
                ${editor.name}
                <span class="ml-2 text-accent-content hover:text-info"><a @click=${(e: Event) => { e.stopPropagation(); this.closeTab(index); }}><i class="fa-solid fa-xmark"></i></a></span>
              </button>
            `)}
          </div>
          <!-- Tab Content -->
          <div class="flex-1 overflow-hidden relative min-h-0">
            ${this.queryEditors.map((editor, index) => html`
              <div class="h-full absolute inset-0 ${this.activeTabIndex === index ? 'visible z-10' : 'invisible z-0'}">
                ${editor.name === 'Drag & Drop Demo'
                  ? html`<draggable-demo class="w-full h-full"></draggable-demo>`
                  : html`
                      <query-editor-frame
                        class="w-full h-full"
                        .tabName=${editor.name}
                        .initialQuery=${editor.queryState || editor.initialQuery || ''}
                        .databaseName=${editor.databaseName || ''}
                        .connectionId=${editor.connectionId || ''}
                        .isActive=${this.activeTabIndex === index}
                        @query-state-changed=${(e: CustomEvent) => this.handleQueryStateChanged(e, index)}
                      ></query-editor-frame>
                    `}
              </div>
            `)}
          </div>
        </div>
        <!-- Right: AI Assistant panel (Cursor/Copilot style) -->
        ${this.aiPanelOpen && this.showAIPanel
          ? html`
              <div class="w-96 flex-shrink-0 border-l border-base-300 bg-base-200/50 flex flex-col overflow-hidden">
                <div class="flex items-center justify-between px-3 py-2 border-b border-base-300 bg-base-200 flex-shrink-0">
                  <span class="text-sm font-medium text-base-content">AI Assistant</span>
                  <button
                    type="button"
                    class="btn btn-ghost btn-xs"
                    title="Close panel"
                    @click=${() => this.dispatchEvent(new CustomEvent('ai-assistant-toggle-requested', { bubbles: true, composed: true }))}
                  >
                    <i class="fa-solid fa-xmark"></i>
                  </button>
                </div>
                <ai-assistant-panel
                  class="flex-1 min-h-0 overflow-auto"
                  .schemaContext=${{}}
                  .currentDatabase=${this.activeEditorDatabase}
                  .endpoint=${this.aiEndpoint}
                  .requestTimeout=${this.aiRequestTimeout}
                  .hideHeader=${true}
                  @ai-query-insert-requested=${this.handleAIQueryInsertRequested}
                ></ai-assistant-panel>
              </div>
            `
          : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'main-panel': MainPanel;
  }
}
