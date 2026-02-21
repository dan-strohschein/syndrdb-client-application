/**
 * Step 1 — Source: File picker, plugin selection, encoding, plugin-specific config.
 */

import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { ImporterPluginManifest, ParserConfigField } from '../types/importer-plugin';
import type { SourceStepState } from '../types/wizard-state';
import type { ElectronAPI } from '../../../types/electron-api';

@customElement('import-step-source')
export class ImportStepSource extends LitElement {
  createRenderRoot() { return this; }

  @property({ type: Object }) state!: SourceStepState;
  @property({ type: Array }) plugins: ImporterPluginManifest[] = [];

  private get api(): ElectronAPI | undefined {
    return window.electronAPI;
  }

  private get selectedPlugin(): ImporterPluginManifest | undefined {
    return this.plugins.find((p) => p.id === this.state.selectedPluginId);
  }

  private emitChange(partial: Partial<SourceStepState>) {
    this.dispatchEvent(
      new CustomEvent('source-changed', {
        detail: { ...this.state, ...partial },
        bubbles: true,
        composed: true,
      })
    );
  }

  private async handlePickFile() {
    const electronAPI = this.api;
    if (!electronAPI?.fileDialog) return;

    // Build filters from all plugins
    const allExtensions = this.plugins.flatMap((p) => p.supportedExtensions);
    const result = await electronAPI.fileDialog.showOpenDialog({
      title: 'Select file to import',
      filters: [
        { name: 'Supported Files', extensions: [...new Set(allExtensions)] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) return;

    const filePath = result.filePaths[0];

    // Get file info
    let fileSize = 0;
    let fileName = filePath.split(/[/\\]/).pop() || filePath;
    let extension = '';

    try {
      const fileInfo = await electronAPI.importer?.getFileInfo(filePath);
      if (fileInfo) {
        fileSize = fileInfo.fileSize;
        fileName = fileInfo.fileName;
        extension = fileInfo.extension;
      }
    } catch (e) {
      console.error('Failed to get file info:', e);
    }

    // Auto-select plugin by extension
    let selectedPluginId = this.state.selectedPluginId;
    if (extension) {
      const matching = this.plugins.find((p) =>
        p.supportedExtensions.some((e) => e.toLowerCase() === extension.toLowerCase())
      );
      if (matching) selectedPluginId = matching.id;
    }

    // Set default parser options from plugin config schema
    let parserOptions = { ...this.state.parserOptions };
    if (selectedPluginId !== this.state.selectedPluginId) {
      const plugin = this.plugins.find((p) => p.id === selectedPluginId);
      if (plugin) {
        parserOptions = {};
        for (const field of plugin.configSchema) {
          parserOptions[field.key] = field.defaultValue;
        }
      }
    }

    this.emitChange({ filePath, fileName, fileSize, selectedPluginId, parserOptions });
  }

  private handlePluginChange(e: Event) {
    const pluginId = (e.target as HTMLSelectElement).value;
    const plugin = this.plugins.find((p) => p.id === pluginId);
    const parserOptions: Record<string, string | number | boolean> = {};
    if (plugin) {
      for (const field of plugin.configSchema) {
        parserOptions[field.key] = field.defaultValue;
      }
    }
    this.emitChange({ selectedPluginId: pluginId, parserOptions });
  }

  private handleEncodingChange(e: Event) {
    this.emitChange({ encoding: (e.target as HTMLSelectElement).value });
  }

  private handleOptionChange(key: string, value: string | number | boolean) {
    this.emitChange({
      parserOptions: { ...this.state.parserOptions, [key]: value },
    });
  }

  private renderConfigField(field: ParserConfigField) {
    const value = this.state.parserOptions[field.key] ?? field.defaultValue;

    switch (field.type) {
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
                (opt) => html`<option value=${opt.value} ?selected=${opt.value === String(value)}>${opt.label}</option>`
              )}
            </select>
          </div>
        `;
      case 'boolean':
        return html`
          <div class="form-control">
            <label class="label cursor-pointer">
              <span class="label-text">${field.label}</span>
              <input
                type="checkbox"
                class="checkbox checkbox-sm"
                ?checked=${!!value}
                @change=${(e: Event) => this.handleOptionChange(field.key, (e.target as HTMLInputElement).checked)}
              />
            </label>
          </div>
        `;
      case 'number':
        return html`
          <div class="form-control">
            <label class="label"><span class="label-text">${field.label}</span></label>
            <input
              type="number"
              class="input input-bordered input-sm"
              .value=${String(value)}
              placeholder=${field.placeholder || ''}
              @change=${(e: Event) => this.handleOptionChange(field.key, Number((e.target as HTMLInputElement).value))}
            />
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
              @change=${(e: Event) => this.handleOptionChange(field.key, (e.target as HTMLInputElement).value)}
            />
          </div>
        `;
    }
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  }

  render() {
    return html`
      <div class="space-y-4">
        <!-- File Picker -->
        <div class="form-control">
          <label class="label"><span class="label-text font-semibold">Source File</span></label>
          <div class="flex gap-2 items-center">
            <button class="btn btn-sm btn-outline" @click=${this.handlePickFile}>
              <i class="fa-solid fa-folder-open mr-1"></i> Browse...
            </button>
            ${this.state.filePath
              ? html`
                  <span class="text-sm truncate flex-1">${this.state.fileName}</span>
                  <span class="badge badge-sm">${this.formatFileSize(this.state.fileSize)}</span>
                `
              : html`<span class="text-sm text-base-content/50">No file selected</span>`}
          </div>
        </div>

        <!-- Plugin Selection -->
        <div class="form-control">
          <label class="label"><span class="label-text font-semibold">Parser</span></label>
          <select
            class="select select-bordered select-sm w-full max-w-xs"
            .value=${this.state.selectedPluginId || ''}
            @change=${this.handlePluginChange}
          >
            <option value="" disabled>Select parser...</option>
            ${this.plugins.map(
              (p) => html`<option value=${p.id} ?selected=${p.id === this.state.selectedPluginId}>${p.name}</option>`
            )}
          </select>
        </div>

        <!-- Encoding -->
        <div class="form-control">
          <label class="label"><span class="label-text font-semibold">Encoding</span></label>
          <select
            class="select select-bordered select-sm w-full max-w-xs"
            .value=${this.state.encoding}
            @change=${this.handleEncodingChange}
          >
            <option value="utf-8">UTF-8</option>
            <option value="latin1">Latin-1 (ISO-8859-1)</option>
            <option value="utf-16le">UTF-16 LE</option>
            <option value="ascii">ASCII</option>
          </select>
        </div>

        <!-- Plugin-specific Config -->
        ${this.selectedPlugin
          ? html`
              <div class="divider text-sm">Parser Options</div>
              <div class="grid grid-cols-2 gap-3">
                ${this.selectedPlugin.configSchema.map((field) => this.renderConfigField(field))}
              </div>
            `
          : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'import-step-source': ImportStepSource;
  }
}
