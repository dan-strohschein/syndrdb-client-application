/**
 * Results Grid View Component
 *
 * Displays query result documents in a sortable, tabular grid.
 * Column headers are extracted from all documents (union of keys).
 * Three-state sort cycle: none → asc → desc → none.
 * Cells render differently based on value type; click any cell to copy.
 */

import { html, LitElement, TemplateResult, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

type SortDirection = 'asc' | 'desc' | 'none';

@customElement('results-grid')
export class ResultsGrid extends LitElement {
  @property({ type: Array })
  data: Record<string, unknown>[] = [];

  @state() private sortColumn: string | null = null;
  @state() private sortDirection: SortDirection = 'none';
  @state() private columns: string[] = [];
  @state() private sortedIndices: number[] = [];

  createRenderRoot() {
    return this;
  }

  willUpdate(changed: PropertyValues): void {
    if (changed.has('data')) {
      this.extractColumns();
      this.resetSort();
    }
  }

  private extractColumns(): void {
    const keySet = new Set<string>();
    for (const doc of this.data) {
      for (const key of Object.keys(doc)) {
        keySet.add(key);
      }
    }

    // _id first, then alphabetical
    const keys = Array.from(keySet);
    const hasId = keys.includes('_id');
    const sorted = keys.filter(k => k !== '_id').sort();
    this.columns = hasId ? ['_id', ...sorted] : sorted;
  }

  private resetSort(): void {
    this.sortColumn = null;
    this.sortDirection = 'none';
    this.sortedIndices = this.data.map((_, i) => i);
  }

  private handleHeaderClick(column: string): void {
    if (this.sortColumn === column) {
      // Cycle: asc → desc → none
      if (this.sortDirection === 'asc') {
        this.sortDirection = 'desc';
      } else if (this.sortDirection === 'desc') {
        this.sortDirection = 'none';
        this.sortColumn = null;
      }
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.applySorting();
  }

  private applySorting(): void {
    if (this.sortDirection === 'none' || !this.sortColumn) {
      this.sortedIndices = this.data.map((_, i) => i);
      return;
    }

    const col = this.sortColumn;
    const dir = this.sortDirection;
    const indices = this.data.map((_, i) => i);

    indices.sort((a, b) => {
      const aVal = this.data[a][col];
      const bVal = this.data[b][col];

      // Null/undefined always sort to end
      const aNull = aVal === null || aVal === undefined;
      const bNull = bVal === null || bVal === undefined;
      if (aNull && bNull) return 0;
      if (aNull) return 1;
      if (bNull) return -1;

      let cmp: number;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        cmp = aVal - bVal;
      } else {
        cmp = String(aVal).localeCompare(String(bVal));
      }

      return dir === 'asc' ? cmp : -cmp;
    });

    this.sortedIndices = indices;
  }

  private sortIcon(column: string): TemplateResult {
    if (this.sortColumn !== column) {
      return html`<i class="fa-solid fa-sort text-base-content/30 ml-1"></i>`;
    }
    return this.sortDirection === 'asc'
      ? html`<i class="fa-solid fa-sort-up ml-1"></i>`
      : html`<i class="fa-solid fa-sort-down ml-1"></i>`;
  }

  private async copyCell(value: unknown): Promise<void> {
    const text = value === null || value === undefined
      ? ''
      : typeof value === 'object'
        ? JSON.stringify(value, null, 2)
        : String(value);
    try {
      await navigator.clipboard.writeText(text);
      import('../toast-notification').then(({ ToastNotification }) => {
        ToastNotification.success('Copied to clipboard');
      });
    } catch {
      // Clipboard write failed — ignore silently
    }
  }

  private renderCellContent(value: unknown): TemplateResult {
    if (value === null || value === undefined) {
      return html`<span class="italic text-base-content/30">NULL</span>`;
    }

    if (typeof value === 'boolean') {
      return html`<span class="badge badge-xs ${value ? 'badge-success' : 'badge-ghost'}">${value}</span>`;
    }

    if (typeof value === 'number') {
      return html`<span class="font-mono">${value}</span>`;
    }

    if (Array.isArray(value)) {
      return html`<span class="badge badge-xs badge-outline" title="${JSON.stringify(value, null, 2)}">[${value.length} items]</span>`;
    }

    if (typeof value === 'object') {
      const keyCount = Object.keys(value as object).length;
      return html`<span class="badge badge-xs badge-outline" title="${JSON.stringify(value, null, 2)}">{${keyCount} keys}</span>`;
    }

    // String
    const str = String(value);
    if (str.length > 100) {
      return html`<span title="${str}">${str.substring(0, 100)}...</span>`;
    }
    return html`${str}`;
  }

  render() {
    if (!this.data || this.data.length === 0) {
      return html`
        <div class="flex items-center justify-center h-full text-base-content/50">
          <div class="text-center">
            <i class="fa-solid fa-table-cells text-4xl mb-3"></i>
            <div>No data to display in grid view</div>
          </div>
        </div>
      `;
    }

    if (this.columns.length === 0) {
      return html`
        <div class="flex items-center justify-center h-full text-base-content/50">
          <div class="text-center">
            <i class="fa-solid fa-table-cells text-4xl mb-3"></i>
            <div>Data is not tabular — use Text or JSON view</div>
          </div>
        </div>
      `;
    }

    return html`
      <div class="h-full overflow-auto">
        <table class="table table-xs table-pin-rows table-zebra w-full">
          <thead>
            <tr>
              <th class="w-12 text-center text-base-content/50">#</th>
              ${this.columns.map(col => html`
                <th
                  class="cursor-pointer select-none hover:bg-base-300/50 transition-colors whitespace-nowrap"
                  @click=${() => this.handleHeaderClick(col)}
                >
                  ${col}${this.sortIcon(col)}
                </th>
              `)}
            </tr>
          </thead>
          <tbody>
            ${this.sortedIndices.map((dataIdx, displayIdx) => html`
              <tr class="hover">
                <td class="text-center text-base-content/40 font-mono text-xs">${displayIdx + 1}</td>
                ${this.columns.map(col => html`
                  <td
                    class="cursor-pointer hover:bg-accent/10 transition-colors max-w-xs truncate"
                    @click=${() => this.copyCell(this.data[dataIdx][col])}
                    title="Click to copy"
                  >
                    ${this.renderCellContent(this.data[dataIdx][col])}
                  </td>
                `)}
              </tr>
            `)}
          </tbody>
        </table>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'results-grid': ResultsGrid;
  }
}
