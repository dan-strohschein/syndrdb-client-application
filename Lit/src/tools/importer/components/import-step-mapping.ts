/**
 * Step 3 — Mapping: Target bundle, column→field mapping, transforms, null handling.
 */

import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { MappingStepState, PreviewStepState, ColumnMapping, TargetMode, NullHandling, TransformType } from '../types/wizard-state';
import { connectionManager } from '../../../services/connection-manager';
import type { Connection } from '../../../services/connection-manager';
import type { Bundle } from '../../../types/bundle';

@customElement('import-step-mapping')
export class ImportStepMapping extends LitElement {
  createRenderRoot() { return this; }

  @property({ type: Object }) state!: MappingStepState;
  @property({ type: Object }) previewState!: PreviewStepState;

  private get connections(): Map<string, Connection> {
    return connectionManager.getAllConnections();
  }

  private get selectedConnection(): Connection | undefined {
    if (!this.state.connectionId) return undefined;
    return this.connections.get(this.state.connectionId);
  }

  private get databases(): string[] {
    return this.selectedConnection?.databases || [];
  }

  private get bundles(): Bundle[] {
    if (!this.selectedConnection || !this.state.databaseName) return [];
    return this.selectedConnection.databaseBundles?.get(this.state.databaseName) || [];
  }

  private get selectedBundle(): Bundle | undefined {
    if (!this.state.bundleName) return undefined;
    return this.bundles.find((b) => b.Name === this.state.bundleName);
  }

  private get targetFields(): string[] {
    if (this.state.targetMode === 'new') {
      return this.previewState.parseResult?.headers || [];
    }
    const bundle = this.selectedBundle;
    if (!bundle) return [];
    return bundle.FieldDefinitions?.map((f) => f.Name) || [];
  }

  private emitChange(partial: Partial<MappingStepState>) {
    this.dispatchEvent(
      new CustomEvent('mapping-changed', {
        detail: { ...this.state, ...partial },
        bubbles: true,
        composed: true,
      })
    );
  }

  override connectedCallback() {
    super.connectedCallback();
    // Initialize column mappings from preview data if empty
    if (this.state.columnMappings.length === 0 && this.previewState.parseResult) {
      this.initializeMappings();
    }
  }

  private initializeMappings() {
    const pr = this.previewState.parseResult;
    if (!pr) return;

    const mappings: ColumnMapping[] = pr.headers.map((header, i) => ({
      sourceIndex: i,
      sourceHeader: header,
      targetField: null,
      targetType: pr.detectedTypes[i]?.type || 'STRING',
      transform: { type: 'none' as TransformType },
      enabled: true,
    }));

    this.emitChange({ columnMappings: mappings });
  }

  /** Auto-match source columns to target fields by name similarity */
  private autoMatch() {
    const fields = this.targetFields;
    const mappings = this.state.columnMappings.map((m) => {
      const exactMatch = fields.find(
        (f) => f.toLowerCase() === m.sourceHeader.toLowerCase()
      );
      if (exactMatch) {
        const bundle = this.selectedBundle;
        const fieldDef = bundle?.FieldDefinitions?.find((fd) => fd.Name === exactMatch);
        return {
          ...m,
          targetField: exactMatch,
          targetType: fieldDef?.Type || m.targetType,
        };
      }
      return m;
    });
    this.emitChange({ columnMappings: mappings });
  }

  private handleTargetModeChange(mode: TargetMode) {
    const updates: Partial<MappingStepState> = { targetMode: mode };
    if (mode === 'new') {
      updates.bundleName = null;
    }
    this.emitChange(updates);
  }

  private handleConnectionChange(e: Event) {
    const connectionId = (e.target as HTMLSelectElement).value;
    this.emitChange({ connectionId, databaseName: null, bundleName: null });
  }

  private handleDatabaseChange(e: Event) {
    this.emitChange({ databaseName: (e.target as HTMLSelectElement).value, bundleName: null });
  }

  private handleBundleChange(e: Event) {
    const bundleName = (e.target as HTMLSelectElement).value;
    this.emitChange({ bundleName });
    // Auto-match after bundle selection
    setTimeout(() => this.autoMatch(), 50);
  }

  private handleNewBundleNameChange(e: Event) {
    this.emitChange({ newBundleName: (e.target as HTMLInputElement).value });
  }

  private handleNullHandlingChange(e: Event) {
    this.emitChange({ nullHandling: (e.target as HTMLSelectElement).value as NullHandling });
  }

  private handleMappingTargetChange(index: number, targetField: string) {
    const mappings = [...this.state.columnMappings];
    const bundle = this.selectedBundle;
    const fieldDef = bundle?.FieldDefinitions?.find((fd) => fd.Name === targetField);
    mappings[index] = {
      ...mappings[index],
      targetField: targetField || null,
      targetType: fieldDef?.Type || mappings[index].targetType,
    };
    this.emitChange({ columnMappings: mappings });
  }

  private handleMappingEnabledChange(index: number, enabled: boolean) {
    const mappings = [...this.state.columnMappings];
    mappings[index] = { ...mappings[index], enabled };
    this.emitChange({ columnMappings: mappings });
  }

  private handleTransformChange(index: number, transformType: TransformType) {
    const mappings = [...this.state.columnMappings];
    mappings[index] = {
      ...mappings[index],
      transform: { type: transformType, param: mappings[index].transform.param },
    };
    this.emitChange({ columnMappings: mappings });
  }

  private handleTransformParamChange(index: number, param: string) {
    const mappings = [...this.state.columnMappings];
    mappings[index] = {
      ...mappings[index],
      transform: { ...mappings[index].transform, param },
    };
    this.emitChange({ columnMappings: mappings });
  }

  render() {
    const conns = Array.from(this.connections.entries()).filter(
      ([, c]) => c.status === 'connected'
    );

    return html`
      <div class="space-y-4">
        <!-- Target Mode Toggle -->
        <div class="flex gap-2">
          <button
            class="btn btn-sm ${this.state.targetMode === 'existing' ? 'btn-primary' : 'btn-ghost'}"
            @click=${() => this.handleTargetModeChange('existing')}
          >
            Import into existing bundle
          </button>
          <button
            class="btn btn-sm ${this.state.targetMode === 'new' ? 'btn-primary' : 'btn-ghost'}"
            @click=${() => this.handleTargetModeChange('new')}
          >
            Create new bundle
          </button>
        </div>

        <!-- Connection + Database + Bundle Selectors -->
        <div class="grid grid-cols-3 gap-3">
          <div class="form-control">
            <label class="label"><span class="label-text">Connection</span></label>
            <select
              class="select select-bordered select-sm"
              .value=${this.state.connectionId || ''}
              @change=${this.handleConnectionChange}
            >
              <option value="" disabled>Select...</option>
              ${conns.map(
                ([id, c]) => html`<option value=${id} ?selected=${id === this.state.connectionId}>${c.name}</option>`
              )}
            </select>
          </div>

          <div class="form-control">
            <label class="label"><span class="label-text">Database</span></label>
            <select
              class="select select-bordered select-sm"
              .value=${this.state.databaseName || ''}
              @change=${this.handleDatabaseChange}
              ?disabled=${!this.state.connectionId}
            >
              <option value="" disabled>Select...</option>
              ${this.databases.map(
                (db) => html`<option value=${db} ?selected=${db === this.state.databaseName}>${db}</option>`
              )}
            </select>
          </div>

          ${this.state.targetMode === 'existing'
            ? html`
                <div class="form-control">
                  <label class="label"><span class="label-text">Bundle</span></label>
                  <select
                    class="select select-bordered select-sm"
                    .value=${this.state.bundleName || ''}
                    @change=${this.handleBundleChange}
                    ?disabled=${!this.state.databaseName}
                  >
                    <option value="" disabled>Select...</option>
                    ${this.bundles.map(
                      (b) => html`<option value=${b.Name} ?selected=${b.Name === this.state.bundleName}>${b.Name}</option>`
                    )}
                  </select>
                </div>
              `
            : html`
                <div class="form-control">
                  <label class="label"><span class="label-text">New Bundle Name</span></label>
                  <input
                    type="text"
                    class="input input-bordered input-sm"
                    .value=${this.state.newBundleName}
                    placeholder="Enter bundle name"
                    @input=${this.handleNewBundleNameChange}
                  />
                </div>
              `}
        </div>

        <!-- Null Handling -->
        <div class="form-control max-w-xs">
          <label class="label"><span class="label-text">Empty cells</span></label>
          <select
            class="select select-bordered select-sm"
            .value=${this.state.nullHandling}
            @change=${this.handleNullHandlingChange}
          >
            <option value="null">Treat as NULL</option>
            <option value="empty-string">Treat as empty string</option>
            <option value="default-value">Use field default value</option>
          </select>
        </div>

        <!-- Auto-match button -->
        ${this.targetFields.length > 0
          ? html`
              <button class="btn btn-sm btn-outline" @click=${this.autoMatch}>
                <i class="fa-solid fa-wand-magic-sparkles mr-1"></i>
                Auto-match columns
              </button>
            `
          : ''}

        <!-- Column Mapping Table -->
        <div class="overflow-x-auto border rounded">
          <table class="table table-xs">
            <thead>
              <tr>
                <th class="w-10">Map</th>
                <th>Source Column</th>
                <th>Target Field</th>
                <th>Type</th>
                <th>Transform</th>
                <th>Param</th>
              </tr>
            </thead>
            <tbody>
              ${this.state.columnMappings.map(
                (mapping, i) => html`
                  <tr class="${!mapping.enabled ? 'opacity-40' : ''}">
                    <td>
                      <input
                        type="checkbox"
                        class="checkbox checkbox-xs"
                        ?checked=${mapping.enabled}
                        @change=${(e: Event) =>
                          this.handleMappingEnabledChange(i, (e.target as HTMLInputElement).checked)}
                      />
                    </td>
                    <td class="font-mono text-sm">${mapping.sourceHeader}</td>
                    <td>
                      ${this.state.targetMode === 'new'
                        ? html`<span class="text-sm">${mapping.sourceHeader}</span>`
                        : html`
                            <select
                              class="select select-bordered select-xs w-full"
                              .value=${mapping.targetField || ''}
                              @change=${(e: Event) =>
                                this.handleMappingTargetChange(i, (e.target as HTMLSelectElement).value)}
                              ?disabled=${!mapping.enabled}
                            >
                              <option value="">-- skip --</option>
                              ${this.targetFields.map(
                                (f) => html`<option value=${f} ?selected=${f === mapping.targetField}>${f}</option>`
                              )}
                            </select>
                          `}
                    </td>
                    <td>
                      <span class="badge badge-xs">${mapping.targetType}</span>
                    </td>
                    <td>
                      <select
                        class="select select-bordered select-xs"
                        .value=${mapping.transform.type}
                        @change=${(e: Event) =>
                          this.handleTransformChange(i, (e.target as HTMLSelectElement).value as TransformType)}
                        ?disabled=${!mapping.enabled}
                      >
                        <option value="none">None</option>
                        <option value="trim">Trim</option>
                        <option value="uppercase">Uppercase</option>
                        <option value="lowercase">Lowercase</option>
                        <option value="date-format">Date Format</option>
                        <option value="default-value">Default Value</option>
                      </select>
                    </td>
                    <td>
                      ${mapping.transform.type === 'date-format' || mapping.transform.type === 'default-value'
                        ? html`
                            <input
                              type="text"
                              class="input input-bordered input-xs w-28"
                              .value=${mapping.transform.param || ''}
                              placeholder=${mapping.transform.type === 'date-format' ? 'YYYY-MM-DD' : 'Default'}
                              @input=${(e: Event) =>
                                this.handleTransformParamChange(i, (e.target as HTMLInputElement).value)}
                              ?disabled=${!mapping.enabled}
                            />
                          `
                        : ''}
                    </td>
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
    'import-step-mapping': ImportStepMapping;
  }
}
