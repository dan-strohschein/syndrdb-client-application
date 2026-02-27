import { html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { connectionManager } from '../services/connection-manager';
import { BaseModalMixin } from '../lib/base-modal-mixin';

@customElement('delete-bundle-modal')
export class DeleteBundleModal extends BaseModalMixin(LitElement) {
  @property({ type: String })
  connectionId: string | null = null;

  @property({ type: String })
  databaseName: string | null = null;

  @property({ type: String })
  bundleName: string | null = null;

  @state()
  private isDeleting = false;

  @state()
  private errorMessage = '';

  @state()
  private confirmText = '';

  override handleClose(): void {
    this.isDeleting = false;
    this.errorMessage = '';
    this.confirmText = '';
    super.handleClose();
  }

  private async handleDelete() {
    if (!this.connectionId || !this.databaseName || !this.bundleName) return;
    if (this.confirmText !== this.bundleName) {
      this.errorMessage = 'Bundle name does not match. Please type the exact name to confirm.';
      return;
    }

    this.isDeleting = true;
    this.errorMessage = '';

    try {
      await connectionManager.setDatabaseContext(this.connectionId, this.databaseName);
      const result = await connectionManager.executeQueryWithContext(
        this.connectionId,
        `DROP BUNDLE "${this.bundleName}";`
      );

      if (!result.success) {
        this.errorMessage = result.error || 'Failed to drop bundle';
        this.isDeleting = false;
        return;
      }

      import('./toast-notification').then(({ ToastNotification }) => {
        ToastNotification.success(`Bundle "${this.bundleName}" deleted from ${this.databaseName}`);
      });

      this.dispatchEvent(new CustomEvent('bundle-deleted', {
        detail: { connectionId: this.connectionId, databaseName: this.databaseName, bundleName: this.bundleName },
        bubbles: true,
      }));

      this.handleClose();
    } catch (err) {
      this.errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      this.isDeleting = false;
    }
  }

  render() {
    if (!this.open) return html``;

    return html`
      <div class="modal modal-open">
        <div class="db-modal-container modal-box w-11/12 max-w-md">
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-bold text-lg text-feedback-error">
              <i class="fa-solid fa-triangle-exclamation mr-2"></i>Delete Bundle
            </h3>
            <button class="btn btn-sm btn-circle btn-ghost" @click=${this.handleClose}>
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div class="space-y-4">
            <p class="text-sm">
              This will permanently delete the bundle
              <strong class="text-feedback-error">${this.bundleName}</strong>
              from database <strong>${this.databaseName}</strong>,
              including all documents. This action cannot be undone.
            </p>

            <div>
              <label class="label">
                <span class="label-text text-sm">Type <strong>${this.bundleName}</strong> to confirm:</span>
              </label>
              <input
                type="text"
                class="input input-bordered input-sm w-full"
                .value=${this.confirmText}
                @input=${(e: Event) => { this.confirmText = (e.target as HTMLInputElement).value; }}
                placeholder=${this.bundleName ?? ''}
              />
            </div>

            ${this.errorMessage ? html`
              <p class="text-sm text-feedback-error">${this.errorMessage}</p>
            ` : ''}
          </div>

          <div class="modal-action mt-6">
            <button class="btn btn-ghost btn-sm" @click=${this.handleClose} ?disabled=${this.isDeleting}>
              Cancel
            </button>
            <button
              class="btn btn-error btn-sm ${this.isDeleting ? 'loading' : ''}"
              @click=${this.handleDelete}
              ?disabled=${this.isDeleting || this.confirmText !== this.bundleName}
            >
              ${this.isDeleting ? 'Deleting...' : 'Delete Bundle'}
            </button>
          </div>
        </div>
        <div class="modal-backdrop" @click=${this.handleClose}></div>
      </div>
    `;
  }
}
