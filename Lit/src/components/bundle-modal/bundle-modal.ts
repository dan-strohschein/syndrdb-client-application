import { html, css, LitElement, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { connectionManager } from '../../services/connection-manager';
import { Bundle } from '../../types/bundle';
import type { FieldDefinition } from '../../types/field-definition';
import { validateIdentifier } from '../../lib/validation';
import { fieldDefinitionsToArray } from '../../lib/bundle-utils';
import { buildCreateBundleCommand, buildUpdateBundleCommands } from '../../domain/bundle-commands';
import { BaseModalMixin } from '../../lib/base-modal-mixin';

@customElement('bundle-modal')
export class BundleModal extends BaseModalMixin(LitElement) {
  @property({ type: String })
  connectionId: string | null = null;

  @property({ type: String })
  bundleId: string | null = null;

  @property({ type: String })
  databaseId: string | null = null;

  @property({ type: Object })
  bundle: Bundle | null = null;

  @property({ type: String })
  databaseName: string | null = null;

  @state()
  private errorMessage = '';

  @state()
  private isLoading = false;

  @state()
  private bundleFormState: { name: string; fieldDefinitions: FieldDefinition[] } = {
    name: '',
    fieldDefinitions: [],
  };

  @state()
  private relationshipStatements: string[] = [];

  @state()
  private connection: unknown = null;

  @state()
  private bundles: Array<Bundle> = [];

  protected willUpdate(changedProperties: PropertyValues): void {
    super.willUpdate(changedProperties);
    if (changedProperties.has('bundle')) {
      if (this.bundle) {
        this.bundleFormState = {
          name: this.bundle.Name ?? '',
          fieldDefinitions: fieldDefinitionsToArray(this.bundle.FieldDefinitions),
        };
      } else {
        this.bundleFormState = { name: '', fieldDefinitions: [] };
      }
    }
  }

  override handleClose(): void {
    this.errorMessage = '';
    this.isLoading = false;
    super.handleClose();
  }



    private handleBundleChanged(event: CustomEvent) {
        const { name, fieldDefinitions } = event.detail;
        this.bundleFormState = { name: name ?? '', fieldDefinitions: fieldDefinitions ?? [] };
        this.bundle = { Name: name, FieldDefinitions: fieldDefinitions };
    }

    private handleRelationshipStatementsChanged(event: CustomEvent<string[]>) {
        this.relationshipStatements = event.detail ?? [];
    }

    private async handleSave() {
        try {
            this.isLoading = true;
            this.errorMessage = '';

            if (!this.connectionId) {
                this.errorMessage = 'No active connection found.';
                this.isLoading = false;
                return;
            }

            const { name, fieldDefinitions } = this.bundleFormState;

            const validation = validateIdentifier(name, { entityName: 'Bundle name' });
            if (!validation.isValid) {
                this.errorMessage = validation.message;
                this.isLoading = false;
                return;
            }

            const createCommand = this.bundle
                ? buildUpdateBundleCommands(this.bundle, this.bundleFormState, this.relationshipStatements)
                : buildCreateBundleCommand(name, fieldDefinitions);

            console.log('Final command to execute:', createCommand);

            const result = await connectionManager.executeQueryWithContext(this.connectionId, createCommand);

            if (result.success) {
                console.log('✅ Bundle created successfully:', name);
                await connectionManager.refreshMetadata(this.connectionId);
                this.dispatchEvent(new CustomEvent('bundle-created', {
                    detail: { bundleName: name, connectionId: this.connectionId },
                    bubbles: true
                }));
                this.handleClose();
            } else {
                console.error('❌ Failed to create bundle:', result);
                this.errorMessage = result.error || 'Failed to create bundle. Please try again.';
            }
        } catch (error) {
            console.error('❌ Error creating bundle:', error);
            this.errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
        } finally {
            this.isLoading = false;
        }
    }

    render() {
        if (!this.open) {
            return html``;
        }

        return html`
        <div class="modal ${this.open ? 'modal-open' : ''}">
            <div class="modal-box w-4/5 max-w-6xl">
                <!-- Modal Header -->
                <div class="flex items-center justify-between mb-6">
                    <h3 class="font-bold text-lg">${this.bundle ? 'Edit Bundle' : 'Add New Bundle'}</h3>
                    <button 
                        class="btn btn-sm btn-circle btn-ghost" 
                        @click=${this.handleClose}
                        ?disabled="${this.isLoading}"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                
                <!-- Modal Content -->
                <form @submit=${(e: Event) => { e.preventDefault(); this.handleSave(); }}>
                    <div class="space-y-4">
                        <div class="tabs tabs-lift">
                            <label class="tab">
                                <input type="radio" name="my_tabs_4" checked="checked"/>
                                <i class="fa-solid fa-file-zipper"></i>
                                General
                            </label>
                            <div class="tab-content bg-base-100 border-base-300 p-6">
                                <fields-tab 
                                    .bundle="${this.bundle}"
                                    .connectionId="${this.connectionId}"
                                    .databaseId="${this.databaseId}"
                                    @bundle-changed=${this.handleBundleChanged}
                                ></fields-tab>
                            </div>

                            <label class="tab">
                                <input type="radio" name="my_tabs_4" />
                                <i class="fa-solid fa-link"></i>
                                Relationships
                            </label>
                            <div class="tab-content bg-base-100 border-base-300 p-6">
                                <relationships-tab
                                    .bundle="${this.bundle}"
                                    .connectionId="${this.connectionId}"
                                    .databaseId="${this.databaseId}"
                                    @relationship-statements-changed=${this.handleRelationshipStatementsChanged}
                                ></relationships-tab>
                            </div>

                            <label class="tab">
                                <input type="radio" name="my_tabs_4" />
                                <i class="fa-solid fa-list"></i>
                                Indexes
                            </label>
                            <div class="tab-content bg-base-100 border-base-300 p-6">
                                TBD
                            </div>
                        </div>
                    </div>
                    
                    <!-- Modal Actions -->
                    <div class="modal-action mt-6">
                        <button 
                            type="button"
                            class="btn btn-ghost" 
                            @click=${this.handleClose}
                            ?disabled="${this.isLoading}"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            class="btn btn-primary ${this.isLoading ? 'loading' : ''}" 
                            ?disabled="${this.isLoading || !this.bundleFormState.name || this.bundleFormState.fieldDefinitions.length === 0}"
                        >
                            ${this.isLoading ? 'Saving...' : (this.bundle ? 'Update Bundle' : 'Add New Bundle')}
                        </button>
                    </div>
                </form>
            </div>
            <div class="modal-backdrop" @click=${this.handleClose}></div>
        </div>
        `;
    }

}