import { html, LitElement, PropertyValues } from 'lit';
import { provide } from '@lit/context';
import { customElement, property, state } from 'lit/decorators.js';
import { Connection, connectionManager } from '../services/connection-manager';
import { QueryResult } from '../drivers/syndrdb-driver';
import { queryEditorContext, QueryEditorContext } from '../context/queryEditorContext';
import { configLoader } from '../config/config-loader';
import './ai-assistant/ai-assistant-panel';
import './server-profiler/server-profiler-tab';
import './session-manager/session-manager-tab';

interface TabEntry {
  name: string;
  type: 'query' | 'profiler' | 'session-manager';
  initialQuery?: string;
  queryState?: string;
  databaseName?: string;
  connectionId?: string;
  /** Stable connection name used to remap connectionId across restarts */
  connectionName?: string;
  profilerConnectionId?: string;
  /** True if the user manually renamed this tab (prevents auto-naming) */
  userRenamed?: boolean;
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
  private tabTransitioning = false;

  @state()
  private closingTabIndex: number | null = null;

  @state()
  private newTabIndex: number | null = null;

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
    // Try to restore tabs from localStorage; fall back to default
    if (this.tabs.length === 0) {
      if (!this.restoreTabs()) {
        this.tabs = [
          { name: "Default Query Editor", type: 'query' },
        ];
      }
    }

    // Add event listener for add-query-editor events
    this.addEventListener('add-query-editor', (event: Event) => {
      this.handleAddQueryEditor(event as CustomEvent);
    });

    // Remap stale tab connectionIds when connections are loaded on startup
    connectionManager.addEventListener('connectionAdded', () => {
      this.remapTabConnections();
    });

    // Add event listener for open-profiler-tab events
    this.addEventListener('open-profiler-tab', () => {
      this.handleOpenProfilerTab();
    });

    // Add event listener for open-session-manager-tab events
    this.addEventListener('open-session-manager-tab', () => {
      this.handleOpenSessionManagerTab();
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

    // Look up connection name for stable persistence across restarts
    const conn = connectionId ? connectionManager.getConnection(connectionId) : null;

    // Create new array to ensure Lit detects the change
    this.tabs = [...this.tabs, {
      name: editorName,
      type: 'query',
      initialQuery: initialQuery,
      databaseName: databaseName,
      connectionId: connectionId,
      connectionName: conn?.name || '',
    }];
    this.activeTabIndex = this.tabs.length - 1; // Switch to new tab
    this.newTabIndex = this.activeTabIndex;
    setTimeout(() => { this.newTabIndex = null; }, 200);
    this.persistTabs();
  }

  private handleOpenProfilerTab() {
    const profilerCount = this.tabs.filter(t => t.type === 'profiler').length;
    this.tabs = [...this.tabs, {
      name: `Server Profiler ${profilerCount + 1}`,
      type: 'profiler'
    }];
    this.activeTabIndex = this.tabs.length - 1;
  }

  private handleOpenSessionManagerTab() {
    const sessionCount = this.tabs.filter(t => t.type === 'session-manager').length;
    this.tabs = [...this.tabs, {
      name: `Session Manager ${sessionCount + 1}`,
      type: 'session-manager'
    }];
    this.activeTabIndex = this.tabs.length - 1;
  }

  private switchToTab(index: number) {
    if (index === this.activeTabIndex) return;
    this.tabTransitioning = true;
    setTimeout(() => {
      this.activeTabIndex = index;
      this.tabTransitioning = false;
    }, 50);
  }

  private async closeTab(index: number) {
    if (this.tabs.length <= 1 || this.closingTabIndex !== null) {
      return;
    }

    const tab = this.tabs[index];

    // For session-manager tabs, stop monitoring and clean up before removing
    if (tab.type === 'session-manager') {
      const containers = this.querySelectorAll('.h-full.absolute');
      const container = containers[index];
      const sessionTab = container?.querySelector('session-manager-tab') as
        (HTMLElement & { cleanupMonitor?: () => Promise<void> }) | null;
      if (sessionTab?.cleanupMonitor) {
        try { await sessionTab.cleanupMonitor(); } catch { /* ignore */ }
      }
    }

    // Animate the tab exit
    this.closingTabIndex = index;
    setTimeout(() => {
      // Create new array to ensure Lit detects the change
      this.tabs = this.tabs.filter((_, i) => i !== index);

      // Adjust activeTabIndex if necessary
      if (this.activeTabIndex >= this.tabs.length) {
        this.activeTabIndex = this.tabs.length - 1;
      }
      this.closingTabIndex = null;
      this.persistTabs();
    }, 150);
  }

  private handleQueryStateChanged(event: CustomEvent, editorIndex: number) {
    const { queryText } = event.detail;
    const autoName = this.deriveTabName(queryText);
    this.tabs = this.tabs.map((editor, index) =>
      index === editorIndex
        ? { ...editor, queryState: queryText, ...(autoName && !editor.userRenamed ? { name: autoName } : {}) }
        : editor
    );
    this.persistTabs();
  }

  /**
   * Derive a short tab name from the first statement in the query text.
   */
  private deriveTabName(queryText: string): string | null {
    if (!queryText || !queryText.trim()) return null;
    const trimmed = queryText.trim();
    // Match first statement keyword + target
    const match = trimmed.match(/^(SELECT|FIND|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|USE|SHOW|BACKUP|RESTORE)\s+(?:(?:DATABASE|BUNDLE|INDEX)\s+)?["']?(\w+)["']?/i);
    if (match) {
      const verb = match[1].toUpperCase();
      const target = match[2];
      if (verb === 'USE') return `USE ${target}`;
      if (verb === 'SHOW') return `SHOW ${target}`;
      return `${verb} ${target}`;
    }
    // Fallback: use first 20 chars
    const firstLine = trimmed.split('\n')[0].substring(0, 25);
    return firstLine.length > 20 ? firstLine.substring(0, 20) + '...' : firstLine;
  }

  /**
   * Handle double-click on tab to rename inline
   */
  private handleTabDblClick(index: number) {
    const currentName = this.tabs[index].name;
    const newName = prompt('Rename tab:', currentName);
    if (newName && newName.trim()) {
      this.tabs = this.tabs.map((tab, i) =>
        i === index ? { ...tab, name: newName.trim(), userRenamed: true } : tab
      );
      this.persistTabs();
    }
  }

  /**
   * Persist tabs to localStorage for session restoration
   */
  private persistTabs(): void {
    try {
      const serializable = this.tabs.map(t => ({
        name: t.name,
        type: t.type,
        initialQuery: t.queryState || t.initialQuery || '',
        databaseName: t.databaseName || '',
        connectionId: t.connectionId || '',
        connectionName: t.connectionName || '',
        profilerConnectionId: t.profilerConnectionId || '',
        userRenamed: (t as any).userRenamed || false,
      }));
      localStorage.setItem('syndrdb-tabs', JSON.stringify(serializable));
      localStorage.setItem('syndrdb-active-tab', String(this.activeTabIndex));
    } catch {
      // localStorage unavailable, ignore
    }
  }

  /**
   * Restore tabs from localStorage
   */
  private restoreTabs(): boolean {
    try {
      const stored = localStorage.getItem('syndrdb-tabs');
      if (!stored) return false;
      const parsed = JSON.parse(stored) as TabEntry[];
      if (!Array.isArray(parsed) || parsed.length === 0) return false;
      this.tabs = parsed;
      const activeStr = localStorage.getItem('syndrdb-active-tab');
      if (activeStr !== null) {
        const idx = parseInt(activeStr, 10);
        if (!isNaN(idx) && idx >= 0 && idx < this.tabs.length) {
          this.activeTabIndex = idx;
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * After connections load on startup, remap stale tab connectionIds
   * by matching the persisted connectionName to loaded connections.
   */
  private remapTabConnections(): void {
    const connections = connectionManager.getConnections();
    if (connections.length === 0) return;

    let changed = false;
    this.tabs = this.tabs.map(tab => {
      if (!tab.connectionName && !tab.connectionId) return tab;

      // Check if current connectionId is still valid
      if (tab.connectionId) {
        const existing = connectionManager.getConnection(tab.connectionId);
        if (existing) {
          // Backfill connectionName for pre-fix tabs
          if (!tab.connectionName) {
            changed = true;
            return { ...tab, connectionName: existing.name };
          }
          return tab; // Still valid
        }
      }

      // connectionId is stale — try to find the connection by persisted name
      if (tab.connectionName) {
        const match = connections.find(c => c.name === tab.connectionName);
        if (match && match.id !== tab.connectionId) {
          changed = true;
          return { ...tab, connectionId: match.id };
        }
      }

      return tab;
    });

    if (changed) {
      this.persistTabs();
    }
  }

  /**
   * Handle a query editor changing its connection (e.g. user picked one from the dropdown)
   */
  private handleTabConnectionChanged(event: CustomEvent, editorIndex: number) {
    const { connectionId, connectionName } = event.detail;
    this.tabs = this.tabs.map((tab, i) =>
      i === editorIndex ? { ...tab, connectionId, connectionName } : tab
    );
    this.persistTabs();
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
          <div class="flex border-b border-db-border bg-surface-1 px-4 flex-shrink-0" role="tablist">
            ${this.tabs.map((tab, index) => html`
              <button
                role="tab"
                aria-selected=${this.activeTabIndex === index}
                class="px-4 py-2 border-b-2 font-medium text-sm transition-colors duration-200 ${this.activeTabIndex === index
                  ? 'text-accent bg-surface-2 db-tab-active-gradient'
                  : 'border-transparent text-base-content hover:text-accent-light hover:bg-surface-2'} ${this.closingTabIndex === index ? 'animate-tab-exit' : ''} ${this.newTabIndex === index ? 'animate-tab-enter' : ''}"
                @click=${() => this.switchToTab(index)}
                @dblclick=${() => this.handleTabDblClick(index)}
              >
                ${tab.type === 'profiler'
                  ? html`<i class="fa-solid fa-gauge-high mr-1 text-xs"></i>`
                  : tab.type === 'session-manager'
                  ? html`<i class="fa-solid fa-users mr-1 text-xs"></i>`
                  : html`<i class="fa-solid fa-code mr-1 text-xs"></i>`}
                ${tab.name}
                <span class="ml-2 text-feedback-muted hover:text-feedback-error transition-colors"><a @click=${(e: Event) => { e.stopPropagation(); this.closeTab(index); }}><i class="fa-solid fa-xmark"></i></a></span>
              </button>
            `)}
          </div>
          <!-- Tab Content -->
          <div class="flex-1 overflow-hidden relative min-h-0">
            ${this.tabs.map((tab, index) => html`
              <div role="tabpanel" class="h-full absolute inset-0 ${this.activeTabIndex === index ? 'block z-10' : 'hidden'} ${this.activeTabIndex === index && !this.tabTransitioning ? 'animate-slide-in-up' : ''}">
                ${tab.type === 'profiler'
                  ? html`<server-profiler-tab
                           class="w-full h-full"
                           .connectionId=${tab.profilerConnectionId || ''}
                           .isActive=${this.activeTabIndex === index}
                         ></server-profiler-tab>`
                  : tab.type === 'session-manager'
                  ? html`<session-manager-tab
                           class="w-full h-full"
                           .isActive=${this.activeTabIndex === index}
                         ></session-manager-tab>`
                  : html`
                      <query-editor-frame
                        class="w-full h-full"
                        .tabName=${tab.name}
                        .initialQuery=${tab.queryState || tab.initialQuery || ''}
                        .databaseName=${tab.databaseName || ''}
                        .connectionId=${tab.connectionId || ''}
                        .isActive=${this.activeTabIndex === index}
                        @query-state-changed=${(e: CustomEvent) => this.handleQueryStateChanged(e, index)}
                        @tab-connection-changed=${(e: CustomEvent) => this.handleTabConnectionChanged(e, index)}
                      ></query-editor-frame>
                    `}
              </div>
            `)}
          </div>
        </div>
        <!-- Right: AI Assistant panel (Cursor/Copilot style) -->
        ${this.aiPanelOpen && this.showAIPanel
          ? html`
              <div class="w-96 flex-shrink-0 border-l border-db-border bg-surface-1 flex flex-col overflow-hidden">
                <div class="flex items-center justify-between px-3 py-2 border-b border-db-border bg-surface-2 flex-shrink-0">
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
