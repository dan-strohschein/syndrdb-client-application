import { html, css, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { Connection } from '../services/connection-manager';

@customElement('connection-tree')
export class ConnectionTree extends LitElement {
  // Disable Shadow DOM to allow global Tailwind CSS
  createRenderRoot() {
    return this;
  }

  @property({ type: Array })
  connections: Connection[] = [];

  @state()
  private expandedNodes: Set<string> = new Set();

  private toggleNode(nodeId: string) {
    if (this.expandedNodes.has(nodeId)) {
      this.expandedNodes.delete(nodeId);
    } else {
      this.expandedNodes.add(nodeId);
    }
    this.requestUpdate();
  }

  private isExpanded(nodeId: string): boolean {
    return this.expandedNodes.has(nodeId);
  }

  private renderConnection(connection: Connection) {
    const statusColors = {
      'connected': 'badge-success',
      'disconnected': 'badge-error',
      'connecting': 'badge-warning',
      'error': 'badge-error'
    };
    
    const statusColor = statusColors[connection.status] || 'badge-error';
    const databasesNodeId = `${connection.id}-databases`;
    const usersNodeId = `${connection.id}-users`;
    
    return html`
      <div class="mb-2">
        <!-- Connection Header -->
        <div class="flex items-center justify-between p-2 rounded hover:bg-base-300 cursor-pointer">
          <div class="flex items-center">
            <div class="badge ${statusColor} badge-xs mr-3"></div>
            <span class="font-medium text-base-content">${connection.name}</span>
          </div>
          
          <!-- Connection Actions -->
          <div class="flex gap-1">
            ${connection.status === 'disconnected' ? html`
              <button 
                class="btn btn-xs btn-success"
                @click=${(e: Event) => this.handleConnect(e, connection.id)}
                title="Connect"
              >
                ▶
              </button>
            ` : ''}
            
            ${connection.status === 'connected' ? html`
              <button 
                class="btn btn-xs btn-error"
                @click=${(e: Event) => this.handleDisconnect(e, connection.id)}
                title="Disconnect"
              >
                ⏸
              </button>
            ` : ''}
            
            ${connection.status === 'connecting' ? html`
              <span class="loading loading-spinner loading-xs"></span>
            ` : ''}
          </div>
        </div>
        
        <!-- Connection Tree Content (when connected) -->
        ${connection.status === 'connected' ? html`
          <div class="ml-4 space-y-1">
            
            <!-- Databases Node -->
            <div class="flex items-center p-1 rounded hover:bg-base-300 cursor-pointer text-sm"
                 @click=${() => this.toggleNode(databasesNodeId)}>
              <span class="mr-2 w-4 text-center">
                ${this.isExpanded(databasesNodeId) ? '▼' : '▶'}
              </span>
              <span class="mr-2">📊</span>
              <span>Databases</span>
              ${connection.databases ? html`
                <span class="ml-2 badge badge-outline badge-xs">${connection.databases.length}</span>
              ` : ''}
            </div>
            
            <!-- Databases List (when expanded) -->
            ${this.isExpanded(databasesNodeId) && connection.databases ? html`
              <div class="ml-8 space-y-1">
                ${connection.databases.map(dbName => html`
                  <div class="flex items-center p-1 rounded hover:bg-base-300 cursor-pointer text-sm">
                    <span class="mr-2 w-4"></span>
                    <span class="mr-2">�️</span>
                    <span>${dbName}</span>
                  </div>
                `)}
                ${connection.databases.length === 0 ? html`
                  <div class="ml-4 text-xs text-gray-500 italic">No databases found</div>
                ` : ''}
              </div>
            ` : ''}
            
            <!-- Users Node -->
            <div class="flex items-center p-1 rounded hover:bg-base-300 cursor-pointer text-sm"
                 @click=${() => this.toggleNode(usersNodeId)}>
              <span class="mr-2 w-4 text-center">
                ${this.isExpanded(usersNodeId) ? '▼' : '▶'}
              </span>
              <span class="mr-2">�</span>
              <span>Users</span>
              ${connection.users ? html`
                <span class="ml-2 badge badge-outline badge-xs">${connection.users.length}</span>
              ` : ''}
            </div>
            
            <!-- Users List (when expanded) -->
            ${this.isExpanded(usersNodeId) && connection.users ? html`
              <div class="ml-8 space-y-1">
                ${connection.users.map(userName => html`
                  <div class="flex items-center p-1 rounded hover:bg-base-300 cursor-pointer text-sm">
                    <span class="mr-2 w-4"></span>
                    <span class="mr-2">�</span>
                    <span>${userName}</span>
                  </div>
                `)}
                ${connection.users.length === 0 ? html`
                  <div class="ml-4 text-xs text-gray-500 italic">No users found</div>
                ` : ''}
              </div>
            ` : ''}
            
          </div>
        ` : ''}
        
        <!-- Error Message -->
        ${connection.status === 'error' && connection.lastError ? html`
          <div class="ml-6 text-xs text-error">
            Error: ${connection.lastError}
          </div>
        ` : ''}
      </div>
    `;
  }

  private handleConnect(event: Event, connectionId: string) {
    event.stopPropagation();
    this.dispatchEvent(new CustomEvent('connect-database', {
      detail: { connectionId },
      bubbles: true
    }));
  }

  private handleDisconnect(event: Event, connectionId: string) {
    event.stopPropagation();
    this.dispatchEvent(new CustomEvent('disconnect-database', {
      detail: { connectionId },
      bubbles: true
    }));
  }

  render() {
    return html`
      <div>
        ${this.connections.map(connection => this.renderConnection(connection))}
        
        ${this.connections.length === 0 ? html`
          <div class="text-center text-gray-400 py-8">
            <div class="text-4xl mb-2">🔌</div>
            <div>No connections</div>
            <div class="text-sm">Click "New Connection" to get started</div>
          </div>
        ` : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'connection-tree': ConnectionTree;
  }
}
