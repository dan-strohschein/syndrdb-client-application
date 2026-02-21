/**
 * Export Step 3 — Format selection and file destination.
 * Shown for data-only and both modes.
 */

import { html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { FormatStepState, ExportMode } from '../types/wizard-state';
import type { ExporterPluginManifest, ExporterConfigField } from '../types/exporter-plugin';
import type { ElectronAPI } from '../../../types/electron-api';

@customElement('export-step-format')
export class ExportStepFormat extends LitElement {
  @property({ type: Object }) state!: FormatStepState;
  @property({ type: Array }) plugins: ExporterPluginManifest[] = [];
  @property({ type: String }) exportMode: ExportMode = 'data-only';

  createRenderRoot() {
    return this;
  }

  private get api(): ElectronAPI | undefined {
    return window.electronAPI;
  }

  private getSelectedPlugin(): ExporterPluginManifest | undefined {
    return this.plugins.find((p) => p.id === this.state.selectedPluginId);
  }

  private handlePluginChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    const pluginId = select.value || null;
    const plugin = this.plugins.find((p) => p.id === pluginId);

    // Reset options to defaults when plugin changes
    const exporterOptions: Record<string, string | number | boolean> = {};
    if (plugin) {
      for (const field of plugin.configSchema) {
        exporterOptions[field.key] = field.defaultValue;
      }
    }

    this.emitState({
      ...this.state,
      selectedPluginId: pluginId,
      exporterOptions,
    });
  }

  private handleOptionChange(key: string, value: string | number | boolean) {
    this.emitState({
      ...this.state,
      exporterOptions: { ...this.state.exporterOptions, [key]: value },
    });
  }

  private async handleBrowseDataFile() {
    const plugin = this.getSelectedPlugin();
    const ext = plugin?.fileExtension || 'json';

    const result = await this.api?.fileDialog?.showSaveDialog({
      title: 'Save Export File',
      filters: [
        { name: `${plugin?.name || 'Export'} Files`, extensions: [ext] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (result && !result.canceled && result.filePath) {
      const dataFilePath = result.filePath;
      // Auto-derive schema file path for "both" mode
      const schemaFilePath =
        this.exportMode === 'both'
          ? dataFilePath.replace(/\.[^.]+$/, '.sql')
          : this.state.schemaFilePath;

      this.emitState({
        ...this.state,
        dataFilePath,
        schemaFilePath,
      });
    }
  }

  private async handleBrowseSchemaFile() {
    const result = await this.api?.fileDialog?.showSaveDialog({
      title: 'Save Schema File',
      filters: [
        { name: 'SQL Files', extensions: ['sql'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (result && !result.canceled && result.filePath) {
      this.emitState({ ...this.state, schemaFilePath: result.filePath });
    }
  }

  private handleEncodingChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    this.emitState({ ...this.state, encoding: select.value });
  }

  private emitState(newState: FormatStepState) {
    this.dispatchEvent(
      new CustomEvent('format-changed', {
        detail: newState,
        bubbles: true,
      })
    );
  }

  private renderConfigField(field: ExporterConfigField) {
    const value = this.state.exporterOptions[field.key] ?? field.defaultValue;

    switch (field.type) {
      case 'boolean':
        return html`
          <div class="form-control">
            <label class="label cursor-pointer justify-start gap-2">
              <input
                type="checkbox"
                class="checkbox checkbox-sm checkbox-primary"
                .checked=${!!value}
                @change=${(e: Event) => this.handleOptionChange(field.key, (e.target as HTMLInputElement).checked)}
              />
              <span class="label-text">${field.label}</span>
            </label>
          </div>
        `;
      case 'number':
        return html`
          <div class="form-control">
            <label class="label"><span class="label-text">${field.label}</span></label>
            <input
              type="number"
              class="input input-bordered input-sm w-24"
              .value=${String(value)}
              @input=${(e: Event) => this.handleOptionChange(field.key, parseInt((e.target as HTMLInputElement).value) || 0)}
            />
          </div>
        `;
      case 'select':
        return html`
          <div class="form-control">
            <label class="label"><span class="label-text">${field.label}</span></label>
            <select
              class="select select-bordered select-sm"
              .value=${String(value)}
              @change=${(e: Event) => this.handleOptionChange(field.key, (e.target as HTMLSelectElement).value)}
            >
              ${(field.options || []).map(
                (opt) => html`<option value=${opt.value}>${opt.label}</option>`
              )}
            </select>
          </div>
        `;
      default:
        return html`
          <div class="form-control">
            <label class="label"><span class="label-text">${field.label}</span></label>
            <input
              type="text"
              class="input input-bordered input-sm"
              .value=${String(value)}
              placeholder=${field.placeholder || ''}
              @input=${(e: Event) => this.handleOptionChange(field.key, (e.target as HTMLInputElement).value)}
            />
          </div>
        `;
    }
  }

  render() {
    const selectedPlugin = this.getSelectedPlugin();

    return html`
      <div class="p-4 space-y-4">
        <!-- Plugin Selection -->
        <div class="form-control">
          <label class="label">
            <span class="label-text font-semibold">Export Format</span>
          </label>
          <select
            class="select select-bordered w-full"
            .value=${this.state.selectedPluginId || ''}
            @change=${this.handlePluginChange}
          >
            <option value="">Select a format...</option>
            ${this.plugins.map(
              (p) => html`
                <option value=${p.id} ?selected=${this.state.selectedPluginId === p.id}>
                  ${p.name} (.${p.fileExtension})
                </option>
              `
            )}
          </select>
        </div>

        <!-- Plugin Config Options -->
        ${selectedPlugin && selectedPlugin.configSchema.length > 0
          ? html`
              <div class="bg-base-200 rounded-lg p-3 space-y-2">
                <span class="text-sm font-semibold">Format Options</span>
                ${selectedPlugin.configSchema.map((field) => this.renderConfigField(field))}
              </div>
            `
          : nothing}

        <!-- Data File Path -->
        <div class="form-control">
          <label class="label">
            <span class="label-text font-semibold">Data File</span>
          </label>
          <div class="flex gap-2">
            <input
              type="text"
              class="input input-bordered flex-1"
              readonly
              .value=${this.state.dataFilePath || ''}
              placeholder="Choose a save location..."
            />
            <button class="btn btn-primary" @click=${this.handleBrowseDataFile}>
              <i class="fa-solid fa-folder-open mr-1"></i> Browse...
            </button>
          </div>
        </div>

        <!-- Schema File Path (both mode) -->
        ${this.exportMode === 'both'
          ? html`
              <div class="form-control">
                <label class="label">
                  <span class="label-text font-semibold">Schema File (.sql)</span>
                </label>
                <div class="flex gap-2">
                  <input
                    type="text"
                    class="input input-bordered flex-1"
                    readonly
                    .value=${this.state.schemaFilePath || ''}
                    placeholder="Auto-derived from data file path"
                  />
                  <button class="btn btn-outline" @click=${this.handleBrowseSchemaFile}>
                    <i class="fa-solid fa-folder-open mr-1"></i> Change
                  </button>
                </div>
              </div>
            `
          : nothing}

        <!-- Encoding -->
        <div class="form-control">
          <label class="label">
            <span class="label-text font-semibold">Encoding</span>
          </label>
          <select
            class="select select-bordered w-48"
            .value=${this.state.encoding}
            @change=${this.handleEncodingChange}
          >
            <option value="utf-8">UTF-8</option>
            <option value="ascii">ASCII</option>
            <option value="utf-16le">UTF-16 LE</option>
            <option value="latin1">Latin-1</option>
          </select>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'export-step-format': ExportStepFormat;
  }
}
