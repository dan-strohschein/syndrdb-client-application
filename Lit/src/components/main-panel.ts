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
      queryEditors: [],
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
  private queryEditors: Array<string> = [];

  @state()
  private queryResult: QueryResult | null = null;

  @state()
  private executing = false;

  firstUpdated() {
    this.queryEditors.push("Default Query Editor");
    this.requestUpdate();
  }

  render() {
    return html`
      <div class="h-full flex flex-col">
       <div class="tabs tabs-lift h-full border-b border-base-300 bg-base-200 px-4">
        ${this.queryEditors.map((editor, index) => 
        { 
          console.log('Rendering editor tab:', editor, index);
          return  html`
          
          <query-editor-container class="w-full h-full" .tabName=${editor} .isActive=${index == 0}></query-editor-container>
        
        `})}
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
