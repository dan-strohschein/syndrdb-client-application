import { html, css, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './components/sidebar-panel';
import './components/main-panel';
import './components/connection-tree';
import './components/connection-modal';

@customElement('app-root')
export class AppRoot extends LitElement {
  // Disable Shadow DOM to allow global Tailwind CSS
  createRenderRoot() {
    return this;
  }

  render() {
    return html`
      <div class="flex h-screen bg-base-100 text-base-content">
        <!-- Sidebar (30%) -->
        <sidebar-panel class="w-[30%] bg-base-200"></sidebar-panel>
        
        <!-- Main Content (70%) -->
        <main-panel class="w-[70%] bg-base-100"></main-panel>
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
