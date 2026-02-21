/**
 * Step 4 — Validation: Dry-run preview, error policy, batch size.
 */

import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type {
  ValidationStepState,
  MappingStepState,
  PreviewStepState,
  SourceStepState,
  ErrorPolicy,
} from '../types/wizard-state';
import type { ElectronAPI } from '../../../types/electron-api';
import type { ImportExecutionConfig } from '../../../electron/import-execution-engine';
import { buildCreateBundleCommand } from '../../../domain/bundle-commands';

@customElement('import-step-validation')
export class ImportStepValidation extends LitElement {
  createRenderRoot() { return this; }

  @property({ type: Object }) state!: ValidationStepState;
  @property({ type: Object }) mappingState!: MappingStepState;
  @property({ type: Object }) previewState!: PreviewStepState;
  @property({ type: Object }) sourceState!: SourceStepState;

  private get api(): ElectronAPI | undefined {
    return window.electronAPI;
  }

  private emitChange(partial: Partial<ValidationStepState>) {
    this.dispatchEvent(
      new CustomEvent('validation-changed', {
        detail: { ...this.state, ...partial },
        bubbles: true,
        composed: true,
      })
    );
  }

  private buildExecutionConfig(): ImportExecutionConfig {
    const bundleName = this.mappingState.targetMode === 'new'
      ? this.mappingState.newBundleName
      : this.mappingState.bundleName!;

    let createBundleCommand: string | undefined;
    if (this.mappingState.targetMode === 'new') {
      const enabledMappings = this.mappingState.columnMappings.filter((m) => m.enabled);
      const fieldDefs = enabledMappings.map((m) => ({
        Name: m.sourceHeader,
        Type: m.targetType,
        IsRequired: false,
        IsUnique: false,
      }));
      createBundleCommand = buildCreateBundleCommand(bundleName, fieldDefs);
    }

    return {
      pluginId: this.sourceState.selectedPluginId!,
      parserConfig: {
        filePath: this.sourceState.filePath!,
        encoding: this.sourceState.encoding,
        previewRowLimit: 0,
        parserOptions: this.sourceState.parserOptions,
      },
      connectionId: this.mappingState.connectionId!,
      databaseName: this.mappingState.databaseName!,
      bundleName,
      createBundle: this.mappingState.targetMode === 'new',
      createBundleCommand,
      columnMappings: this.mappingState.columnMappings,
      nullHandling: this.mappingState.nullHandling,
      errorPolicy: this.state.errorPolicy,
      batchSize: this.state.batchSize,
    };
  }

  private async handleValidate() {
    this.emitChange({ loading: true, validated: false, errors: [] });

    try {
      const config = this.buildExecutionConfig();
      const previewRows = this.previewState.parseResult?.rows || [];
      const result = await this.api?.importer?.validateImport(config, previewRows);

      if (result) {
        this.emitChange({
          loading: false,
          validated: true,
          validRows: result.validRows,
          invalidRows: result.invalidRows,
          errors: result.errors,
        });
      }
    } catch (e) {
      this.emitChange({
        loading: false,
        validated: false,
        errors: [{ rowIndex: -1, message: e instanceof Error ? e.message : 'Validation failed' }],
      });
    }
  }

  private handleErrorPolicyChange(e: Event) {
    this.emitChange({
      errorPolicy: (e.target as HTMLSelectElement).value as ErrorPolicy,
      validated: false,
    });
  }

  private handleBatchSizeChange(e: Event) {
    const value = parseInt((e.target as HTMLInputElement).value, 10);
    if (value > 0) {
      this.emitChange({ batchSize: value });
    }
  }

  render() {
    const totalPreviewRows = this.previewState.parseResult?.rows.length || 0;

    return html`
      <div class="space-y-4">
        <!-- Configuration -->
        <div class="grid grid-cols-2 gap-4">
          <div class="form-control">
            <label class="label"><span class="label-text font-semibold">Error Policy</span></label>
            <select
              class="select select-bordered select-sm"
              .value=${this.state.errorPolicy}
              @change=${this.handleErrorPolicyChange}
            >
              <option value="skip">Skip bad rows</option>
              <option value="abort">Abort on first error</option>
              <option value="log">Log errors and continue</option>
            </select>
            <label class="label">
              <span class="label-text-alt">
                ${this.state.errorPolicy === 'skip'
                  ? 'Rows that fail validation will be skipped'
                  : this.state.errorPolicy === 'abort'
                  ? 'Import stops at the first error'
                  : 'All errors are logged, import continues'}
              </span>
            </label>
          </div>

          <div class="form-control">
            <label class="label"><span class="label-text font-semibold">Batch Size</span></label>
            <input
              type="number"
              class="input input-bordered input-sm"
              .value=${String(this.state.batchSize)}
              min="1"
              max="10000"
              @change=${this.handleBatchSizeChange}
            />
            <label class="label">
              <span class="label-text-alt">Rows per INSERT batch (1-10000)</span>
            </label>
          </div>
        </div>

        <!-- Validate Button -->
        <button
          class="btn btn-primary btn-sm"
          @click=${this.handleValidate}
          ?disabled=${this.state.loading}
        >
          ${this.state.loading
            ? html`<span class="loading loading-spinner loading-xs"></span> Validating...`
            : html`<i class="fa-solid fa-check-double mr-1"></i> Validate (${totalPreviewRows} preview rows)`}
        </button>

        <!-- Validation Results -->
        ${this.state.validated
          ? html`
              <div class="stats shadow">
                <div class="stat">
                  <div class="stat-title">Valid Rows</div>
                  <div class="stat-value text-success text-2xl">${this.state.validRows}</div>
                  <div class="stat-desc">
                    ${totalPreviewRows > 0
                      ? `${Math.round((this.state.validRows / totalPreviewRows) * 100)}%`
                      : '0%'}
                  </div>
                </div>
                <div class="stat">
                  <div class="stat-title">Invalid Rows</div>
                  <div class="stat-value text-error text-2xl">${this.state.invalidRows}</div>
                  <div class="stat-desc">
                    ${totalPreviewRows > 0
                      ? `${Math.round((this.state.invalidRows / totalPreviewRows) * 100)}%`
                      : '0%'}
                  </div>
                </div>
              </div>
            `
          : ''}

        <!-- Error Details -->
        ${this.state.errors.length > 0
          ? html`
              <div class="overflow-x-auto max-h-48 border rounded">
                <table class="table table-xs">
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Column</th>
                      <th>Error</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${this.state.errors.slice(0, 100).map(
                      (err) => html`
                        <tr>
                          <td>${err.rowIndex >= 0 ? err.rowIndex + 1 : '-'}</td>
                          <td>${err.column || '-'}</td>
                          <td class="text-error">${err.message}</td>
                          <td class="font-mono text-xs">${err.value || '-'}</td>
                        </tr>
                      `
                    )}
                  </tbody>
                </table>
                ${this.state.errors.length > 100
                  ? html`<div class="text-center text-sm text-base-content/50 py-1">
                      ...and ${this.state.errors.length - 100} more errors
                    </div>`
                  : ''}
              </div>
            `
          : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'import-step-validation': ImportStepValidation;
  }
}
