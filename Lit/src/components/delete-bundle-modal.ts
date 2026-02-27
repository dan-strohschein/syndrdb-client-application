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
  private isCheckingDocuments = false;

  @state()
  private documentCount: number | null = null;

  @state()
  private forceDelete = false;

  @state()
  private errorMessage = '';

  @state()
  private confirmText = '';

  private get hasDocuments(): boolean {
    return this.documentCount !== null && this.documentCount > 0;
  }

  override handleClose(): void {
    this.isDeleting = false;
    this.isCheckingDocuments = false;
    this.documentCount = null;
    this.forceDelete = false;
    this.errorMessage = '';
    this.confirmText = '';
    super.handleClose();
  }

  updated(changedProperties: Map<string, unknown>) {
    super.updated(changedProperties);

    if (changedProperties.has('open') && this.open) {
      this.checkDocumentCount();
    }
  }

  private async checkDocumentCount() {
    const connId = this.connectionId;
    const dbName = this.databaseName;
    const bundle = this.bundleName;

    if (!connId || !dbName || !bundle) {
      this.documentCount = 0;
      return;
    }

    try {
      this.isCheckingDocuments = true;
      this.errorMessage = '';

      const countQuery = `SELECT COUNT(*) FROM "${bundle}";`;
      const result = await connectionManager.executeQueryWithContext(connId, countQuery, dbName ?? undefined);

      if (result.success && result.data) {
        this.documentCount = this.parseCountResult(result.data);
      } else {
        // If count query fails, assume it has documents to be safe
        this.documentCount = 1;
      }
    } catch (error) {
      console.error('[DeleteBundle] Error checking document count:', error);
      this.documentCount = 1;
    } finally {
      this.isCheckingDocuments = false;
    }
  }

  private parseCountResult(data: unknown): number {
    if (typeof data === 'number') return data;

    if (Array.isArray(data)) {
      if (data.length > 0) {
        const firstRow = data[0];
        if (typeof firstRow === 'number') return firstRow;
        if (typeof firstRow === 'object' && firstRow !== null) {
          const values = Object.values(firstRow as Record<string, unknown>);
          for (const val of values) {
            if (typeof val === 'number') return val;
            if (typeof val === 'string') {
              const parsed = parseInt(val, 10);
              if (!isNaN(parsed)) return parsed;
            }
          }
        }
      }
      return 0;
    }

    if (typeof data === 'object' && data !== null) {
      const values = Object.values(data as Record<string, unknown>);
      for (const val of values) {
        if (typeof val === 'number') return val;
        if (typeof val === 'string') {
          const parsed = parseInt(val, 10);
          if (!isNaN(parsed)) return parsed;
        }
      }
    }

    return 0;
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

      const dropCmd = this.forceDelete
        ? `DROP BUNDLE "${this.bundleName}" WITH FORCE;`
        : `DROP BUNDLE "${this.bundleName}";`;
      const result = await connectionManager.executeQueryWithContext(
        this.connectionId,
        dropCmd
      );

      if (!result.success) {
        this.errorMessage = result.error || 'Failed to drop bundle';
        this.isDeleting = false;
        return;
      }

      // Remove the deleted bundle from the cached bundle list so the tree updates
      const connection = connectionManager.getConnection(this.connectionId);
      if (connection?.databaseBundles && this.databaseName) {
        const cachedBundles = connection.databaseBundles.get(this.databaseName);
        if (cachedBundles) {
          connection.databaseBundles.set(
            this.databaseName,
            cachedBundles.filter(b => b.Name !== this.bundleName)
          );
        }
      }

      await connectionManager.refreshMetadata(this.connectionId);

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

    const loading = this.isCheckingDocuments;

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

          ${loading
            ? html`
              <div class="flex items-center justify-center py-8">
                <span class="loading loading-spinner loading-md mr-2"></span>
                <span class="text-sm opacity-60">Checking bundle contents...</span>
              </div>
            `
            : html`
              <div class="space-y-4">
                <p class="text-sm">
                  This will permanently delete the bundle
                  <strong class="text-feedback-error">${this.bundleName}</strong>
                  from database <strong>${this.databaseName}</strong>${this.hasDocuments
                    ? html`, including <strong class="text-feedback-error">${this.documentCount?.toLocaleString()}</strong> document${this.documentCount === 1 ? '' : 's'}`
                    : ''}.
                  This action cannot be undone.
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
                    ?disabled=${this.isDeleting}
                    autocomplete="off"
                  />
                </div>

                ${this.hasDocuments
                  ? html`
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        class="toggle toggle-error toggle-sm"
                        .checked=${this.forceDelete}
                        @change=${(e: Event) => { this.forceDelete = (e.target as HTMLInputElement).checked; }}
                        ?disabled=${this.isDeleting}
                      />
                      <span class="text-sm">Force delete (remove bundle even if it contains documents)</span>
                    </label>
                  `
                  : ''}

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
            `
          }
        </div>
        <div class="modal-backdrop" @click=${this.handleClose}></div>
      </div>
    `;
  }
}
