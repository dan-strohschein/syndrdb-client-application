/**
 * Step 2 — Preview: Shows parsed data table, header toggle, detected types.
 */

import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { PreviewStepState, SourceStepState } from '../types/wizard-state';
import type { ElectronAPI } from '../../../types/electron-api';

@customElement('import-step-preview')
export class ImportStepPreview extends LitElement {
  createRenderRoot() { return this; }

  @property({ type: Object }) state!: PreviewStepState;
  @property({ type: Object }) sourceState!: SourceStepState;

  private get api(): ElectronAPI | undefined {
    return window.electronAPI;
  }

  private emitChange(partial: Partial<PreviewStepState>) {
    this.dispatchEvent(
      new CustomEvent('preview-changed', {
        detail: { ...this.state, ...partial },
        bubbles: true,
        composed: true,
      })
    );
  }

  override async connectedCallback() {
    super.connectedCallback();
    // Auto-parse on first mount if source is configured
    if (!this.state.parseResult && this.sourceState.filePath && this.sourceState.selectedPluginId) {
      await this.parseFile();
    }
  }

  override async updated(changed: Map<string, unknown>) {
    // Re-parse when source changes
    if (changed.has('sourceState') && this.sourceState.filePath && this.sourceState.selectedPluginId) {
      const old = changed.get('sourceState') as SourceStepState | undefined;
      if (old && (old.filePath !== this.sourceState.filePath ||
          old.selectedPluginId !== this.sourceState.selectedPluginId ||
          JSON.stringify(old.parserOptions) !== JSON.stringify(this.sourceState.parserOptions) ||
          old.encoding !== this.sourceState.encoding)) {
        await this.parseFile();
      }
    }
  }

  private async parseFile() {
    this.emitChange({ loading: true, error: null });

    try {
      const result = await this.api?.importer?.parsePreview(
        this.sourceState.selectedPluginId!,
        {
          filePath: this.sourceState.filePath!,
          encoding: this.sourceState.encoding,
          previewRowLimit: 100,
          parserOptions: this.sourceState.parserOptions,
        }
      );

      if (result) {
        this.emitChange({
          parseResult: result,
          loading: false,
          hasHeaderRow: this.sourceState.parserOptions.hasHeader !== false,
        });
      }
    } catch (e) {
      this.emitChange({
        loading: false,
        error: e instanceof Error ? e.message : 'Failed to parse file',
      });
    }
  }

  private handleHeaderToggle(e: Event) {
    const hasHeader = (e.target as HTMLInputElement).checked;
    this.emitChange({ hasHeaderRow: hasHeader });
    // Re-parse with updated header option — trigger via source change
    this.dispatchEvent(
      new CustomEvent('source-changed', {
        detail: {
          ...this.sourceState,
          parserOptions: { ...this.sourceState.parserOptions, hasHeader },
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  private getConfidenceBadge(confidence: number): string {
    if (confidence >= 0.95) return 'badge-success';
    if (confidence >= 0.8) return 'badge-warning';
    return 'badge-error';
  }

  render() {
    if (this.state.loading) {
      return html`
        <div class="flex items-center justify-center h-64">
          <span class="loading loading-spinner loading-lg"></span>
          <span class="ml-2">Parsing file...</span>
        </div>
      `;
    }

    if (this.state.error) {
      return html`
        <div class="alert alert-error">
          <i class="fa-solid fa-circle-exclamation"></i>
          <span>${this.state.error}</span>
        </div>
      `;
    }

    const pr = this.state.parseResult;
    if (!pr) {
      return html`<div class="text-base-content/50 text-center py-8">No data to preview</div>`;
    }

    const displayRows = pr.rows.slice(0, 100);

    return html`
      <div class="space-y-3">
        <!-- Warnings -->
        ${pr.warnings.length > 0
          ? html`
              <div class="alert alert-warning text-sm py-2">
                ${pr.warnings.map((w) => html`<div>${w}</div>`)}
              </div>
            `
          : ''}

        <!-- Header toggle + row count -->
        <div class="flex items-center justify-between">
          <label class="label cursor-pointer gap-2">
            <input
              type="checkbox"
              class="checkbox checkbox-sm"
              ?checked=${this.state.hasHeaderRow}
              @change=${this.handleHeaderToggle}
            />
            <span class="label-text">First row is header</span>
          </label>
          <span class="text-sm text-base-content/70">
            ${pr.totalRowCount.toLocaleString()} rows total | Showing ${displayRows.length}
          </span>
        </div>

        <!-- Type Detection Summary -->
        <div class="flex flex-wrap gap-1">
          ${pr.headers.map(
            (header, i) => html`
              <span class="badge badge-sm ${this.getConfidenceBadge(pr.detectedTypes[i]?.confidence ?? 0)}">
                ${header}: ${pr.detectedTypes[i]?.type ?? 'STRING'}
                (${Math.round((pr.detectedTypes[i]?.confidence ?? 0) * 100)}%)
              </span>
            `
          )}
        </div>

        <!-- Data Table -->
        <div class="overflow-x-auto max-h-[50vh] border rounded">
          <table class="table table-xs table-pin-rows">
            <thead>
              <tr>
                <th class="bg-base-200 w-10">#</th>
                ${pr.headers.map(
                  (h) => html`<th class="bg-base-200">${h}</th>`
                )}
              </tr>
            </thead>
            <tbody>
              ${displayRows.map(
                (row, i) => html`
                  <tr class="hover">
                    <td class="text-base-content/50">${i + 1}</td>
                    ${row.map(
                      (cell) => html`
                        <td class="${cell === null ? 'text-base-content/30 italic' : ''}">${cell ?? 'NULL'}</td>
                      `
                    )}
                  </tr>
                `
              )}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'import-step-preview': ImportStepPreview;
  }
}
