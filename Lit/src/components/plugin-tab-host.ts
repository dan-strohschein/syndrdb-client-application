/**
 * Plugin Tab Host - Error-boundary wrapper for plugin tab content.
 * Creates the plugin's custom element by tag name and wraps it in error handling.
 */

import { html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { pluginRegistry } from '../services/plugin-registry';

@customElement('plugin-tab-host')
export class PluginTabHost extends LitElement {
  createRenderRoot() {
    return this;
  }

  @property({ type: String })
  tabTypeId = '';

  @property({ attribute: false })
  config: Record<string, unknown> = {};

  @state()
  private errorMessage: string | null = null;

  @state()
  private pluginElement: HTMLElement | null = null;

  connectedCallback() {
    super.connectedCallback();
    this.initializePlugin();
  }

  private initializePlugin() {
    if (!this.tabTypeId) {
      this.errorMessage = 'No tab type ID specified';
      return;
    }

    const tabTypes = pluginRegistry.getTabTypes();
    const tabType = tabTypes.get(this.tabTypeId);

    if (!tabType) {
      this.errorMessage = `Plugin tab type not found: ${this.tabTypeId}`;
      return;
    }

    try {
      // Check if the custom element is registered
      const Constructor = customElements.get(tabType.componentTag);
      if (!Constructor) {
        this.errorMessage = `Plugin component not registered: <${tabType.componentTag}>`;
        return;
      }

      // Create the plugin element
      const element = document.createElement(tabType.componentTag) as HTMLElement & {
        pluginAPI?: unknown;
        tabConfig?: Record<string, unknown>;
      };

      // Pass config if available
      if (this.config) {
        element.tabConfig = this.config;
      }

      this.pluginElement = element;
      this.errorMessage = null;
    } catch (error) {
      this.errorMessage = `Failed to create plugin component: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  updated() {
    if (this.pluginElement && !this.errorMessage) {
      const container = this.querySelector('.plugin-tab-container');
      if (container && !container.contains(this.pluginElement)) {
        container.innerHTML = '';
        container.appendChild(this.pluginElement);
      }
    }
  }

  render() {
    if (this.errorMessage) {
      return html`
        <div class="h-full flex items-center justify-center">
          <div class="flex flex-col items-center gap-3 text-feedback-error max-w-md text-center">
            <i class="fa-solid fa-circle-exclamation text-3xl"></i>
            <p class="font-semibold">Plugin Error</p>
            <p class="text-sm text-gray-400">${this.errorMessage}</p>
            <button
              class="px-3 py-1 text-sm bg-surface-3 hover:bg-surface-4 rounded transition-colors text-gray-300"
              @click=${() => { this.errorMessage = null; this.initializePlugin(); }}
            >
              Retry
            </button>
          </div>
        </div>
      `;
    }

    return html`<div class="plugin-tab-container h-full w-full"></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'plugin-tab-host': PluginTabHost;
  }
}
