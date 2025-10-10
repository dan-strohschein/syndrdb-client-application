import { html, css, LitElement, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { connectionManager } from '../../services/connection-manager';
import { FieldDefinition } from '../../types/field-definition';
import './field-definition-editor.js';
import { Bundle } from '../../types/bundle';

@customElement('fields-tab')
export class FieldsTab extends LitElement {

    @property({ type: Boolean })
    open = false;

    @property({ type: String })
    connectionId: string | null = null;

    @property({ type: String })
    databaseId: string | null = null;

    @property({ type: Object })
    bundle: Bundle | null = null;

    @state()
    private formData: {
        name: string;
        fieldDefinitions: FieldDefinition[];
    } = {
        name: '',
        fieldDefinitions: [],
    };

    @state()
    private errorMessage = '';

    @state()
    private isLoading = false;

    @state()
    private fields: Array<FieldDefinition> = [];

    // Disable Shadow DOM to allow global Tailwind CSS
    createRenderRoot() {
        return this;
    }

    /**
     * Initialize form data when bundle property changes
     */
    // updated(changedProperties: Map<string, any>) {
    //     super.updated(changedProperties);
        
    //     if (changedProperties.has('bundle') && this.bundle) {
    //         // Initialize form data from bundle
    //         this.formData = {
    //             name: this.bundle.Name || '',
    //             fieldDefinitions: this.bundle.DocumentStructure?.FieldDefinitions || [],
    //         };
            
    //         // Initialize fields array from bundle field definitions
    //         this.fields = [...(this.bundle.DocumentStructure?.FieldDefinitions || [])];
            
    //         console.log('Initialized fields-tab with bundle data:', this.bundle);
    //     }
    // }

    /**
     * handle when the bundle is passed in from the parent for editing
     * Use willUpdate instead of firstUpdated to avoid scheduling additional updates
     */
    protected willUpdate(changedProperties: PropertyValues): void {
        // Only process bundle data if the bundle property has changed
        if (changedProperties.has('bundle') && this.bundle) {
            console.log('Fields tab willUpdate, bundle changed:', this.bundle);
            
            this.formData.name = this.bundle.Name || '';
            
            // Use the correct path: bundle.FieldDefinitions (not DocumentStructure.FieldDefinitions)
            const fieldDefinitions = this.bundle.FieldDefinitions || [];
            if (Array.isArray(fieldDefinitions)) {
                this.fields = fieldDefinitions.map(field => ({
                    ...field,
                    id: crypto.randomUUID()
                }));
            } else {
                // Handle case where FieldDefinitions is an object instead of array
                let fieldNames = Object.keys(fieldDefinitions);
                this.fields = [];
                for (let name of fieldNames) {
                    if (name !== 'DocumentID') {
                        this.fields.push({
                            ...(fieldDefinitions as any)[name],
                            name: name,
                            id: crypto.randomUUID()
                        });
                    }
                }
            }
        }
    }


    /**
     * Validate bundle name according to the rules:
     * AlphaNumeric only, with - and _ allowed. Case doesn't matter. No spaces or symbols.
     */
    private validateBundleName(name: string): { isValid: boolean; message: string } {
        if (!name.trim()) {
            return { isValid: false, message: 'Bundle name is required.' };
        }

        // Check for valid characters only: alphanumeric, hyphens, and underscores
        const validNameRegex = /^[a-zA-Z0-9_-]+$/;
        if (!validNameRegex.test(name)) {
            return { 
                isValid: false, 
                message: 'Bundle name can only contain letters, numbers, hyphens (-), and underscores (_). No spaces or other symbols allowed.' 
            };
        }

        return { isValid: true, message: '' };
    }

     private handleInputChange(field: string, value: string | boolean | number | Date) {
        this.formData = {
            ...this.formData,
            [field]: value
        };


        this.bundle = {Name: this.formData.name, FieldDefinitions: this.formData.fieldDefinitions};

        // Clear error when user starts typing
        if (this.errorMessage) {
            this.errorMessage = '';
        }

        this.dispatchEvent(new CustomEvent('change-bundle', {
            detail: { ...this.formData },
            bubbles: true,
            composed: true
        }));
    }


    private handleAddField() {
        let newField: FieldDefinition = {
            id: crypto.randomUUID(), // Add unique ID for tracking
            Name: '',
            Type: '',
            IsRequired: false,
            IsUnique: false,
            DefaultValue: null
        };

        this.fields = [...this.fields, newField];
        this.requestUpdate();
    }

    private handleFieldChanged(event: CustomEvent) {
        const { fieldId, fieldData } = event.detail;
        console.log('Field changed:', fieldId, fieldData);
        
        // Find and update the field in the fields array by ID
        const fieldIndex = this.fields.findIndex(field => field.id === fieldId);
        if (fieldIndex !== -1) {
            this.fields[fieldIndex] = { ...fieldData, id: fieldId }; // Preserve the ID
            this.formData.fieldDefinitions = this.fields;
            this.requestUpdate();
        }
        this.dispatchEvent(new CustomEvent('bundle-changed', {
            detail: { ...this.formData },
            bubbles: true,
            composed: true
        }));
        event.stopPropagation();
    }

    private handleDeleteField(event: CustomEvent) {
        const { fieldId } = event.detail;
        console.log('Deleting field:', fieldId);
        
        // Remove the field with the matching ID
        this.fields = this.fields.filter(field => field.id !== fieldId);
        this.requestUpdate();
        
        // Stop the event from bubbling further
        event.stopPropagation();
    }

    /**
     * Get the current bundle data from the form
     */
    getCurrentBundleData(): { name: string; fieldDefinitions: FieldDefinition[] } {
        return {
            name: this.formData.name,
            fieldDefinitions: [...this.fields]
        };
    }

    render() {
        return html`
            <div class="w-full">
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                        Bundle Name <span class="text-red-500">*</span>
                    </label>
                    <input 
                        type="text" 
                        class="w-full px-3 py-2 border ${this.errorMessage ? 'border-red-300' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter bundle name"
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
                <div class="divider">Fields</div>
                <div class="w-full">
                    <div class="w-full bg-neutral text-neutral-content rounded-lg overflow-y-auto" style="max-height: 300px;">
                        <div class="p-4 w-full space-y-2" @delete-field=${this.handleDeleteField} @field-changed=${this.handleFieldChanged}>
                            ${repeat(this.fields, (field) => field.id, (field) => html`
                                <field-definition-editor .field="${field}" class="w-full"></field-definition-editor>
                            `)}
                            <button type="button" class="btn btn-outline btn-success btn-xs mt-2" @click=${this.handleAddField}>
                                <i class="fas fa-plus mr-2"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}