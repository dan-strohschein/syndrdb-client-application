import { html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { connectionManager } from '../services/connection-manager';
import { BaseModalMixin } from '../lib/base-modal-mixin';

interface BackupFormData {
  databaseName: string;
  backupName: string;
  compression: 'gzip' | 'zstd' | 'none';
  includeIndexes: boolean;
  lockDatabase: boolean;
}

@customElement('backup-modal')
export class BackupModal extends BaseModalMixin(LitElement) {
  @property({ type: String })
  connectionId: string | null = null;

  @property({ type: String })
  databaseName: string | null = null;

  @state()
  private formData: BackupFormData = {
    databaseName: '',
    backupName: '',
    compression: 'gzip',
    includeIndexes: true,
    lockDatabase: true,
  };

  @state()
  private errorMessage = '';

  @state()
  private successMessage = '';

  @state()
  private isLoading = false;

  @state()
  private backupComplete = false;

  @state()
  private availableDatabases: string[] = [];

  override handleClose(): void {
    this.errorMessage = '';
    this.successMessage = '';
    this.isLoading = false;
    this.backupComplete = false;
    this.formData = {
      databaseName: '',
      backupName: '',
      compression: 'gzip',
      includeIndexes: true,
      lockDatabase: true,
    };
    this.availableDatabases = [];
    super.handleClose();
  }

  updated(changedProperties: Map<string, unknown>) {
    super.updated(changedProperties);

    if (changedProperties.has('open') && this.open) {
      this.populateOnOpen();
    }
  }

  private populateOnOpen() {
    // Find the connection — use provided connectionId, or fall back to active connection
    const connId = this.connectionId;
    const connection = connId
      ? connectionManager.getConnection(connId)
      : connectionManager.getActiveConnection();

    if (connection && connection.databases) {
      this.availableDatabases = [...connection.databases];
    } else {
      this.availableDatabases = [];
    }

    // Pre-select database if provided
    if (this.databaseName) {
      this.formData = {
        ...this.formData,
        databaseName: this.databaseName,
        backupName: this.generateDefaultBackupName(this.databaseName),
      };
    } else if (this.availableDatabases.length === 1) {
      // Auto-select if only one database
      const dbName = this.availableDatabases[0];
      this.formData = {
        ...this.formData,
        databaseName: dbName,
        backupName: this.generateDefaultBackupName(dbName),
      };
    }
  }

  private generateDefaultBackupName(dbName: string): string {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${dbName}_${yyyy}-${mm}-${dd}`;
  }

  private handleDatabaseChange(value: string) {
    this.formData = {
      ...this.formData,
      databaseName: value,
      backupName: value ? this.generateDefaultBackupName(value) : '',
    };
    if (this.errorMessage) this.errorMessage = '';
  }

  private handleInputChange(field: keyof BackupFormData, value: string | boolean) {
    this.formData = { ...this.formData, [field]: value };
    if (this.errorMessage) this.errorMessage = '';
  }

  private getResolvedConnectionId(): string | null {
    if (this.connectionId) return this.connectionId;
    const active = connectionManager.getActiveConnection();
    return active?.id ?? null;
  }

  private async handleBackup() {
    try {
      this.isLoading = true;
      this.errorMessage = '';
      this.successMessage = '';

      // Validate
      if (!this.formData.databaseName) {
        this.errorMessage = 'Please select a database.';
        this.isLoading = false;
        return;
      }
      if (!this.formData.backupName.trim()) {
        this.errorMessage = 'Please enter a backup name.';
        this.isLoading = false;
        return;
      }

      const connId = this.getResolvedConnectionId();
      if (!connId) {
        this.errorMessage = 'No active connection found.';
        this.isLoading = false;
        return;
      }

      const db = this.formData.databaseName;
      const backupName = this.formData.backupName.trim();
      const compression = this.formData.compression;
      const includeIndexes = this.formData.includeIndexes;
      let locked = false;

      // Step 1: Lock if requested
      if (this.formData.lockDatabase) {
        const lockCmd = `LOCK DATABASE "${db}" FOR "backup" COMMENT "Client-initiated backup";`;
        console.log('[Backup] Sending LOCK command:', lockCmd);
        const lockResult = await connectionManager.executeQueryWithContext(connId, lockCmd);
        console.log('[Backup] LOCK result:', lockResult);
        if (!lockResult.success) {
          this.errorMessage = `Failed to lock database: ${lockResult.error || 'Unknown error'}`;
          this.isLoading = false;
          return;
        }
        locked = true;
      }

      try {
        // Step 2: Backup
        const backupCmd = `BACKUP DATABASE "${db}" TO "${backupName}" WITH COMPRESSION = '${compression}', INCLUDE_INDEXES = ${includeIndexes};`;
        console.log('[Backup] Sending BACKUP command:', backupCmd);
        const backupResult = await connectionManager.executeQueryWithContext(connId, backupCmd);
        console.log('[Backup] BACKUP result:', backupResult);

        if (backupResult.success) {
          this.successMessage = `Backup "${backupName}" created successfully for database "${db}".`;
          this.backupComplete = true;
        } else {
          this.errorMessage = `Backup failed: ${backupResult.error || 'Unknown error'}`;
        }
      } finally {
        // Step 3: Unlock if we locked
        if (locked) {
          try {
            const unlockCmd = `UNLOCK DATABASE "${db}";`;
            console.log('[Backup] Sending UNLOCK command:', unlockCmd);
            const unlockResult = await connectionManager.executeQueryWithContext(connId, unlockCmd);
            console.log('[Backup] UNLOCK result:', unlockResult);
            if (!unlockResult.success) {
              const unlockWarning = `\nWarning: Failed to unlock database: ${unlockResult.error || 'Unknown error'}`;
              if (this.successMessage) {
                this.successMessage += unlockWarning;
              } else {
                this.errorMessage += unlockWarning;
              }
            }
          } catch (unlockError) {
            const unlockWarning = `\nWarning: Failed to unlock database: ${unlockError instanceof Error ? unlockError.message : 'Unknown error'}`;
            if (this.successMessage) {
              this.successMessage += unlockWarning;
            } else {
              this.errorMessage += unlockWarning;
            }
          }
        }
      }
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    } finally {
      this.isLoading = false;
    }
  }

  render() {
    if (!this.open) return html``;

    const databasePreSelected = !!this.databaseName;

    return html`
      <div class="modal ${this.open ? 'modal-open' : ''}">
        <div class="modal-box w-11/12 max-w-2xl">
          <!-- Modal Header -->
          <div class="flex items-center justify-between mb-6">
            <h3 class="font-bold text-lg">Backup Database</h3>
            <button
              class="btn btn-sm btn-circle btn-ghost"
              @click=${this.handleClose}
              ?disabled=${this.isLoading}
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Modal Content -->
          <form @submit=${(e: Event) => { e.preventDefault(); this.handleBackup(); }}>
            <div class="space-y-4">
              <!-- Database Selection -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Database <span class="text-red-500">*</span>
                </label>
                <select
                  class="w-full px-3 py-2 border ${this.errorMessage && !this.formData.databaseName ? 'border-red-300' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  .value=${this.formData.databaseName}
                  @change=${(e: Event) => this.handleDatabaseChange((e.target as HTMLSelectElement).value)}
                  ?disabled=${this.isLoading || databasePreSelected}
                >
                  ${!this.formData.databaseName ? html`<option value="">Select a database...</option>` : ''}
                  ${this.availableDatabases.map(
                    (db) => html`<option value=${db} ?selected=${db === this.formData.databaseName}>${db}</option>`
                  )}
                </select>
                ${this.availableDatabases.length === 0
                  ? html`<p class="text-xs text-warning mt-1">No databases available. Ensure you are connected to a server.</p>`
                  : ''}
              </div>

              <!-- Backup Name -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Backup Name <span class="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  class="w-full px-3 py-2 border ${this.errorMessage && !this.formData.backupName.trim() ? 'border-red-300' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter backup filename"
                  .value=${this.formData.backupName}
                  @input=${(e: Event) => this.handleInputChange('backupName', (e.target as HTMLInputElement).value)}
                  ?disabled=${this.isLoading}
                  autocomplete="off"
                />
                <p class="text-xs text-gray-500 mt-1">.sdb extension added if not provided</p>
              </div>

              <!-- Compression -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Compression</label>
                <select
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  .value=${this.formData.compression}
                  @change=${(e: Event) => this.handleInputChange('compression', (e.target as HTMLSelectElement).value)}
                  ?disabled=${this.isLoading}
                >
                  <option value="gzip" ?selected=${this.formData.compression === 'gzip'}>gzip (default)</option>
                  <option value="zstd" ?selected=${this.formData.compression === 'zstd'}>zstd</option>
                  <option value="none" ?selected=${this.formData.compression === 'none'}>none</option>
                </select>
              </div>

              <!-- Checkboxes -->
              <div class="flex flex-col gap-3">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    class="checkbox checkbox-sm"
                    .checked=${this.formData.includeIndexes}
                    @change=${(e: Event) => this.handleInputChange('includeIndexes', (e.target as HTMLInputElement).checked)}
                    ?disabled=${this.isLoading}
                  />
                  <span class="text-sm">Include indexes</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    class="checkbox checkbox-sm"
                    .checked=${this.formData.lockDatabase}
                    @change=${(e: Event) => this.handleInputChange('lockDatabase', (e.target as HTMLInputElement).checked)}
                    ?disabled=${this.isLoading}
                  />
                  <span class="text-sm">Lock database during backup <span class="text-gray-500">(recommended)</span></span>
                </label>
              </div>
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
              <button
                type="button"
                class="btn btn-ghost"
                @click=${this.handleClose}
                ?disabled=${this.isLoading}
              >
                ${this.backupComplete ? 'Close' : 'Cancel'}
              </button>
              ${!this.backupComplete
                ? html`
                    <button
                      type="submit"
                      class="btn btn-primary ${this.isLoading ? 'loading' : ''}"
                      ?disabled=${this.isLoading || !this.formData.databaseName || !this.formData.backupName.trim()}
                    >
                      ${this.isLoading ? 'Backing up...' : 'Start Backup'}
                    </button>
                  `
                : ''}
            </div>
          </form>
        </div>
        <div class="modal-backdrop" @click=${this.handleClose}></div>
      </div>
    `;
  }
}
