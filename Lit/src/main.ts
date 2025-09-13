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


@customElement('app-root')
export class AppRoot extends LitElement {
  // Disable Shadow DOM to allow global Tailwind CSS
  createRenderRoot() {
    return this;
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
