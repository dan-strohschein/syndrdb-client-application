import { html, css, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { connectionManager } from '../services/connection-manager';

@customElement('database-modal')
export class DatabaseModal extends LitElement {

@property({ type: Boolean })
  open = false;

@property({ type: String })
  connectionId: string | null = null;

@property({ type: Object })
  database: {
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

  // Disable Shadow DOM to allow global Tailwind CSS
    createRenderRoot() {
        return this;
    }

    /**
     * Validate database name according to the rules:
     * AlphaNumeric only, with - and _ allowed. Case doesn't matter. No spaces or symbols.
     */
    private validateDatabaseName(name: string): { isValid: boolean; message: string } {
        if (!name.trim()) {
            return { isValid: false, message: 'Database name is required.' };
        }

        // Check for valid characters only: alphanumeric, hyphens, and underscores
        const validNameRegex = /^[a-zA-Z0-9_-]+$/;
        if (!validNameRegex.test(name)) {
            return { 
                isValid: false, 
                message: 'Database name can only contain letters, numbers, hyphens (-), and underscores (_). No spaces or other symbols allowed.' 
            };
        }

        return { isValid: true, message: '' };
    }

    private handleClose() {
        this.open = false;
        this.errorMessage = '';
        this.isLoading = false;
        
        this.formData = {
            name: '',
        };
        
        this.dispatchEvent(new CustomEvent('close-modal', {
            bubbles: true
        }));
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
            const validation = this.validateDatabaseName(this.formData.name);
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
        } catch (error) {
            console.error('❌ Error creating database:', error);
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
            <div class="modal-box w-11/12 max-w-2xl">
                <!-- Modal Header -->
                <div class="flex items-center justify-between mb-6">
                    <h3 class="font-bold text-lg">${this.database ? 'Edit Database' : 'Add New Database'}</h3>
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
                            ${this.isLoading ? 'Creating...' : 'Create Database'}
                        </button>
                    </div>
                </form>
            </div>
            <div class="modal-backdrop" @click=${this.handleClose}></div>
        </div>
        `;
    }

}