/**
 * Context menu handler for the connection tree
 */
import { html, TemplateResult } from 'lit';
import { ContextMenuState, CONTEXT_MENU_ACTIONS, NODE_TYPES } from './tree-types';

export class TreeContextMenuHandler {
  /**
   * Create context menu state
   */
  static createContextMenu(
    event: MouseEvent, 
    nodeId: string, 
    nodeName: string, 
    nodeType: string,
    data: any
  ): ContextMenuState {
    return {
      visible: true,
      x: event.clientX,
      y: event.clientY,
      nodeId,
      nodeName,
      nodeType,
      data
    };
  }

  /**
   * Handle context menu actions
   */
  static handleContextMenuAction(
    action: string,
    contextMenu: ContextMenuState,
    eventDispatcher: (event: CustomEvent) => void
  ): void {
    console.log(`Context menu action: ${action} for ${contextMenu.nodeType} "${contextMenu.nodeName}"`);
    
    switch (action) {
      case CONTEXT_MENU_ACTIONS.TEST:
        console.log('🧪 Dispatching test-connection event');
        eventDispatcher(new CustomEvent('test-connection', {
          detail: { 
            connectionId: contextMenu.nodeId,
            connectionName: contextMenu.nodeName 
          },
          bubbles: true
        }));
        break;
      case CONTEXT_MENU_ACTIONS.EDIT_CONNECTION:
        console.log('✏️ Dispatching edit-connection event from connection tree');
        eventDispatcher(new CustomEvent('edit-connection', {
          detail: { 
            connectionId: contextMenu.nodeId,
            connectionName: contextMenu.nodeName 
          },
          bubbles: true
        }));
        console.log('✅ Edit connection event dispatched successfully');
        break;  
      case CONTEXT_MENU_ACTIONS.QUERY:
        console.log('🚀 Dispatching add-query-editor event from connection tree');
        
        // Extract database context from node ID
        const databaseContext = TreeContextMenuHandler.extractDatabaseContext(contextMenu.nodeId, contextMenu.nodeType);
        
        const queryDetail = {
          query: `-- Query for ${contextMenu.nodeType} "${contextMenu.nodeName}"`,
          databaseName: databaseContext.databaseName,
          connectionId: databaseContext.connectionId
        };
        
        eventDispatcher(new CustomEvent('add-query-editor', {
          detail: queryDetail,
          bubbles: true
        }));
        console.log('✅ Event dispatched successfully with database context:', databaseContext);
        break;
        
      case CONTEXT_MENU_ACTIONS.ADD_USER:
        console.log('👤 Dispatching add-user event from connection tree');
        eventDispatcher(new CustomEvent('add-user', {
          detail: { 
            nodeType: contextMenu.nodeType,
            nodeName: contextMenu.nodeName,
            nodeId: contextMenu.nodeId
          },
          bubbles: true
        }));
        console.log('✅ Add user event dispatched successfully');
        break;
        
      case CONTEXT_MENU_ACTIONS.EDIT_USER:
        console.log('✏️ Dispatching edit-user event from connection tree');
        // Extract connection ID from the nodeId (format: connectionId-user-userName)
        const connectionId = contextMenu.nodeId.split('-user-')[0];
        eventDispatcher(new CustomEvent('edit-user', {
          detail: { 
            userName: contextMenu.nodeName,
            connectionId: connectionId,
            nodeType: contextMenu.nodeType,
            nodeId: contextMenu.nodeId
          },
          bubbles: true
        }));
        console.log('✅ Edit user event dispatched successfully');
        break;

      case CONTEXT_MENU_ACTIONS.NEW_DATABASE:
        console.log('🗄️ Dispatching new-database-requested event from connection tree');
        eventDispatcher(new CustomEvent('new-database-requested', {
          detail: { 
            connectionId: contextMenu.nodeId.split('-')[0], // Extract connection ID
            nodeType: contextMenu.nodeType,
            nodeName: contextMenu.nodeName,
            nodeId: contextMenu.nodeId
          },
          bubbles: true
        }));
        console.log('✅ New database event dispatched successfully');
        break;
        case CONTEXT_MENU_ACTIONS.EDIT_DATABASE:
            console.log('🗄️ Dispatching edit-database event from connection tree');
            const editDatabaseContext = TreeContextMenuHandler.extractDatabaseContext(contextMenu.nodeId, contextMenu.nodeType);
            eventDispatcher(new CustomEvent('edit-database', {
                detail: { 
                    connectionId: editDatabaseContext.connectionId,
                    databaseName: editDatabaseContext.databaseName || contextMenu.nodeName,
                    nodeType: contextMenu.nodeType,
                    nodeId: contextMenu.nodeId
                },
                bubbles: true
            }));
            console.log('✅ Edit database event dispatched successfully with database context:', editDatabaseContext);
        break;
        case CONTEXT_MENU_ACTIONS.DELETE_DATABASE:
            console.log('🗄️ Dispatching delete-database-requested event from connection tree')
            eventDispatcher(new CustomEvent('delete-database-requested', {
                detail: { 
                connectionId: contextMenu.nodeId.split('-')[0], // Extract connection ID
                nodeType: contextMenu.nodeType,
                nodeName: contextMenu.nodeName,
                nodeId: contextMenu.nodeId
            },
            bubbles: true
            }));
            console.log('✅ Delete database event dispatched successfully');
        break;

        case CONTEXT_MENU_ACTIONS.NEW_BUNDLE:
        console.log('🗄️ Dispatching new-bundle-requested event from connection tree');
        eventDispatcher(new CustomEvent('new-bundle-requested', {
          detail: { 
            connectionId: contextMenu.nodeId.split('-')[0], // Extract connection ID
            nodeType: contextMenu.nodeType,
            nodeName: contextMenu.nodeName,
            nodeId: contextMenu.nodeId
          },
          bubbles: true
        }));
        console.log('✅ New bundle event dispatched successfully');
        break;
        case CONTEXT_MENU_ACTIONS.EDIT_BUNDLE:
            console.log('🗄️ Dispatching edit-bundle-requested event from connection tree')
            
            // Extract bundle information from nodeId and nodeName
            const bundleConnectionId = contextMenu.nodeId.split('-')[0]; // Extract connection ID
            const bundleId = contextMenu.nodeId; // Use full nodeId as bundleId
            const bundleName = contextMenu.nodeName; // Use nodeName as bundle name
            const bundle = contextMenu.data; // Use data for additional bundle info

            console.log('📊 Bundle edit data:', {
                nodeId: contextMenu.nodeId,
                nodeName: contextMenu.nodeName,
                extractedConnectionId: bundleConnectionId,
                bundleId: bundleId,
                bundleName: bundleName
            });
            
            eventDispatcher(new CustomEvent('edit-bundle-requested', {
                detail: { 
                connectionId: bundleConnectionId,
                bundleId: bundleId, // Pass the bundle ID
                bundleName: bundleName, // Pass the bundle name
                bundle: bundle, // Pass the full bundle data if available
                nodeType: contextMenu.nodeType,
                nodeName: contextMenu.nodeName,
                nodeId: contextMenu.nodeId
            },
            bubbles: true
            }));
            console.log('✅ Edit bundle event dispatched successfully');
        break;
        case CONTEXT_MENU_ACTIONS.BACKUP_DATABASE: {
            const backupContext = TreeContextMenuHandler.extractDatabaseContext(contextMenu.nodeId, contextMenu.nodeType);
            eventDispatcher(new CustomEvent('backup-database-requested', {
                detail: {
                    connectionId: backupContext.connectionId,
                    databaseName: backupContext.databaseName || contextMenu.nodeName
                },
                bubbles: true
            }));
            break;
        }
        case CONTEXT_MENU_ACTIONS.RESTORE_DATABASE: {
            const restoreContext = TreeContextMenuHandler.extractDatabaseContext(contextMenu.nodeId, contextMenu.nodeType);
            eventDispatcher(new CustomEvent('restore-database-requested', {
                detail: {
                    connectionId: restoreContext.connectionId,
                    databaseName: restoreContext.databaseName || contextMenu.nodeName
                },
                bubbles: true
            }));
            break;
        }
        case CONTEXT_MENU_ACTIONS.DELETE_BUNDLE:
            console.log('🗄️ Dispatching delete-bundle-requested event from connection tree')
            eventDispatcher(new CustomEvent('delete-bundle-requested', {
                detail: { 
                connectionId: contextMenu.nodeId.split('-')[0], // Extract connection ID
                nodeType: contextMenu.nodeType,
                nodeName: contextMenu.nodeName,
                nodeId: contextMenu.nodeId,
                bundle: contextMenu.data // Pass the full bundle data if available
            },
            bubbles: true
            }));
            console.log('✅ Delete bundle event dispatched successfully');
        break;
    }
  }

  /**
   * Get the appropriate actions for the context menu based on node type
   */
  static getContextMenuActions(nodeType: string): Array<{action: string, icon: string, label: string}> {
    const actions = [];
    
    if (nodeType === NODE_TYPES.DATABASES) {
      actions.push({
        action: CONTEXT_MENU_ACTIONS.NEW_DATABASE,
        icon: 'fa-database',
        label: 'New Database'
      });
    } else if (nodeType === NODE_TYPES.CONNECTION) {
      actions.push({
        action: CONTEXT_MENU_ACTIONS.EDIT_CONNECTION,
        icon: 'fa-pen-to-square',
        label: 'Edit Connection'
      });
      actions.push({
        action: CONTEXT_MENU_ACTIONS.NEW_DATABASE,
         icon: 'fa-database',
         label: 'New Database'
      });
     
    } else if (nodeType === NODE_TYPES.DATABASE) {
      actions.push({
        action: CONTEXT_MENU_ACTIONS.EDIT_DATABASE,
        icon: 'fa-edit',
        label: 'Edit Database'
      });
      actions.push({
        action: CONTEXT_MENU_ACTIONS.DELETE_DATABASE,
        icon: 'fa-trash',
        label: 'Delete Database'
      });
      actions.push({
        action: CONTEXT_MENU_ACTIONS.QUERY,
        icon: 'fa-plus',
        label: 'New Query Editor'
      });
      actions.push({
        action: CONTEXT_MENU_ACTIONS.BACKUP_DATABASE,
        icon: 'fa-download',
        label: 'Backup Database'
      });
      actions.push({
        action: CONTEXT_MENU_ACTIONS.RESTORE_DATABASE,
        icon: 'fa-upload',
        label: 'Restore Database'
      });
    } else if (nodeType === NODE_TYPES.USERS) {
      actions.push({
        action: CONTEXT_MENU_ACTIONS.ADD_USER,
        icon: 'fa-user-plus',
        label: 'Add User'
      });
    } else if (nodeType === NODE_TYPES.USER) {
      actions.push({
        action: CONTEXT_MENU_ACTIONS.EDIT_USER,
        icon: 'fa-user-edit',
        label: 'Edit User'
      });
    } else if (nodeType === NODE_TYPES.BUNDLES) {
      actions.push({
        action: CONTEXT_MENU_ACTIONS.NEW_BUNDLE,
        icon: 'fa-folder-plus',
        label: 'New Bundle'
      });
      actions.push({
        action: CONTEXT_MENU_ACTIONS.QUERY,
        icon: 'fa-plus',
        label: 'New Query Editor'
      });
    } else if (nodeType === NODE_TYPES.BUNDLE) {
      actions.push({
        action: CONTEXT_MENU_ACTIONS.EDIT_BUNDLE,
        icon: 'fa-pen-to-square',
        label: 'Edit Bundle'
      });
      actions.push({
        action: CONTEXT_MENU_ACTIONS.DELETE_BUNDLE,
        icon: 'fa-trash',
        label: 'Delete Bundle'
      });
    } else {
      actions.push({
        action: CONTEXT_MENU_ACTIONS.QUERY,
        icon: 'fa-plus',
        label: 'New Query Editor'
      });
    }
    
    // Add Test action for all node types
    // actions.push({
    //   action: CONTEXT_MENU_ACTIONS.TEST,
    //   icon: 'fa-flask',
    //   label: 'Test Connection'
    // });
    
    return actions;
  }

  /**
   * Extract database context from node ID
   */
  static extractDatabaseContext(nodeId: string, nodeType: string): { connectionId: string; databaseName: string | null } {
    const parts = nodeId.split('-');
    const connectionId = parts[0];
    
    // Find database name in node ID (format: connectionId-database-databaseName-...)
    const databaseIndex = parts.indexOf('database');
    let databaseName: string | null = null;
    
    if (databaseIndex !== -1 && databaseIndex + 1 < parts.length) {
      databaseName = parts[databaseIndex + 1];
    }
    
    return {
      connectionId,
      databaseName
    };
  }

  /**
   * Render the context menu
   */
  static renderContextMenu(
    contextMenu: ContextMenuState | null,
    onAction: (action: string) => void
  ): TemplateResult {
    if (!contextMenu?.visible) {
      return html``;
    }

    const actions = TreeContextMenuHandler.getContextMenuActions(contextMenu.nodeType);

    return html`
      <context-menu style="position: fixed; top: ${contextMenu.y}px; left: ${contextMenu.x}px; z-index: 1000;">
        <ul class="menu bg-base-200 w-56 rounded-box shadow-lg">
          ${actions.map(({action, icon, label}) => html`
            <li>
              <a @click=${(e: Event) => {
                e.preventDefault();
                e.stopPropagation();
                onAction(action);
              }}>
                <i class="fa-solid ${icon} mr-2"></i>
                ${label}${action === CONTEXT_MENU_ACTIONS.TEST ? ` - ${contextMenu.nodeName}` : ''}
              </a>
            </li>
          `)}
        </ul>
      </context-menu>
    `;
  }
}
