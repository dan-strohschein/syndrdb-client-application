import { html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { connectionManager } from '../services/connection-manager';
import { BaseModalMixin } from '../lib/base-modal-mixin';

interface BackupEntry {
  file_name: string;
  size_bytes: number;
  modified_at: string;
}

interface ConnectionOption {
  id: string;
  name: string;
}

@customElement('restore-modal')
export class RestoreModal extends BaseModalMixin(LitElement) {
  @property({ type: String })
  connectionId: string | null = null;

  @state()
  private availableConnections: ConnectionOption[] = [];

  @state()
  private selectedConnectionId = '';

  @state()
  private backups: BackupEntry[] = [];

  @state()
  private selectedBackup: BackupEntry | null = null;

  @state()
  private newDatabaseName = '';

  @state()
  private isLoadingBackups = false;

  @state()
  private isRestoring = false;

  @state()
  private errorMessage = '';

  @state()
  private successMessage = '';

  @state()
  private restoreComplete = false;

  @state()
  private unlockAfterRestore = false;

  @state()
  private step: 'select-backup' | 'configure-restore' = 'select-backup';

  override handleClose(): void {
    this.errorMessage = '';
    this.successMessage = '';
    this.isLoadingBackups = false;
    this.isRestoring = false;
    this.restoreComplete = false;
    this.availableConnections = [];
    this.selectedConnectionId = '';
    this.backups = [];
    this.selectedBackup = null;
    this.newDatabaseName = '';
    this.unlockAfterRestore = false;
    this.step = 'select-backup';
    super.handleClose();
  }

  updated(changedProperties: Map<string, unknown>) {
    super.updated(changedProperties);

    if (changedProperties.has('open') && this.open) {
      this.populateOnOpen();
    }
  }

  private populateOnOpen() {
    // Build list of connected connections
    const allConnections = connectionManager.getConnections();
    this.availableConnections = allConnections
      .filter((c) => c.status === 'connected')
      .map((c) => ({ id: c.id, name: c.name }));

    // Pre-select: use provided connectionId, or active connection, or sole connection
    if (this.connectionId) {
      this.selectedConnectionId = this.connectionId;
      this.fetchBackups();
    } else {
      const active = connectionManager.getActiveConnection();
      if (active && active.status === 'connected') {
        this.selectedConnectionId = active.id;
        this.fetchBackups();
      } else if (this.availableConnections.length === 1) {
        this.selectedConnectionId = this.availableConnections[0].id;
        this.fetchBackups();
      }
    }
  }

  private handleConnectionChange(value: string) {
    this.selectedConnectionId = value;
    this.backups = [];
    this.selectedBackup = null;
    this.newDatabaseName = '';
    this.step = 'select-backup';
    this.errorMessage = '';
    this.successMessage = '';

    if (value) {
      this.fetchBackups();
    }
  }

  private async fetchBackups() {
    if (!this.selectedConnectionId) return;

    try {
      this.isLoadingBackups = true;
      this.errorMessage = '';

      const cmd = `SHOW BACKUPS;`;
      console.log('[Restore] Sending SHOW BACKUPS command:', cmd);
      const result = await connectionManager.executeQueryWithContext(this.selectedConnectionId, cmd);
      console.log('[Restore] SHOW BACKUPS result:', result);

      if (result.success && Array.isArray(result.data)) {
        this.backups = result.data as BackupEntry[];
      } else if (result.success) {
        this.backups = [];
      } else {
        this.errorMessage = `Failed to fetch backups: ${result.error || 'Unknown error'}`;
        this.backups = [];
      }
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Failed to fetch backups.';
      this.backups = [];
    } finally {
      this.isLoadingBackups = false;
    }
  }

  private handleBackupSelect(backup: BackupEntry) {
    this.selectedBackup = backup;
    this.step = 'configure-restore';
    this.errorMessage = '';
  }

  private handleBackToList() {
    this.step = 'select-backup';
    this.selectedBackup = null;
    this.newDatabaseName = '';
    this.errorMessage = '';
  }

  private async handleRestore() {
    if (!this.selectedBackup || !this.newDatabaseName.trim()) return;

    const connId = this.selectedConnectionId;
    if (!connId) {
      this.errorMessage = 'No connection selected.';
      return;
    }

    // Client-side validation: check for name conflict
    const connection = connectionManager.getConnection(connId);
    if (connection?.databases) {
      const nameLower = this.newDatabaseName.trim().toLowerCase();
      const conflict = connection.databases.some(
        (db) => db.toLowerCase() === nameLower
      );
      if (conflict) {
        this.errorMessage = `A database named "${this.newDatabaseName.trim()}" already exists on this server. Please choose a different name.`;
        return;
      }
    }

    try {
      this.isRestoring = true;
      this.errorMessage = '';
      this.successMessage = '';

      const fileName = this.selectedBackup.file_name;
      const newName = this.newDatabaseName.trim();
      const cmd = `RESTORE DATABASE FROM "${fileName}" AS "${newName}";`;
      console.log('[Restore] Sending RESTORE command:', cmd);
      const result = await connectionManager.executeQueryWithContext(connId, cmd);
      console.log('[Restore] RESTORE result:', result);

      if (result.success) {
        if (this.unlockAfterRestore) {
          const unlockCmd = `UNLOCK DATABASE "${newName}";`;
          console.log('[Restore] Sending UNLOCK command:', unlockCmd);
          const unlockResult = await connectionManager.executeQueryWithContext(connId, unlockCmd);
          console.log('[Restore] UNLOCK result:', unlockResult);

          if (unlockResult.success) {
            this.successMessage = `Database "${newName}" restored and unlocked successfully from "${fileName}".`;
          } else {
            this.successMessage = `Database "${newName}" restored successfully from "${fileName}".\n\nWarning: Failed to unlock database: ${unlockResult.error || 'Unknown error'}. Run UNLOCK DATABASE "${newName}"; manually before attempting writes.`;
          }
        } else {
          this.successMessage = `Database "${newName}" restored successfully from "${fileName}".\n\nReminder: The restored database is in LOCKED state. Run UNLOCK DATABASE "${newName}"; before attempting writes.`;
        }
        this.restoreComplete = true;
        // Refresh the connection tree so the restored database appears
        await connectionManager.refreshMetadata(connId);
      } else {
        this.errorMessage = `Restore failed: ${result.error || 'Unknown error'}`;
      }
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    } finally {
      this.isRestoring = false;
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const value = bytes / Math.pow(1024, i);
    return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  }

  private formatDate(isoString: string): string {
    try {
      const date = new Date(isoString);
      return date.toLocaleString();
    } catch {
      return isoString;
    }
  }

  render() {
    if (!this.open) return html``;

    const connectionPreSelected = !!this.connectionId;
    const isLoading = this.isLoadingBackups || this.isRestoring;

    return html`
      <div class="modal ${this.open ? 'modal-open' : ''}">
        <div class="modal-box w-11/12 max-w-2xl">
          <!-- Modal Header -->
          <div class="flex items-center justify-between mb-6">
            <h3 class="font-bold text-lg">Restore Database</h3>
            <button
              class="btn btn-sm btn-circle btn-ghost"
              @click=${this.handleClose}
              ?disabled=${isLoading}
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Modal Content -->
          <div class="space-y-4">
            <!-- Connection Selection -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Connection <span class="text-red-500">*</span>
              </label>
              <select
                class="w-full px-3 py-2 border ${this.errorMessage && !this.selectedConnectionId ? 'border-red-300' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                .value=${this.selectedConnectionId}
                @change=${(e: Event) => this.handleConnectionChange((e.target as HTMLSelectElement).value)}
                ?disabled=${isLoading || connectionPreSelected}
              >
                ${!this.selectedConnectionId ? html`<option value="">Select a connection...</option>` : ''}
                ${this.availableConnections.map(
                  (conn) => html`<option value=${conn.id} ?selected=${conn.id === this.selectedConnectionId}>${conn.name}</option>`
                )}
              </select>
              ${this.availableConnections.length === 0
                ? html`<p class="text-xs text-warning mt-1">No connected servers available. Connect to a server first.</p>`
                : ''}
            </div>

            <!-- Loading State -->
            ${this.isLoadingBackups
              ? html`
                <div class="flex items-center justify-center py-8">
                  <span class="loading loading-spinner loading-md mr-2"></span>
                  <span class="text-sm text-gray-500">Loading backups...</span>
                </div>
              `
              : ''}

            <!-- Backup List (select-backup step) -->
            ${this.step === 'select-backup' && !this.isLoadingBackups && this.selectedConnectionId
              ? html`
                ${this.backups.length > 0
                  ? html`
                    <div class="overflow-x-auto">
                      <table class="table table-sm w-full">
                        <thead>
                          <tr>
                            <th>File Name</th>
                            <th>Size</th>
                            <th>Modified</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          ${this.backups.map(
                            (backup) => html`
                              <tr class="hover:bg-base-200 cursor-pointer" @click=${() => this.handleBackupSelect(backup)}>
                                <td class="font-mono text-sm">${backup.file_name}</td>
                                <td class="text-sm">${this.formatBytes(backup.size_bytes)}</td>
                                <td class="text-sm">${this.formatDate(backup.modified_at)}</td>
                                <td>
                                  <button
                                    type="button"
                                    class="btn btn-xs btn-primary"
                                    @click=${(e: Event) => { e.stopPropagation(); this.handleBackupSelect(backup); }}
                                  >
                                    Select
                                  </button>
                                </td>
                              </tr>
                            `
                          )}
                        </tbody>
                      </table>
                    </div>
                  `
                  : html`
                    <div class="text-center py-8 text-gray-500">
                      <i class="fa-solid fa-box-open text-3xl mb-2"></i>
                      <p class="text-sm">No backups found on this server.</p>
                    </div>
                  `}
              `
              : ''}

            <!-- Configure Restore (configure-restore step) -->
            ${this.step === 'configure-restore' && this.selectedBackup
              ? html`
                <!-- Selected Backup Summary -->
                <div class="p-3 bg-base-200 rounded-md">
                  <p class="text-sm font-medium mb-1">Selected Backup</p>
                  <p class="text-sm font-mono">${this.selectedBackup.file_name}</p>
                  <p class="text-xs text-gray-500 mt-1">
                    ${this.formatBytes(this.selectedBackup.size_bytes)} &mdash; ${this.formatDate(this.selectedBackup.modified_at)}
                  </p>
                </div>

                <!-- New Database Name -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    New Database Name <span class="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    class="w-full px-3 py-2 border ${this.errorMessage && !this.newDatabaseName.trim() ? 'border-red-300' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter new database name"
                    .value=${this.newDatabaseName}
                    @input=${(e: Event) => { this.newDatabaseName = (e.target as HTMLInputElement).value; if (this.errorMessage) this.errorMessage = ''; }}
                    ?disabled=${this.isRestoring}
                    autocomplete="off"
                  />
                  <p class="text-xs text-gray-500 mt-1">The backup will be restored as a new database with this name.</p>
                </div>

                <!-- Unlock after restore toggle -->
                <label class="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    class="toggle toggle-sm"
                    .checked=${this.unlockAfterRestore}
                    @change=${(e: Event) => { this.unlockAfterRestore = (e.target as HTMLInputElement).checked; }}
                    ?disabled=${this.isRestoring}
                  />
                  <span class="text-sm">Unlock this database after restore</span>
                </label>
              `
              : ''}
          </div>

          <!-- Messages -->
          ${this.errorMessage
            ? html`<div class="mt-4 p-3 bg-error/10 border border-error/30 rounded-md">
                <p class="text-sm text-error whitespace-pre-line">${this.errorMessage}</p>
              </div>`
            : ''}
          ${this.successMessage
            ? html`<div class="mt-4 p-3 bg-success/10 border border-success/30 rounded-md">
                <p class="text-sm text-success whitespace-pre-line">${this.successMessage}</p>
              </div>`
            : ''}

          <!-- Modal Actions -->
          <div class="modal-action mt-6">
            ${this.step === 'configure-restore' && !this.restoreComplete
              ? html`
                <button
                  type="button"
                  class="btn btn-ghost"
                  @click=${this.handleBackToList}
                  ?disabled=${this.isRestoring}
                >
                  Back
                </button>
              `
              : ''}
            <button
              type="button"
              class="btn btn-ghost"
              @click=${this.handleClose}
              ?disabled=${isLoading}
            >
              ${this.restoreComplete ? 'Close' : 'Cancel'}
            </button>
            ${this.step === 'configure-restore' && !this.restoreComplete
              ? html`
                <button
                  type="button"
                  class="btn btn-primary ${this.isRestoring ? 'loading' : ''}"
                  @click=${this.handleRestore}
                  ?disabled=${this.isRestoring || !this.newDatabaseName.trim()}
                >
                  ${this.isRestoring ? 'Restoring...' : 'Restore'}
                </button>
              `
              : ''}
          </div>
        </div>
        <div class="modal-backdrop" @click=${this.handleClose}></div>
      </div>
    `;
  }
}
