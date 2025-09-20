import { html, css, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { connectionManager } from '../../services/connection-manager';
import { FieldsTab } from './fields-tab';
import { Bundle } from '../../types/bundle';

@customElement('bundle-modal')
export class BundleModal extends LitElement {

@property({ type: Boolean })
  open = false;

@property({ type: String })
  connectionId: string | null = null;

@property({ type: String })
  bundleId: string | null = null;
  
@property({ type: String })
  databaseId: string | null = null;

@property({ type: Object })
  bundle: Bundle | null = null;

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

    private validateBundleName(name: string): { isValid: boolean; message: string } {
        if (!name || !name.trim()) {
            return { isValid: false, message: 'Bundle name cannot be empty.' };
        }

        // Check for valid characters only: alphanumeric, hyphens, and underscores
        // No spaces or other symbols allowed
        const validNameRegex = /^[a-zA-Z0-9_-]+$/;
        if (!validNameRegex.test(name)) {
            return { 
                isValid: false, 
                message: 'Bundle name can only contain letters, numbers, hyphens (-), and underscores (_). No spaces or other symbols allowed.' 
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

    private handleBundleChanged(event: CustomEvent) {
        const { name, fieldDefinitions } = event.detail;
        this.formData = {
            ...this.formData,
            name
        };
        this.bundle = { Name: name, FieldDefinitions: fieldDefinitions };
    }

    private async handleSave() {
        try {
            this.isLoading = true;
            this.errorMessage = '';

            // Validate form data
            const validation = this.validateBundleName(this.formData.name);
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

            let createCommand = '';
            // In bundle-modal.ts, you can get a reference to the fields-tab:
            const fieldsTab = this.querySelector('fields-tab') as FieldsTab;
            if (fieldsTab) {
                const bundleData = fieldsTab.getCurrentBundleData();

                // Validate bundle name
                const validation = this.validateBundleName(bundleData.name);
                if (!validation.isValid) {
                    this.errorMessage = validation.message;
                    this.isLoading = false;
                    return;
                }
            
                console.log('Current bundle data:', bundleData);
                createCommand = `CREATE BUNDLE "${bundleData.name}" WITH FIELDS `; //WITH FIELDS (${JSON.stringify(bundleData.fieldDefinitions)})`;
            
                // Send CREATE BUNDLE command to server
                
                console.log('🗄️ Sending CREATE BUNDLE command:', createCommand);


                // Ok, we need to transform the statement to match the expected format
                // Remove the [ ] since its not an array
                // then remove the id and the string value from each field definition
                
                    
                // Parse the JSON array of field definitions
                // let fieldDefinitions: Array<any> = [];
                // try {
                //     fieldDefinitions = JSON.parse(fieldsPart);
                // } catch (e) {
                //     console.error('Error parsing field definitions:', e);
                //     this.errorMessage = 'Failed to parse field definitions.';
                //     this.isLoading = false;
                //     return;
                // }
                let fieldStrings = Array<string>();
                createCommand += '(';
                // Transform each field definition to remove id and string value
                bundleData.fieldDefinitions.forEach((field) => 
                {
                    
                    let fieldString = `{"${field.name}", ${field.type.toUpperCase()}, `;
                    if (field.isRequired) {
                        fieldString += ' TRUE';
                    } else {
                        fieldString += ' FALSE';
                    }
                    fieldString += ', ';
                    if (field.isUnique) {
                        fieldString += ' TRUE';
                    } else {
                        fieldString += ' FALSE';
                    }
                    fieldString += ', ';
                    if (field.defaultValue !== undefined && field.defaultValue !== null && field.defaultValue !== '') {                       
                        fieldString += `  ${field.defaultValue}`;
                    }
                    fieldString += '} ';
                    fieldStrings.push(fieldString);
                });
                //     return ({

                //     name: field.name,
                //     type: field.type,
                //     isRequired: field.isRequired,
                //     isUnique: field.isUnique,
                //     defaultValue: field.defaultValue
                // });

            
                fieldStrings.forEach((fs, index) => {
                    createCommand += fs;
                    if (index < fieldStrings.length - 1) {
                        createCommand += ', ';
                    }
                });
                createCommand += ');';
                //console.log('Transformed field definitions:', transformedFields);
                console.log('Final CREATE BUNDLE command:', createCommand);
                const result = await connectionManager.executeQueryWithContext(this.connectionId, createCommand);
                
                if (result.success) {
                    console.log('✅ Bundle created successfully:', this.formData.name);
                    
                    // Refresh connection metadata to update the databases list
                    await connectionManager.refreshMetadata(this.connectionId);
                    
                    // Dispatch success event
                    this.dispatchEvent(new CustomEvent('bundle-created', {
                        detail: { 
                            bundleName: this.formData.name,
                            connectionId: this.connectionId 
                        },
                        bubbles: true
                    }));
                    
                    // Close modal
                    this.handleClose();
                } else {
                    console.error('❌ Failed to create bundle:', result);
                    this.errorMessage = result.error || 'Failed to create bundle. Please try again.';
                }    //finally {
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
                                TBD
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
                            ?disabled="${this.isLoading || this.formData.name.length === 0 || this.bundle?.FieldDefinitions.length === 0}"
                        >
                            ${this.isLoading ? 'Creating...' : 'Create Bundle'}
                        </button>
                    </div>
                </form>
            </div>
            <div class="modal-backdrop" @click=${this.handleClose}></div>
        </div>
        `;
    }

}