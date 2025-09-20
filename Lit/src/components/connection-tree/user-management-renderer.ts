/**
 * User management renderer for the connection tree
 */
import { html, TemplateResult } from 'lit';
import { Connection } from '../../services/connection-manager';
import { generateUsersNodeId, generateUserNodeId, formatCountBadge } from './tree-utils';
import { TreeDataService } from './tree-data-service';

export class UserManagementRenderer {
  /**
   * Render the Users node and its children
   */
  static renderUsersNode(
    connection: Connection,
    databaseName: string,
    isExpanded: (nodeId: string) => boolean,
    onToggleNode: (nodeId: string) => void,
    onContextMenu: (event: MouseEvent, nodeId: string, nodeName: string, nodeType: string) => void,
    onUsersClick: (connection: Connection, usersNodeId: string) => Promise<void>
  ): TemplateResult {
    const usersNodeId = generateUsersNodeId(connection.id, databaseName);
    const expanded = isExpanded(usersNodeId);

    return html`
      <!-- Users Node -->
      <div class="flex items-center p-1 rounded hover:bg-base-300 cursor-pointer text-sm"
           @click=${async () => {
             // Set database context before calling onUsersClick
             const parts = usersNodeId.split('-');
             const databaseIndex = parts.indexOf('database');
             if (databaseIndex !== -1 && databaseIndex + 1 < parts.length) {
               const databaseName = parts[databaseIndex + 1];
               try {
                 const { connectionManager } = await import('../../services/connection-manager');
                 await connectionManager.setDatabaseContext(connection.id, databaseName);
               } catch (error) {
                 console.error('Failed to set database context for users:', databaseName, error);
               }
             }
             onUsersClick(connection, usersNodeId);
           }}
           @contextmenu=${(e: MouseEvent) => onContextMenu(e, usersNodeId, 'Users', 'users')}>
        <span class="mr-2 w-4 text-center">
          <i class="fa-solid ${expanded ? 'fa-chevron-down' : 'fa-chevron-right'} text-xs"></i>
        </span>
        <span class="mr-2"><i class="fa-solid fa-users"></i></span>
        <span>Users</span>
        ${connection.users ? html`
          <span class="ml-2 badge badge-outline badge-xs">${formatCountBadge(connection.users.length)}</span>
        ` : ''}
      </div>

      <!-- Users List (when expanded) -->
      ${expanded && connection.users ? html`
        <div class="ml-8 space-y-1">
          ${connection.users.map(userName => 
            UserManagementRenderer.renderUserNode(connection, userName, onContextMenu)
          )}
          ${connection.users.length === 0 ? html`
            <div class="ml-4 text-xs text-gray-500 italic">No users found</div>
          ` : ''}
        </div>
      ` : ''}
    `;
  }

  /**
   * Render an individual user node
   */
  static renderUserNode(
    connection: Connection,
    userName: string,
    onContextMenu: (event: MouseEvent, nodeId: string, nodeName: string, nodeType: string) => void
  ): TemplateResult {
    const userNodeId = generateUserNodeId(connection.id, userName);

    return html`
      <div class="flex items-center p-1 rounded hover:bg-base-300 cursor-pointer text-sm"
           @contextmenu=${(e: MouseEvent) => onContextMenu(e, userNodeId, userName, 'user')}>
        <span class="mr-2 w-4 text-center"></span>
        <span class="mr-2"><i class="fa-solid fa-user"></i></span>
        <span>${userName}</span>
      </div>
    `;
  }

  /**
   * Handle users node click event
   */
  static async handleUsersClick(
    connection: Connection,
    usersNodeId: string,
    isExpanded: (nodeId: string) => boolean,
    onToggleNode: (nodeId: string) => void,
    onSetActiveConnection: (connectionId: string) => void,
    onRequestUpdate: () => void
  ): Promise<void> {
    // Set this connection as the active one
    onSetActiveConnection(connection.id);
    
    // Extract database name from users node ID (format: connectionId-database-databaseName-users)
    const parts = usersNodeId.split('-');
    const databaseIndex = parts.indexOf('database');
    if (databaseIndex !== -1 && databaseIndex + 1 < parts.length) {
      const databaseName = parts[databaseIndex + 1];
      
      // Set database context before users operations
      try {
        const { connectionManager } = await import('../../services/connection-manager');
        await connectionManager.setDatabaseContext(connection.id, databaseName);
      } catch (error) {
        console.error('Failed to set database context for users:', databaseName, error);
      }
    }
    
    // Toggle the users node
    onToggleNode(usersNodeId);
    console.log('Users clicked for connection:', connection.name);
    
    // If expanding and users are not loaded or empty, refresh metadata
    if (isExpanded(usersNodeId) && (!connection.users || connection.users.length === 0)) {
      try {
        await TreeDataService.fetchConnectionUsers(connection.id);
        console.log('Users data refreshed:', connection.users);
        onRequestUpdate();
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    }
  }
}
