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
      <div class="mb-4 ${connection.status === 'connected' ? 'border-l-2 border-l-feedback-success pl-1' : ''}"
           role="treeitem"
           aria-expanded=${expanded}
           tabindex="-1">
        <div class="flex items-center p-2 rounded-lg hover:bg-base-300 cursor-pointer font-medium ${
          isActive ? 'text-accent border-l-2 border-l-accent' : ''
        }"
             style="${isActive ? 'background: linear-gradient(90deg, rgba(99, 102, 241, 0.10), transparent)' : ''}"
             @click=${() => {
               onSetActiveConnection(connection.id);
               onToggleNode(connection.id);
             }}
             @dblclick=${(e: MouseEvent) => {
               if (connection.status === 'disconnected' || connection.status === 'error') {
                 e.stopPropagation();
                 (e.currentTarget as HTMLElement).dispatchEvent(new CustomEvent('connect-server', {
                   detail: { connectionId: connection.id },
                   bubbles: true,
                   composed: true
                 }));
               }
             }}
             @contextmenu=${(e: MouseEvent) => onContextMenu(e, connection.id, connection.name, 'connection', connection)}>
          
          <span class="mr-3 w-4 text-center">
            <i class="fa-solid ${expanded ? 'fa-chevron-down' : 'fa-chevron-right'} text-sm transition-transform duration-150"></i>
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
        return 'text-feedback-success';
      case 'connecting':
        return 'text-feedback-warning';
      case 'error':
        return 'text-feedback-error';
      case 'disconnected':
      default:
        return 'text-feedback-muted';
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
          class="btn btn-xs btn-success transition-transform duration-100 active:scale-[0.93]"
          @click=${(e: Event) => onConnect(e, connection.id)}
          title="Connect"
        >
          <i class="fa-solid fa-play text-xs"></i>
        </button>
      ` : ''}
      
      ${connection.status === 'error' ? html`
        <button 
          class="btn btn-xs btn-warning transition-transform duration-100 active:scale-[0.93]"
          @click=${(e: Event) => onConnect(e, connection.id)}
          title="Retry Connection"
        >
          <i class="fa-solid fa-rotate-right text-xs"></i>
        </button>
      ` : ''}
      
      ${connection.status === 'connected' ? html`
        <button 
          class="btn btn-xs btn-error transition-transform duration-100 active:scale-[0.93]"
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
          <div class="db-connected-pulse flex items-center gap-1.5">
            <div class="db-status-dot db-status-dot-connected"></div>
            <span class="text-xs text-feedback-success">Connected</span>
          </div>
        `;

      case 'connecting':
        return html`
          <div class="db-status-dot db-status-dot-connecting"></div>
          <span class="text-xs text-feedback-warning">Connecting...</span>
        `;

      case 'error':
        return html`
          <div class="db-status-dot db-status-dot-error"></div>
          <span class="text-xs text-feedback-error">Error</span>
        `;

      case 'disconnected':
      default:
        return html`
          <div class="db-status-dot db-status-dot-disconnected"></div>
          <span class="text-xs text-feedback-muted">Disconnected</span>
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
