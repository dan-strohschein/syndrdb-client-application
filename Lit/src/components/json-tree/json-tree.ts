import { html, css, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { KeyValuePair } from '../../types/key-value-pair';

@customElement('json-tree')
export class JsonTree extends LitElement {

// Disable Shadow DOM to allow global Tailwind CSS
  createRenderRoot() {
    return this;
  }

    @property({ type: Object })
    public data: KeyValuePair | null = null;
    public displayMode: 'text' | 'tree' = 'tree';

    protected render() {
        return html`
      <div class="json-tree">
        ${this.renderNode(this?.data)}
      </div>
    `;
    }

    private renderNode(data: KeyValuePair | null) {
        if (!data) {
            return html`<span class="text-muted">No data</span>`;
        }

        return html`
            <json-tree-node .data=${{ [data.key]: data.value, nodeData: data, displayMode: this.displayMode }}></json-tree-node>
        `;
    }
}