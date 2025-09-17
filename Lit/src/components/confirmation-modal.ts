import { html, css, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';


@customElement('confirmation-modal')
export class ConfirmationModal extends LitElement {

@property({ type: Boolean })
  open = false;

@property({ type: Object })
  options: {
    affirm: string;
    deny: string;
    title: string;
    
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
  
        this.dispatchEvent(new CustomEvent('close-modal', {
        bubbles: true
        }));
    }

    private handleAffirm() {
        this.dispatchEvent(new CustomEvent('affirm', {
        bubbles: true
        }));
        this.handleClose();
    }

    private handleDeny() {
        this.dispatchEvent(new CustomEvent('deny', {
        bubbles: true
        }));
        this.handleClose();
    }


    render() {
        if (!this.isOpen) {
            return html``;
        }

        return html`
        <div class="modal ${this.open ? 'modal-open' : ''}">
            <div class="modal-box w-11/12 max-w-2xl">
                <!-- Modal Header -->
                <div class="flex items-center justify-between mb-6">
                    <h3 class="font-bold text-lg">${this.options?.title}</h3>
                    <button class="btn btn-sm btn-circle btn-ghost" @click=${this.handleClose}>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    </button>
                </div>

                <!-- Modal Content -->
                <div class="space-y-4">
                    <slot></slot>
                </div>
                
                <div class="modal-action">
                    <button class="btn btn-ghost" @click=${this.handleDeny}>${this.options?.deny || 'Cancel'}</button>
                    <button class="btn btn-primary" @click=${this.handleAffirm}>${this.options?.affirm || 'Confirm'}</button>
                </div>
            </div>
            <div class="modal-backdrop ${this.open ? 'modal-backdrop-open' : ''}" @click=${this.handleClose}></div>

            
        </div>
        `;
    }

}