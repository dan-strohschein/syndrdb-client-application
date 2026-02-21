/**
 * Import Wizard Modal — 5-step wizard orchestrator.
 * Extends BaseModalMixin for consistent modal behavior.
 */

import { html, LitElement } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { BaseModalMixin } from '../../../lib/base-modal-mixin';
import type { ImportWizardState } from '../types/wizard-state';
import { createInitialWizardState } from '../types/wizard-state';
import type { ElectronAPI } from '../../../types/electron-api';
import type { ImporterPluginManifest, ParseResult } from '../types/importer-plugin';
import './import-step-source';
import './import-step-preview';
import './import-step-mapping';
import './import-step-validation';
import './import-step-execute';

const STEP_LABELS = ['Source', 'Preview', 'Mapping', 'Validation', 'Execute'];

@customElement('import-wizard-modal')
export class ImportWizardModal extends BaseModalMixin(LitElement) {
  @property({ type: String }) connectionId: string | null = null;
  @property({ type: String }) databaseName: string | null = null;
  @property({ type: String }) bundleName: string | null = null;

  @state() private wizardState: ImportWizardState = createInitialWizardState();

  private get api(): ElectronAPI | undefined {
    return window.electronAPI;
  }

  override async updated(changed: Map<string, unknown>) {
    if (changed.has('open') && this.open) {
      this.wizardState = createInitialWizardState();
      // Pre-fill from props
      if (this.connectionId) this.wizardState.mapping.connectionId = this.connectionId;
      if (this.databaseName) this.wizardState.mapping.databaseName = this.databaseName;
      if (this.bundleName) {
        this.wizardState.mapping.bundleName = this.bundleName;
        this.wizardState.mapping.targetMode = 'existing';
      }
      await this.loadPlugins();
    }
  }

  private async loadPlugins() {
    try {
      const plugins = await this.api?.importer?.listPlugins();
      if (plugins) {
        this.wizardState = { ...this.wizardState, availablePlugins: plugins };
        this.requestUpdate();
      }
    } catch (e) {
      console.error('Failed to load importer plugins:', e);
    }
  }

  private get canGoNext(): boolean {
    const step = this.wizardState.currentStep;
    switch (step) {
      case 0: // Source
        return !!this.wizardState.source.filePath && !!this.wizardState.source.selectedPluginId;
      case 1: // Preview
        return !!this.wizardState.preview.parseResult && !this.wizardState.preview.loading;
      case 2: // Mapping
        return this.isMappingValid();
      case 3: // Validation
        return this.wizardState.validation.validated;
      case 4: // Execute
        return false; // No next from execute
      default:
        return false;
    }
  }

  private isMappingValid(): boolean {
    const m = this.wizardState.mapping;
    if (!m.connectionId || !m.databaseName) return false;
    if (m.targetMode === 'existing' && !m.bundleName) return false;
    if (m.targetMode === 'new' && !m.newBundleName.trim()) return false;
    const hasEnabledMapping = m.columnMappings.some((cm) => cm.enabled && cm.targetField);
    return hasEnabledMapping;
  }

  private handleNext() {
    if (!this.canGoNext) return;
    const nextStep = this.wizardState.currentStep + 1;

    // Invalidate future steps when going forward from mapping
    if (this.wizardState.currentStep === 2) {
      this.wizardState.validation = {
        ...this.wizardState.validation,
        validated: false,
        validRows: 0,
        invalidRows: 0,
        errors: [],
      };
      this.wizardState.execution = {
        ...this.wizardState.execution,
        status: 'idle',
        importedRows: 0,
        skippedRows: 0,
        failedRows: 0,
        errors: [],
      };
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

  private handleSourceChanged(e: CustomEvent) {
    this.wizardState = { ...this.wizardState, source: e.detail };
    this.requestUpdate();
  }

  private handlePreviewChanged(e: CustomEvent) {
    this.wizardState = { ...this.wizardState, preview: e.detail };
    this.requestUpdate();
  }

  private handleMappingChanged(e: CustomEvent) {
    this.wizardState = { ...this.wizardState, mapping: e.detail };
    this.requestUpdate();
  }

  private handleValidationChanged(e: CustomEvent) {
    this.wizardState = { ...this.wizardState, validation: e.detail };
    this.requestUpdate();
  }

  private handleExecutionChanged(e: CustomEvent) {
    this.wizardState = { ...this.wizardState, execution: e.detail };
    this.requestUpdate();
  }

  override handleClose() {
    // Clean up import listeners
    this.api?.importer?.removeImportListeners();
    super.handleClose();
  }

  render() {
    if (!this.open) return html``;

    const step = this.wizardState.currentStep;
    const isExecuting = this.wizardState.execution.status === 'running';

    return html`
      <div class="modal modal-open">
        <div class="modal-box max-w-5xl w-full h-[85vh] flex flex-col">
          <!-- Header -->
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-bold text-lg">Import Data</h3>
            <button class="btn btn-sm btn-ghost" @click=${this.handleClose} ?disabled=${isExecuting}>
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <!-- Step Indicator -->
          <ul class="steps steps-horizontal w-full mb-4">
            ${STEP_LABELS.map(
              (label, i) => html`
                <li class="step ${i <= step ? 'step-primary' : ''}">${label}</li>
              `
            )}
          </ul>

          <!-- Step Content -->
          <div class="flex-1 overflow-y-auto min-h-0">
            ${step === 0
              ? html`<import-step-source
                  .state=${this.wizardState.source}
                  .plugins=${this.wizardState.availablePlugins}
                  @source-changed=${this.handleSourceChanged}
                ></import-step-source>`
              : step === 1
              ? html`<import-step-preview
                  .state=${this.wizardState.preview}
                  .sourceState=${this.wizardState.source}
                  @preview-changed=${this.handlePreviewChanged}
                ></import-step-preview>`
              : step === 2
              ? html`<import-step-mapping
                  .state=${this.wizardState.mapping}
                  .previewState=${this.wizardState.preview}
                  @mapping-changed=${this.handleMappingChanged}
                ></import-step-mapping>`
              : step === 3
              ? html`<import-step-validation
                  .state=${this.wizardState.validation}
                  .mappingState=${this.wizardState.mapping}
                  .previewState=${this.wizardState.preview}
                  .sourceState=${this.wizardState.source}
                  @validation-changed=${this.handleValidationChanged}
                ></import-step-validation>`
              : html`<import-step-execute
                  .state=${this.wizardState.execution}
                  .mappingState=${this.wizardState.mapping}
                  .validationState=${this.wizardState.validation}
                  .sourceState=${this.wizardState.source}
                  .previewState=${this.wizardState.preview}
                  @execution-changed=${this.handleExecutionChanged}
                ></import-step-execute>`}
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
            ${step < 4
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
    'import-wizard-modal': ImportWizardModal;
  }
}
