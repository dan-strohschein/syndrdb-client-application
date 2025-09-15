import { html, css, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

@customElement('about-modal')
export class AboutModal extends LitElement {
  @property({ type: String }) appName = 'SyndrDB Client';
  @property({ type: String }) appVersion = '1.0.0';
  @property({ type: String }) appDescription = 'A client application for SyndrDB by Dan Strohschein';
  @state() isOpen = false;

  // Disable Shadow DOM to allow global Tailwind CSS
  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('keydown', this.handleEscapeKey.bind(this));
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this.handleEscapeKey.bind(this));
  }

  private handleEscapeKey(event: KeyboardEvent) {
    if (event.key === 'Escape' && this.isOpen) {
      this.close();
    }
  }

  private handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }

  render() {
    console.log('About modal render called, isOpen:', this.isOpen);
    return html`
      <div 
        class="fixed inset-0 z-[9999] flex items-center justify-center ${this.isOpen ? 'block' : 'hidden'}"
        style="background-color: rgba(0, 0, 0, 0.5); pointer-events: ${this.isOpen ? 'auto' : 'none'};"
        @click=${this.handleBackdropClick}
      >
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6 relative" @click=${(e: Event) => e.stopPropagation()}>
          <!-- Close button -->
          <button 
            class="absolute right-2 top-2 w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-600 hover:text-gray-800" 
            @click=${this.close}
          >✕</button>
          
          <!-- Modal content -->
          <div class="text-center mt-8">
            <!-- Logo or icon area -->
            <div class="mb-4 flex justify-center">
              <img src="/apple-touch-icon.png" alt="SyndrDB" class="w-16 h-16" />
            </div>
            
            <h2 class="text-2xl font-bold mb-2 text-gray-900 dark:text-white">${this.appName}</h2>
            <p class="text-gray-600 dark:text-gray-300 mb-4">${this.appDescription}</p>
            
            <hr class="my-4" />
            
            <div class="text-sm text-gray-500 dark:text-gray-400">
              <p><strong>Version:</strong> ${this.appVersion}</p>
              <p><strong>Built with:</strong> Electron + Lit + Tailwind CSS</p>
              <p class="mt-2">© 2025 Dan Strohschein</p>
            </div>
            
            <div class="mt-6">
              <button class="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded" @click=${this.close}>Close</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  open() {
    console.log('About modal open() called');
    this.isOpen = true;
    this.requestUpdate();
    console.log('About modal isOpen set to:', this.isOpen);
  }

  close() {
    console.log('About modal close() called');
    this.isOpen = false;
    this.requestUpdate();
  }
}