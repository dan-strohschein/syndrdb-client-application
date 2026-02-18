/**
 * JSON Tree View Component
 *
 * Displays JSON (string or object) in an interactive, expand/collapse tree for use in
 * query results and other data views. Expand state is tracked by path strings (e.g. "",
 * "users", "users.0") in a Set; root is "", first-level keys/indices are "key" or "0",
 * deeper levels use dot-separated paths.
 */

import { html, LitElement, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

const ROOT_PATH = '';

/** JSON-serializable value: object, array, or primitive. */
type JsonValue = object | string | number | boolean | null;

/**
 * Root component that accepts JSON as string or object and renders an expand/collapse tree.
 * Single-file implementation with internal recursive renderNode; no separate node element.
 */
@customElement('json-tree-view')
export class JsonTreeView extends LitElement {
  /**
   * JSON data as string (parsed with JSON.parse) or already-parsed object/array.
   * Invalid JSON string results in an error state message.
   */
  @property({ type: Object })
  data?: string | object;

  /**
   * Number of levels expanded by default when data is set (0 = all collapsed, 1+ = expand that many levels).
   * Path scheme: root = "", first-level = "key" or "0", deeper = "path.key" or "path.0".
   */
  @property({ type: Number, attribute: 'default-expanded-depth' })
  defaultExpandedDepth = 1;

  /** Parsed value from data (object/array/primitive) or undefined when data is unset or invalid. */
  @state()
  private parsed: JsonValue | undefined = undefined;

  /** When data is a string and parsing fails, this holds the error message. */
  @state()
  private parseError: string | null = null;

  /** Set of path strings for expanded nodes. Root = "", children = "key" or "0", nested = "a.b". */
  @state()
  private expandedNodes: Set<string> = new Set();

  // Disable Shadow DOM to allow global Tailwind CSS
  createRenderRoot() {
    return this;
  }

  override willUpdate(
    changedProperties: Map<string, unknown>
  ): void {
    if (changedProperties.has('data')) {
      this.parseDataAndInitExpanded();
    }
  }

  /**
   * Parse data (string -> JSON.parse, object -> use as-is), set parseError on failure,
   * and initialize expandedNodes up to defaultExpandedDepth.
   */
  private parseDataAndInitExpanded(): void {
    this.parseError = null;
    this.parsed = undefined;

    const raw = this.data;
    if (raw === undefined || raw === null) {
      return;
    }

    if (typeof raw === 'string') {
      try {
        this.parsed = JSON.parse(raw) as JsonValue;
      } catch (e) {
        this.parseError = e instanceof Error ? e.message : 'Invalid JSON';
        return;
      }
    } else if (typeof raw === 'object') {
      this.parsed = raw as JsonValue;
    } else {
      this.parsed = raw as JsonValue;
    }

    // Build set of paths to expand up to defaultExpandedDepth (depth 0 = root only for "branch" roots).
    this.expandedNodes = this.computeInitialExpanded(ROOT_PATH, this.parsed, this.defaultExpandedDepth);
  }

  /**
   * Compute which paths should be expanded up to maxDepth. Root is depth 0.
   * Returns a new Set with those paths.
   */
  private computeInitialExpanded(
    path: string,
    value: JsonValue,
    maxDepth: number
  ): Set<string> {
    const out = new Set<string>();
    if (maxDepth < 0) return out;

    const isBranch = this.isBranch(value);
    if (isBranch) {
      out.add(path);
    }
    if (maxDepth <= 0 || !isBranch) return out;

    if (Array.isArray(value)) {
      value.forEach((_, i) => {
        const childPath = path === ROOT_PATH ? String(i) : `${path}.${i}`;
        this.computeInitialExpanded(childPath, value[i], maxDepth - 1).forEach((p) => out.add(p));
      });
    } else if (value !== null && typeof value === 'object') {
      for (const key of Object.keys(value)) {
        const childPath = path === ROOT_PATH ? key : `${path}.${key}`;
        const child = (value as Record<string, JsonValue>)[key];
        this.computeInitialExpanded(childPath, child as JsonValue, maxDepth - 1).forEach((p) =>
          out.add(p)
        );
      }
    }
    return out;
  }

  private isBranch(value: JsonValue): boolean {
    if (value === null || typeof value !== 'object') return false;
    if (Array.isArray(value)) return value.length > 0;
    return Object.keys(value).length > 0;
  }

  private toggle(path: string): void {
    const next = new Set(this.expandedNodes);
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }
    this.expandedNodes = next;
  }

  private isExpanded(path: string): boolean {
    return this.expandedNodes.has(path);
  }

  /** Child path from parent (for root's children, parent is ""). */
  private childPath(parentPath: string, segment: string): string {
    return parentPath === ROOT_PATH ? segment : `${parentPath}.${segment}`;
  }

  protected override render(): TemplateResult {
    if (this.parseError) {
      return html`
        <div class="text-error text-sm font-mono p-2" role="alert">
          Invalid JSON: ${this.parseError}
        </div>
      `;
    }

    if (this.parsed === undefined && this.data !== undefined && this.data !== null) {
      return html`<div class="text-base-content/60 text-sm font-mono p-2">No data</div>`;
    }

    if (this.parsed === undefined) {
      return html`<div class="text-base-content/60 text-sm font-mono p-2">No data</div>`;
    }

    return html`
      <div
        class="json-tree-view font-mono text-sm text-base-content select-text"
        role="tree"
        aria-label="JSON tree"
      >
        ${this.renderNode(ROOT_PATH, '(root)', this.parsed)}
      </div>
    `;
  }

  /**
   * Render a single node: branch (object/array with children) or leaf (primitive).
   * path: path string for this node ("" for root). label: display label (e.g. "(root)", "0", "users").
   */
  private renderNode(path: string, label: string, value: JsonValue): TemplateResult {
    const isBranch = this.isBranch(value);

    if (!isBranch) {
      const isRootPrimitive = path === ROOT_PATH;
      return html`
        <div class="flex items-baseline gap-1 pl-4" role="treeitem" data-path="${path}">
          ${!isRootPrimitive
            ? html`
                <span class="json-tree-view-key text-primary">${label}</span>
                <span class="json-tree-view-sep">: </span>
              `
            : ''}
          <span class="json-tree-view-value">${this.formatLeaf(value)}</span>
        </div>
      `;
    }

    const expanded = this.isExpanded(path);
    const isArray = Array.isArray(value);
    const preview = isArray ? `[ ${(value as unknown[]).length} ]` : '{ }';

    return html`
      <div role="group" class="json-tree-view-branch" data-path="${path}">
        <div
          class="flex items-baseline gap-1 cursor-pointer hover:bg-base-300/50 rounded pr-1 -ml-1 pl-1 min-h-6"
          role="treeitem"
          aria-expanded="${expanded}"
          tabindex="0"
          @click=${() => this.toggle(path)}
        >
          <span class="json-tree-view-arrow inline-block w-4 shrink-0 text-base-content/70">
            ${expanded
              ? html`<i class="fa-solid fa-chevron-down" aria-hidden="true"></i>`
              : html`<i class="fa-solid fa-chevron-right" aria-hidden="true"></i>`}
          </span>
          <span class="json-tree-view-key text-primary">${label}</span>
          <span class="json-tree-view-sep">: </span>
          <span class="json-tree-view-preview text-base-content/80">${preview}</span>
        </div>
        ${expanded
          ? html`
              <div class="json-tree-view-children pl-4 border-l border-base-300/50 ml-2">
                ${this.renderChildren(path, value)}
              </div>
            `
          : ''}
      </div>
    `;
  }

  private renderChildren(parentPath: string, value: object): TemplateResult[] {
    if (Array.isArray(value)) {
      return value.map((item, i) => {
        const seg = String(i);
        return this.renderNode(this.childPath(parentPath, seg), seg, item as JsonValue);
      });
    }
    if (value === null || typeof value !== 'object') {
      return [];
    }
    return Object.entries(value).map(([key, val]) =>
      this.renderNode(this.childPath(parentPath, key), key, val as JsonValue)
    );
  }

  private formatLeaf(value: JsonValue): string {
    if (value === null) return 'null';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') return JSON.stringify(value);
    if (Array.isArray(value)) return `[ ${value.length} ]`;
    if (typeof value === 'object') return '{ }';
    return String(value);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'json-tree-view': JsonTreeView;
  }
}
