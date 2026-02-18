import { html, css, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { connectionManager } from '../services/connection-manager';
import { validateIdentifier } from '../lib/validation';
import { BaseModalMixin } from '../lib/base-modal-mixin';

@customElement('database-modal')
export class DatabaseModal extends BaseModalMixin(LitElement) {
  @property({ type: String })
  connectionId: string | null = null;

  @property({ type: Object })
  database: {
    name: string;
  } | null = null;

  @property({ type: Boolean })
  editMode = false;

  @property({ type: Object })
  databaseToEdit: {
    name: string;
  } | null = null;

  @state()
  private formData: {
    name: string;
  } = {
    name: '',
  };

  @state()
  private errorMessage = '';

  @state()
  private isLoading = false;

  override handleClose(): void {
    this.errorMessage = '';
    this.isLoading = false;
    this.formData = { name: '' };
    this.editMode = false;
    this.databaseToEdit = null;
    super.handleClose();
  }
    
    private prepopulateForm() {
        if (this.editMode && this.databaseToEdit) {
            this.formData = {
                name: this.databaseToEdit.name
            };
            console.log('📝 Prepopulated database form with data:', this.formData);
        }
    }

    private handleInputChange(field: string, value: string | boolean | number | Date) {
        this.formData = {
            ...this.formData,
            [field]: value
        };
        // Clear error when user starts typing
        if (this.errorMessage) {
            this.errorMessage = '';
        }
    }

    private async handleSave() {
        try {
            this.isLoading = true;
            this.errorMessage = '';

            // Validate database name
            const validation = validateIdentifier(this.formData.name, { entityName: 'Database name' });
            if (!validation.isValid) {
                this.errorMessage = validation.message;
                this.isLoading = false;
                return;
            }

            // Check if we have a valid connection
            if (!this.connectionId) {
                this.errorMessage = 'No active connection found.';
                this.isLoading = false;
                return;
            }

            if (this.editMode) {
                // For edit mode, we would typically send an ALTER DATABASE command
                // However, SyndrDB might not support renaming databases
                // For now, we'll just update the local state and dispatch an event
                console.log('✏️ Editing database name from', this.databaseToEdit?.name, 'to', this.formData.name);
                
                // Dispatch database-updated event
                this.dispatchEvent(new CustomEvent('database-updated', {
                    detail: { 
                        oldDatabaseName: this.databaseToEdit?.name,
                        newDatabaseName: this.formData.name,
                        connectionId: this.connectionId 
                    },
                    bubbles: true
                }));
                
                // Close modal
                this.handleClose();
            } else {
                // Send CREATE DATABASE command to server
                const createCommand = `CREATE DATABASE "${this.formData.name}";`;
                console.log('🗄️ Sending CREATE DATABASE command:', createCommand);

                const result = await connectionManager.executeQueryWithContext(this.connectionId, createCommand);
                
                if (result.success) {
                    console.log('✅ Database created successfully:', this.formData.name);
                    
                    // Refresh connection metadata to update the databases list
                    await connectionManager.refreshMetadata(this.connectionId);
                    
                    // Dispatch success event
                    this.dispatchEvent(new CustomEvent('database-created', {
                        detail: { 
                            databaseName: this.formData.name,
                            connectionId: this.connectionId 
                        },
                        bubbles: true
                    }));
                    
                    // Close modal
                    this.handleClose();
                } else {
                    console.error('❌ Failed to create database:', result);
                    this.errorMessage = result.error || 'Failed to create database. Please try again.';
                }
            }
        } catch (error) {
            console.error('❌ Error creating database:', error);
            this.errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
        } finally {
            this.isLoading = false;
        }
    }

    updated(changedProperties: Map<string, any>) {
        super.updated(changedProperties);
        
        // If edit mode or databaseToEdit changed and we're in edit mode, prepopulate the form
        if ((changedProperties.has('editMode') || changedProperties.has('databaseToEdit')) && this.editMode) {
            this.prepopulateForm();
        }
    }

    render() {
        if (!this.open) {
            return html``;
        }

        return html`
        <div class="modal ${this.open ? 'modal-open' : ''}">
            <div class="modal-box w-11/12 max-w-2xl">
                <!-- Modal Header -->
                <div class="flex items-center justify-between mb-6">
                    <h3 class="font-bold text-lg">${this.editMode ? 'Edit Database' : 'Add New Database'}</h3>
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
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">
                                Database Name <span class="text-red-500">*</span>
                            </label>
                            <input 
                                type="text" 
                                class="w-full px-3 py-2 border ${this.errorMessage ? 'border-red-300' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Enter database name"
                                .value="${this.formData.name}"
                                @input="${(e: Event) => this.handleInputChange('name', (e.target as HTMLInputElement).value)}"
                                ?disabled="${this.isLoading}"
                                autocomplete="off"
                                required
                            />
                            <p class="text-xs text-gray-500 mt-1">
                                Only letters, numbers, hyphens (-), and underscores (_) are allowed
                            </p>
                            ${this.errorMessage ? html`
                                <p class="text-sm text-red-600 mt-1">${this.errorMessage}</p>
                            ` : ''}
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
                            ?disabled="${this.isLoading || !this.formData.name.trim()}"
                        >
                            ${this.isLoading ? (this.editMode ? 'Updating...' : 'Creating...') : (this.editMode ? 'Update Database' : 'Create Database')}
                        </button>
                    </div>
                </form>
            </div>
            <div class="modal-backdrop" @click=${this.handleClose}></div>
        </div>
        `;
    }

}