import { html, css, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';

@customElement('sidebar-panel')
export class SidebarPanel extends LitElement {
  // Disable Shadow DOM to allow global Tailwind CSS
  createRenderRoot() {
    return this;
  }

  @state()
  private connections = [
    { name: 'Local SyndrDB', status: 'connected' },
    { name: 'Production DB', status: 'disconnected' },
    { name: 'Test Environment', status: 'connected' }
  ];

  @state()
  private showConnectionModal = false;

  private openConnectionModal() {
    this.showConnectionModal = true;
  }

  private handleCloseModal() {
    this.showConnectionModal = false;
  }

  private handleSaveConnection(event: CustomEvent) {
    const connectionData = event.detail;
    console.log('Saving connection:', connectionData);
    
    // Add new connection to the list
    this.connections = [
      ...this.connections,
      { name: connectionData.name, status: 'disconnected' }
    ];
    
    this.showConnectionModal = false;
  }

  render() {
    return html`
      <div class="h-full flex flex-col bg-base-200">
        <!-- Header -->
        <div class="p-4 border-b border-base-300">
          <h2 class="text-lg font-semibold text-base-content">Database Connections</h2>
          <button class="btn btn-primary btn-sm mt-2 w-full" @click=${this.openConnectionModal}>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            New Connection
          </button>
        </div>
        
        <!-- Connection Tree -->
        <div class="flex-1 overflow-auto p-2">
          <connection-tree .connections="\${this.connections}"></connection-tree>
        </div>
        
        <!-- Status Bar -->
        <div class="p-2 border-t border-base-300 text-xs text-base-content/70">
          \${this.connections.filter(c => c.status === 'connected').length} of \${this.connections.length} connected
        </div>
        
        <!-- Connection Modal -->
        <connection-modal 
          .open=\${this.showConnectionModal}
          @close-modal=\${this.handleCloseModal}
          @save-connection=\${this.handleSaveConnection}
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
