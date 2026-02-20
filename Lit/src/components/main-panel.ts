import { html, LitElement, PropertyValues } from 'lit';
import { provide } from '@lit/context';
import { customElement, property, state } from 'lit/decorators.js';
import { Connection, connectionManager } from '../services/connection-manager';
import { QueryResult } from '../drivers/syndrdb-driver';
import { queryEditorContext, QueryEditorContext } from '../context/queryEditorContext';
import { configLoader } from '../config/config-loader';
import './ai-assistant/ai-assistant-panel';
import './server-profiler/server-profiler-tab';

interface TabEntry {
  name: string;
  type: 'query' | 'profiler';
  initialQuery?: string;
  queryState?: string;
  databaseName?: string;
  connectionId?: string;
  profilerConnectionId?: string;
}

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
  private tabs: TabEntry[] = [];

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
      tabs: this.tabs,
      setTabs: (editors) => {
        this.tabs = editors as TabEntry[];
        this.updateContextProvider();
      }
    };
  }

  private updateContextProvider() {
    // Update the context provider properties without replacing the object
    this.queryEditorContextProvider.selectedConnectionId = this._selectedConnectionId;
    this.queryEditorContextProvider.connection = connectionManager.getConnection(this._selectedConnectionId || '');
    this.queryEditorContextProvider.tabs = this.tabs;
  }

  willUpdate(changedProperties: PropertyValues) {
    // Update context provider when relevant state changes
    if (changedProperties.has('_selectedConnectionId') || 
        changedProperties.has('tabs') || 
        changedProperties.has('connection')) {
      this.updateContextProvider();
    }
  }

  firstUpdated() {
    // Initialize with default editor if none exist
    if (this.tabs.length === 0) {
      this.tabs = [
        { name: "Default Query Editor", type: 'query' },
      ];
    }

    // Add event listener for add-query-editor events
    this.addEventListener('add-query-editor', (event: Event) => {
      this.handleAddQueryEditor(event as CustomEvent);
    });

    // Add event listener for open-profiler-tab events
    this.addEventListener('open-profiler-tab', () => {
      this.handleOpenProfilerTab();
    });
  }

  private handleAddQueryEditor(event: CustomEvent) {
    const { query, databaseName, connectionId } = event.detail;
    const editorName = `Query Editor ${this.tabs.length + 1}`;
    
    // Build initial query with database context
    let initialQuery = '';
    if (databaseName) {
      initialQuery = `USE "${databaseName}";\n\n${query || '-- Your query here'}`;
    } else {
      initialQuery = query || '-- Your query here';
    }
    
    // Create new array to ensure Lit detects the change
    this.tabs = [...this.tabs, {
      name: editorName,
      type: 'query',
      initialQuery: initialQuery,
      databaseName: databaseName,
      connectionId: connectionId
    }];
    this.activeTabIndex = this.tabs.length - 1; // Switch to new tab
    
    console.log(`Added new query editor: ${editorName} with database context:`, {
      databaseName,
      connectionId,
      initialQuery
    });
  }

  private handleOpenProfilerTab() {
    const profilerCount = this.tabs.filter(t => t.type === 'profiler').length;
    this.tabs = [...this.tabs, {
      name: `Server Profiler ${profilerCount + 1}`,
      type: 'profiler'
    }];
    this.activeTabIndex = this.tabs.length - 1;
  }

  private switchToTab(index: number) {
    this.activeTabIndex = index;
    // Lit automatically handles updates for @state properties
  }

  private closeTab(index: number) {
    if (this.tabs.length <= 1) {
      // Prevent closing the last tab
      return;
    }
    
    // Create new array to ensure Lit detects the change
    this.tabs = this.tabs.filter((_, i) => i !== index);
    
    // Adjust activeTabIndex if necessary
    if (this.activeTabIndex >= this.tabs.length) {
      this.activeTabIndex = this.tabs.length - 1;
    }
  }

  private handleQueryStateChanged(event: CustomEvent, editorIndex: number) {
    const { queryText } = event.detail;
    this.tabs = this.tabs.map((editor, index) =>
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
    const editor = this.tabs[this.activeTabIndex];
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
            ${this.tabs.map((tab, index) => html`
              <button
                class="px-4 py-2 border-b-2 font-medium text-sm transition-colors duration-200 ${this.activeTabIndex === index
                  ? 'border-primary text-primary bg-base-100'
                  : 'border-transparent text-base-content hover:text-primary hover:bg-base-100'}"
                @click=${() => this.switchToTab(index)}
              >
                ${tab.type === 'profiler'
                  ? html`<i class="fa-solid fa-gauge-high mr-1 text-xs"></i>`
                  : html`<i class="fa-solid fa-code mr-1 text-xs"></i>`}
                ${tab.name}
                <span class="ml-2 text-accent-content hover:text-info"><a @click=${(e: Event) => { e.stopPropagation(); this.closeTab(index); }}><i class="fa-solid fa-xmark"></i></a></span>
              </button>
            `)}
          </div>
          <!-- Tab Content -->
          <div class="flex-1 overflow-hidden relative min-h-0">
            ${this.tabs.map((tab, index) => html`
              <div class="h-full absolute inset-0 ${this.activeTabIndex === index ? 'block z-10' : 'hidden'}">
                ${tab.type === 'profiler'
                  ? html`<server-profiler-tab
                           class="w-full h-full"
                           .connectionId=${tab.profilerConnectionId || ''}
                           .isActive=${this.activeTabIndex === index}
                         ></server-profiler-tab>`
                  : html`
                      <query-editor-frame
                        class="w-full h-full"
                        .tabName=${tab.name}
                        .initialQuery=${tab.queryState || tab.initialQuery || ''}
                        .databaseName=${tab.databaseName || ''}
                        .connectionId=${tab.connectionId || ''}
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
