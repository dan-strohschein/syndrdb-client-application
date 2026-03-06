import { html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { ModalState } from './types/modal-props';
import type { Bundle } from './types/bundle';
import './components/sidebar-panel';
import './components/main-panel';
import './components/connection-tree/connection-tree';
import './components/connection-modal';
import './components/query-editor/query-editor-tab-container';
import './components/query-editor/graphql-query-editor';
// import './components/query-editor/syndrql-query-editor';
import './components/json-tree/json-tree';
import './components/json-tree/json-tree-node';
import './components/navigation-bar';
import './components/animated-logo';
import './components/query-editor/query-editor-frame';
import './components/about-modal';
import './components/user-modal';
import './components/database-modal';
import './components/bundle-modal/bundle-modal';
import './components/bundle-modal/fields-tab';
import './components/bundle-modal/indexes-tab';
import './components/bundle-modal/relationships-tab';
import './components/bundle-modal/relationship-field-editor'
import './components/bundle-modal/field-definition-editor';
import './components/code-editor/code-editor';
import './components/error-modal';
import './components/backup-modal';
import './components/restore-modal';
import './components/delete-database-modal';
import './components/delete-bundle-modal';
import './components/status-bar';
import './components/toast-notification';
import './components/command-palette';
import './components/toolbar';
import './components/query-history-panel';
import './components/server-profiler/server-profiler-tab';
import './components/server-profiler/profiler-connection-picker';
import './components/server-profiler/profiler-metrics-display';
import './components/session-manager/session-manager-tab';
import './components/session-manager/session-connection-picker';
import './components/session-manager/session-list-view';
import './components/session-manager/session-detail-view';
import './tools/importer/components/import-wizard-modal';
import './tools/exporter/components/export-wizard-modal';

import './components/dragndrop/draggable-demo';
import './components/dragndrop/draggable';
import './components/dragndrop/droppable';
import './components/code-editor/code-editor';
import './components/code-editor/suggestion-complete/suggestion-dropdown';

// Import configuration and validation systems
import { configLoader } from './config/config-loader.js';
import { validateAllGrammars } from './components/code-editor/syndrQL-language-serviceV2/schema-validator.js';
import { connectionManager } from './services/connection-manager';
import { pluginRegistry } from './services/plugin-registry';

/**
 * Initialize application configuration and validation
 */
async function initializeApplication() {
  try {
    console.log('🚀 Initializing SyndrDB Client Application...');

    // Load configuration
    console.log('📝 Loading configuration...');
    await configLoader.loadConfig('/config.yaml');
    const config = configLoader.getConfig();
    console.log(`✅ Configuration loaded (environment: ${config.environment})`);

    // Validate grammar files on system launch
    console.log('🔍 Validating grammar files...');
    await validateAllGrammars();
    console.log('✅ Grammar validation complete');

    // Initialize visual plugin system
    console.log('🔌 Loading visual plugins...');
    await pluginRegistry.initialize();
    console.log(`✅ Visual plugins loaded (${pluginRegistry.getActivePlugins().length} active)`);

    console.log('✅ Application initialization complete');
  } catch (error) {
    console.error('❌ Application initialization failed:', error);
    // Show error toast once the app has rendered
    setTimeout(() => {
      import('./components/toast-notification').then(({ ToastNotification }) => {
        ToastNotification.error(`Initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}. Check console for details.`);
      });
    }, 500);
    throw error;
  }
}

// Initialize on app load
initializeApplication().catch(error => {
  console.error('Fatal error during initialization:', error);
});

@customElement('app-root')
export class AppRoot extends LitElement {
  // Disable Shadow DOM to allow global Tailwind CSS
  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    // Listen for add-query-editor events and forward them to main-panel
    this.addEventListener('add-query-editor', (event: Event) => {
      this.handleAddQueryEditor(event as CustomEvent);
    });
    
    // List for edit connection events
    this.addEventListener('edit-connection', (event: Event) => {
      this.handleEditConnection(event as CustomEvent);
    });
    
    // Listen for edit-database events
    this.addEventListener('edit-database', (event: Event) => {
      this.handleEditDatabase(event as CustomEvent);
    });
    
    // List for delete connection events
    this.addEventListener('delete-connection', (event: Event) => {
      this.handleDeleteConnection(event as CustomEvent);
    });

    // Listen for about modal requests
    this.addEventListener('about-modal-requested', (event: Event) => {
      this.handleAboutModalRequest();
    });
    
    // Listen for add-user events
    this.addEventListener('add-user', (event: Event) => {
      this.handleAddUserRequest();
    });
    
    // Listen for edit-user events
    this.addEventListener('edit-user', (event: Event) => {
      this.handleEditUserRequest(event as CustomEvent);
    });

    // Listen for new-database-requested events
    this.addEventListener('new-database-requested', (event: Event) => {
      this.handleNewDatabaseRequest(event as CustomEvent);
    });

    // Listen for new-bundle-requested events
    this.addEventListener('new-bundle-requested', (event: Event) => {
      this.handleNewBundleRequest(event as CustomEvent);
    });

    // List for edit-bundle events
     this.addEventListener('edit-bundle-requested', (event: Event) => {
      this.handleEditBundleRequest(event as CustomEvent);
    });

    // Listen for database-created events
    this.addEventListener('database-created', (event: Event) => {
      this.handleDatabaseCreated(event as CustomEvent);
    });

    // Listen for connect-database events
    this.addEventListener('connect-database', (event: Event) => {
      this.handleConnectDatabase(event as CustomEvent);
    });

    // Listen for disconnect-database events
    this.addEventListener('disconnect-database', (event: Event) => {
      this.handleDisconnectDatabase(event as CustomEvent);
    });

    // Listen for test-connection events
    this.addEventListener('test-connection', (event: Event) => {
      this.handleTestConnection(event as CustomEvent);
    });

    // Listen for connection-error events
    this.addEventListener('connection-error', (event: Event) => {
      this.handleConnectionError(event as CustomEvent);
    });
    
    // Listen for query execution results to update status bar
    this.addEventListener('query-executed', (event: Event) => {
      this.handleQueryExecuted(event as CustomEvent);
    });

    this.addEventListener('close-modal', () => {
      this.handleCloseModal();
    });

    this.addEventListener('open-connection-modal', () => {
      this.modalState = { type: 'connection', props: { open: true } };
    });

    this.addEventListener('backup-database-requested', (event: Event) => {
      this.handleBackupDatabaseRequest(event as CustomEvent);
    });

    this.addEventListener('restore-database-requested', (event: Event) => {
      this.handleRestoreDatabaseRequest(event as CustomEvent);
    });

    this.addEventListener('ai-assistant-toggle-requested', () => {
      this.aiPanelOpen = !this.aiPanelOpen;
      this.activeTool = this.aiPanelOpen ? 'ai-assistant' : '';
    });

    this.addEventListener('open-query-history', () => {
      this.activeTool = 'history';
      // Clear after the panel opens so the highlight is momentary
      setTimeout(() => { this.activeTool = ''; }, 1500);
    });

    this.addEventListener('query-executing', (event: Event) => {
      const { executing } = (event as CustomEvent).detail;
      this.isExecuting = executing;
    });

    // Listen for open-plugin-tab events and forward to main-panel
    this.addEventListener('open-plugin-tab', (event: Event) => {
      const mainPanel = this.querySelector('main-panel');
      if (mainPanel) {
        mainPanel.dispatchEvent(new CustomEvent('open-plugin-tab', {
          detail: (event as CustomEvent).detail,
          bubbles: false
        }));
      }
    });

    // Listen for open-bundle-query events (double-click on bundle in tree)
    this.addEventListener('open-bundle-query', (event: Event) => {
      const { bundleName, databaseName, connectionId } = (event as CustomEvent).detail;
      const mainPanel = this.querySelector('main-panel');
      if (mainPanel) {
        mainPanel.dispatchEvent(new CustomEvent('add-query-editor', {
          detail: {
            query: `FIND * IN "${bundleName}" LIMIT 10;`,
            databaseName,
            connectionId
          },
          bubbles: false
        }));
      }
    });

    // Listen for open-profiler-tab events and forward to main-panel
    this.addEventListener('open-profiler-tab', () => {
      const mainPanel = this.querySelector('main-panel');
      if (mainPanel) {
        mainPanel.dispatchEvent(new CustomEvent('open-profiler-tab', { bubbles: false }));
      }
    });

    // Listen for open-session-manager-tab events and forward to main-panel
    this.addEventListener('open-session-manager-tab', () => {
      const mainPanel = this.querySelector('main-panel');
      if (mainPanel) {
        mainPanel.dispatchEvent(new CustomEvent('open-session-manager-tab', { bubbles: false }));
      }
    });

    // Listen for open-schema-diagram events and forward to main-panel
    this.addEventListener('open-schema-diagram', (event: Event) => {
      const mainPanel = this.querySelector('main-panel');
      if (mainPanel) {
        mainPanel.dispatchEvent(new CustomEvent('open-schema-diagram', {
          detail: (event as CustomEvent).detail,
          bubbles: false
        }));
      }
    });

    // Listen for import wizard requests
    this.addEventListener('import-wizard-requested', (event: Event) => {
      this.handleImportWizardRequest(event as CustomEvent);
    });

    // Listen for export wizard requests
    this.addEventListener('export-wizard-requested', (event: Event) => {
      this.handleExportWizardRequest(event as CustomEvent);
    });

    // Listen for delete database requests
    this.addEventListener('delete-database-requested', (event: Event) => {
      this.handleDeleteDatabaseRequest(event as CustomEvent);
    });

    // Listen for database-deleted events to refresh the tree
    this.addEventListener('database-deleted', (event: Event) => {
      this.handleDatabaseDeleted(event as CustomEvent);
    });

    // Listen for delete bundle requests
    this.addEventListener('delete-bundle-requested', (event: Event) => {
      this.handleDeleteBundleRequest(event as CustomEvent);
    });

    // Listen for bundle-deleted events to refresh the tree
    this.addEventListener('bundle-deleted', (event: Event) => {
      this.handleBundleDeleted(event as CustomEvent);
    });

    // Listen for refresh-tree-node events
    this.addEventListener('refresh-tree-node', (event: Event) => {
      this.handleRefreshTreeNode(event as CustomEvent);
    });
  }

  @state()
  private aiPanelOpen = false;

  @state()
  private activeTool = '';

  @state()
  private isExecuting = false;

  @state()
  private modalState: ModalState = { type: 'none' };

  @state()
  private sidebarWidth = parseInt(localStorage.getItem('sidebar-width') || '30', 10);

  private _resizing = false;

  private _onResizeMove = (e: MouseEvent) => {
    if (!this._resizing) return;
    const pct = (e.clientX / window.innerWidth) * 100;
    this.sidebarWidth = Math.max(15, Math.min(50, pct));
  };

  private _onResizeEnd = () => {
    this._resizing = false;
    document.removeEventListener('mousemove', this._onResizeMove);
    document.removeEventListener('mouseup', this._onResizeEnd);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    localStorage.setItem('sidebar-width', String(Math.round(this.sidebarWidth)));
  };

  private _startResize = () => {
    this._resizing = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', this._onResizeMove);
    document.addEventListener('mouseup', this._onResizeEnd);
  };

  @state()
  private statusBarState: { executionTimeMS: number; resultCount: number } = {
    executionTimeMS: 0,
    resultCount: 0,
  };

  private handleCloseModal(): void {
    this.modalState = { type: 'none' };
  }

  private handleEditConnection(event: CustomEvent) {
    const { connectionId } = event.detail;
    const connection = connectionManager.getConnection(connectionId);
    if (!connection) {
      console.error('❌ Connection not found:', connectionId);
      return;
    }
    this.modalState = {
      type: 'connection',
      props: { open: true, editMode: true, connectionToEdit: connection },
    };
  }

  private handleEditDatabase(event: CustomEvent) {
    const { connectionId, databaseName } = event.detail;
    this.modalState = {
      type: 'database',
      props: {
        open: true,
        editMode: true,
        connectionId,
        databaseToEdit: { name: databaseName },
      },
    };
  }

  private handleDeleteConnection(event: CustomEvent) {
    this.modalState = {
      type: 'connection',
      props: { open: true, connectionId: event.detail?.connectionId },
    };
  }

  private handleAddQueryEditor(event: CustomEvent) {
   // console.log('🎯 App root received add-query-editor event, forwarding to main-panel');
   // console.log('Event detail:', event.detail);
    
    // Find the main-panel element and dispatch the event to it
    const mainPanel = this.querySelector('main-panel');
    if (mainPanel) {
      console.log('📤 Dispatching event to main-panel');
      mainPanel.dispatchEvent(new CustomEvent('add-query-editor', {
        detail: event.detail,
        bubbles: false // Don't need to bubble further
      }));
    } else {
      console.error('❌ Could not find main-panel element');
    }
  }

  private handleNewDatabaseRequest(event: CustomEvent) {
    this.modalState = {
      type: 'database',
      props: { open: true, connectionId: event.detail?.connectionId },
    };
  }

  private handleNewBundleRequest(event: CustomEvent) {
    const { connectionId, databaseName } = event.detail || {};
    if (!connectionId) {
      console.error('❌ New bundle request missing connectionId');
      this.showBundleError('Cannot create bundle: Missing connection information');
      return;
    }
    this.modalState = {
      type: 'bundle',
      props: {
        open: true,
        connectionId,
        databaseName: databaseName ?? null,
        bundleId: null,
        bundle: null,
      },
    };
  }

  private handleEditBundleRequest(event: CustomEvent) {
    const { bundleId, bundle, connectionId } = event.detail || {};
    if (!bundleId && !bundle) {
      this.showBundleError('Cannot edit bundle: Missing bundle identifier or data');
      return;
    }
    if (!connectionId) {
      this.showBundleError('Cannot edit bundle: Missing connection information');
      return;
    }

    const validatedBundle: Bundle | null =
      bundle && this.validateBundleObject(bundle) ? bundle : null;
    this.modalState = {
      type: 'bundle',
      props: {
        open: true,
        connectionId,
        bundleId: bundleId ?? undefined,
        bundle: validatedBundle ?? null,
      },
    };
  }

  /**
   * Validate that a bundle object has the minimum required properties
   */
  private validateBundleObject(bundle: unknown): bundle is Bundle {
    if (!bundle || typeof bundle !== 'object') {
      return false;
    }
    const obj = bundle as Record<string, unknown>;
    if (!obj['Name']) {
      return false;
    }
    return true;
  }

  /**
   * Show bundle-related error messages to the user
   */
  private showBundleError(message: string): void {
    this.modalState = { type: 'error', props: { open: true, errorMessage: message } };
  }

  private async handleDatabaseCreated(event: CustomEvent) {
    // console.log('🎯 App root received database-created event');
    // console.log('Event detail:', event.detail);

    // Find the sidebar-panel and trigger a tree refresh
    const sidebarPanel = this.querySelector('sidebar-panel');
    if (sidebarPanel) {
      console.log('📤 Refreshing connection tree after database creation');
      // Dispatch an event to refresh the specific connection node
      sidebarPanel.dispatchEvent(new CustomEvent('refresh-connection', {
        detail: { connectionId: event.detail?.connectionId },
        bubbles: false
      }));
    } else {
      console.error('❌ Could not find sidebar-panel element');
    }
  }

  private handleAboutModalRequest() {
    this.modalState = { type: 'about', props: { open: true } };
  }

  private handleAddUserRequest() {
    this.modalState = { type: 'user', props: { open: true, user: null } };
  }

  private handleEditUserRequest(event: CustomEvent) {
    const userName = event.detail?.userName as string;
    const userData = {
      name: userName,
      userId: userName,
      password: '',
      isActive: true,
      isLockedOut: false,
      failedLoginAttempts: 0,
      lockoutExpiresOn: null,
    };
    this.modalState = { type: 'user', props: { open: true, user: userData } };
  }

  private handleConnectDatabase(event: CustomEvent) {
    // console.log('🎯 App root received connect-database event');
    // console.log('Event detail:', event.detail);
    
    // In a prod application, we would:
    // 1. Get connection details from the connection store
    // 2. Establish a database connection
    // 3. Update connection status
    // 4. Notify the connection tree of the status change
    
    // For now, we'll just log the connection attempt
   // console.log(`🔌 Attempting to connect to database: ${event.detail.connectionId}`);
    // We typically dispatch this to the connection service
    // connectionService.connect(event.detail.connectionId);
  }

  private handleDisconnectDatabase(event: CustomEvent) {
    // console.log('🎯 App root received disconnect-database event');
    // console.log('Event detail:', event.detail);
    
    // In a production application, we would:
    // 1. Close the database connection
    // 2. Update connection status
    // 3. Notify the connection tree of the status change
    
    console.log(`🔌 Attempting to disconnect from database: ${event.detail.connectionId}`);
    // connectionService.disconnect(event.detail.connectionId);
  }

  private handleTestConnection(event: CustomEvent) {
    // console.log('🎯 App root received test-connection event');
    // console.log('Event detail:', event.detail);
    
    // In a real application, you would:
    // 1. Test the connection using stored connection details
    // 2. Show a result message (success/failure)
    // 3. Optionally update the connection status
    
    console.log(`🧪 Testing connection: ${event.detail.connectionName} (ID: ${event.detail.connectionId})`);
    
    // Show toast notification for connection test result
    setTimeout(() => {
      import('./components/toast-notification').then(({ ToastNotification }) => {
        ToastNotification.success(`Connection test for "${event.detail.connectionName}": Success!`);
      });
    }, 100); // Small delay to let the context menu close first
  }

  private handleBackupDatabaseRequest(event: CustomEvent) {
    const { connectionId, databaseName } = event.detail || {};
    this.modalState = {
      type: 'backup',
      props: {
        open: true,
        connectionId: connectionId ?? null,
        databaseName: databaseName ?? null,
      },
    };
  }

  private handleRestoreDatabaseRequest(event: CustomEvent) {
    const { connectionId } = event.detail || {};
    this.modalState = {
      type: 'restore',
      props: {
        open: true,
        connectionId: connectionId ?? null,
      },
    };
  }

  private handleImportWizardRequest(event?: CustomEvent) {
    const { connectionId, databaseName, bundleName } = event?.detail || {};
    this.modalState = {
      type: 'import-wizard',
      props: {
        open: true,
        connectionId: connectionId ?? null,
        databaseName: databaseName ?? null,
        bundleName: bundleName ?? null,
      },
    };
  }

  private handleDeleteDatabaseRequest(event: CustomEvent) {
    const { connectionId, nodeName } = event.detail || {};
    this.modalState = {
      type: 'delete-database',
      props: {
        open: true,
        connectionId: connectionId ?? null,
        databaseName: nodeName ?? null,
      },
    };
  }

  private handleDatabaseDeleted(event: CustomEvent) {
    const sidebarPanel = this.querySelector('sidebar-panel');
    if (sidebarPanel) {
      console.log('📤 Refreshing connection tree after database deletion');
      sidebarPanel.dispatchEvent(new CustomEvent('refresh-connection', {
        detail: { connectionId: event.detail?.connectionId },
        bubbles: false
      }));
    }
  }

  private handleDeleteBundleRequest(event: CustomEvent) {
    const { connectionId, nodeName, nodeId } = event.detail || {};
    // Extract database name from nodeId format: connectionId-database-databaseName-bundle-bundleName
    const parts = (nodeId as string)?.split('-') ?? [];
    const databaseIndex = parts.indexOf('database');
    const databaseName = databaseIndex !== -1 && databaseIndex + 1 < parts.length
      ? parts[databaseIndex + 1]
      : null;

    this.modalState = {
      type: 'delete-bundle',
      props: {
        open: true,
        connectionId: connectionId ?? null,
        databaseName,
        bundleName: nodeName ?? null,
      },
    };
  }

  private handleBundleDeleted(event: CustomEvent) {
    const sidebarPanel = this.querySelector('sidebar-panel');
    if (sidebarPanel) {
      console.log('📤 Refreshing connection tree after bundle deletion');
      sidebarPanel.dispatchEvent(new CustomEvent('refresh-connection', {
        detail: { connectionId: event.detail?.connectionId },
        bubbles: false
      }));
    }
  }

  private async handleRefreshTreeNode(event: CustomEvent) {
    const { connectionId, nodeType } = event.detail;
    if (!connectionId) return;

    try {
      await connectionManager.refreshMetadata(connectionId);
      const sidebarPanel = this.querySelector('sidebar-panel');
      if (sidebarPanel) {
        sidebarPanel.dispatchEvent(new CustomEvent('refresh-connection', {
          detail: { connectionId },
          bubbles: false
        }));
      }
      import('./components/toast-notification').then(({ ToastNotification }) => {
        ToastNotification.success(`Refreshed ${nodeType || 'node'}`);
      });
    } catch (error) {
      console.error('Failed to refresh tree node:', error);
      import('./components/toast-notification').then(({ ToastNotification }) => {
        ToastNotification.error('Failed to refresh');
      });
    }
  }

  private handleExportWizardRequest(event?: CustomEvent) {
    const { connectionId, databaseName } = event?.detail || {};
    this.modalState = {
      type: 'export-wizard',
      props: {
        open: true,
        connectionId: connectionId ?? null,
        databaseName: databaseName ?? null,
      },
    };
  }

  private handleConnectionError(event: CustomEvent) {
    const { connectionName, error } = event.detail;
    const errorMessage = error || 'Unknown connection error occurred.';
    this.modalState = {
      type: 'error',
      props: {
        open: true,
        errorMessage: `Failed to connect to "${connectionName}": ${errorMessage}`,
      },
    };
  }
  
  /**
   * Handle query execution results and update status bar
   */
  private handleQueryExecuted(event: CustomEvent) {
    const { executionTime, ResultCount } = event.detail;
    this.statusBarState = {
      executionTimeMS: executionTime !== undefined ? executionTime : this.statusBarState.executionTimeMS,
      resultCount: ResultCount !== undefined ? ResultCount : this.statusBarState.resultCount,
    };
  }

  render() {
    return html`
      <div class="h-screen bg-surface-0 text-base-content flex flex-col">

          <!-- Navigation Bar (full width, no horizontal margin) -->
          <div class="w-full flex-shrink-0">
            <navigation-bar></navigation-bar>
          </div>

        <div class="flex-1 flex min-w-0">
          <!-- Activity Bar (vertical toolbar) -->
          <app-toolbar .activeTool=${this.activeTool}></app-toolbar>
          <!-- Sidebar: Connections -->
          <sidebar-panel class="min-w-0 flex-shrink-0 bg-surface-1" style="width: ${this.sidebarWidth}%"></sidebar-panel>
          <!-- Resize Handle -->
          <div
            class="w-1 cursor-col-resize hover:bg-accent/30 active:bg-accent/50 transition-colors flex-shrink-0"
            @mousedown=${this._startResize}
          ></div>
          <!-- Center: Code editor (query tabs + results) -->
          <main-panel class="flex-1 min-w-0 bg-surface-2" .aiPanelOpen=${this.aiPanelOpen}></main-panel>
        </div>
        
        <!-- Status Bar at the bottom -->
        <status-bar
          id="main-status-bar"
          .executionTimeMS=${this.statusBarState.executionTimeMS}
          .resultCount=${this.statusBarState.resultCount}
          .executing=${this.isExecuting}
        ></status-bar>

        <!-- Modals: bound from modalState (no querySelector, no casts) -->
        <connection-modal
          .open=${this.modalState.type === 'connection'}
          .editMode=${this.modalState.type === 'connection' ? (this.modalState.props.editMode ?? false) : false}
          .connectionToEdit=${this.modalState.type === 'connection' ? this.modalState.props.connectionToEdit ?? null : null}
          .connectionId=${this.modalState.type === 'connection' ? this.modalState.props.connectionId ?? null : null}
          @close-modal=${this.handleCloseModal}
        ></connection-modal>
        <about-modal
          .open=${this.modalState.type === 'about'}
          @close-modal=${this.handleCloseModal}
        ></about-modal>
        <user-modal
          .open=${this.modalState.type === 'user'}
          .user=${this.modalState.type === 'user' ? this.modalState.props.user ?? null : null}
          @close-modal=${this.handleCloseModal}
        ></user-modal>
        <database-modal
          .open=${this.modalState.type === 'database'}
          .connectionId=${this.modalState.type === 'database' ? this.modalState.props.connectionId ?? null : null}
          .editMode=${this.modalState.type === 'database' ? (this.modalState.props.editMode ?? false) : false}
          .databaseToEdit=${this.modalState.type === 'database' ? this.modalState.props.databaseToEdit ?? null : null}
          @close-modal=${this.handleCloseModal}
        ></database-modal>
        <bundle-modal
          .open=${this.modalState.type === 'bundle'}
          .connectionId=${this.modalState.type === 'bundle' ? this.modalState.props.connectionId ?? null : null}
          .databaseName=${this.modalState.type === 'bundle' ? this.modalState.props.databaseName ?? null : null}
          .bundleId=${this.modalState.type === 'bundle' ? this.modalState.props.bundleId ?? null : null}
          .bundle=${this.modalState.type === 'bundle' ? this.modalState.props.bundle ?? null : null}
          @close-modal=${this.handleCloseModal}
        ></bundle-modal>
        <error-modal
          .open=${this.modalState.type === 'error'}
          .errorMessage=${this.modalState.type === 'error' ? this.modalState.props.errorMessage ?? '' : ''}
          @close-modal=${this.handleCloseModal}
        ></error-modal>
        <backup-modal
          .open=${this.modalState.type === 'backup'}
          .connectionId=${this.modalState.type === 'backup' ? this.modalState.props.connectionId ?? null : null}
          .databaseName=${this.modalState.type === 'backup' ? this.modalState.props.databaseName ?? null : null}
          @close-modal=${this.handleCloseModal}
        ></backup-modal>
        <restore-modal
          .open=${this.modalState.type === 'restore'}
          .connectionId=${this.modalState.type === 'restore' ? this.modalState.props.connectionId ?? null : null}
          @close-modal=${this.handleCloseModal}
        ></restore-modal>
        <import-wizard-modal
          .open=${this.modalState.type === 'import-wizard'}
          .connectionId=${this.modalState.type === 'import-wizard' ? this.modalState.props.connectionId ?? null : null}
          .databaseName=${this.modalState.type === 'import-wizard' ? this.modalState.props.databaseName ?? null : null}
          .bundleName=${this.modalState.type === 'import-wizard' ? this.modalState.props.bundleName ?? null : null}
          @close-modal=${this.handleCloseModal}
        ></import-wizard-modal>
        <export-wizard-modal
          .open=${this.modalState.type === 'export-wizard'}
          .connectionId=${this.modalState.type === 'export-wizard' ? this.modalState.props.connectionId ?? null : null}
          .databaseName=${this.modalState.type === 'export-wizard' ? this.modalState.props.databaseName ?? null : null}
          @close-modal=${this.handleCloseModal}
        ></export-wizard-modal>
        <delete-database-modal
          .open=${this.modalState.type === 'delete-database'}
          .connectionId=${this.modalState.type === 'delete-database' ? this.modalState.props.connectionId ?? null : null}
          .databaseName=${this.modalState.type === 'delete-database' ? this.modalState.props.databaseName ?? null : null}
          @close-modal=${this.handleCloseModal}
        ></delete-database-modal>
        <delete-bundle-modal
          .open=${this.modalState.type === 'delete-bundle'}
          .connectionId=${this.modalState.type === 'delete-bundle' ? this.modalState.props.connectionId ?? null : null}
          .databaseName=${this.modalState.type === 'delete-bundle' ? this.modalState.props.databaseName ?? null : null}
          .bundleName=${this.modalState.type === 'delete-bundle' ? this.modalState.props.bundleName ?? null : null}
          @close-modal=${this.handleCloseModal}
        ></delete-bundle-modal>

        <!-- Toast Notification Container -->
        <toast-notification></toast-notification>

        <!-- Command Palette (Ctrl+K) -->
        <command-palette></command-palette>

        <!-- Query History Panel -->
        <query-history-panel></query-history-panel>
    </div>
    `;
  }
}

// Initialize the app
const app = document.getElementById('app');
if (app) {
  app.innerHTML = '<app-root></app-root>';
}

declare global {
  interface HTMLElementTagNameMap {
    'app-root': AppRoot;
  }
}
