import { html, css, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './components/sidebar-panel';
import './components/main-panel';
import './components/connection-tree';
import './components/connection-modal';
import './components/query-editor/query-editor';
import './components/query-editor/graphql-query-editor';
import './components/query-editor/syndrql-query-editor';
import './components/json-tree/json-tree';
import './components/json-tree/json-tree-node';
import './components/navigation-bar';
import './components/query-editor/query-editor-container';
import './components/about-modal';


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
