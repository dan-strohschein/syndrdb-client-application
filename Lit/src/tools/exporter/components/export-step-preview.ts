/**
 * Export Step 4 — Preview generated DDL and/or queries before execution.
 */

import { html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { PreviewStepState, ExportMode } from '../types/wizard-state';

@customElement('export-step-preview')
export class ExportStepPreview extends LitElement {
  @property({ type: Object }) state!: PreviewStepState;
  @property({ type: String }) exportMode: ExportMode = 'schema-only';

  createRenderRoot() {
    return this;
  }

  private handleOpenInEditor() {
    this.dispatchEvent(
      new CustomEvent('add-query-editor', {
        detail: {
          title: 'Export DDL Script',
          content: this.state.ddlScript,
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    const showSchema = this.exportMode === 'schema-only' || this.exportMode === 'both';
    const showQueries = this.exportMode === 'data-only' || this.exportMode === 'both';

    return html`
      <div class="p-4 space-y-4">
        ${this.state.loading
          ? html`
              <div class="flex items-center justify-center py-8">
                <span class="loading loading-spinner loading-lg"></span>
                <span class="ml-2">Generating preview...</span>
              </div>
            `
          : nothing}

        ${this.state.error
          ? html`
              <div class="alert alert-error">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <span>${this.state.error}</span>
              </div>
            `
          : nothing}

        <!-- Schema DDL Preview -->
        ${showSchema && this.state.ddlScript
          ? html`
              <div>
                <div class="flex items-center justify-between mb-2">
                  <h4 class="font-semibold text-sm">DDL Script Preview</h4>
                  <button class="btn btn-sm btn-ghost" @click=${this.handleOpenInEditor}>
                    <i class="fa-solid fa-external-link mr-1"></i> Open in Editor Tab
                  </button>
                </div>
                <pre class="bg-base-200 rounded-lg p-4 text-xs font-mono overflow-auto max-h-64 whitespace-pre-wrap">${this.state.ddlScript}</pre>
                <div class="text-xs text-base-content/50 mt-1">
                  ${this.state.ddlScript.split('\n').length} lines
                </div>
              </div>
            `
          : nothing}

        <!-- Query Preview -->
        ${showQueries && this.state.queries.length > 0
          ? html`
              <div>
                <h4 class="font-semibold text-sm mb-2">Queries to Execute</h4>
                <div class="space-y-2">
                  ${this.state.queries.map(
                    (q) => html`
                      <div class="bg-base-200 rounded-lg p-3">
                        <div class="flex items-center gap-2 mb-1">
                          <span class="badge badge-sm badge-outline">${q.databaseName}</span>
                          <span class="text-sm font-medium">${q.bundleName}</span>
                        </div>
                        <code class="text-xs font-mono text-base-content/80">${q.query}</code>
                      </div>
                    `
                  )}
                </div>
                <div class="text-xs text-base-content/50 mt-1">
                  ${this.state.queries.length} quer${this.state.queries.length === 1 ? 'y' : 'ies'} to execute
                </div>
              </div>
            `
          : nothing}

        ${!this.state.loading && !this.state.error && !this.state.ddlScript && this.state.queries.length === 0
          ? html`
              <div class="text-center text-base-content/50 py-8">
                <i class="fa-solid fa-eye text-2xl mb-2"></i>
                <p class="text-sm">No preview available. Please select items to export in the previous step.</p>
              </div>
            `
          : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'export-step-preview': ExportStepPreview;
  }
}
