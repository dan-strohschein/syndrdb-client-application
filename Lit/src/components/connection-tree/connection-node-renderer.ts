/**
 * Connection node renderer for the connection tree - Updated for new hierarchy
 */
import { html, TemplateResult } from 'lit';
import { Connection } from '../../services/connection-manager';
import { getNodeIcon } from './tree-utils';
import { DatabaseNodeRenderer } from './database-node-renderer';

export class ConnectionNodeRenderer {
  /**
   * Render a connection node and its children
   */
  static renderConnectionNode(
    connection: Connection,
    isExpanded: (nodeId: string) => boolean,
    onToggleNode: (nodeId: string) => void,
    onContextMenu: (event: MouseEvent, nodeId: string, nodeName: string, nodeType: string, data:any) => void,
    onSetActiveConnection: (connectionId: string) => void,
    onRequestUpdate: () => void,
    onUsersClick: (connection: Connection, usersNodeId: string) => Promise<void>,
    selectedConnectionId: string | null,
    onConnect?: (event: Event, connectionId: string) => void,
    onDisconnect?: (event: Event, connectionId: string) => void,
    onBundleClick?: (connection: Connection, bundleName: string, bundleNodeId: string) => Promise<void>
  ): TemplateResult {
    const expanded = isExpanded(connection.id);
    const isActive = connection.id === selectedConnectionId;

    return html`
      <!-- Connection Node -->
      <div class="mb-4">
        <div class="flex items-center p-2 rounded-lg hover:bg-base-300 cursor-pointer font-medium ${
          isActive ? 'bg-primary text-primary-content' : ''
        }"
             @click=${() => {
               onSetActiveConnection(connection.id);
               onToggleNode(connection.id);
             }}
             @contextmenu=${(e: MouseEvent) => onContextMenu(e, connection.id, connection.name, 'connection', connection)}>
          
          <span class="mr-3 w-4 text-center">
            <i class="fa-solid ${expanded ? 'fa-chevron-down' : 'fa-chevron-right'} text-sm"></i>
          </span>
          
          <span class="mr-3">
            <i class="${getNodeIcon('connection')} ${ConnectionNodeRenderer.getConnectionStatusColor(connection.status)}"></i>
          </span>
          
          <span class="flex-1">${connection.name}</span>
          
          <!-- Connection Actions and Status -->
          <div class="flex items-center space-x-2" @click=${(e: Event) => e.stopPropagation()}>
            ${ConnectionNodeRenderer.renderConnectionActions(connection, onConnect, onDisconnect)}
            ${ConnectionNodeRenderer.renderConnectionStatus(connection)}
            ${ConnectionNodeRenderer.renderDatabaseCountBadge(connection)}
          </div>
        </div>
        
        <!-- Connection Children (when expanded) -->
        ${expanded ? html`
          <div class="ml-6 space-y-2">
            <!-- Databases Container Node -->
            ${DatabaseNodeRenderer.renderDatabasesNode(
              connection,
              isExpanded,
              onToggleNode,
              onContextMenu,
              onSetActiveConnection,
              onRequestUpdate,
              onUsersClick,
              onBundleClick
            )}
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Get status color class for connection icon
   */
  static getConnectionStatusColor(status: string): string {
    switch (status) {
      case 'connected':
        return 'text-green-500';
      case 'connecting':
        return 'text-yellow-500';
      case 'error':
        return 'text-red-500';
      case 'disconnected':
      default:
        return 'text-gray-400';
    }
  }

  /**
   * Render connection action buttons (connect/disconnect/retry)
   */
  static renderConnectionActions(
    connection: Connection,
    onConnect?: (event: Event, connectionId: string) => void,
    onDisconnect?: (event: Event, connectionId: string) => void
  ): TemplateResult {
    if (!onConnect || !onDisconnect) {
      return html``;
    }

    return html`
      ${connection.status === 'disconnected' ? html`
        <button 
          class="btn btn-xs btn-success"
          @click=${(e: Event) => onConnect(e, connection.id)}
          title="Connect"
        >
          <i class="fa-solid fa-play text-xs"></i>
        </button>
      ` : ''}
      
      ${connection.status === 'error' ? html`
        <button 
          class="btn btn-xs btn-warning"
          @click=${(e: Event) => onConnect(e, connection.id)}
          title="Retry Connection"
        >
          <i class="fa-solid fa-rotate-right text-xs"></i>
        </button>
      ` : ''}
      
      ${connection.status === 'connected' ? html`
        <button 
          class="btn btn-xs btn-error"
          @click=${(e: Event) => onDisconnect(e, connection.id)}
          title="Disconnect"
        >
          <i class="fa-solid fa-pause text-xs"></i>
        </button>
      ` : ''}
    `;
  }

  /**
   * Render the connection status indicator
   */
  static renderConnectionStatus(connection: Connection): TemplateResult {
    switch (connection.status) {
      case 'connected':
        return html`
          <div class="w-2 h-2 bg-green-500 rounded-full"></div>
          <span class="text-xs text-green-600">Connected</span>
        `;
      
      case 'connecting':
        return html`
          <div class="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
          <span class="text-xs text-yellow-600">Connecting...</span>
        `;
      
      case 'error':
        return html`
          <div class="w-2 h-2 bg-red-500 rounded-full"></div>
          <span class="text-xs text-red-600">Error</span>
        `;
      
      case 'disconnected':
      default:
        return html`
          <div class="w-2 h-2 bg-gray-400 rounded-full"></div>
          <span class="text-xs text-gray-500">Disconnected</span>
        `;
    }
  }

  /**
   * Render database count badge if available
   */
  static renderDatabaseCountBadge(connection: Connection): TemplateResult {
    if (!connection.databases || connection.databases.length === 0) {
      return html``;
    }

    return html`
      <span class="badge badge-outline badge-xs">${connection.databases.length}</span>
    `;
  }
}
