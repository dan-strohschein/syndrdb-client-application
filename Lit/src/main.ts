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
      (databaseModal as any).isOpen = true;
      (databaseModal as any).requestUpdate();
    } else {
      console.error('❌ Could not find database-modal element');
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
    
    // In a real application, you would:
    // 1. Get connection details from your connection store
    // 2. Establish a database connection
    // 3. Update connection status
    // 4. Notify the connection tree of the status change
    
    // For now, we'll just log the connection attempt
    console.log(`🔌 Attempting to connect to database: ${event.detail.connectionId}`);
    // You would typically dispatch this to your connection service
    // connectionService.connect(event.detail.connectionId);
  }

  private handleDisconnectDatabase(event: CustomEvent) {
    console.log('🎯 App root received disconnect-database event');
    console.log('Event detail:', event.detail);
    
    // In a real application, you would:
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
    
    // For demonstration, show an alert with the test result
    // In a real app, you might show a toast notification or modal
    setTimeout(() => {
      alert(`Connection test for "${event.detail.connectionName}": Success! ✅\n\n(This is a mock result - integrate with your actual connection service)`);
    }, 100); // Small delay to let the context menu close first
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
        
        <!-- About Modal -->
        <about-modal></about-modal>
        
        <!-- User Modal -->
        <user-modal></user-modal>

        <!-- Database Modal -->
        <database-modal></database-modal>
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
