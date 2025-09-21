import { html, css, LitElement } from 'lit';
import { provide } from '@lit/context'
import { customElement, property, state } from 'lit/decorators.js';
import { Connection, connectionManager } from '../services/connection-manager';
import { QueryResult } from '../drivers/syndrdb-driver';
import { queryContext, QueryContextValue } from './query-editor/queryContext';
import { queryEditorContext, QueryEditorContext } from '../context/queryEditorContext';
import { stat } from 'fs';

@customElement('main-panel')
export class MainPanel extends LitElement {
  @provide({context: queryEditorContext})
  get queryEditorContextProvider(): QueryEditorContext {
    return {
      selectedConnectionId: this._selectedConnectionId,
      setSelectedConnectionId: (id) => {
        this._selectedConnectionId = id;
        this.requestUpdate();
      },
      connection: connectionManager.getConnection(this._selectedConnectionId || ''),
      setConnection: (connection) => {
        this.connection = connection;
        this.requestUpdate();
      },
      queryEditors: this.queryEditors,
      setQueryEditors: (editors) => {
        this.queryEditors = editors;
        this.requestUpdate();
      }
    };
  }

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

  @state()
  private activeTabIndex: number = 0;

  @state()
  private queryResult: QueryResult | null = null;

  @state()
  private executing = false;

  firstUpdated() {
    this.queryEditors.push({name: "Default Query Editor"});
    this.requestUpdate();
    
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
    
    this.queryEditors.push({
      name: editorName, 
      initialQuery: initialQuery,
      databaseName: databaseName,
      connectionId: connectionId
    });
    this.activeTabIndex = this.queryEditors.length - 1; // Switch to new tab
    this.requestUpdate();
    
    console.log(`Added new query editor: ${editorName} with database context:`, {
      databaseName,
      connectionId,
      initialQuery
    });
  }

  private switchToTab(index: number) {
    this.activeTabIndex = index;
    this.requestUpdate();
  }

  private handleQueryStateChanged(event: CustomEvent, editorIndex: number) {
    const { queryText } = event.detail;
    this.queryEditors[editorIndex].queryState = queryText;
    // Don't need to requestUpdate as we're just storing state
  }

  render() {
    return html`
      <div class="h-full flex flex-col">
        <!-- Tab Headers -->
        <div class="flex border-b border-base-300 bg-base-200 px-4">
          ${this.queryEditors.map((editor, index) => html`
            <button 
              class="px-4 py-2 border-b-2 font-medium text-sm transition-colors duration-200 ${
                this.activeTabIndex === index 
                  ? 'border-primary text-primary bg-base-100' 
                  : 'border-transparent text-base-content hover:text-primary hover:bg-base-100'
              }"
              @click=${() => this.switchToTab(index)}
            >
              ${editor.name}
            </button>
          `)}
        </div>
        
        <!-- Tab Content -->
        <div class="flex-1 overflow-hidden relative">
          ${this.queryEditors.map((editor, index) => {
            // Always render all tabs but use visibility to control display
            return html`
              <div class="h-full absolute inset-0 ${this.activeTabIndex === index ? 'visible z-10' : 'invisible z-0'}">
                <query-editor-container 
                  class="w-full h-full" 
                  .tabName=${editor.name} 
                  .initialQuery=${editor.queryState || editor.initialQuery || ''} 
                  .databaseName=${editor.databaseName || ''}
                  .connectionId=${editor.connectionId || ''}
                  .isActive=${this.activeTabIndex === index}
                  @query-state-changed=${(e: CustomEvent) => this.handleQueryStateChanged(e, index)}>
                </query-editor-container>
              </div>
            `;
          })}
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
