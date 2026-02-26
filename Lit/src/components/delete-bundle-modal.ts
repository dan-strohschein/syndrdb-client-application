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
  private confirmationText = '';

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

  private get hasDocuments(): boolean {
    return this.documentCount !== null && this.documentCount > 0;
  }

  private get isConfirmed(): boolean {
    if (!this.hasDocuments) return true;
    return this.confirmationText.trim().toLowerCase() === 'delete';
  }

  override handleClose(): void {
    this.confirmationText = '';
    this.isDeleting = false;
    this.isCheckingDocuments = false;
    this.documentCount = null;
    this.forceDelete = false;
    this.errorMessage = '';
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
      console.log('[DeleteBundle] Checking document count:', countQuery);
      const result = await connectionManager.executeQueryWithContext(connId, countQuery, dbName ?? undefined);
      console.log('[DeleteBundle] Count result:', result);

      if (result.success && result.data) {
        // Parse the count from the result
        const count = this.parseCountResult(result.data);
        this.documentCount = count;
        console.log('[DeleteBundle] Document count:', count);
      } else {
        // If count query fails, assume it has documents to be safe
        this.documentCount = 1;
      }
    } catch (error) {
      console.error('[DeleteBundle] Error checking document count:', error);
      // On error, assume documents exist to require confirmation
      this.documentCount = 1;
    } finally {
      this.isCheckingDocuments = false;
    }
  }

  private parseCountResult(data: unknown): number {
    // Handle various possible result formats
    if (typeof data === 'number') return data;

    if (Array.isArray(data)) {
      if (data.length > 0) {
        const firstRow = data[0];
        if (typeof firstRow === 'number') return firstRow;
        if (typeof firstRow === 'object' && firstRow !== null) {
          // Look for a count field in the result object
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

  private handleConfirmationInput(e: Event) {
    this.confirmationText = (e.target as HTMLInputElement).value;
    if (this.errorMessage) this.errorMessage = '';
  }

  private async handleDelete() {
    if (!this.isConfirmed || this.isDeleting) return;

    const connId = this.connectionId;
    const dbName = this.databaseName;
    const bundle = this.bundleName;

    if (!connId) {
      this.errorMessage = 'No connection specified.';
      return;
    }
    if (!bundle) {
      this.errorMessage = 'No bundle specified.';
      return;
    }

    try {
      this.isDeleting = true;
      this.errorMessage = '';

      const dropCmd = this.forceDelete
        ? `DROP BUNDLE "${bundle}" WITH FORCE;`
        : `DROP BUNDLE "${bundle}";`;
      console.log('[DeleteBundle] Sending DROP command:', dropCmd);
      const result = await connectionManager.executeQueryWithContext(connId, dropCmd, dbName ?? undefined);
      console.log('[DeleteBundle] DROP result:', result);

      if (result.success) {
        // Remove the deleted bundle from the cached bundle list so the tree updates
        const connection = connectionManager.getConnection(connId);
        if (connection?.databaseBundles && dbName) {
          const cachedBundles = connection.databaseBundles.get(dbName);
          if (cachedBundles) {
            connection.databaseBundles.set(
              dbName,
              cachedBundles.filter(b => b.Name !== bundle)
            );
          }
        }

        await connectionManager.refreshMetadata(connId);

        this.dispatchEvent(
          new CustomEvent('bundle-deleted', {
            detail: { connectionId: connId, databaseName: dbName, bundleName: bundle },
            bubbles: true,
          })
        );

        this.handleClose();
      } else {
        const err = result.error;
        const msg = err && typeof err === 'object' && 'message' in err
          ? (err as { message: string }).message
          : err || 'Unknown error';
        this.errorMessage = `Failed to delete bundle: ${msg}`;
      }
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    } finally {
      this.isDeleting = false;
    }
  }

  render() {
    if (!this.open) return html``;

    const loading = this.isCheckingDocuments;

    return html`
      <div class="modal ${this.open ? 'modal-open' : ''}">
        <div class="modal-box w-11/12 max-w-lg ${this.modalContainerClass}">
          <!-- Modal Header -->
          <div class="flex items-center justify-between mb-6">
            <h3 class="font-bold text-lg">Delete Bundle</h3>
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

          ${loading
            ? html`
              <div class="flex items-center justify-center py-8">
                <span class="loading loading-spinner loading-md mr-2"></span>
                <span class="text-sm text-gray-500">Checking bundle contents...</span>
              </div>
            `
            : html`
              <!-- Warning -->
              <div class="p-3 bg-error/10 border border-error/30 rounded-md mb-4">
                <p class="text-sm text-error font-semibold">
                  This action cannot be undone.
                </p>
                <p class="text-sm text-error mt-1">
                  This will permanently delete the bundle
                  <span class="font-bold">"${this.bundleName}"</span>
                  ${this.hasDocuments
                    ? html` and its <span class="font-bold">${this.documentCount?.toLocaleString()}</span> document${this.documentCount === 1 ? '' : 's'}.`
                    : html` and its schema definition.`
                  }
                </p>
              </div>

              <!-- Confirmation Input (only when documents exist) -->
              ${this.hasDocuments
                ? html`
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
                `
                : ''
              }

              <!-- Force Delete Toggle -->
              ${this.hasDocuments
                ? html`
                  <label class="flex items-center gap-2 cursor-pointer mt-4">
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
                : ''
              }

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
                  ${this.isDeleting ? 'Deleting...' : 'Delete Bundle'}
                </button>
              </div>
            `
          }
        </div>
        <div class="modal-backdrop ${this.modalBackdropClass}" @click=${this.handleClose}></div>
      </div>
    `;
  }
}
