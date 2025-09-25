import { html, css, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { connectionManager } from '../services/connection-manager';
import { ConnectionConfig } from '../drivers/syndrdb-driver';

@customElement('connection-modal')
export class ConnectionModal extends LitElement {
  // Disable Shadow DOM to allow global Tailwind CSS
  createRenderRoot() {
    return this;
  }

  @property({ type: Boolean })
  open = false;

  @property({ type: Boolean })
  editMode = false;

  @property({ type: Object })
  connectionToEdit: any = null;

  // Add debugging for when open property changes
  updated(changedProperties: Map<string, any>) {
    if (changedProperties.has('open')) {
      console.log('Modal open property changed to:', this.open);
      
      // If opening in edit mode, prepopulate the form
      if (this.open && this.editMode && this.connectionToEdit) {
        this.prepopulateForm();
      }
    }
    
    if (changedProperties.has('connectionToEdit') && this.connectionToEdit) {
      console.log('Connection to edit changed:', this.connectionToEdit);
      if (this.open && this.editMode) {
        this.prepopulateForm();
      }
    }
  }

  @state()
  private formData = {
    name: '',
    hostname: '',
    port: '',
    database: '',
    username: '',
    password: ''
  };

  @state()
  private testing = false;

  @state()
  private testResult = '';

  private prepopulateForm() {
    if (this.connectionToEdit && this.connectionToEdit.config) {
      console.log('Prepopulating form with connection data:', this.connectionToEdit.config);
      this.formData = {
        name: this.connectionToEdit.config.name || this.connectionToEdit.name || '',
        hostname: this.connectionToEdit.config.hostname || '',
        port: this.connectionToEdit.config.port || '1776',
        database: this.connectionToEdit.config.database || '',
        username: this.connectionToEdit.config.username || '',
        password: this.connectionToEdit.config.password || ''
      };
      
      // Force a re-render to update the input fields
      this.requestUpdate();
    }
  }

  private handleInputChange(field: string, value: string) {
    this.formData = {
      ...this.formData,
      [field]: value
    };
  }

  private async handleTestConnection() {
    this.testing = true;
    this.testResult = '';
    
    try {
      // Create connection config from form data
      const config: ConnectionConfig = {
        name: this.formData.name || 'Test Connection',
        hostname: this.formData.hostname,
        port: this.formData.port || '1776',
        database: this.formData.database,
        username: this.formData.username,
        password: this.formData.password
      };

      // Test the connection using the connection manager
      const success = await connectionManager.testConnection(config);
      this.testResult = success ? 'success' : 'error';
      
    } catch (error) {
      console.error('Connection test failed:', error);
      this.testResult = 'error';
    }
    
    this.testing = false;
  }

  private async handleSave() {
    try {
      // Create connection config from form data
      const config: ConnectionConfig = {
        name: this.formData.name || (this.editMode ? 'Edited Connection' : 'New Connection'),
        hostname: this.formData.hostname,
        port: this.formData.port || '1776',
        database: this.formData.database,
        username: this.formData.username,
        password: this.formData.password
      };

      // Check if electronAPI is available
      const electronAPI = (window as any).electronAPI;
      if (!electronAPI?.connectionStorage) {
        throw new Error('Connection storage service not available');
      }

      // For edit mode, use overwrite to replace the existing connection
      const saveResult = this.editMode 
        ? await electronAPI.connectionStorage.overwrite(config)
        : await electronAPI.connectionStorage.save(config);
      
      if (!saveResult.success) {
        if (saveResult.connectionExists) {
          // Connection with this name already exists, ask user if they want to overwrite
          const userConfirmed = confirm(
            `A connection with the name "${config.name}" already exists. Do you want to overwrite it?`
          );
          
          if (userConfirmed) {
            // User confirmed overwrite
            const overwriteResult = await electronAPI.connectionStorage.overwrite(config);
            if (!overwriteResult.success) {
              throw new Error(overwriteResult.error || 'Failed to overwrite connection');
            }
          } else {
            // User cancelled, don't save
            return;
          }
        } else {
          // Other error
          throw new Error(saveResult.error || 'Failed to save connection');
        }
      }

      // Add the connection to the connection manager for immediate use
      const connectionId = await connectionManager.addConnection(config);
      
      // Emit event with connection ID for the parent component
      this.dispatchEvent(new CustomEvent('save-connection', {
        detail: { connectionId, config },
        bubbles: true
      }));
      
      this.handleClose();
      
    } catch (error) {
      console.error('Failed to save connection:', error);
      alert(`Failed to save connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private handleClose() {
    this.open = false;
    this.editMode = false;
    this.connectionToEdit = null;
    this.testResult = '';
    this.formData = {
      name: '',
      hostname: '',
      port: '',
      database: '',
      username: '',
      password: ''
    };
    
    this.dispatchEvent(new CustomEvent('close-modal', {
      bubbles: true
    }));
  }

  render() {
    return html`
      <div class="modal ${this.open ? 'modal-open' : ''}">
        <div class="modal-box w-11/12 max-w-2xl">
          <!-- Modal Header -->
          <div class="flex items-center justify-between mb-6">
            <h3 class="font-bold text-lg">${this.editMode ? 'Edit Database Connection' : 'New Database Connection'}</h3>
            <button class="btn btn-sm btn-circle btn-ghost" @click=${this.handleClose}>
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Connection Form -->
          <div class="space-y-4">
            <!-- Connection Name -->
            <div class="form-control">
              <label class="label">
                <span class="label-text font-semibold">Connection Name</span>
              </label>
              <input 
                type="text" 
                placeholder="My SyndrDB Connection" 
                class="input input-bordered w-full"
                .value=${this.formData.name}
                @input=${(e: any) => this.handleInputChange('name', e.target.value)}
              />
            </div>

            <!-- Host and Port Row -->
            <div class="grid grid-cols-3 gap-4">
              <div class="form-control col-span-2">
                <label class="label">
                  <span class="label-text font-semibold">Hostname / IP Address</span>
                </label>
                <input 
                  type="text" 
                  placeholder="localhost or 192.168.1.100" 
                  class="input input-bordered w-full"
                  .value=${this.formData.hostname}
                  @input=${(e: any) => this.handleInputChange('hostname', e.target.value)}
                />
              </div>
              
              <div class="form-control">
                <label class="label">
                  <span class="label-text font-semibold">Port</span>
                </label>
                <input 
                  type="text" 
                  placeholder="5432" 
                  class="input input-bordered w-full"
                  .value=${this.formData.port}
                  @input=${(e: any) => this.handleInputChange('port', e.target.value)}
                />
              </div>
            </div>

            <!-- Database Name -->
            <div class="form-control">
              <label class="label">
                <span class="label-text font-semibold">Database Name</span>
              </label>
              <input 
                type="text" 
                placeholder="syndrdb_main" 
                class="input input-bordered w-full"
                .value=${this.formData.database}
                @input=${(e: any) => this.handleInputChange('database', e.target.value)}
              />
            </div>

            <!-- Username and Password Row -->
            <div class="grid grid-cols-2 gap-4">
              <div class="form-control">
                <label class="label">
                  <span class="label-text font-semibold">Username</span>
                </label>
                <input 
                  type="text" 
                  placeholder="admin" 
                  class="input input-bordered w-full"
                  .value=${this.formData.username}
                  @input=${(e: any) => this.handleInputChange('username', e.target.value)}
                />
              </div>
              
              <div class="form-control">
                <label class="label">
                  <span class="label-text font-semibold">Password</span>
                </label>
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  class="input input-bordered w-full"
                  .value=${this.formData.password}
                  @input=${(e: any) => this.handleInputChange('password', e.target.value)}
                />
              </div>
            </div>

            <!-- Test Connection Section -->
            <div class="divider">Connection Test</div>
            
            <div class="flex items-center space-x-4">
              <button 
                class="btn btn-outline btn-info ${this.testing ? 'loading' : ''}"
                @click=${this.handleTestConnection}
                ?disabled=${this.testing || !this.formData.hostname || !this.formData.port}
              >
                ${this.testing ? 'Testing...' : 'Test Connection'}
              </button>
              
              ${this.testResult === 'success' ? html`
                <div class="alert alert-success py-2 px-4">
                  <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Connection successful!</span>
                </div>
              ` : ''}
              
              ${this.testResult === 'error' ? html`
                <div class="alert alert-error py-2 px-4">
                  <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Connection failed. Please check your settings.</span>
                </div>
              ` : ''}
            </div>
          </div>

          <!-- Modal Actions -->
          <div class="modal-action">
            <button class="btn btn-ghost" @click=${this.handleClose}>
              Cancel
            </button>
                        <button
              type="button"
              class="btn btn-primary"
              @click=${this.handleSave}
              ?disabled=${!this.formData.name || !this.formData.hostname || !this.formData.port}
            >
              ${this.editMode ? 'Update Connection' : 'Save Connection'}
            </button>
          </div>
        </div>
        
        <!-- Modal backdrop -->
        <div class="modal-backdrop" @click=${this.handleClose}></div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'connection-modal': ConnectionModal;
  }
}
