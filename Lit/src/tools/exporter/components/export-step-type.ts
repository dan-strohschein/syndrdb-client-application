/**
 * Export Step 1 — Export type selection: Schema Only, Data Only, or Both.
 */

import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { TypeStepState, ExportMode } from '../types/wizard-state';

@customElement('export-step-type')
export class ExportStepType extends LitElement {
  @property({ type: Object }) state!: TypeStepState;

  createRenderRoot() {
    return this;
  }

  private handleModeSelect(mode: ExportMode) {
    this.dispatchEvent(
      new CustomEvent('type-changed', {
        detail: { ...this.state, exportMode: mode },
        bubbles: true,
      })
    );
  }

  render() {
    const modes: { mode: ExportMode; title: string; icon: string; description: string }[] = [
      {
        mode: 'schema-only',
        title: 'Schema Only',
        icon: 'fa-solid fa-sitemap',
        description: 'Export database schemas as DDL SyndrQL statements (CREATE DATABASE, CREATE BUNDLE, indexes, relationships, users).',
      },
      {
        mode: 'data-only',
        title: 'Data Only',
        icon: 'fa-solid fa-table',
        description: 'Export document data from bundles to a file (JSON, CSV, etc.) using SELECT queries.',
      },
      {
        mode: 'both',
        title: 'Schema & Data',
        icon: 'fa-solid fa-layer-group',
        description: 'Export both the DDL schema script and the document data. Generates a .sql file for schema and a data file.',
      },
    ];

    return html`
      <div class="p-4">
        <h4 class="text-base font-semibold mb-4">What would you like to export?</h4>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          ${modes.map(
            ({ mode, title, icon, description }) => html`
              <div
                class="card bg-base-200 cursor-pointer hover:bg-base-300 transition-colors border-2 ${this.state.exportMode === mode ? 'border-primary' : 'border-transparent'}"
                @click=${() => this.handleModeSelect(mode)}
              >
                <div class="card-body items-center text-center p-6">
                  <i class="${icon} text-3xl mb-2 ${this.state.exportMode === mode ? 'text-primary' : 'text-base-content/60'}"></i>
                  <h5 class="card-title text-sm">${title}</h5>
                  <p class="text-xs text-base-content/70">${description}</p>
                </div>
              </div>
            `
          )}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'export-step-type': ExportStepType;
  }
}
