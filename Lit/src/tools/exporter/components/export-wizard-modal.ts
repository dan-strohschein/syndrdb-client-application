/**
 * Export Wizard Modal — multi-step wizard orchestrator.
 * Extends BaseModalMixin for consistent modal behavior.
 * Adapts step labels and flow based on export mode (schema-only, data-only, both).
 */

import { html, LitElement, nothing } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { BaseModalMixin } from '../../../lib/base-modal-mixin';
import type { ExportWizardState, ExportMode, SelectionStepState, PreviewStepState } from '../types/wizard-state';
import { createInitialExportWizardState } from '../types/wizard-state';
import type { ElectronAPI } from '../../../types/electron-api';
import { generateFullDDLScript } from '../domain/ddl-script-generator';
import { buildExportQueries, getCheckedBundles } from '../domain/find-query-builder';
import { getCheckedNodes } from '../domain/find-query-builder';
import './export-step-type';
import './export-step-connection';
import './export-step-format';
import './export-step-preview';
import './export-step-execute';

/** Get step labels based on export mode */
function getStepLabels(mode: ExportMode): string[] {
  switch (mode) {
    case 'schema-only':
      return ['Type', 'Selection', 'Preview', 'Execute'];
    case 'data-only':
    case 'both':
      return ['Type', 'Selection', 'Format', 'Preview', 'Execute'];
  }
}

/** Map logical step index to the component to render */
function getStepComponent(mode: ExportMode, stepIndex: number): string {
  if (mode === 'schema-only') {
    const steps = ['type', 'connection', 'preview', 'execute'];
    return steps[stepIndex] || 'type';
  }
  const steps = ['type', 'connection', 'format', 'preview', 'execute'];
  return steps[stepIndex] || 'type';
}

@customElement('export-wizard-modal')
export class ExportWizardModal extends BaseModalMixin(LitElement) {
  @property({ type: String }) connectionId: string | null = null;
  @property({ type: String }) databaseName: string | null = null;

  @state() private wizardState: ExportWizardState = createInitialExportWizardState();

  private get api(): ElectronAPI | undefined {
    return window.electronAPI;
  }

  override async updated(changed: Map<string, unknown>) {
    if (changed.has('open') && this.open) {
      this.wizardState = createInitialExportWizardState();
      // Pre-fill from props
      if (this.connectionId) {
        this.wizardState.selection.connectionId = this.connectionId;
      }
      await this.loadPlugins();
    }
  }

  private async loadPlugins() {
    try {
      const plugins = await this.api?.exporter?.listPlugins();
      if (plugins) {
        this.wizardState = { ...this.wizardState, availablePlugins: plugins };
        // Auto-select first plugin
        if (plugins.length > 0 && !this.wizardState.format.selectedPluginId) {
          const defaultOptions: Record<string, string | number | boolean> = {};
          for (const field of plugins[0].configSchema) {
            defaultOptions[field.key] = field.defaultValue;
          }
          this.wizardState.format = {
            ...this.wizardState.format,
            selectedPluginId: plugins[0].id,
            exporterOptions: defaultOptions,
          };
        }
        this.requestUpdate();
      }
    } catch (e) {
      console.error('Failed to load exporter plugins:', e);
    }
  }

  private get stepLabels(): string[] {
    return getStepLabels(this.wizardState.type.exportMode);
  }

  private get totalSteps(): number {
    return this.stepLabels.length;
  }

  private get currentStepComponent(): string {
    return getStepComponent(this.wizardState.type.exportMode, this.wizardState.currentStep);
  }

  private get canGoNext(): boolean {
    const component = this.currentStepComponent;
    switch (component) {
      case 'type':
        return true; // Always has a selection
      case 'connection':
        return this.isSelectionValid();
      case 'format':
        return this.isFormatValid();
      case 'preview':
        return true; // Preview is informational
      case 'execute':
        return false; // No next from execute
      default:
        return false;
    }
  }

  private isSelectionValid(): boolean {
    const s = this.wizardState.selection;
    if (!s.connectionId) return false;

    if (s.dataSourceMode === 'custom-query') {
      return !!s.customQuery.trim() && !!s.customQueryDatabase;
    }

    // Tree selection: at least one item must be checked
    return this.hasCheckedNodes(s.schemaTree);
  }

  private hasCheckedNodes(nodes: { checked: boolean; children: { checked: boolean; children: unknown[] }[] }[]): boolean {
    for (const node of nodes) {
      if (node.checked) return true;
      if (node.children.length > 0 && this.hasCheckedNodes(node.children as typeof nodes)) return true;
    }
    return false;
  }

  private isFormatValid(): boolean {
    const f = this.wizardState.format;
    if (!f.selectedPluginId) return false;
    if (!f.dataFilePath) return false;
    return true;
  }

  private handleNext() {
    if (!this.canGoNext) return;
    const nextStep = this.wizardState.currentStep + 1;

    // When entering preview step, generate DDL and queries
    const nextComponent = getStepComponent(this.wizardState.type.exportMode, nextStep);
    if (nextComponent === 'preview') {
      this.generatePreview();
    }

    this.wizardState = { ...this.wizardState, currentStep: nextStep };
    this.requestUpdate();
  }

  private handleBack() {
    if (this.wizardState.currentStep > 0) {
      this.wizardState = {
        ...this.wizardState,
        currentStep: this.wizardState.currentStep - 1,
      };
      this.requestUpdate();
    }
  }

  private generatePreview() {
    const mode = this.wizardState.type.exportMode;
    const selection = this.wizardState.selection;
    let ddlScript = '';
    let queries: { databaseName: string; bundleName: string; query: string }[] = [];

    const generateDDL = mode === 'schema-only' || mode === 'both';
    const generateQueries = mode === 'data-only' || mode === 'both';

    if (generateDDL) {
      if (selection.dataSourceMode === 'tree-selection') {
        ddlScript = generateFullDDLScript(selection.schemaTree);
      }
    }

    if (generateQueries) {
      if (selection.dataSourceMode === 'custom-query' && selection.customQuery.trim()) {
        queries = [{
          databaseName: selection.customQueryDatabase || '',
          bundleName: 'Custom Query',
          query: selection.customQuery.trim(),
        }];
      } else {
        const checkedBundles = getCheckedBundles(selection.schemaTree);
        queries = buildExportQueries(checkedBundles);
      }
    }

    this.wizardState.preview = {
      ...this.wizardState.preview,
      ddlScript,
      queries,
      loading: false,
      error: null,
    };
  }

  private handleTypeChanged(e: CustomEvent) {
    this.wizardState = {
      ...this.wizardState,
      type: e.detail,
      // Reset execution when type changes
      execution: createInitialExportWizardState().execution,
    };
    this.requestUpdate();
  }

  private handleSelectionChanged(e: CustomEvent) {
    this.wizardState = { ...this.wizardState, selection: e.detail };
    this.requestUpdate();
  }

  private handleFormatChanged(e: CustomEvent) {
    this.wizardState = { ...this.wizardState, format: e.detail };
    this.requestUpdate();
  }

  private handlePreviewChanged(e: CustomEvent) {
    this.wizardState = { ...this.wizardState, preview: e.detail };
    this.requestUpdate();
  }

  private handleExecutionChanged(e: CustomEvent) {
    this.wizardState = { ...this.wizardState, execution: e.detail };
    this.requestUpdate();
  }

  override handleClose() {
    this.api?.exporter?.removeExportListeners();
    super.handleClose();
  }

  render() {
    if (!this.open) return html``;

    const step = this.wizardState.currentStep;
    const labels = this.stepLabels;
    const isExecuting = this.wizardState.execution.status === 'running';
    const component = this.currentStepComponent;

    return html`
      <div class="modal modal-open">
        <div class="modal-box max-w-5xl w-full h-[85vh] flex flex-col">
          <!-- Header -->
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-bold text-lg">Export Data</h3>
            <button class="btn btn-sm btn-ghost" @click=${this.handleClose} ?disabled=${isExecuting}>
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <!-- Step Indicator -->
          <ul class="steps steps-horizontal w-full mb-4">
            ${labels.map(
              (label, i) => html`
                <li class="step ${i <= step ? 'step-primary' : ''}">${label}</li>
              `
            )}
          </ul>

          <!-- Step Content -->
          <div class="flex-1 overflow-y-auto min-h-0">
            ${component === 'type'
              ? html`<export-step-type
                  .state=${this.wizardState.type}
                  @type-changed=${this.handleTypeChanged}
                ></export-step-type>`
              : component === 'connection'
              ? html`<export-step-connection
                  .state=${this.wizardState.selection}
                  .exportMode=${this.wizardState.type.exportMode}
                  @selection-changed=${this.handleSelectionChanged}
                ></export-step-connection>`
              : component === 'format'
              ? html`<export-step-format
                  .state=${this.wizardState.format}
                  .plugins=${this.wizardState.availablePlugins}
                  .exportMode=${this.wizardState.type.exportMode}
                  @format-changed=${this.handleFormatChanged}
                ></export-step-format>`
              : component === 'preview'
              ? html`<export-step-preview
                  .state=${this.wizardState.preview}
                  .exportMode=${this.wizardState.type.exportMode}
                  @preview-changed=${this.handlePreviewChanged}
                ></export-step-preview>`
              : html`<export-step-execute
                  .state=${this.wizardState.execution}
                  .formatState=${this.wizardState.format}
                  .previewState=${this.wizardState.preview}
                  .exportMode=${this.wizardState.type.exportMode}
                  .connectionId=${this.wizardState.selection.connectionId}
                  @execution-changed=${this.handleExecutionChanged}
                ></export-step-execute>`}
          </div>

          <!-- Navigation Buttons -->
          <div class="modal-action mt-4">
            <button
              class="btn"
              @click=${this.handleBack}
              ?disabled=${step === 0 || isExecuting}
            >
              Back
            </button>
            <div class="flex-1"></div>
            <button class="btn" @click=${this.handleClose} ?disabled=${isExecuting}>
              Cancel
            </button>
            ${step < this.totalSteps - 1
              ? html`
                  <button
                    class="btn btn-primary"
                    @click=${this.handleNext}
                    ?disabled=${!this.canGoNext}
                  >
                    Next
                  </button>
                `
              : ''}
          </div>
        </div>
        <div class="modal-backdrop" @click=${this.handleClose}></div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'export-wizard-modal': ExportWizardModal;
  }
}
