import { html, css, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

@customElement('field-definition-editor')
export class FieldDefinitionEditor extends LitElement {

    @property({ type: Object })
    field: {
        id?: string;
        name: string;
        type: string;
        isRequired: boolean;
        isUnique: boolean;
        defaultValue?: any;
    } | null = null;

    @state()
    private formData: {
        id?: string;
        name: string;
        type: string;
        isRequired: boolean;
        isUnique: boolean;
        defaultValue?: any;
    } = {
        name: '',
        type: 'STRING',
        isRequired: false,
        isUnique: false,
        defaultValue: '',
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
     * Initialize form data when field property changes
     */
    updated(changedProperties: Map<string, any>) {
        super.updated(changedProperties);
        
        if (changedProperties.has('field') && this.field) {
            // Initialize form data from field
            this.formData = {
                id: this.field.id,
                name: this.field.name || '',
                type: this.field.type || 'STRING',
                isRequired: this.field.isRequired || false,
                isUnique: this.field.isUnique || false,
                defaultValue: this.field.defaultValue || '',
            };
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

        // Dispatch field-changed event with updated field data
        this.dispatchEvent(new CustomEvent('field-changed', {
            detail: { 
                fieldId: this.field?.id || this.formData.id,
                fieldData: { ...this.formData }
            },
            bubbles: true,
            composed: true
        }));
    }

    private handleDeleteField() {
        this.dispatchEvent(new CustomEvent('delete-field', {
            detail: { fieldId: this.field?.id || this.formData.id },
            bubbles: true,
            composed: true
        }));
    }

    protected render() {
        return html`
        <div class="field-definition-editor border rounded mb-0 bg-base-800 w-full" style="height: 40px;">
            <div class="flex items-center gap-0 p-1">
                <div class="flex-2 w-1/3">
                    <input 
                        type="text" 
                        class="input input-bordered w-full h-8" 
                        .value="${this.formData.name}"
                        @input="${(e: Event) => this.handleInputChange('name', (e.target as HTMLInputElement).value)}"
                        placeholder="Field name" 
                    />
                </div>
                <div class="flex-auto" style="flex-grow: 0.46;">
                    <select class="select select-bordered w-full h-8 text-sm"
                     .value="${this.formData.type}"
                     @change="${(e: Event) => this.handleInputChange('type', (e.target as HTMLSelectElement).value)}"
                    >
                        <option disabled selected>Type</option>
                        <option>STRING</option>
                        <option>INT</option>
                        <option>FLOAT</option>
                        <option>DATETIME</option>
                        <option>BOOL</option>
                    </select>
                </div>
                <div class="flex items-center justify-start pl-2 pr-1">
                    <input type="checkbox" class="toggle toggle-sm toggle-info" 
                    .checked="${this.formData.isRequired}"
                    @change="${(e: Event) => this.handleInputChange('isRequired', (e.target as HTMLInputElement).checked)}"
                    />
                    <span class="text-xs ml-1">Required</span>
                </div>
                <div class="flex items-center justify-start pl-1 pr-1">
                    <input type="checkbox" class="toggle toggle-sm toggle-info" 
                    .checked="${this.formData.isUnique}"
                    @change="${(e: Event) => this.handleInputChange('isUnique', (e.target as HTMLInputElement).checked)}"
                    />
                    <span class="text-xs ml-1">Unique</span>
                </div>
                <div class="flex-1">
                    <input 
                        type="text" 
                        class="input input-bordered w-full h-8" 
                        .value="${this.formData.defaultValue}"
                        @input="${(e: Event) => this.handleInputChange('defaultValue', (e.target as HTMLInputElement).value)}"
                        placeholder="Default value" 
                    />
                </div>
                <div class="flex items-center justify-center pl-1">
                    <button class="btn btn-sm btn-circle btn-ghost" @click=${() => this.handleDeleteField()}>
                        <i class="fas fa-trash text-red-500"></i>
                    </button>
                </div>
            </div>
        </div>
        `;

    }
}