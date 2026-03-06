import { html, css, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { connectionManager, Connection } from '../services/connection-manager';
import { pluginRegistry, type SidebarSection } from '../services/plugin-registry';

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

  @state()
  private pluginSections: Array<SidebarSection & { pluginId: string }> = [];

  @state()
  private collapsedSections: Set<string> = new Set();

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

    // Load plugin sidebar sections when plugins are ready
    pluginRegistry.on('pluginsLoaded', () => this.updatePluginSections());
    pluginRegistry.on('pluginStateChanged', () => this.updatePluginSections());
    if (pluginRegistry.loaded) {
      this.updatePluginSections();
    }

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

  private updatePluginSections() {
    this.pluginSections = pluginRegistry.getSidebarSections();
  }

  private toggleSection(sectionId: string) {
    const next = new Set(this.collapsedSections);
    if (next.has(sectionId)) {
      next.delete(sectionId);
    } else {
      next.add(sectionId);
    }
    this.collapsedSections = next;
  }

  private handlePluginItemClick(item: { tabTypeId: string; config?: Record<string, unknown> }) {
    this.dispatchEvent(new CustomEvent('open-plugin-tab', {
      detail: { tabTypeId: item.tabTypeId, config: item.config },
      bubbles: true,
    }));
  }

  private openConnectionModal() {
    this.dispatchEvent(new CustomEvent('open-connection-modal', { bubbles: true }));
  }

  render() {
    return html`
      <div class="h-full flex flex-col db-sidebar-hex-bg relative">
        <!-- Header -->
        <div class="flex-shrink-0 p-4 db-sidebar-header relative z-10">
          <h2 class="text-x1 font-semibold text-gray-200">Database Connections</h2>
          <button class="btn btn-sm btn-primary mt-2 w-full transition-transform duration-100 active:scale-[0.97]" @click=${this.openConnectionModal}>
            <i class="fa-solid fa-plus mr-2 text-icon-success"></i>
            New Connection
          </button>
        </div>
        
        <!-- Search Filter -->
        <div class="flex-shrink-0 px-4 py-2 relative z-10">
          <div class="relative">
            <i class="fa-solid fa-search absolute left-2 top-1/2 -translate-y-1/2 text-icon-schema text-xs"></i>
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
        <div class="flex-1 db-scroll-shadow-wrapper relative z-10" style="max-height: calc(100vh - 250px);">
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
        
        <!-- Plugin Sidebar Sections -->
        ${this.pluginSections.length > 0 ? html`
          <div class="flex-shrink-0 border-t border-db-border relative z-10">
            ${this.pluginSections.map(section => html`
              <div class="plugin-sidebar-section">
                <button
                  class="w-full flex items-center gap-2 px-4 py-2 text-xs font-semibold text-gray-300 hover:bg-surface-3/50 transition-colors"
                  @click=${() => this.toggleSection(section.id)}
                >
                  <i class="fa-solid ${this.collapsedSections.has(section.id) ? 'fa-chevron-right' : 'fa-chevron-down'} text-[8px] text-gray-500 w-3"></i>
                  <i class="${section.icon} ${section.iconColor || 'text-gray-400'} text-xs"></i>
                  <span class="uppercase tracking-wider">${section.label}</span>
                </button>
                ${!this.collapsedSections.has(section.id) ? html`
                  <div class="pb-1">
                    ${section.children.map(item => html`
                      <button
                        class="w-full flex items-center gap-2 px-4 pl-9 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-surface-3/50 transition-colors"
                        @click=${() => this.handlePluginItemClick(item)}
                      >
                        <i class="${item.icon} ${item.iconColor || 'text-gray-500'} text-[10px]"></i>
                        <span>${item.label}</span>
                      </button>
                    `)}
                  </div>
                ` : ''}
              </div>
            `)}
          </div>
        ` : ''}

        <!-- Status Bar -->
        <div class="flex-shrink-0 p-2 border-t border-db-border text-xs text-feedback-muted relative z-10">
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
