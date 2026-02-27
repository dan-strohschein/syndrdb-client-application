import { html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { connectionManager } from '../services/connection-manager';
import { BaseModalMixin } from '../lib/base-modal-mixin';

@customElement('delete-database-modal')
export class DeleteDatabaseModal extends BaseModalMixin(LitElement) {
  @property({ type: String })
  connectionId: string | null = null;

  @property({ type: String })
  databaseName: string | null = null;

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
    if (!this.connectionId || !this.databaseName) return;
    if (this.confirmText !== this.databaseName) {
      this.errorMessage = 'Database name does not match. Please type the exact name to confirm.';
      return;
    }

    this.isDeleting = true;
    this.errorMessage = '';

    try {
      const result = await connectionManager.executeQueryOnConnectionId(
        this.connectionId,
        `DROP DATABASE "${this.databaseName}";`
      );

      if (!result.success) {
        this.errorMessage = result.error || 'Failed to drop database';
        this.isDeleting = false;
        return;
      }

      import('./toast-notification').then(({ ToastNotification }) => {
        ToastNotification.success(`Database "${this.databaseName}" deleted`);
      });

      this.dispatchEvent(new CustomEvent('database-deleted', {
        detail: { connectionId: this.connectionId, databaseName: this.databaseName },
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
              <i class="fa-solid fa-triangle-exclamation mr-2"></i>Delete Database
            </h3>
            <button class="btn btn-sm btn-circle btn-ghost" @click=${this.handleClose}>
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div class="space-y-4">
            <p class="text-sm">
              This will permanently delete the database
              <strong class="text-feedback-error">${this.databaseName}</strong>
              and all of its bundles and data. This action cannot be undone.
            </p>

            <div>
              <label class="label">
                <span class="label-text text-sm">Type <strong>${this.databaseName}</strong> to confirm:</span>
              </label>
              <input
                type="text"
                class="input input-bordered input-sm w-full"
                .value=${this.confirmText}
                @input=${(e: Event) => { this.confirmText = (e.target as HTMLInputElement).value; }}
                placeholder=${this.databaseName ?? ''}
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
              ?disabled=${this.isDeleting || this.confirmText !== this.databaseName}
            >
              ${this.isDeleting ? 'Deleting...' : 'Delete Database'}
            </button>
          </div>
        </div>
        <div class="modal-backdrop" @click=${this.handleClose}></div>
      </div>
    `;
  }
}
