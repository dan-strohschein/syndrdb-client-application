import { html, css, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';


@customElement('database-modal')
export class DatabaseModal extends LitElement {

@property({ type: Boolean })
  open = false;

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


  @state() isOpen = false;

   // Disable Shadow DOM to allow global Tailwind CSS
    createRenderRoot() {
        return this;
    }

    private handleClose() {
        this.open = false;
        
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
    }

    private async handleSave() {}

    render() {
        if (!this.isOpen) {
            return html``;
        }

        return html`
        <div class="modal ${this.open ? 'modal-open' : ''}">
            <div class="modal-box w-11/12 max-w-2xl">
                <!-- Modal Header -->
                <div class="flex items-center justify-between mb-6">
                    <h3 class="font-bold text-lg">${this.database ? 'Edit Database' : 'Add New Database'}</h3>
                    <button class="btn btn-sm btn-circle btn-ghost" @click=${this.handleClose}>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    </button>
                </div>
                 <!-- Modal Content -->
                <form>
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium mb-1" for="name">Database Name</label>
                            <input 
                            id="name"
                            type="text" 
                            required
                            class="input input-bordered w-full validator" 
                            .value=${this.formData.name}
                            @input=${(e: Event) => this.handleInputChange('name', (e.target as HTMLInputElement).value)}
                            />
                            <p class="validator-hint">Required</p>
                        </div>
                    </div>
                    <!-- Modal Actions -->
                    <div class="modal-action">
                        <button class="btn btn-ghost" @click=${this.handleClose}>Cancel</button>
                        <button class="btn btn-primary" @click=${this.handleSave}>Save</button>
                    </div>
                </form>
            </div>
            <div class="modal-backdrop ${this.open ? 'modal-backdrop-open' : ''}" @click=${this.handleClose}></div>

           
            </div>
        </div>
        `;
    }

}