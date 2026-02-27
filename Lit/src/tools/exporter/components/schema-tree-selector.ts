/**
 * Schema Tree Selector — reusable checkbox tree component for selecting
 * databases, bundles, and users from a connection's schema.
 */

import { html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { SchemaTreeNode } from '../types/wizard-state';

@customElement('schema-tree-selector')
export class SchemaTreeSelector extends LitElement {
  @property({ type: Array }) nodes: SchemaTreeNode[] = [];

  createRenderRoot() {
    return this;
  }

  private handleToggleCheck(nodeId: string, checked: boolean) {
    this.dispatchEvent(
      new CustomEvent('node-checked', {
        detail: { nodeId, checked },
        bubbles: true,
      })
    );
  }

  private handleToggleExpand(nodeId: string) {
    this.dispatchEvent(
      new CustomEvent('node-toggle-expand', {
        detail: { nodeId },
        bubbles: true,
      })
    );
    // Also emit expand-requested for lazy loading
    this.dispatchEvent(
      new CustomEvent('node-expand-requested', {
        detail: { nodeId },
        bubbles: true,
      })
    );
  }

  private getNodeIcon(node: SchemaTreeNode): string {
    switch (node.type) {
      case 'database':
        return 'fa-solid fa-database';
      case 'bundle':
        return 'fa-solid fa-box';
      case 'user':
        return 'fa-solid fa-user';
      case 'connection':
        return 'fa-solid fa-plug';
      default:
        return 'fa-solid fa-circle';
    }
  }

  private renderNode(node: SchemaTreeNode, depth: number = 0): unknown {
    const hasChildren = node.children.length > 0 || node.type === 'database';
    const paddingLeft = depth * 1.5;

    return html`
      <div class="flex items-center py-1 hover:bg-base-200 rounded px-1" style="padding-left: ${paddingLeft}rem;">
        <!-- Expand/collapse arrow -->
        ${hasChildren
          ? html`
              <button
                class="btn btn-ghost btn-xs mr-1"
                @click=${() => this.handleToggleExpand(node.id)}
              >
                <i class="fa-solid ${node.expanded ? 'fa-chevron-down' : 'fa-chevron-right'} text-xs"></i>
              </button>
            `
          : html`<span class="w-6 inline-block"></span>`}

        <!-- Checkbox -->
        <input
          type="checkbox"
          class="checkbox checkbox-sm checkbox-primary mr-2"
          .checked=${node.checked}
          .indeterminate=${node.indeterminate}
          @change=${(e: Event) => {
            const target = e.target as HTMLInputElement;
            this.handleToggleCheck(node.id, target.checked);
          }}
        />

        <!-- Icon + name -->
        <i class="${this.getNodeIcon(node)} text-sm mr-2 text-base-content/60"></i>
        <span class="text-sm">${node.name}</span>

        ${node.type === 'bundle' && node.bundleData?.DocumentCount !== undefined
          ? html`<span class="badge badge-sm badge-ghost ml-2">${node.bundleData.DocumentCount} docs</span>`
          : nothing}
      </div>

      <!-- Children -->
      ${node.expanded && node.children.length > 0
        ? html`
            <div>
              ${node.children.map((child) => this.renderNode(child, depth + 1))}
            </div>
          `
        : nothing}
    `;
  }

  render() {
    if (this.nodes.length === 0) {
      return html`
        <div class="text-center text-base-content/50 py-8">
          <i class="fa-solid fa-folder-open text-2xl mb-2"></i>
          <p class="text-sm">No databases or bundles found. Select a connection first.</p>
        </div>
      `;
    }

    return html`
      <div class="border border-base-300 rounded-lg p-2 max-h-80 overflow-y-auto">
        ${this.nodes.map((node) => this.renderNode(node))}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'schema-tree-selector': SchemaTreeSelector;
  }
}
