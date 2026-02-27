import { html, css, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { connectionManager, Connection } from '../services/connection-manager';

@customElement('sidebar-panel')
export class SidebarPanel extends LitElement {
  // Disable Shadow DOM to allow global Tailwind CSS
  createRenderRoot() {
    return this;
  }

  @state()
  private connections: Connection[] = [];

  @state()
  private treeFilter = '';

  private newConnectionHandler: (() => void) | null = null;
  private saveConnectionHandler: (() => void) | null = null;

  connectedCallback() {
    super.connectedCallback();

    connectionManager.addEventListener('connectionAdded', () => this.updateConnections());
    connectionManager.addEventListener('connectionStatusChanged', () => this.updateConnections());
    connectionManager.addEventListener('connectionRemoved', () => this.updateConnections());

    this.newConnectionHandler = () => {
      this.dispatchEvent(new CustomEvent('open-connection-modal', { bubbles: true }));
    };
    document.addEventListener('new-connection-requested', this.newConnectionHandler);

    this.saveConnectionHandler = () => this.updateConnections();
    document.addEventListener('save-connection', this.saveConnectionHandler);

    this.loadSavedConnections();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.newConnectionHandler) {
      document.removeEventListener('new-connection-requested', this.newConnectionHandler);
    }
    if (this.saveConnectionHandler) {
      document.removeEventListener('save-connection', this.saveConnectionHandler);
    }
  }

  private async loadSavedConnections() {
    try {
      // Check if electronAPI is available
      const electronAPI = (window as any).electronAPI;
      if (electronAPI?.connectionStorage) {
        const savedConnections = await electronAPI.connectionStorage.load();
        
        // Add each saved connection to the connection manager
        for (const config of savedConnections) {
          await connectionManager.addConnection(config);
        }
      }
    } catch (error) {
      console.error('Failed to load saved connections:', error);
    }
    
    // Update the connections display
    this.updateConnections();
  }

  private updateConnections() {
    this.connections = connectionManager.getConnections();
  }

  private async connectToDatabase(connectionId: string) {
    try {
      const success = await connectionManager.connect(connectionId);
      
      // Check if connection failed (returned false)
      if (!success) {
        console.error('Connection failed: connect method returned false');
        
        // Get the connection to access its name and error details
        const connection = connectionManager.getConnection(connectionId);
        const connectionName = connection ? connection.name : 'Unknown Connection';
        const errorMessage = connection?.lastError || 'Connection failed';
        
        console.log('🚨 Emitting connection-error event:', { connectionId, connectionName, error: errorMessage });
        
        // Emit connection-error event to show the error modal
        this.dispatchEvent(new CustomEvent('connection-error', {
          detail: { 
            connectionId,
            connectionName,
            error: errorMessage
          },
          bubbles: true
        }));
        
        console.log('✅ connection-error event emitted successfully');
      }
    } catch (error) {
      console.error('Failed to connect with exception:', error);
      
      // Get the connection to access its name and error details
      const connection = connectionManager.getConnection(connectionId);
      const connectionName = connection ? connection.name : 'Unknown Connection';
      const errorMessage = connection?.lastError || (error instanceof Error ? error.message : 'Unknown error');
      
      console.log('🚨 Emitting connection-error event (from catch):', { connectionId, connectionName, error: errorMessage });
      
      // Emit connection-error event to show the error modal
      this.dispatchEvent(new CustomEvent('connection-error', {
        detail: { 
          connectionId,
          connectionName,
          error: errorMessage
        },
        bubbles: true
      }));
      
      console.log('✅ connection-error event emitted successfully (from catch)');
    }
  }

  private async disconnectFromDatabase(connectionId: string) {
    try {
      await connectionManager.disconnect(connectionId);
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  }

  private handleConnectDatabase(event: CustomEvent) {
    const { connectionId } = event.detail;
    this.connectToDatabase(connectionId);
  }

  private handleDisconnectDatabase(event: CustomEvent) {
    const { connectionId } = event.detail;
    this.disconnectFromDatabase(connectionId);
  }

  private _onTreeScroll(e: Event) {
    const el = e.target as HTMLElement;
    const wrapper = el.parentElement;
    if (!wrapper) return;
    wrapper.classList.toggle('shadow-top', el.scrollTop > 0);
    wrapper.classList.toggle('shadow-bottom', el.scrollTop + el.clientHeight < el.scrollHeight - 1);
  }

  private openConnectionModal() {
    this.dispatchEvent(new CustomEvent('open-connection-modal', { bubbles: true }));
  }

  render() {
    return html`
      <div class="h-full flex flex-col bg-surface-1">
        <!-- Header -->
        <div class="flex-shrink-0 p-4 db-sidebar-header">
          <h2 class="text-x1 font-semibold text-gray-200">Database Connections</h2>
          <button class="btn btn-sm mt-2 w-full bg-accent hover:bg-accent-dark text-white transition-transform duration-100 active:scale-[0.97]" @click=${this.openConnectionModal}>
            <i class="fa-solid fa-plus mr-2 text-green-300"></i>
            New Connection
          </button>
        </div>
        
        <!-- Search Filter -->
        <div class="flex-shrink-0 px-4 py-2">
          <div class="relative">
            <i class="fa-solid fa-search absolute left-2 top-1/2 -translate-y-1/2 text-indigo-400 text-xs"></i>
            <input
              type="text"
              class="db-input text-xs w-full pl-7 pr-7 py-1.5"
              placeholder="Filter connections..."
              .value=${this.treeFilter}
              @input=${(e: Event) => { this.treeFilter = (e.target as HTMLInputElement).value; }}
            />
            ${this.treeFilter ? html`
              <button
                class="absolute right-2 top-1/2 -translate-y-1/2 text-feedback-muted hover:text-white text-xs"
                @click=${() => { this.treeFilter = ''; }}
              >
                <i class="fa-solid fa-xmark"></i>
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Connection Tree -->
        <div class="flex-1 db-scroll-shadow-wrapper" style="max-height: calc(100vh - 250px);">
          <div class="h-full overflow-y-scroll overflow-x-hidden p-2" @scroll=${this._onTreeScroll}>
            <connection-tree
              .connections=${this.treeFilter
                ? this.connections.filter(c => c.name.toLowerCase().includes(this.treeFilter.toLowerCase()))
                : this.connections}
              @connect-database=${this.handleConnectDatabase}
              @disconnect-database=${this.handleDisconnectDatabase}
            ></connection-tree>
          </div>
        </div>
        
        <!-- Status Bar -->
        <div class="flex-shrink-0 p-2 border-t border-db-border text-xs text-feedback-muted">
          ${this.connections.filter(c => c.status === 'connected').length} of ${this.connections.length} connected
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sidebar-panel': SidebarPanel;
  }
}
