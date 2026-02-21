/**
 * Export Step 5 — Execute the export and show progress.
 */

import { html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { ExecutionStepState, ExportMode, FormatStepState, PreviewStepState } from '../types/wizard-state';
import type { ExportExecutionConfig } from '../types/export-config';
import type { ElectronAPI } from '../../../types/electron-api';

@customElement('export-step-execute')
export class ExportStepExecute extends LitElement {
  @property({ type: Object }) state!: ExecutionStepState;
  @property({ type: Object }) formatState!: FormatStepState;
  @property({ type: Object }) previewState!: PreviewStepState;
  @property({ type: String }) exportMode: ExportMode = 'schema-only';
  @property({ type: String }) connectionId: string | null = null;

  @state() private elapsedTimer: ReturnType<typeof setInterval> | null = null;
  @state() private startTime = 0;

  createRenderRoot() {
    return this;
  }

  private get api(): ElectronAPI | undefined {
    return window.electronAPI;
  }

  connectedCallback() {
    super.connectedCallback();
    // Set up IPC listeners for export progress
    this.api?.exporter?.onExportProgress((data: unknown) => {
      const progress = data as {
        documentsExported: number;
        totalDocuments: number;
        currentBundle: string;
        percentComplete: number;
        elapsedMs: number;
      };
      this.emitState({
        ...this.state,
        documentsExported: progress.documentsExported,
        totalDocuments: progress.totalDocuments,
        percentComplete: progress.percentComplete,
        elapsedMs: progress.elapsedMs,
      });
    });

    this.api?.exporter?.onExportComplete((data: unknown) => {
      const result = data as {
        totalDocuments: number;
        bundlesExported: number;
        fileSize: number;
        filePath: string;
        elapsedMs: number;
        errors: { bundleName?: string; message: string }[];
      };
      this.stopTimer();
      this.emitState({
        ...this.state,
        status: result.errors.length > 0 ? 'error' : 'completed',
        documentsExported: result.totalDocuments,
        bundlesExported: result.bundlesExported,
        elapsedMs: result.elapsedMs,
        percentComplete: 100,
        errors: result.errors,
        dataOutputPath: result.filePath,
      });
    });

    this.api?.exporter?.onExportError((data: unknown) => {
      const result = data as { errors: { bundleName?: string; message: string }[] };
      this.stopTimer();
      this.emitState({
        ...this.state,
        status: 'error',
        errors: result.errors || [{ message: 'Export failed' }],
      });
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.stopTimer();
    this.api?.exporter?.removeExportListeners();
  }

  private startTimer() {
    this.startTime = Date.now();
    this.elapsedTimer = setInterval(() => {
      this.emitState({
        ...this.state,
        elapsedMs: Date.now() - this.startTime,
      });
    }, 500);
  }

  private stopTimer() {
    if (this.elapsedTimer) {
      clearInterval(this.elapsedTimer);
      this.elapsedTimer = null;
    }
  }

  private async handleStartExport() {
    this.emitState({
      ...this.state,
      status: 'running',
      documentsExported: 0,
      bundlesExported: 0,
      percentComplete: 0,
      elapsedMs: 0,
      errors: [],
      schemaOutputPath: null,
      dataOutputPath: null,
    });
    this.startTimer();

    try {
      const exportSchema = this.exportMode === 'schema-only' || this.exportMode === 'both';
      const exportData = this.exportMode === 'data-only' || this.exportMode === 'both';

      // Export schema to file
      if (exportSchema && this.previewState.ddlScript) {
        const schemaPath = this.formatState.schemaFilePath || this.formatState.dataFilePath?.replace(/\.[^.]+$/, '.sql') || 'export.sql';

        const schemaResult = await this.api?.exporter?.exportSchema(
          this.previewState.ddlScript,
          schemaPath
        );

        if (schemaResult && !schemaResult.success) {
          this.stopTimer();
          this.emitState({
            ...this.state,
            status: 'error',
            errors: [{ message: `Schema export failed: ${schemaResult.error}` }],
          });
          return;
        }

        this.emitState({
          ...this.state,
          schemaOutputPath: schemaPath,
        });
      }

      // Export data
      if (exportData && this.previewState.queries.length > 0) {
        if (!this.connectionId || !this.formatState.selectedPluginId || !this.formatState.dataFilePath) {
          this.stopTimer();
          this.emitState({
            ...this.state,
            status: 'error',
            errors: [{ message: 'Missing connection, plugin, or file path for data export.' }],
          });
          return;
        }

        const config: ExportExecutionConfig = {
          exportMode: this.exportMode,
          connectionId: this.connectionId,
          queries: this.previewState.queries,
          pluginId: this.formatState.selectedPluginId,
          exporterConfig: {
            filePath: this.formatState.dataFilePath,
            encoding: this.formatState.encoding,
            exporterOptions: this.formatState.exporterOptions,
          },
          batchSize: 1000,
        };

        const result = await this.api?.exporter?.startExport(config);
        this.stopTimer();

        if (result) {
          this.emitState({
            ...this.state,
            status: result.errors.length > 0 ? 'error' : 'completed',
            documentsExported: result.totalDocuments,
            bundlesExported: result.bundlesExported,
            elapsedMs: result.elapsedMs,
            percentComplete: 100,
            errors: result.errors,
            dataOutputPath: result.filePath,
          });
        }
      } else if (!exportData) {
        // Schema-only mode completes here
        this.stopTimer();
        this.emitState({
          ...this.state,
          status: 'completed',
          percentComplete: 100,
          elapsedMs: Date.now() - this.startTime,
        });
      }
    } catch (error) {
      this.stopTimer();
      this.emitState({
        ...this.state,
        status: 'error',
        errors: [{ message: error instanceof Error ? error.message : 'Export failed' }],
      });
    }
  }

  private handleOpenInEditor() {
    this.dispatchEvent(
      new CustomEvent('add-query-editor', {
        detail: {
          title: 'Exported DDL Script',
          content: this.previewState.ddlScript,
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  private async handleAbort() {
    await this.api?.exporter?.abortExport();
    this.stopTimer();
    this.emitState({
      ...this.state,
      status: 'aborted',
    });
  }

  private emitState(newState: ExecutionStepState) {
    this.dispatchEvent(
      new CustomEvent('execution-changed', {
        detail: newState,
        bubbles: true,
      })
    );
  }

  private formatTime(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }

  render() {
    const { status, documentsExported, bundlesExported, percentComplete, elapsedMs, errors, schemaOutputPath, dataOutputPath } = this.state;
    const isRunning = status === 'running';
    const isCompleted = status === 'completed';
    const isError = status === 'error';
    const isAborted = status === 'aborted';

    return html`
      <div class="p-4 space-y-4">
        ${status === 'idle'
          ? html`
              <div class="text-center py-8">
                <i class="fa-solid fa-file-export text-4xl text-base-content/40 mb-4"></i>
                <p class="text-base-content/60 mb-4">Ready to export. Click the button below to start.</p>

                ${this.exportMode === 'schema-only'
                  ? html`
                      <div class="flex justify-center gap-2 mb-4">
                        <button class="btn btn-primary" @click=${this.handleStartExport}>
                          <i class="fa-solid fa-play mr-1"></i> Export to File
                        </button>
                        <button class="btn btn-outline" @click=${this.handleOpenInEditor}>
                          <i class="fa-solid fa-external-link mr-1"></i> Open in Editor Tab
                        </button>
                      </div>
                    `
                  : html`
                      <button class="btn btn-primary" @click=${this.handleStartExport}>
                        <i class="fa-solid fa-play mr-1"></i> Start Export
                      </button>
                    `}
              </div>
            `
          : nothing}

        ${isRunning
          ? html`
              <div>
                <div class="flex items-center justify-between mb-2">
                  <span class="font-semibold">Exporting...</span>
                  <button class="btn btn-sm btn-error" @click=${this.handleAbort}>
                    <i class="fa-solid fa-stop mr-1"></i> Abort
                  </button>
                </div>
                <progress class="progress progress-primary w-full" value=${percentComplete} max="100"></progress>
                <div class="flex justify-between text-sm text-base-content/60 mt-1">
                  <span>${documentsExported} documents exported</span>
                  <span>${this.formatTime(elapsedMs)}</span>
                </div>
              </div>
            `
          : nothing}

        ${isCompleted
          ? html`
              <div class="alert alert-success">
                <i class="fa-solid fa-check-circle"></i>
                <div>
                  <h4 class="font-bold">Export Complete</h4>
                  <div class="text-sm">
                    ${documentsExported > 0
                      ? html`<p>${documentsExported} documents from ${bundlesExported} bundle${bundlesExported !== 1 ? 's' : ''} exported.</p>`
                      : nothing}
                    <p>Completed in ${this.formatTime(elapsedMs)}.</p>
                  </div>
                </div>
              </div>

              ${schemaOutputPath
                ? html`
                    <div class="bg-base-200 rounded-lg p-3">
                      <span class="text-sm font-semibold">Schema File:</span>
                      <code class="text-xs ml-2">${schemaOutputPath}</code>
                    </div>
                  `
                : nothing}

              ${dataOutputPath
                ? html`
                    <div class="bg-base-200 rounded-lg p-3">
                      <span class="text-sm font-semibold">Data File:</span>
                      <code class="text-xs ml-2">${dataOutputPath}</code>
                    </div>
                  `
                : nothing}
            `
          : nothing}

        ${isAborted
          ? html`
              <div class="alert alert-warning">
                <i class="fa-solid fa-ban"></i>
                <span>Export was aborted. ${documentsExported} documents were exported before cancellation.</span>
              </div>
            `
          : nothing}

        ${isError
          ? html`
              <div class="alert alert-error">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <div>
                  <h4 class="font-bold">Export Failed</h4>
                  <p class="text-sm">${errors.length > 0 ? errors[0].message : 'Unknown error'}</p>
                </div>
              </div>

              ${errors.length > 1
                ? html`
                    <div class="collapse collapse-arrow bg-base-200">
                      <input type="checkbox" />
                      <div class="collapse-title text-sm font-medium">
                        ${errors.length} error${errors.length !== 1 ? 's' : ''}
                      </div>
                      <div class="collapse-content">
                        <ul class="text-xs space-y-1">
                          ${errors.map(
                            (err) => html`
                              <li>
                                ${err.bundleName ? html`<span class="badge badge-sm badge-ghost mr-1">${err.bundleName}</span>` : nothing}
                                ${err.message}
                              </li>
                            `
                          )}
                        </ul>
                      </div>
                    </div>
                  `
                : nothing}
            `
          : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'export-step-execute': ExportStepExecute;
  }
}
