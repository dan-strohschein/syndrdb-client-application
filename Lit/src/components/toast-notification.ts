import { html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastEntry {
  id: number;
  type: ToastType;
  message: string;
  exiting: boolean;
}

/**
 * Toast notification component — singleton that manages transient messages.
 * Use the static methods: ToastNotification.success(), .error(), .warning(), .info()
 */
@customElement('toast-notification')
export class ToastNotification extends LitElement {
  private static instance: ToastNotification | null = null;
  private nextId = 0;

  @state()
  private toasts: ToastEntry[] = [];

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    ToastNotification.instance = this;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (ToastNotification.instance === this) {
      ToastNotification.instance = null;
    }
  }

  // --- Static convenience API ---

  static success(message: string, duration = 4000) {
    ToastNotification.instance?.addToast('success', message, duration);
  }

  static error(message: string, duration = 6000) {
    ToastNotification.instance?.addToast('error', message, duration);
  }

  static warning(message: string, duration = 5000) {
    ToastNotification.instance?.addToast('warning', message, duration);
  }

  static info(message: string, duration = 4000) {
    ToastNotification.instance?.addToast('info', message, duration);
  }

  // --- Instance methods ---

  private addToast(type: ToastType, message: string, duration: number) {
    const id = this.nextId++;
    this.toasts = [...this.toasts, { id, type, message, exiting: false }];

    // Auto-dismiss after duration
    setTimeout(() => this.dismissToast(id), duration);
  }

  private dismissToast(id: number) {
    // Mark as exiting for exit animation
    this.toasts = this.toasts.map(t =>
      t.id === id ? { ...t, exiting: true } : t
    );

    // Remove after animation completes
    setTimeout(() => {
      this.toasts = this.toasts.filter(t => t.id !== id);
    }, 200);
  }

  private getIcon(type: ToastType): string {
    switch (type) {
      case 'success': return 'fa-circle-check';
      case 'error': return 'fa-circle-xmark';
      case 'warning': return 'fa-triangle-exclamation';
      case 'info': return 'fa-circle-info';
    }
  }

  private getIconColor(type: ToastType): string {
    switch (type) {
      case 'success': return 'text-feedback-success';
      case 'error': return 'text-feedback-error';
      case 'warning': return 'text-feedback-warning';
      case 'info': return 'text-feedback-info';
    }
  }

  render() {
    return html`
      <div class="db-toast-container">
        ${this.toasts.map(toast => html`
          <div class="db-toast db-toast-${toast.type} ${toast.exiting ? 'exiting' : ''}"
               @click=${() => this.dismissToast(toast.id)}>
            <i class="fa-solid ${this.getIcon(toast.type)} ${this.getIconColor(toast.type)} text-base flex-shrink-0"></i>
            <span class="flex-1">${toast.message}</span>
            <button class="text-feedback-muted hover:text-white transition-colors ml-2 flex-shrink-0"
                    @click=${(e: Event) => { e.stopPropagation(); this.dismissToast(toast.id); }}>
              <i class="fa-solid fa-xmark text-xs"></i>
            </button>
          </div>
        `)}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'toast-notification': ToastNotification;
  }
}
