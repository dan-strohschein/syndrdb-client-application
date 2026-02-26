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
  private confirmationText = '';

  @state()
  private isDeleting = false;

  @state()
  private forceDelete = false;

  @state()
  private errorMessage = '';

  private get isConfirmed(): boolean {
    return this.confirmationText.trim().toLowerCase() === 'delete';
  }

  override handleClose(): void {
    this.confirmationText = '';
    this.isDeleting = false;
    this.forceDelete = false;
    this.errorMessage = '';
    super.handleClose();
  }

  private handleConfirmationInput(e: Event) {
    this.confirmationText = (e.target as HTMLInputElement).value;
    if (this.errorMessage) this.errorMessage = '';
  }

  private async handleDelete() {
    if (!this.isConfirmed || this.isDeleting) return;

    const connId = this.connectionId;
    const dbName = this.databaseName;

    if (!connId) {
      this.errorMessage = 'No connection specified.';
      return;
    }
    if (!dbName) {
      this.errorMessage = 'No database specified.';
      return;
    }

    try {
      this.isDeleting = true;
      this.errorMessage = '';

      const dropCmd = this.forceDelete
        ? `DROP DATABASE "${dbName}" WITH FORCE;`
        : `DROP DATABASE "${dbName}";`;
      console.log('[DeleteDatabase] Sending DROP command:', dropCmd);
      const result = await connectionManager.executeQueryWithContext(connId, dropCmd);
      console.log('[DeleteDatabase] DROP result:', result);

      if (result.success) {
        // Refresh metadata so the tree updates
        await connectionManager.refreshMetadata(connId);

        this.dispatchEvent(
          new CustomEvent('database-deleted', {
            detail: { connectionId: connId, databaseName: dbName },
            bubbles: true,
          })
        );

        this.handleClose();
      } else {
        const err = result.error;
        const msg = err && typeof err === 'object' && 'message' in err
          ? (err as { message: string }).message
          : err || 'Unknown error';
        this.errorMessage = `Failed to delete database: ${msg}`;
      }
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    } finally {
      this.isDeleting = false;
    }
  }

  render() {
    if (!this.open) return html``;

    return html`
      <div class="modal ${this.open ? 'modal-open' : ''}">
        <div class="modal-box w-11/12 max-w-lg ${this.modalContainerClass}">
          <!-- Modal Header -->
          <div class="flex items-center justify-between mb-6">
            <h3 class="font-bold text-lg">Delete Database</h3>
            <button
              class="btn btn-sm btn-circle btn-ghost"
              @click=${this.handleClose}
              ?disabled=${this.isDeleting}
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Warning -->
          <div class="p-3 bg-error/10 border border-error/30 rounded-md mb-4">
            <p class="text-sm text-error font-semibold">
              This action cannot be undone.
            </p>
            <p class="text-sm text-error mt-1">
              This will permanently delete the database
              <span class="font-bold">"${this.databaseName}"</span>
              and all of its data.
            </p>
          </div>

          <!-- Confirmation Input -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Type <span class="font-bold">delete</span> to confirm
            </label>
            <input
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-error focus:border-error"
              placeholder="type in the word delete to confirm"
              .value=${this.confirmationText}
              @input=${this.handleConfirmationInput}
              ?disabled=${this.isDeleting}
              autocomplete="off"
            />
          </div>

          <!-- Force Delete Toggle -->
          <label class="flex items-center gap-2 cursor-pointer mt-4">
            <input
              type="checkbox"
              class="toggle toggle-error toggle-sm"
              .checked=${this.forceDelete}
              @change=${(e: Event) => { this.forceDelete = (e.target as HTMLInputElement).checked; }}
              ?disabled=${this.isDeleting}
            />
            <span class="text-sm">Force delete (remove database even if bundles contain data)</span>
          </label>

          <!-- Error Message -->
          ${this.errorMessage
            ? html`<div class="mt-4 p-3 bg-error/10 border border-error/30 rounded-md">
                <p class="text-sm text-error">${this.errorMessage}</p>
              </div>`
            : ''}

          <!-- Modal Actions -->
          <div class="modal-action mt-6">
            <button
              type="button"
              class="btn btn-ghost"
              @click=${this.handleClose}
              ?disabled=${this.isDeleting}
            >
              Cancel
            </button>
            <button
              type="button"
              class="btn btn-error ${this.isDeleting ? 'loading' : ''}"
              @click=${this.handleDelete}
              ?disabled=${!this.isConfirmed || this.isDeleting}
            >
              ${this.isDeleting ? 'Deleting...' : 'Delete Database'}
            </button>
          </div>
        </div>
        <div class="modal-backdrop ${this.modalBackdropClass}" @click=${this.handleClose}></div>
      </div>
    `;
  }
}
