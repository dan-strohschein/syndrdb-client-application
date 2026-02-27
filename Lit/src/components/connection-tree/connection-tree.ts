/**
 * Refactored Connection Tree Component - Main orchestrator
 */
import { html, LitElement } from 'lit';
import { provide } from '@lit/context';
import { customElement, property, state } from 'lit/decorators.js';
import { Connection } from '../../services/connection-manager';
import { ConnectionContext, connectionContext } from '../../context/connectionContext';

// Import the modular components
import { TreeDataService } from './tree-data-service';
import { TreeContextMenuHandler } from './tree-context-menu';
import { ConnectionNodeRenderer } from './connection-node-renderer';
import { UserManagementRenderer } from './user-management-renderer';
import { TreeNodeState, ContextMenuState } from './tree-types';

@customElement('connection-tree')
export class ConnectionTree extends LitElement {

  @provide({ context: connectionContext })
  get connectionContextProvider(): ConnectionContext {
    return {
      selectedConnectionId: this._selectedConnectionId,
      setSelectedConnectionId: (id) => {
        this._selectedConnectionId = id;
        this.requestUpdate();
      },
    };
  }

  // Disable Shadow DOM to allow global Tailwind CSS
  createRenderRoot() {
    return this;
  }

  @property({ type: Array })
  connections: Connection[] = [];

  @state()
  private expandedNodes: Set<string> = new Set();

  @state()
  private _selectedConnectionId: string | null = null;

  @state()
  private contextMenu: ContextMenuState | null = null;

  /** Index of the currently focused tree item for keyboard navigation */
  @state()
  private focusedNodeIndex: number = -1;

  /**
   * Toggle node expansion state
   */
  private toggleNode = (nodeId: string): void => {
    if (this.expandedNodes.has(nodeId)) {
      this.expandedNodes.delete(nodeId);
    } else {
      this.expandedNodes.add(nodeId);
    }
    this.requestUpdate();
  };

  /**
   * Check if a node is expanded
   */
  private isExpanded = (nodeId: string): boolean => {
    return this.expandedNodes.has(nodeId);
  };

  /**
   * Handle context menu events
   */
  private handleContextMenu = (event: MouseEvent, nodeId: string, nodeName: string, nodeType: string, data:any): void => {
    event.preventDefault();
    event.stopPropagation();

    this.contextMenu = TreeContextMenuHandler.createContextMenu(event, nodeId, nodeName, nodeType, data);
    this.requestUpdate();
  };

  /**
   * Hide context menu
   */
  private hideContextMenu = (): void => {
    this.contextMenu = null;
    this.requestUpdate();
  };

  /**
   * Handle context menu actions
   */
  private handleContextMenuAction = (action: string): void => {
    if (!this.contextMenu) return;
    
    TreeContextMenuHandler.handleContextMenuAction(
      action,
      this.contextMenu,
      (event: CustomEvent) => this.dispatchEvent(event)
    );
    
    this.hideContextMenu();
  };

  /**
   * Set the active connection
   */
  private setActiveConnection = (connectionId: string): void => {
    this._selectedConnectionId = connectionId;
    console.log(`🔗 Active connection set to: ${connectionId}`);
    this.requestUpdate();
  };

  /**
   * Handle users node click
   */
  private handleUsersClick = async (connection: Connection, usersNodeId: string): Promise<void> => {
    await UserManagementRenderer.handleUsersClick(
      connection,
      usersNodeId,
      this.isExpanded,
      this.toggleNode,
      this.setActiveConnection,
      () => this.requestUpdate()
    );
  };

  /**
   * Handle connect-server event from double-click on connection node
   */
  private handleConnectServer = (event: Event): void => {
    const customEvent = event as CustomEvent<{ connectionId: string }>;
    const { connectionId } = customEvent.detail;
    console.log(`🔌 Double-click connect to: ${connectionId}`);
    this.dispatchEvent(new CustomEvent('connect-database', {
      detail: { connectionId },
      bubbles: true
    }));
  };

  /**
   * Handle open-bundle-query event from double-click on bundle node
   */
  private handleOpenBundleQuery = (event: Event): void => {
    const customEvent = event as CustomEvent<{ bundleName: string; databaseName: string; connectionId: string }>;
    this.dispatchEvent(new CustomEvent('open-bundle-query', {
      detail: customEvent.detail,
      bubbles: true
    }));
  };

  /**
   * Handle connect database button click
   */
  private handleConnect = (event: Event, connectionId: string): void => {
    event.stopPropagation();
    console.log(`🔌 Connecting to database: ${connectionId}`);
    this.dispatchEvent(new CustomEvent('connect-database', {
      detail: { connectionId },
      bubbles: true
    }));
  };

  /**
   * Handle disconnect database button click
   */
  private handleDisconnect = (event: Event, connectionId: string): void => {
    event.stopPropagation();
    console.log(`🔌 Disconnecting from database: ${connectionId}`);
    this.dispatchEvent(new CustomEvent('disconnect-database', {
      detail: { connectionId },
      bubbles: true
    }));
  };

  /**
   * Handle bundle node click (loads bundle details)
   */
  private handleBundleClick = async (connection: Connection, bundleName: string, bundleNodeId: string): Promise<void> => {
    console.log(`📦 Loading bundle details for: ${bundleName}`);
    
    try {
      // Import the TreeDataService
      const { TreeDataService } = await import('./tree-data-service');
      
      // Fetch bundle details (this will execute SHOW BUNDLE command)
      await TreeDataService.fetchBundleDetails(connection.id, bundleName);
      
      console.log(`✅ Bundle details loaded for: ${bundleName}`);
      
      // Trigger a re-render to show the updated bundle children
      this.requestUpdate();
    } catch (error) {
      console.error(`❌ Error loading bundle details for ${bundleName}:`, error);
    }
  };

  /**
   * Get all visible treeitem elements for keyboard navigation
   */
  private getTreeItems(): HTMLElement[] {
    return Array.from(this.querySelectorAll('[role="treeitem"]'));
  }

  /**
   * Handle keyboard navigation within the tree
   */
  private handleTreeKeyDown = (event: KeyboardEvent): void => {
    const items = this.getTreeItems();
    if (items.length === 0) return;

    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        this.focusedNodeIndex = Math.min(this.focusedNodeIndex + 1, items.length - 1);
        items[this.focusedNodeIndex]?.focus();
        break;
      }
      case 'ArrowUp': {
        event.preventDefault();
        this.focusedNodeIndex = Math.max(this.focusedNodeIndex - 1, 0);
        items[this.focusedNodeIndex]?.focus();
        break;
      }
      case 'ArrowRight': {
        // Expand current node
        event.preventDefault();
        const current = items[this.focusedNodeIndex];
        if (current && current.getAttribute('aria-expanded') === 'false') {
          current.click(); // Toggle expand
        }
        break;
      }
      case 'ArrowLeft': {
        // Collapse current node
        event.preventDefault();
        const current = items[this.focusedNodeIndex];
        if (current && current.getAttribute('aria-expanded') === 'true') {
          current.click(); // Toggle collapse
        }
        break;
      }
      case 'Enter':
      case ' ': {
        event.preventDefault();
        const current = items[this.focusedNodeIndex];
        current?.click();
        break;
      }
      case 'Home': {
        event.preventDefault();
        this.focusedNodeIndex = 0;
        items[0]?.focus();
        break;
      }
      case 'End': {
        event.preventDefault();
        this.focusedNodeIndex = items.length - 1;
        items[items.length - 1]?.focus();
        break;
      }
    }
  };

  /**
   * Handle click outside to hide context menu
   */
  private handleDocumentClick = (event: Event): void => {
    const target = event.target as HTMLElement;
    if (!target.closest('context-menu')) {
      this.hideContextMenu();
    }
  };

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('click', this.handleDocumentClick);
    this.addEventListener('connect-server', this.handleConnectServer);
    this.addEventListener('open-bundle-query', this.handleOpenBundleQuery);

    import('../../services/connection-manager').then(({ connectionManager }) => {
    connectionManager.onConnectionsChanged(() => {
      this.requestUpdate(); // Re-render when connections change
    });
  });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('click', this.handleDocumentClick);
    this.removeEventListener('connect-server', this.handleConnectServer);
    this.removeEventListener('open-bundle-query', this.handleOpenBundleQuery);
  }
 
  render() {
    return html`
      <div class="p-4" role="tree" aria-label="Connection tree" tabindex="0" @keydown=${this.handleTreeKeyDown}>
        <!-- Connection Nodes -->
        ${this.connections.map(connection =>
          ConnectionNodeRenderer.renderConnectionNode(
            connection,
            this.isExpanded,
            this.toggleNode,
            this.handleContextMenu,
            this.setActiveConnection,
            () => this.requestUpdate(),
            this.handleUsersClick,
            this._selectedConnectionId,
            this.handleConnect,
            this.handleDisconnect,
            this.handleBundleClick
          )
        )}        <!-- Empty State -->
        ${this.connections.length === 0 ? html`
          <div class="db-empty-state h-64">
            <div class="db-empty-state-icon">
              <i class="fa-solid fa-server"></i>
            </div>
            <p class="db-empty-state-title">No Connections</p>
            <p class="db-empty-state-description">Add a database connection to get started</p>
            <button class="db-button" @click=${() => this.dispatchEvent(new CustomEvent('open-connection-modal', { bubbles: true }))}>
              <i class="fa-solid fa-plus mr-2"></i>New Connection
            </button>
          </div>
        ` : ''}
        
        <!-- Context Menu -->
        ${TreeContextMenuHandler.renderContextMenu(this.contextMenu, this.handleContextMenuAction)}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'connection-tree': ConnectionTree;
  }
}
