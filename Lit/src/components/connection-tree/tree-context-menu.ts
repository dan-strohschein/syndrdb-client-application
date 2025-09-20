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
    nodeType: string
  ): ContextMenuState {
    return {
      visible: true,
      x: event.clientX,
      y: event.clientY,
      nodeId,
      nodeName,
      nodeType
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
        
      case CONTEXT_MENU_ACTIONS.QUERY:
        console.log('🚀 Dispatching add-query-editor event from connection tree');
        eventDispatcher(new CustomEvent('add-query-editor', {
          detail: { query: `-- Query for ${contextMenu.nodeType} "${contextMenu.nodeName}"` },
          bubbles: true
        }));
        console.log('✅ Event dispatched successfully');
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
            console.log('🗄️ Dispatching edit-database-requested event from connection tree')
            eventDispatcher(new CustomEvent('edit-database-requested', {
                detail: { 
                connectionId: contextMenu.nodeId.split('-')[0], // Extract connection ID
                nodeType: contextMenu.nodeType,
                nodeName: contextMenu.nodeName,
                nodeId: contextMenu.nodeId
            },
            bubbles: true
            }));
            console.log('✅ Edit database event dispatched successfully');
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
            eventDispatcher(new CustomEvent('edit-bundle-requested', {
                detail: { 
                connectionId: contextMenu.nodeId.split('-')[0], // Extract connection ID
                nodeType: contextMenu.nodeType,
                nodeName: contextMenu.nodeName,
                nodeId: contextMenu.nodeId
            },
            bubbles: true
            }));
            console.log('✅ Edit bundle event dispatched successfully');
        break;
        case CONTEXT_MENU_ACTIONS.DELETE_BUNDLE:
            console.log('🗄️ Dispatching delete-bundle-requested event from connection tree')
            eventDispatcher(new CustomEvent('delete-bundle-requested', {
                detail: { 
                connectionId: contextMenu.nodeId.split('-')[0], // Extract connection ID
                nodeType: contextMenu.nodeType,
                nodeName: contextMenu.nodeName,
                nodeId: contextMenu.nodeId
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
              <a @click=${() => onAction(action)}>
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
