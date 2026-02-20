import { html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { connectionManager, Connection } from '../../services/connection-manager';

type ConnectionMode = 'existing' | 'new';

@customElement('session-connection-picker')
export class SessionConnectionPicker extends LitElement {
  createRenderRoot() { return this; }

  @property({ type: Boolean })
  connected = false;

  @property({ type: Boolean })
  loading = false;

  @property({ type: Number })
  monitorInterval = 1000;

  @property({ type: String })
  lastSnapshotTime = '';

  @property({ type: Boolean })
  stale = false;

  @property({ type: Boolean })
  hasData = false;

  @state()
  private mode: ConnectionMode = 'existing';

  @state()
  private selectedConnectionId = '';

  @state()
  private availableConnections: Connection[] = [];

  @state()
  private newConnectionForm = {
    hostname: '',
    port: '1776',
    username: '',
    password: ''
  };

  private connectionChangeHandler = () => this.refreshConnectionList();

  connectedCallback() {
    super.connectedCallback();
    this.refreshConnectionList();
    connectionManager.on('connectionStatusChanged', this.connectionChangeHandler);
    connectionManager.on('connectionAdded', this.connectionChangeHandler);
    connectionManager.on('connectionRemoved', this.connectionChangeHandler);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    connectionManager.off('connectionStatusChanged', this.connectionChangeHandler);
    connectionManager.off('connectionAdded', this.connectionChangeHandler);
    connectionManager.off('connectionRemoved', this.connectionChangeHandler);
  }

  private refreshConnectionList() {
    this.availableConnections = connectionManager.getConnections()
      .filter(c => c.status === 'connected');
  }

  private handleModeChange(newMode: ConnectionMode) {
    this.mode = newMode;
  }

  private handleExistingConnectionSelect(e: Event) {
    this.selectedConnectionId = (e.target as HTMLSelectElement).value;
  }

  private handleNewFormChange(field: string, value: string) {
    this.newConnectionForm = { ...this.newConnectionForm, [field]: value };
  }

  private handleIntervalChange(e: Event) {
    const ms = parseInt((e.target as HTMLSelectElement).value, 10);
    this.dispatchEvent(new CustomEvent('session-interval-changed', {
      bubbles: true, composed: true,
      detail: { interval: ms }
    }));
  }

  private handleConnect() {
    if (this.mode === 'existing') {
      if (!this.selectedConnectionId) return;
      this.dispatchEvent(new CustomEvent('session-connect', {
        bubbles: true, composed: true,
        detail: { mode: 'existing', connectionId: this.selectedConnectionId, interval: this.monitorInterval }
      }));
    } else {
      const { hostname, port, username, password } = this.newConnectionForm;
      if (!hostname || !port) return;
      this.dispatchEvent(new CustomEvent('session-connect', {
        bubbles: true, composed: true,
        detail: {
          mode: 'new',
          config: { hostname, port, username, password, name: `Session Monitor - ${hostname}:${port}` },
          interval: this.monitorInterval
        }
      }));
    }
  }

  private handleDisconnect() {
    this.dispatchEvent(new CustomEvent('session-disconnect', {
      bubbles: true, composed: true
    }));
  }

  private handleClear() {
    this.dispatchEvent(new CustomEvent('session-clear', {
      bubbles: true, composed: true
    }));
  }

  private get canConnect(): boolean {
    if (this.mode === 'existing') return !!this.selectedConnectionId;
    return !!this.newConnectionForm.hostname && !!this.newConnectionForm.port;
  }

  render() {
    return html`
      <div class="bg-base-200 border-b border-base-300 p-3">
        <div class="flex items-center gap-3 flex-wrap">
          <!-- Connection mode toggle -->
          <div class="join">
            <button class="join-item btn btn-sm ${this.mode === 'existing' ? 'btn-primary' : 'btn-ghost'}"
                    @click=${() => this.handleModeChange('existing')}
                    ?disabled=${this.connected}>
              Existing Connection
            </button>
            <button class="join-item btn btn-sm ${this.mode === 'new' ? 'btn-primary' : 'btn-ghost'}"
                    @click=${() => this.handleModeChange('new')}
                    ?disabled=${this.connected}>
              New Connection
            </button>
          </div>

          ${this.mode === 'existing' ? html`
            <select class="select select-sm select-bordered w-64"
                    .value=${this.selectedConnectionId}
                    @change=${this.handleExistingConnectionSelect}
                    ?disabled=${this.connected}>
              <option value="">Select a connection...</option>
              ${this.availableConnections.map(conn => html`
                <option value=${conn.id}>${conn.name} (${conn.config.hostname}:${conn.config.port})</option>
              `)}
            </select>
          ` : html`
            <input type="text" placeholder="Hostname" class="input input-sm input-bordered w-36"
                   .value=${this.newConnectionForm.hostname}
                   @input=${(e: Event) => this.handleNewFormChange('hostname', (e.target as HTMLInputElement).value)}
                   ?disabled=${this.connected} />
            <input type="text" placeholder="Port" class="input input-sm input-bordered w-20"
                   .value=${this.newConnectionForm.port}
                   @input=${(e: Event) => this.handleNewFormChange('port', (e.target as HTMLInputElement).value)}
                   ?disabled=${this.connected} />
            <input type="text" placeholder="Username" class="input input-sm input-bordered w-28"
                   .value=${this.newConnectionForm.username}
                   @input=${(e: Event) => this.handleNewFormChange('username', (e.target as HTMLInputElement).value)}
                   ?disabled=${this.connected} />
            <input type="password" placeholder="Password" class="input input-sm input-bordered w-28"
                   .value=${this.newConnectionForm.password}
                   @input=${(e: Event) => this.handleNewFormChange('password', (e.target as HTMLInputElement).value)}
                   ?disabled=${this.connected} />
          `}

          <!-- Interval selector -->
          <select class="select select-sm select-bordered w-24"
                  .value=${String(this.monitorInterval)}
                  @change=${this.handleIntervalChange}
                  ?disabled=${this.connected}>
            <option value="250">250ms</option>
            <option value="500">500ms</option>
            <option value="1000">1s</option>
            <option value="2000">2s</option>
            <option value="5000">5s</option>
          </select>

          <!-- Connect / Disconnect button -->
          ${this.connected
            ? html`<button class="btn btn-sm btn-error" @click=${this.handleDisconnect}>
                      <i class="fa-solid fa-stop mr-1"></i> Stop Monitoring
                    </button>`
            : html`<button class="btn btn-sm btn-success" @click=${this.handleConnect}
                           ?disabled=${!this.canConnect || this.loading}>
                      ${this.loading
                        ? html`<span class="loading loading-spinner loading-xs"></span>`
                        : html`<i class="fa-solid fa-play mr-1"></i>`}
                      Start Monitoring
                    </button>`
          }

          <!-- Live indicator -->
          ${this.connected ? html`
            <div class="divider divider-horizontal mx-1"></div>
            <div class="flex items-center gap-2">
              <span class="relative flex h-3 w-3">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                <span class="relative inline-flex rounded-full h-3 w-3 bg-success"></span>
              </span>
              <span class="text-xs text-success font-medium">Live</span>
              ${this.lastSnapshotTime ? html`
                <span class="text-xs text-base-content/60">Last: ${this.lastSnapshotTime}</span>
              ` : ''}
            </div>
          ` : ''}

          <!-- Stale indicator + Clear button (when stopped but data remains) -->
          ${!this.connected && this.stale && this.hasData ? html`
            <div class="divider divider-horizontal mx-1"></div>
            <div class="flex items-center gap-2">
              <span class="relative flex h-3 w-3">
                <span class="relative inline-flex rounded-full h-3 w-3 bg-warning"></span>
              </span>
              <span class="text-xs text-warning font-medium">Stopped</span>
              ${this.lastSnapshotTime ? html`
                <span class="text-xs text-base-content/60">Last snapshot: ${this.lastSnapshotTime}</span>
              ` : ''}
            </div>
            <button class="btn btn-sm btn-ghost btn-square" title="Clear session data" @click=${this.handleClear}>
              <i class="fa-solid fa-trash-can text-base-content/60"></i>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'session-connection-picker': SessionConnectionPicker;
  }
}
