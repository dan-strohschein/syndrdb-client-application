/**
 * Step 5 — Execute: Start import, progress bar, live error log, results.
 */

import { html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type {
  ExecutionStepState,
  MappingStepState,
  ValidationStepState,
  SourceStepState,
  PreviewStepState,
} from '../types/wizard-state';
import type { ElectronAPI } from '../../../types/electron-api';
import type { ImportExecutionConfig } from '../../../electron/import-execution-engine';
import type { ImportResult, ImportRowError } from '../types/importer-plugin';
import { buildCreateBundleCommand } from '../../../domain/bundle-commands';

@customElement('import-step-execute')
export class ImportStepExecute extends LitElement {
  createRenderRoot() { return this; }

  @property({ type: Object }) state!: ExecutionStepState;
  @property({ type: Object }) mappingState!: MappingStepState;
  @property({ type: Object }) validationState!: ValidationStepState;
  @property({ type: Object }) sourceState!: SourceStepState;
  @property({ type: Object }) previewState!: PreviewStepState;

  @state() private startTime = 0;
  private timerInterval: ReturnType<typeof setInterval> | null = null;

  private get api(): ElectronAPI | undefined {
    return window.electronAPI;
  }

  private emitChange(partial: Partial<ExecutionStepState>) {
    this.dispatchEvent(
      new CustomEvent('execution-changed', {
        detail: { ...this.state, ...partial },
        bubbles: true,
        composed: true,
      })
    );
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.cleanupListeners();
  }

  private cleanupListeners() {
    this.api?.importer?.removeImportListeners();
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
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
      errorPolicy: this.validationState.errorPolicy,
      batchSize: this.validationState.batchSize,
    };
  }

  private async handleStart() {
    this.cleanupListeners();
    this.startTime = Date.now();

    this.emitChange({
      status: 'running',
      totalRows: this.previewState.parseResult?.totalRowCount || 0,
      importedRows: 0,
      skippedRows: 0,
      failedRows: 0,
      percentComplete: 0,
      elapsedMs: 0,
      estimatedRemainingMs: 0,
      errors: [],
    });

    // Start elapsed time timer
    this.timerInterval = setInterval(() => {
      if (this.state.status === 'running') {
        const elapsed = Date.now() - this.startTime;
        const rate = this.state.importedRows / (elapsed / 1000) || 0;
        const remaining = rate > 0
          ? ((this.state.totalRows - this.state.importedRows) / rate) * 1000
          : 0;
        this.emitChange({ elapsedMs: elapsed, estimatedRemainingMs: remaining });
      }
    }, 500);

    // Set up progress listener
    this.api?.importer?.onImportProgress((data: unknown) => {
      const progress = data as {
        importedRows: number;
        skippedRows: number;
        failedRows: number;
        totalRows: number;
        percentComplete: number;
        elapsedMs: number;
      };
      this.emitChange({
        importedRows: progress.importedRows,
        skippedRows: progress.skippedRows,
        failedRows: progress.failedRows,
        totalRows: Math.max(this.state.totalRows, progress.totalRows),
        percentComplete: progress.percentComplete,
        elapsedMs: progress.elapsedMs,
      });
    });

    // Error listener
    this.api?.importer?.onImportError((data: unknown) => {
      const error = data as ImportRowError;
      this.emitChange({ errors: [...this.state.errors, error] });
    });

    // Start the import
    try {
      const config = this.buildExecutionConfig();
      const result = await this.api?.importer?.startImport(config) as ImportResult | undefined;

      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }

      if (result) {
        this.emitChange({
          status: 'completed',
          totalRows: result.totalRows,
          importedRows: result.importedRows,
          skippedRows: result.skippedRows,
          failedRows: result.failedRows,
          errors: result.errors,
          elapsedMs: result.elapsedMs,
          percentComplete: 100,
        });
      }
    } catch (e) {
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }
      this.emitChange({
        status: 'error',
        errors: [...this.state.errors, {
          rowIndex: -1,
          message: e instanceof Error ? e.message : 'Import failed',
        }],
      });
    }
  }

  private async handleAbort() {
    try {
      await this.api?.importer?.abortImport();
      this.emitChange({ status: 'aborted' });
    } catch (e) {
      console.error('Failed to abort import:', e);
    }
  }

  private formatTime(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }

  render() {
    const isRunning = this.state.status === 'running';
    const isCompleted = this.state.status === 'completed';
    const isAborted = this.state.status === 'aborted';
    const isError = this.state.status === 'error';
    const isIdle = this.state.status === 'idle';

    return html`
      <div class="space-y-4">
        <!-- Start / Status -->
        ${isIdle
          ? html`
              <div class="text-center py-8">
                <p class="text-lg mb-4">Ready to import data</p>
                <p class="text-sm text-base-content/70 mb-4">
                  Target: <strong>${this.mappingState.targetMode === 'new' ? this.mappingState.newBundleName : this.mappingState.bundleName}</strong>
                  in <strong>${this.mappingState.databaseName}</strong>
                </p>
                <p class="text-sm text-base-content/70 mb-6">
                  ~${(this.previewState.parseResult?.totalRowCount || 0).toLocaleString()} rows |
                  Batch size: ${this.validationState.batchSize} |
                  Error policy: ${this.validationState.errorPolicy}
                </p>
                <button class="btn btn-primary" @click=${this.handleStart}>
                  <i class="fa-solid fa-play mr-1"></i> Start Import
                </button>
              </div>
            `
          : ''}

        <!-- Progress -->
        ${isRunning || isCompleted || isAborted || isError
          ? html`
              <!-- Progress Bar -->
              <div class="w-full">
                <div class="flex justify-between text-sm mb-1">
                  <span>${this.state.percentComplete}%</span>
                  <span>${this.state.importedRows.toLocaleString()} / ${this.state.totalRows.toLocaleString()} rows</span>
                </div>
                <progress
                  class="progress ${isCompleted ? 'progress-success' : isError || isAborted ? 'progress-error' : 'progress-primary'} w-full"
                  value=${this.state.percentComplete}
                  max="100"
                ></progress>
              </div>

              <!-- Stats -->
              <div class="stats shadow w-full">
                <div class="stat py-2">
                  <div class="stat-title text-xs">Imported</div>
                  <div class="stat-value text-success text-lg">${this.state.importedRows.toLocaleString()}</div>
                </div>
                <div class="stat py-2">
                  <div class="stat-title text-xs">Skipped</div>
                  <div class="stat-value text-warning text-lg">${this.state.skippedRows.toLocaleString()}</div>
                </div>
                <div class="stat py-2">
                  <div class="stat-title text-xs">Failed</div>
                  <div class="stat-value text-error text-lg">${this.state.failedRows.toLocaleString()}</div>
                </div>
                <div class="stat py-2">
                  <div class="stat-title text-xs">Elapsed</div>
                  <div class="stat-value text-lg">${this.formatTime(this.state.elapsedMs)}</div>
                </div>
                ${isRunning
                  ? html`
                      <div class="stat py-2">
                        <div class="stat-title text-xs">Remaining</div>
                        <div class="stat-value text-lg">~${this.formatTime(this.state.estimatedRemainingMs)}</div>
                      </div>
                    `
                  : ''}
              </div>

              <!-- Controls -->
              ${isRunning
                ? html`
                    <div class="flex gap-2">
                      <button class="btn btn-error btn-sm" @click=${this.handleAbort}>
                        <i class="fa-solid fa-stop mr-1"></i> Abort
                      </button>
                    </div>
                  `
                : ''}

              <!-- Completion message -->
              ${isCompleted
                ? html`
                    <div class="alert alert-success">
                      <i class="fa-solid fa-circle-check"></i>
                      <span>Import completed successfully in ${this.formatTime(this.state.elapsedMs)}</span>
                    </div>
                  `
                : ''}

              ${isAborted
                ? html`
                    <div class="alert alert-warning">
                      <i class="fa-solid fa-triangle-exclamation"></i>
                      <span>Import was aborted. ${this.state.importedRows} rows were imported before abort.</span>
                    </div>
                  `
                : ''}

              ${isError
                ? html`
                    <div class="alert alert-error">
                      <i class="fa-solid fa-circle-exclamation"></i>
                      <span>Import failed. Check error log below.</span>
                    </div>
                  `
                : ''}

              <!-- Error Log -->
              ${this.state.errors.length > 0
                ? html`
                    <div class="collapse collapse-arrow bg-base-200">
                      <input type="checkbox" />
                      <div class="collapse-title text-sm font-medium">
                        Error Log (${this.state.errors.length})
                      </div>
                      <div class="collapse-content">
                        <div class="max-h-48 overflow-y-auto text-xs font-mono">
                          ${this.state.errors.slice(0, 200).map(
                            (err) => html`
                              <div class="text-error py-0.5 border-b border-base-300">
                                ${err.rowIndex >= 0 ? `Row ${err.rowIndex + 1}: ` : ''}${err.message}
                                ${err.column ? ` (column: ${err.column})` : ''}
                              </div>
                            `
                          )}
                          ${this.state.errors.length > 200
                            ? html`<div class="py-1">...and ${this.state.errors.length - 200} more</div>`
                            : ''}
                        </div>
                      </div>
                    </div>
                  `
                : ''}
            `
          : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'import-step-execute': ImportStepExecute;
  }
}
