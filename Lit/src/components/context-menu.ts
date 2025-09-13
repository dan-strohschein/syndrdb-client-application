import { html, css, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';

@customElement('context-menu')
export class ContextMenu extends LitElement {
// Disable Shadow DOM to allow global Tailwind CSS
  createRenderRoot() {
    return this;
  }

  render() {
    return html`
      <div class="context-menu">
        <slot></slot>
      </div>
    `;
  }
}