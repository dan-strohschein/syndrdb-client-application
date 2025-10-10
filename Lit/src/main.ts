import { html, css, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './components/sidebar-panel';
import './components/main-panel';
import './components/connection-tree/connection-tree';
import './components/connection-modal';
import './components/query-editor/query-editor';
import './components/query-editor/graphql-query-editor';
import './components/query-editor/syndrql-query-editor';
import './components/json-tree/json-tree';
import './components/json-tree/json-tree-node';
import './components/navigation-bar';
import './components/query-editor/query-editor-container';
import './components/about-modal';
import './components/user-modal';
import './components/database-modal';
import './components/bundle-modal/bundle-modal';
import './components/bundle-modal/fields-tab';
import './components/bundle-modal/indexes-tab';
import './components/bundle-modal/field-definition-editor';
import './components/code-editor/code-editor';
import './components/error-modal';
import './components/status-bar';
import './components/status-bar';
import './components/dragndrop/draggable-demo';
import './components/dragndrop/draggable';
import './components/dragndrop/droppable';
import './components/code-editor/code-editor';

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
      this.handleAboutModalRequest(event as CustomEvent);
    });
    
    // Listen for add-user events
    this.addEventListener('add-user', (event: Event) => {
      this.handleAddUserRequest(event as CustomEvent);
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
  }

  private handleEditConnection(event: CustomEvent) {
    console.log('🎯 App root received edit-connection event');
    console.log('Event detail:', event.detail);
    
    // Get the actual connection object from connection manager
    const { connectionId } = event.detail;
    
    // Import connection manager to get the connection object
    import('./services/connection-manager').then(({ connectionManager }) => {
      const connection = connectionManager.getConnection(connectionId);
      
      if (!connection) {
        console.error('❌ Connection not found:', connectionId);
        return;
      }
      
      // Find the connection-modal element and open it for editing
      const connectionModal = this.querySelector('connection-modal');
      if (connectionModal) {
        console.log('📤 Opening connection modal for editing connection:', connection.name);
        (connectionModal as any).open = true;
        (connectionModal as any).editMode = true;
        (connectionModal as any).connectionToEdit = connection;
        (connectionModal as any).requestUpdate();
      } else {
        console.error('❌ Could not find connection-modal element');
      }
    }).catch(error => {
      console.error('❌ Error importing connection manager:', error);
    });
  }

  private handleEditDatabase(event: CustomEvent) {
    console.log('🗄️ App root received edit-database event');
    console.log('Event detail:', event.detail);
    
    const { connectionId, databaseName } = event.detail;
    
    // Find the database-modal element and open it for editing
    const databaseModal = this.querySelector('database-modal');
    if (databaseModal) {
      console.log('📤 Opening database modal for editing database:', databaseName);
      (databaseModal as any).open = true;
      (databaseModal as any).editMode = true;
      (databaseModal as any).connectionId = connectionId;
      (databaseModal as any).databaseToEdit = { name: databaseName };
      (databaseModal as any).requestUpdate();
    } else {
      console.error('❌ Could not find database-modal element');
    }
  }

  private handleDeleteConnection(event: CustomEvent) {
    console.log('🎯 App root received delete-connection event');
    console.log('Event detail:', event.detail);
    
    // Find the connection-modal element and open it for deletion confirmation
    const connectionModal = this.querySelector('connection-modal');
    if (connectionModal) {
      console.log('📤 Opening connection modal for deleting connection:', event.detail.connectionName);
      (connectionModal as any).open = true;
      (connectionModal as any).connectionId = event.detail?.connectionId;
      (connectionModal as any).requestUpdate();
    } else {
      console.error('❌ Could not find connection-modal element');
    }
  }

  private handleAddQueryEditor(event: CustomEvent) {
    console.log('🎯 App root received add-query-editor event, forwarding to main-panel');
    console.log('Event detail:', event.detail);
    
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

  private async handleNewDatabaseRequest(event: CustomEvent) {
    console.log('🎯 App root received new-database-requested event');
    console.log('Event detail:', event.detail);

    // Find the database-modal element and open it
    const databaseModal = this.querySelector('database-modal');
    if (databaseModal) {
      console.log('📤 Opening database modal');
      (databaseModal as any).open = true;
      (databaseModal as any).connectionId = event.detail?.connectionId;
      (databaseModal as any).requestUpdate();
    } else {
      console.error('❌ Could not find database-modal element');
    }
  }

private async handleNewBundleRequest(event: CustomEvent) {
    console.log('🎯 App root received new-bundle-requested event');
    console.log('Event detail:', event.detail);

    // Validate event data
    const { connectionId, databaseName } = event.detail || {};
    
    if (!connectionId) {
      console.error('❌ New bundle request missing connectionId');
      this.showBundleError('Cannot create bundle: Missing connection information');
      return;
    }

    // Find the bundle-modal element
    const bundleModal = this.querySelector('bundle-modal');
    if (!bundleModal) {
      console.error('❌ Could not find bundle-modal element');
      this.showBundleError('System error: Bundle creator not available');
      return;
    }

    try {
      console.log('📤 Opening bundle modal for new bundle creation');
      (bundleModal as any).open = true;
      (bundleModal as any).editMode = false; // Ensure we're in create mode
      (bundleModal as any).connectionId = connectionId;
      (bundleModal as any).databaseName = databaseName; // Pass database context if available
      (bundleModal as any).bundleId = null; // Clear any existing bundle ID
      (bundleModal as any).bundle = null; // Clear any existing bundle data
      (bundleModal as any).requestUpdate();
      
      console.log('✅ Bundle modal opened successfully for new bundle creation');
      
    } catch (error) {
      console.error('❌ Error opening bundle modal for new bundle:', error);
      this.showBundleError('Failed to open bundle creator');
    }
  }

private async handleEditBundleRequest(event: CustomEvent) {
    console.log('🎯 App root received edit-bundle-requested event');
    console.log('Event detail:', event.detail);

    // Validate event data
    const { bundleId, bundle, connectionId, bundleName } = event.detail || {};
    
    if (!bundleId && !bundle) {
      console.error('❌ Edit bundle request missing both bundleId and bundle data');
      this.showBundleError('Cannot edit bundle: Missing bundle identifier or data');
      return;
    }

    if (!connectionId) {
      console.error('❌ Edit bundle request missing connectionId');
      this.showBundleError('Cannot edit bundle: Missing connection information');
      return;
    }

    // Find the bundle-modal element
    const bundleModal = this.querySelector('bundle-modal');
    if (!bundleModal) {
      console.error('❌ Could not find bundle-modal element');
      this.showBundleError('System error: Bundle editor not available');
      return;
    }

    // Enhanced logging for debugging
    console.log('� Bundle data validation:', {
      hasBundleId: !!bundleId,
      hasBundleObject: !!bundle,
      hasConnectionId: !!connectionId,
      bundleName: bundleName || bundle?.name || 'Unknown',
      bundleObjectKeys: bundle ? Object.keys(bundle) : 'No bundle object'
    });

    try {
      // Set modal properties with validation
      (bundleModal as any).open = true;
      (bundleModal as any).editMode = true; // Ensure we're in edit mode
      (bundleModal as any).connectionId = connectionId;
      (bundleModal as any).bundle = bundle;

      // Pass both bundleId and bundle for redundancy
      if (bundleId) {
        (bundleModal as any).bundleId = bundleId;
        console.log('✅ Bundle ID passed to modal:', bundleId);
      }
      
      if (bundle) {
        // Validate bundle object has minimum required properties
        if (this.validateBundleObject(bundle)) {
          (bundleModal as any).bundle = bundle;
          console.log('✅ Bundle object validated and passed to modal');
        } else {
          console.warn('⚠️ Bundle object validation failed, modal will need to fetch data using bundleId');
          (bundleModal as any).bundle = null; // Clear invalid bundle
        }
      } else if (bundleId) {
        // No bundle object provided, but we have bundleId - modal should fetch the data
        console.log('ℹ️ No bundle object provided, modal will fetch data using bundleId:', bundleId);
        (bundleModal as any).bundle = null;
      }
      
      (bundleModal as any).requestUpdate();
      console.log('📤 Bundle modal opened successfully for editing');
      
    } catch (error) {
      console.error('❌ Error opening bundle modal:', error);
      this.showBundleError('Failed to open bundle editor');
    }
  }

  /**
   * Validate that a bundle object has the minimum required properties
   */
  private validateBundleObject(bundle: any): boolean {
    if (!bundle || typeof bundle !== 'object') {
      console.warn('⚠️ Bundle validation: Not an object');
      return false;
    }

    // Check for essential bundle properties
    const requiredFields = ['Name']; // Add other required fields as needed
    const optionalFields = ['BundleId', 'DocumentStructure', 'Indexes', 'Relationships']; // Log these for debugging

    for (const field of requiredFields) {
      if (!bundle[field]) {
        console.warn(`⚠️ Bundle validation: Missing required field '${field}'`);
        return false;
      }
    }

    // Log optional fields for debugging
    console.log('🔍 Bundle object fields:', {
      required: requiredFields.reduce((acc, field) => ({ ...acc, [field]: !!bundle[field] }), {}),
      optional: optionalFields.reduce((acc, field) => ({ ...acc, [field]: !!bundle[field] }), {}),
      totalFields: Object.keys(bundle).length
    });

    return true;
  }

  /**
   * Show bundle-related error messages to the user
   */
  private showBundleError(message: string): void {
    console.log('🔍 Attempting to show bundle error:', message);
    
    const errorModal = this.querySelector('error-modal');
    if (errorModal) {
      (errorModal as any).open = true;
      (errorModal as any).errorMessage = message;
      (errorModal as any).requestUpdate();
      console.log('✅ Bundle error displayed to user');
    } else {
      console.error('❌ Could not find error-modal, falling back to alert');
      alert(`Bundle Error: ${message}`);
    }
  }

  private async handleDatabaseCreated(event: CustomEvent) {
    console.log('🎯 App root received database-created event');
    console.log('Event detail:', event.detail);

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

  private handleAboutModalRequest(event: CustomEvent) {
    console.log('🎯 App root received about-modal-requested event');
    
    // Find the about-modal element and open it
    const aboutModal = this.querySelector('about-modal');
    if (aboutModal) {
      console.log('📤 Opening about modal');
      (aboutModal as any).open();
    } else {
      console.error('❌ Could not find about-modal element');
    }
  }

  private handleAddUserRequest(event: CustomEvent) {
    console.log('🎯 App root received add-user event');
    console.log('Event detail:', event.detail);
    
    // Find the user-modal element and open it for creating a new user
    const userModal = this.querySelector('user-modal');
    if (userModal) {
      console.log('📤 Opening user modal for new user');
      (userModal as any).user = null; // Clear any existing user data
      (userModal as any).open = true;
      (userModal as any).isOpen = true;
      (userModal as any).requestUpdate();
    } else {
      console.error('❌ Could not find user-modal element');
    }
  }

  private handleEditUserRequest(event: CustomEvent) {
    console.log('🎯 App root received edit-user event');
    console.log('Event detail:', event.detail);
    
    // Find the user-modal element and open it for editing
    const userModal = this.querySelector('user-modal');
    if (userModal) {
      console.log('📤 Opening user modal for editing user:', event.detail.userName);
      
      // Create a mock user object based on the userName
      // In a real app, you would fetch the full user data from the server
      const userData = {
        name: event.detail.userName,
        userId: event.detail.userName, // Assuming userName is the userId
        password: '', // Password fields are usually not populated for security
        isActive: true,
        isLockedOut: false,
        failedLoginAttempts: 0,
        lockoutExpiresOn: null
      };
      
      (userModal as any).user = userData;
      (userModal as any).open = true;
      (userModal as any).isOpen = true;
      (userModal as any).requestUpdate();
    } else {
      console.error('❌ Could not find user-modal element');
    }
  }

  private handleConnectDatabase(event: CustomEvent) {
    console.log('🎯 App root received connect-database event');
    console.log('Event detail:', event.detail);
    
    // In a prod application, we would:
    // 1. Get connection details from the connection store
    // 2. Establish a database connection
    // 3. Update connection status
    // 4. Notify the connection tree of the status change
    
    // For now, we'll just log the connection attempt
    console.log(`🔌 Attempting to connect to database: ${event.detail.connectionId}`);
    // We typically dispatch this to the connection service
    // connectionService.connect(event.detail.connectionId);
  }

  private handleDisconnectDatabase(event: CustomEvent) {
    console.log('🎯 App root received disconnect-database event');
    console.log('Event detail:', event.detail);
    
    // In a production application, we would:
    // 1. Close the database connection
    // 2. Update connection status
    // 3. Notify the connection tree of the status change
    
    console.log(`🔌 Attempting to disconnect from database: ${event.detail.connectionId}`);
    // connectionService.disconnect(event.detail.connectionId);
  }

  private handleTestConnection(event: CustomEvent) {
    console.log('🎯 App root received test-connection event');
    console.log('Event detail:', event.detail);
    
    // In a real application, you would:
    // 1. Test the connection using stored connection details
    // 2. Show a result message (success/failure)
    // 3. Optionally update the connection status
    
    console.log(`🧪 Testing connection: ${event.detail.connectionName} (ID: ${event.detail.connectionId})`);
    
    // For now, show an alert with the test result
    // TODO show a toast notification or modal for the connection
    setTimeout(() => {
      alert(`Connection test for "${event.detail.connectionName}": Success! ✅\n\n(This is a mock result - integrate with your actual connection service)`);
    }, 100); // Small delay to let the context menu close first
  }

  private handleConnectionError(event: CustomEvent) {
    console.log('🎯 App root received connection-error event');
    console.log('Event detail:', event.detail);
    
    const { connectionName, error } = event.detail;
    const errorMessage = error || 'Unknown connection error occurred.';
    
    console.log('🔍 Attempting to find error-modal element...');
    
    // Find the error modal and show it with the error message
    const errorModal = this.querySelector('error-modal');
    
    console.log('🔍 Error modal element found:', !!errorModal);
    
    if (errorModal) {
      console.log('📤 Showing error modal with message:', errorMessage);
      (errorModal as any).open = true;
      (errorModal as any).errorMessage = `Failed to connect to "${connectionName}": ${errorMessage}`;
      (errorModal as any).requestUpdate();
      console.log('✅ Error modal should now be visible');
    } else {
      console.error('❌ Could not find error-modal element');
      // Fallback: show an alert for debugging
      alert(`Connection Error: Failed to connect to "${connectionName}": ${errorMessage}`);
    }
  }
  
  /**
   * Handle query execution results and update status bar
   */
  private handleQueryExecuted(event: CustomEvent) {
    console.log('⏱️ App root received query-executed event');
    console.log('Query result detail:', event.detail);
    
    const { executionTime, ResultCount } = event.detail;
    
    // Find the status bar and update execution time and result count
    const statusBar = this.querySelector('#main-status-bar') as any;
    if (statusBar) {
      if (executionTime !== undefined) {
        statusBar.executionTimeMS = executionTime;
        console.log('✅ Updated status bar with execution time:', executionTime, 'ms');
      }
      
      if (ResultCount !== undefined) {
        statusBar.resultCount = ResultCount;
        console.log('✅ Updated status bar with result count:', ResultCount);
      }
    } else {
      console.warn('⚠️ Could not find status bar element');
    }
  }

  render() {
    return html`
      <div class="h-screen bg-base-100 text-base-content flex flex-col">
        
          <!-- Navigation Bar --> 
          <div class="w-full p-4 bg-base-200 flex-shrink-0">
            <navigation-bar></navigation-bar>
          </div>
       
          
        
        <div class="flex-1 flex">
          <!-- Sidebar (30%) -->
          <sidebar-panel class="w-[30%] bg-base-200"></sidebar-panel>
          
          <!-- Main Content (70%) -->
          <main-panel class="w-[70%] bg-base-100"></main-panel>
        </div>
        
        <!-- Status Bar at the bottom -->
        <status-bar id="main-status-bar"></status-bar>
        
        <!-- About Modal -->
        <about-modal></about-modal>
        
        <!-- User Modal -->
        <user-modal></user-modal>

        <!-- Database Modal -->
        <database-modal></database-modal>

        <!-- Bundle Modal -->
        <bundle-modal></bundle-modal>

        <!-- Error Modal -->
        <error-modal></error-modal>
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
