import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { BaseModalMixin } from '../lib/base-modal-mixin';

@customElement('about-modal')
export class AboutModal extends BaseModalMixin(LitElement) {
  @property({ type: String }) appName = 'SyndrDB Client';
  @property({ type: String }) appVersion = '1.0.0';
  @property({ type: String }) appDescription =
    'A client application for SyndrDB by Dan Strohschein';

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('keydown', this.handleEscapeKey);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this.handleEscapeKey);
  }

  private handleEscapeKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && this.open) {
      this.handleClose();
    }
  };

  private handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.handleClose();
    }
  }

  render() {
    return html`
      <div
        class="fixed inset-0 z-[9999] flex items-center justify-center ${this.open ? 'block' : 'hidden'}"
        style="background-color: rgba(0, 0, 0, 0.5); pointer-events: ${this.open ? 'auto' : 'none'};"
        @click=${this.handleBackdropClick}
      >
        <div
          class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6 relative"
          @click=${(e: Event) => e.stopPropagation()}
        >
          <!-- Close button -->
          <button
            class="absolute right-2 top-2 w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-600 hover:text-gray-800"
            @click=${this.handleClose}
          >
            ✕
          </button>

          <!-- Modal content -->
          <div class="text-center mt-8">
            <div class="mb-4 flex justify-center">
              <img src="/apple-touch-icon.png" alt="SyndrDB" class="w-16 h-16" />
            </div>

            <h2 class="text-2xl font-bold mb-2 text-gray-900 dark:text-white">
              ${this.appName}
            </h2>
            <p class="text-gray-600 dark:text-gray-300 mb-4">
              ${this.appDescription}
            </p>

            <hr class="my-4" />

            <div class="text-sm text-gray-500 dark:text-gray-400">
              <p><strong>Version:</strong> ${this.appVersion}</p>
              <p><strong>Built with:</strong> Electron + Lit + Tailwind CSS</p>
              <p class="mt-2">© 2025 Dan Strohschein</p>
            </div>

            <div class="mt-6">
              <button
                class="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded"
                @click=${this.handleClose}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}
