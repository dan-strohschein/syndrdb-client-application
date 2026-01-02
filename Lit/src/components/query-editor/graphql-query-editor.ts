import { html, css, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { connectionManager } from '../../services/connection-manager';

@customElement('graphql-query-editor')
export class GraphQLQueryEditor extends LitElement {
  @state()
  private query: string = '';

// TODO This will be replaced with the code-editor at some point soon.

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
          placeholder="# Enter your SyndrDB query here&#10;&#10;find: { collection: 'users' }&#10;filter: { age: { $gt: 18 } }&#10;limit: 10&#10;&#10;# Example queries:&#10;# find: { collection: 'orders', filter: { status: 'active' } }&#10;# aggregate: { collection: 'products', pipeline: [...] }&#10;# insert: { collection: 'customers', document: {...} }"
          .value=${this.query}
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