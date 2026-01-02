import { html, css, LitElement, PropertyValues } from 'lit';
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
    // Use immutable update pattern to ensure Lit detects the change
    this.queryEditors = this.queryEditors.map((editor, index) => 
      index === editorIndex 
        ? { ...editor, queryState: queryText }
        : editor
    );
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
              <span class="ml-2 text-accent-content hover:text-info"><a @click=${() => this.closeTab(index)}><i class="fa-solid fa-xmark"></i></a></span>
            </button>
          `)}
        </div>
        
        <!-- Tab Content -->
        <div class="flex-1 overflow-hidden relative">
          ${this.queryEditors.map((editor, index) => {
            // Always render all tabs but use visibility to control display
            return html`
              <div class="h-full absolute inset-0 ${this.activeTabIndex === index ? 'visible z-10' : 'invisible z-0'}">
                ${editor.name === "Drag & Drop Demo" ? html`
                  <draggable-demo class="w-full h-full"></draggable-demo>
                ` : html`
                  <query-editor-frame
                    class="w-full h-full }" 
                    .tabName=${editor.name} 
                    .initialQuery=${editor.queryState || editor.initialQuery || ''} 
                    .databaseName=${editor.databaseName || ''}
                    .connectionId=${editor.connectionId || ''}
                    .isActive=${this.activeTabIndex === index}
                    @query-state-changed=${(e: CustomEvent) => this.handleQueryStateChanged(e, index)}>
                  </query-editor-frame>
                `}
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
