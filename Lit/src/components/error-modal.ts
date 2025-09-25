import { html, css, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

@customElement('error-modal')
export class ErrorModal extends LitElement {

@property({ type: Boolean })
  open = false;

@property({ type: String })
  errorMessage = '';

  // Disable Shadow DOM to allow global Tailwind CSS
    createRenderRoot() {
        return this;
    }

    private handleClose() {
        this.open = false;
        this.errorMessage = '';
       
        
        this.dispatchEvent(new CustomEvent('close-modal', {
            bubbles: true
        }));
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
                    <h3 class="font-bold text-lg">ERROR!</h3>
                    <button 
                        class="btn btn-sm btn-circle btn-ghost" 
                        @click=${this.handleClose}
                        
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                
                <!-- Modal Content -->
               
                    <div class="space-y-4">
                        <div>
                            
                           
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
                        >
                            CLOSE
                        </button>
                        
                    </div>
               
            </div>
            <div class="modal-backdrop" @click=${this.handleClose}></div>
        </div>
        `;
    }

}