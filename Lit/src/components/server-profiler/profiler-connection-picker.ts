import { html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { connectionManager, Connection } from '../../services/connection-manager';

type ConnectionMode = 'existing' | 'new';

@customElement('profiler-connection-picker')
export class ProfilerConnectionPicker extends LitElement {
  createRenderRoot() { return this; }

  @property({ type: Boolean })
  connected = false;

  @property({ type: Boolean })
  loading = false;

  @property({ type: Number })
  autoRefreshInterval = 10;

  @property({ type: Boolean })
  autoRefreshEnabled = true;

  @property({ type: String })
  lastRefreshed = '';

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

  private handleConnect() {
    if (this.mode === 'existing') {
      if (!this.selectedConnectionId) return;
      this.dispatchEvent(new CustomEvent('profiler-connect', {
        bubbles: true, composed: true,
        detail: { mode: 'existing', connectionId: this.selectedConnectionId }
      }));
    } else {
      const { hostname, port, username, password } = this.newConnectionForm;
      if (!hostname || !port) return;
      this.dispatchEvent(new CustomEvent('profiler-connect', {
        bubbles: true, composed: true,
        detail: { mode: 'new', config: { hostname, port, username, password, name: `Profiler - ${hostname}:${port}` } }
      }));
    }
  }

  private handleDisconnect() {
    this.dispatchEvent(new CustomEvent('profiler-disconnect', {
      bubbles: true, composed: true
    }));
  }

  private handleRefreshNow() {
    this.dispatchEvent(new CustomEvent('profiler-refresh', {
      bubbles: true, composed: true
    }));
  }

  private handleAutoRefreshToggle() {
    this.dispatchEvent(new CustomEvent('auto-refresh-changed', {
      bubbles: true, composed: true,
      detail: { enabled: !this.autoRefreshEnabled, interval: this.autoRefreshInterval }
    }));
  }

  private handleIntervalChange(e: Event) {
    const interval = parseInt((e.target as HTMLSelectElement).value, 10);
    this.dispatchEvent(new CustomEvent('auto-refresh-changed', {
      bubbles: true, composed: true,
      detail: { enabled: this.autoRefreshEnabled, interval }
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
            <!-- Existing connection dropdown -->
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
            <!-- New connection inline form -->
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

          <!-- Connect / Disconnect button -->
          ${this.connected
            ? html`<button class="btn btn-sm btn-error" @click=${this.handleDisconnect}>
                      <i class="fa-solid fa-stop mr-1"></i> Stop Profiling
                    </button>`
            : html`<button class="btn btn-sm btn-success" @click=${this.handleConnect}
                           ?disabled=${!this.canConnect || this.loading}>
                      ${this.loading
                        ? html`<span class="loading loading-spinner loading-xs"></span>`
                        : html`<i class="fa-solid fa-play mr-1"></i>`}
                      Connect & Profile
                    </button>`
          }

          <!-- Separator -->
          ${this.connected ? html`
            <div class="divider divider-horizontal mx-1"></div>

            <!-- Refresh controls -->
            <button class="btn btn-sm btn-ghost" @click=${this.handleRefreshNow}
                    ?disabled=${this.loading} title="Refresh Now">
              <i class="fa-solid fa-rotate ${this.loading ? 'fa-spin' : ''}"></i>
            </button>

            <label class="label cursor-pointer gap-2">
              <span class="label-text text-xs">Auto-refresh</span>
              <input type="checkbox" class="toggle toggle-sm toggle-primary"
                     .checked=${this.autoRefreshEnabled}
                     @change=${this.handleAutoRefreshToggle} />
            </label>

            <select class="select select-sm select-bordered w-20"
                    .value=${String(this.autoRefreshInterval)}
                    @change=${this.handleIntervalChange}>
              <option value="5">5s</option>
              <option value="10">10s</option>
              <option value="30">30s</option>
              <option value="60">1m</option>
            </select>

            ${this.lastRefreshed ? html`
              <span class="text-xs text-base-content/60">
                Last: ${this.lastRefreshed}
              </span>
            ` : ''}
          ` : ''}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'profiler-connection-picker': ProfilerConnectionPicker;
  }
}
