
import { html, css, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { connectionManager } from '../../services/connection-manager';

@customElement('syndrql-query-editor')
export class SyndrQLQueryEditor extends LitElement {
  @state()
  private query: string = '';

// Disable Shadow DOM to allow global Tailwind CSS
  createRenderRoot() {
    return this;
  }

  private handleInput(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    this.query = target.value;
  }

  protected render() {
    return html`
      <div class="p-4">
        <textarea
          class="textarea textarea-bordered w-full"
          rows="5"
          placeholder="Enter your SyndrQL query here..."
          @input=${this.handleInput}
        ></textarea>
        <div class="mt-2">
          <button class="btn btn-primary" @click=${this.executeQuery}>Execute</button>
        </div>
      </div>
    `;
  }

  private async executeQuery() {
    if (!this.query) return;

    try {
      const { connectionManager } = await import('../../services/connection-manager');
      const result = await connectionManager.executeQuery(this.query);
      console.log('Query result:', result);
    } catch (error) {
      console.error('Error executing query:', error);
    }
  }
}