/**
 * Export Step 2 — Connection selection and entity tree selection.
 * Handles both tree selection mode and custom query mode for data exports.
 */

import { html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { SelectionStepState, ExportMode, DataSourceMode, SchemaTreeNode } from '../types/wizard-state';
import type { Connection } from '../../../services/connection-manager';
import { connectionManager, ConnectionManager } from '../../../services/connection-manager';
import { buildSchemaTree, toggleNodeChecked, toggleNodeExpanded, addBundlesToDatabaseNode } from '../domain/schema-collector';
import { BundleManager } from '../../../services/bundle-manager';
import './schema-tree-selector';

const bundleManager = new BundleManager(ConnectionManager.getInstance());

@customElement('export-step-connection')
export class ExportStepConnection extends LitElement {
  @property({ type: Object }) state!: SelectionStepState;
  @property({ type: String }) exportMode: ExportMode = 'schema-only';

  @state() private connections: Map<string, Connection> = new Map();
  @state() private loadingBundles = false;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.connections = connectionManager.getAllConnections();
    connectionManager.onConnectionsChanged((conns) => {
      this.connections = conns;
    });
  }

  private getConnectedConnections(): [string, Connection][] {
    return Array.from(this.connections.entries()).filter(
      ([, conn]) => conn.status === 'connected'
    );
  }

  private handleConnectionChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    const connectionId = select.value || null;

    let schemaTree: SchemaTreeNode[] = [];
    if (connectionId) {
      const connection = this.connections.get(connectionId);
      if (connection) {
        schemaTree = buildSchemaTree(connection);
      }
    }

    this.emitState({
      ...this.state,
      connectionId,
      schemaTree,
    });
  }

  private handleNodeChecked(e: CustomEvent) {
    const { nodeId, checked } = e.detail;
    const updatedTree = toggleNodeChecked(this.state.schemaTree, nodeId, checked);
    this.emitState({ ...this.state, schemaTree: updatedTree });
  }

  private handleNodeToggleExpand(e: CustomEvent) {
    const { nodeId } = e.detail;
    const updatedTree = toggleNodeExpanded(this.state.schemaTree, nodeId);
    this.emitState({ ...this.state, schemaTree: updatedTree });
  }

  private async handleNodeExpandRequested(e: CustomEvent) {
    const { nodeId } = e.detail;
    // Find the node to check if it's a database that needs bundles loaded
    const node = this.findNode(this.state.schemaTree, nodeId);
    if (!node || node.type !== 'database' || node.children.length > 0) return;

    // Lazy load bundles for this database
    if (!this.state.connectionId) return;
    this.loadingBundles = true;

    try {
      const bundles = await bundleManager.loadBundlesForDatabase(this.state.connectionId, node.name);
      if (bundles) {
        const updatedTree = addBundlesToDatabaseNode(
          this.state.schemaTree,
          nodeId,
          this.state.connectionId,
          node.name,
          bundles
        );
        this.emitState({ ...this.state, schemaTree: updatedTree });
      }
    } catch (err) {
      console.error('Failed to load bundles:', err);
    } finally {
      this.loadingBundles = false;
    }
  }

  private findNode(nodes: SchemaTreeNode[], id: string): SchemaTreeNode | null {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children.length > 0) {
        const found = this.findNode(node.children, id);
        if (found) return found;
      }
    }
    return null;
  }

  private handleDataSourceModeChange(mode: DataSourceMode) {
    this.emitState({ ...this.state, dataSourceMode: mode });
  }

  private handleCustomQueryChange(e: Event) {
    const textarea = e.target as HTMLTextAreaElement;
    this.emitState({ ...this.state, customQuery: textarea.value });
  }

  private handleCustomQueryDatabaseChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    this.emitState({ ...this.state, customQueryDatabase: select.value || null });
  }

  private emitState(newState: SelectionStepState) {
    this.dispatchEvent(
      new CustomEvent('selection-changed', {
        detail: newState,
        bubbles: true,
      })
    );
  }

  private getDatabases(): string[] {
    if (!this.state.connectionId) return [];
    const connection = this.connections.get(this.state.connectionId);
    return connection?.databases || [];
  }

  render() {
    const connectedConnections = this.getConnectedConnections();
    const showDataSourceToggle = this.exportMode === 'data-only' || this.exportMode === 'both';

    return html`
      <div class="p-4 space-y-4">
        <!-- Connection Selector -->
        <div class="form-control">
          <label class="label">
            <span class="label-text font-semibold">Connection</span>
          </label>
          <select
            class="select select-bordered w-full"
            .value=${this.state.connectionId || ''}
            @change=${this.handleConnectionChange}
          >
            <option value="">Select a connection...</option>
            ${connectedConnections.map(
              ([id, conn]) => html`
                <option value=${id} ?selected=${this.state.connectionId === id}>
                  ${conn.name} (${conn.config.hostname}:${conn.config.port})
                </option>
              `
            )}
          </select>
          ${connectedConnections.length === 0
            ? html`<label class="label"><span class="label-text-alt text-warning">No connected servers. Connect to a server first.</span></label>`
            : nothing}
        </div>

        ${this.state.connectionId
          ? html`
              <!-- Data source mode toggle (for data exports) -->
              ${showDataSourceToggle
                ? html`
                    <div class="flex gap-2 mb-2">
                      <button
                        class="btn btn-sm ${this.state.dataSourceMode === 'tree-selection' ? 'btn-primary' : 'btn-ghost'}"
                        @click=${() => this.handleDataSourceModeChange('tree-selection')}
                      >
                        <i class="fa-solid fa-list-tree mr-1"></i> Select from Tree
                      </button>
                      <button
                        class="btn btn-sm ${this.state.dataSourceMode === 'custom-query' ? 'btn-primary' : 'btn-ghost'}"
                        @click=${() => this.handleDataSourceModeChange('custom-query')}
                      >
                        <i class="fa-solid fa-code mr-1"></i> Custom Query
                      </button>
                    </div>
                  `
                : nothing}

              ${this.state.dataSourceMode === 'tree-selection' || !showDataSourceToggle
                ? html`
                    <!-- Schema Tree -->
                    <div class="form-control">
                      <label class="label">
                        <span class="label-text font-semibold">Select items to export</span>
                        ${this.loadingBundles
                          ? html`<span class="loading loading-spinner loading-xs"></span>`
                          : nothing}
                      </label>
                      <schema-tree-selector
                        .nodes=${this.state.schemaTree}
                        @node-checked=${this.handleNodeChecked}
                        @node-toggle-expand=${this.handleNodeToggleExpand}
                        @node-expand-requested=${this.handleNodeExpandRequested}
                      ></schema-tree-selector>
                    </div>
                  `
                : html`
                    <!-- Custom Query Mode -->
                    <div class="form-control">
                      <label class="label">
                        <span class="label-text font-semibold">Database</span>
                      </label>
                      <select
                        class="select select-bordered w-full"
                        .value=${this.state.customQueryDatabase || ''}
                        @change=${this.handleCustomQueryDatabaseChange}
                      >
                        <option value="">Select a database...</option>
                        ${this.getDatabases().map(
                          (db) => html`<option value=${db}>${db}</option>`
                        )}
                      </select>
                    </div>
                    <div class="form-control">
                      <label class="label">
                        <span class="label-text font-semibold">SyndrQL SELECT Query</span>
                      </label>
                      <textarea
                        class="textarea textarea-bordered font-mono h-32"
                        placeholder='SELECT * FROM "MyBundle";'
                        .value=${this.state.customQuery}
                        @input=${this.handleCustomQueryChange}
                      ></textarea>
                      <label class="label">
                        <span class="label-text-alt">Enter a valid SyndrQL SELECT query.</span>
                      </label>
                    </div>
                  `}
            `
          : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'export-step-connection': ExportStepConnection;
  }
}
