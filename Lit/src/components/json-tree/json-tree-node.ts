import { html, css, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { KeyValuePair } from '../../types/key-value-pair';

@customElement('json-tree-node')
export class JsonTreeNode extends LitElement {
// Disable Shadow DOM to allow global Tailwind CSS
  createRenderRoot() {
    return this;
  }

  @property({ type: Object })
  public data: KeyValuePair | null = null;//Record<string, unknown> = {};
  public displayMode: 'text' | 'tree' = 'tree';
  public nodeData: Object | null = null;

  @state()  
  private node_collapsed = true;

  protected render() {
    return html`
      <div class="json-tree-node">
        ${this.renderNode(this.data as KeyValuePair)}
      </div>
    `;
  }

  private expand_node() {
    this.node_collapsed = false;
    // Also, render the children of this node, if there are any

    this.requestUpdate();
  }

  private collapse_node() {
    this.node_collapsed = true;
    this.requestUpdate();
  }

  private has_children(data: any): boolean {
    // Determine if the node data has children (i.e., is an object or array with elements)
    if (data === null || data === undefined) {
      return false;
    }
    if (Array.isArray(data)) {
      return data.length > 0;
    }
    if (typeof data === 'object') {
      return Object.keys(data).length > 0;
    }
    return false;
  }

  private render_node_type(data: any): string {
    //Determine what data type the node data element is
    // It could be an array, object, string, number, boolean, null, etc.
    // Return a string representing the type
    if (data === null) {
      return 'null';
    }
    if (data === undefined) {
      return 'undefined';
    }
    if (data instanceof Date) {
      return 'date'; // Gotta fix this to show the nice date string
    }
    if (Array.isArray(data)) {
      // TODO there should be a click event to expand the array and show its contents
      // And thene each element needs to be evaluated for its type and rendered
      return `[<span class="badge badge-soft badge-info">${data.length}</span>]`;
    }
    if (typeof data === 'object') {
      // TODO there should be a click event to expand the object and show its contents
      return '{<span class="badge badge-soft badge-accent">object</span>}';
    }
    if (typeof data === 'string') {
      return `"${data}"`;
    }
    if (typeof data === 'number') {
      return  `${(data as number).toString()}`;
    }
    if (typeof data === 'boolean') {
      return `${(data as boolean).toString()}`;
    }
    // Fallback
    const type = typeof data;
    return type;
  }

  private renderCollapsibleNode(key: string, data: any) {
    return html`
      <div class="json-tree-node"
        @click=${this.node_collapsed ? this.expand_node : this.collapse_node}
        >
          ${this.node_collapsed ? html`<span class="collapse-icon"><i class="fa-solid fa-square-plus"></i></span>` : html`<span class="collapse-icon"><i class="fa-solid fa-square-minus"></i></span>`}
          <span class="json-key">${key}</span>: <span class="json-value">${this.render_node_type(data)}</span>
        </div>
        ${!this.node_collapsed ? html`<div class="json-children ml-4">
          ${Array.isArray(data) ? data.map((item, index) => html`<json-tree-node .data=${{ key: index.toString(), value: item }}></json-tree-node>`) :
            Object.entries(data).map(([childKey, childValue]) => html`<json-tree-node .data=${{ key: childKey, value: childValue }}></json-tree-node>`)}
        </div>` : ''}
    `; 
  }

  private renderLeafNode(key: string, data: any) {
    return html`
    <div class="json-tree-node">
      <span class="json-key">${key}</span>: <span class="json-value">${this.render_node_type(data)}</span>
    </div>`;
  }

  private renderTextNode(key: string, data: any) {
    return html`
    <span class="json-key">${key}</span>: <pre>${JSON.stringify(data, null, 2)}</pre>`;
  }

  private renderTreeNode(key: string, data: any) {
    return this.has_children(data) ? this.renderCollapsibleNode(key, data) : this.renderLeafNode(key, data);
  }

  private renderNode(data: KeyValuePair) {
    if (!data) {
      return html`<span class="text-muted">No data</span>`;
    }

      if (this.displayMode === 'text') {
        return this.renderTextNode(data.key, data.value);
      }

      return this.renderTreeNode(data.key, data.value);

  }
}