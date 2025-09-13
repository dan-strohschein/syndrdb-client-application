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
  private showConnectionModal = false;

  connectedCallback() {
    super.connectedCallback();
    
    // Listen for connection manager events
    connectionManager.addEventListener('connectionAdded', () => this.updateConnections());
    connectionManager.addEventListener('connectionStatusChanged', () => this.updateConnections());
    connectionManager.addEventListener('connectionRemoved', () => this.updateConnections());
    
    // Load saved connections and then update the display
    this.loadSavedConnections();
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
      await connectionManager.connect(connectionId);
    } catch (error) {
      console.error('Failed to connect:', error);
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

  private openConnectionModal() {
    console.log('Opening connection modal...');
    this.showConnectionModal = true;
    console.log('showConnectionModal is now:', this.showConnectionModal);
  }

  private handleCloseModal() {
    this.showConnectionModal = false;
  }

  private handleSaveConnection(event: CustomEvent) {
    const { connectionId, config } = event.detail;
    console.log('Connection saved with ID:', connectionId);
    
    // The connection is already added to the manager, 
    // so we just need to update our local state
    this.updateConnections();
    this.showConnectionModal = false;
  }

  render() {
    return html`
      <div class="h-full flex flex-col bg-base-200">
        <!-- Header -->
        <div class="p-4 border-b border-base-300">
          <h2 class="text-x1 font-semibold text-base-content">Database Connections</h2>
          <button class="btn btn-primary btn-sm mt-2 w-full" @click=${this.openConnectionModal}>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            New Connection
          </button>
        </div>
        
        <!-- Connection Tree -->
        <div class="flex-1 overflow-auto p-2">
          <connection-tree 
            .connections=${this.connections}
            @connect-database=${this.handleConnectDatabase}
            @disconnect-database=${this.handleDisconnectDatabase}
          ></connection-tree>
        </div>
        
        <!-- Status Bar -->
        <div class="p-2 border-t border-base-300 text-xs text-base-content/70">
          ${this.connections.filter(c => c.status === 'connected').length} of ${this.connections.length} connected
        </div>
        
        <!-- Connection Modal -->
        <connection-modal 
          .open=${this.showConnectionModal}
          @close-modal=${this.handleCloseModal}
          @save-connection=${this.handleSaveConnection}
        ></connection-modal>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sidebar-panel': SidebarPanel;
  }
}
