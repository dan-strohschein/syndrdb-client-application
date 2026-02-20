import { html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { connectionManager } from '../../services/connection-manager';
import type { ConnectionConfig } from '../../drivers/syndrdb-driver';
import type { SessionInfo, SessionDetail } from './session-manager-types';
import './session-connection-picker';
import './session-list-view';
import './session-detail-view';

@customElement('session-manager-tab')
export class SessionManagerTab extends LitElement {
  createRenderRoot() { return this; }

  @property({ type: Boolean })
  isActive = false;

  /** Main-process TCP connection ID used for the monitor stream */
  @state()
  private monitorConnectionId = '';

  @state()
  private connected = false;

  @state()
  private loading = false;

  @state()
  private error = '';

  @state()
  private sessions: SessionInfo[] = [];

  @state()
  private sessionDetail: SessionDetail | null = null;

  @state()
  private view: 'list' | 'detail' = 'list';

  @state()
  private lastSnapshotTime = '';

  @state()
  private monitorInterval = 1000;

  /** True when data exists but the monitor stream has been stopped */
  @state()
  private stale = false;

  /** Bound handler references for cleanup */
  private snapshotHandler = (data: { connectionId: string; timestamp: number; data: unknown }) => {
    if (data.connectionId !== this.monitorConnectionId) return;
    this.lastSnapshotTime = new Date(data.timestamp).toLocaleTimeString();
    this.processSnapshot(data.data);
  };

  private stoppedHandler = (data: { connectionId: string }) => {
    if (data.connectionId !== this.monitorConnectionId) return;
    console.log('Session monitor stopped by server');
  };

  disconnectedCallback() {
    super.disconnectedCallback();
    this.cleanupMonitor();
  }

  /**
   * Create a dedicated TCP connection directly via the electron API.
   * This bypasses the connection manager entirely so:
   * - nothing appears in the sidebar
   * - the user's real connection stays free for normal queries
   */
  private async createDedicatedConnection(cfg: ConnectionConfig): Promise<string> {
    const api = window.electronAPI?.syndrdb;
    if (!api) throw new Error('Electron API not available');

    const result = await api.connect(cfg);
    if (!result.success || !result.connectionId) {
      throw new Error(result.error || 'Failed to create dedicated monitor connection');
    }
    return result.connectionId;
  }

  private async handleConnect(e: CustomEvent) {
    const { mode, connectionId, config, interval } = e.detail;
    this.loading = true;
    this.error = '';
    this.stale = false;
    this.monitorInterval = interval || 1000;

    try {
      let connConfig: ConnectionConfig;

      if (mode === 'existing') {
        // Clone the existing connection's config for a dedicated socket
        const existingConn = connectionManager.getConnection(connectionId);
        if (!existingConn) throw new Error('Connection not found');
        connConfig = {
          name: `Session Monitor - ${existingConn.config.hostname}:${existingConn.config.port}`,
          hostname: existingConn.config.hostname,
          port: existingConn.config.port,
          database: existingConn.config.database || 'primary',
          username: existingConn.config.username,
          password: existingConn.config.password
        };
      } else {
        connConfig = {
          name: config.name,
          hostname: config.hostname,
          port: config.port,
          database: config.database || 'primary',
          username: config.username,
          password: config.password
        };
      }

      // Open a dedicated TCP connection that only the monitor uses.
      // Goes straight through electron IPC — never touches the connection manager.
      this.monitorConnectionId = await this.createDedicatedConnection(connConfig);

      // Set up IPC listeners
      this.setupMonitorListeners();

      // Start monitoring all sessions
      await this.startSessionsMonitor();
      this.connected = true;
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Connection failed';
      this.connected = false;
      // If we got a connection but the monitor command failed, tear it down
      if (this.monitorConnectionId) {
        try { await window.electronAPI?.syndrdb.disconnect(this.monitorConnectionId); } catch { /* ignore */ }
        this.monitorConnectionId = '';
      }
    } finally {
      this.loading = false;
    }
  }

  private async handleDisconnect() {
    await this.cleanupMonitor();
    this.connected = false;
    // Keep existing data visible but mark as stale
    if (this.sessions.length > 0 || this.sessionDetail) {
      this.stale = true;
    }
    this.error = '';
  }

  private handleClear() {
    this.sessions = [];
    this.sessionDetail = null;
    this.view = 'list';
    this.lastSnapshotTime = '';
    this.stale = false;
  }

  private handleIntervalChanged(e: CustomEvent) {
    this.monitorInterval = e.detail.interval;
  }

  private async handleSessionSelected(e: CustomEvent) {
    const { sessionId } = e.detail;
    this.loading = true;
    this.sessionDetail = null;
    this.view = 'detail';

    try {
      // Stop current all-sessions monitor
      await this.stopCurrentMonitor();
      // Start single-session monitor
      await this.startSingleSessionMonitor(sessionId);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to monitor session';
    } finally {
      this.loading = false;
    }
  }

  private async handleDetailBack() {
    if (this.stale) {
      // Not live — just switch back to list view without restarting monitor
      this.sessionDetail = null;
      this.view = 'list';
      return;
    }

    this.loading = true;
    this.sessionDetail = null;
    this.view = 'list';

    try {
      await this.stopCurrentMonitor();
      await this.startSessionsMonitor();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to restart sessions monitor';
    } finally {
      this.loading = false;
    }
  }

  private setupMonitorListeners() {
    const api = window.electronAPI?.syndrdb;
    if (!api) return;
    api.onMonitorSnapshot(this.snapshotHandler);
    api.onMonitorStopped(this.stoppedHandler);
  }

  private removeMonitorListeners() {
    const api = window.electronAPI?.syndrdb;
    if (!api) return;
    api.removeMonitorListeners();
  }

  private async startSessionsMonitor() {
    const api = window.electronAPI?.syndrdb;
    if (!api || !this.monitorConnectionId) return;
    const command = `MONITOR SESSIONS INTERVAL ${this.monitorInterval};`;
    const result = await api.startMonitor(this.monitorConnectionId, command);
    if (!result.success) {
      throw new Error(result.error || 'Failed to start monitor');
    }
  }

  private async startSingleSessionMonitor(sessionId: string) {
    const api = window.electronAPI?.syndrdb;
    if (!api || !this.monitorConnectionId) return;
    const command = `MONITOR SESSION "${sessionId}" INTERVAL ${this.monitorInterval};`;
    const result = await api.startMonitor(this.monitorConnectionId, command);
    if (!result.success) {
      throw new Error(result.error || 'Failed to start session monitor');
    }
  }

  private async stopCurrentMonitor() {
    const api = window.electronAPI?.syndrdb;
    if (!api || !this.monitorConnectionId) return;
    await api.stopMonitor(this.monitorConnectionId);
  }

  async cleanupMonitor() {
    try {
      await this.stopCurrentMonitor();
    } catch { /* ignore */ }
    this.removeMonitorListeners();
    // Tear down the dedicated TCP connection directly via electron API
    if (this.monitorConnectionId) {
      try {
        await window.electronAPI?.syndrdb.disconnect(this.monitorConnectionId);
      } catch { /* ignore */ }
    }
    this.monitorConnectionId = '';
  }

  private processSnapshot(data: unknown) {
    if (this.view === 'list') {
      // Expect an array of sessions
      if (Array.isArray(data)) {
        this.sessions = data as SessionInfo[];
      } else if (data && typeof data === 'object') {
        // Might be wrapped in a result object
        const obj = data as Record<string, unknown>;
        if (Array.isArray(obj.sessions)) {
          this.sessions = obj.sessions as SessionInfo[];
        } else if (Array.isArray(obj.Result)) {
          this.sessions = obj.Result as SessionInfo[];
        }
      }
    } else if (this.view === 'detail') {
      // Server may send a single object or a one-element array
      let detail: unknown = data;

      // Unwrap single-element arrays
      if (Array.isArray(detail)) {
        detail = detail.length > 0 ? detail[0] : null;
      }

      if (detail && typeof detail === 'object') {
        const obj = detail as Record<string, unknown>;
        if (obj.session_id) {
          this.sessionDetail = detail as SessionDetail;
        } else if (obj.Result && typeof obj.Result === 'object') {
          this.sessionDetail = obj.Result as SessionDetail;
        }
      }
    }
  }

  render() {
    return html`
      <div class="h-full flex flex-col">
        <session-connection-picker
          .connected=${this.connected}
          .loading=${this.loading}
          .monitorInterval=${this.monitorInterval}
          .lastSnapshotTime=${this.lastSnapshotTime}
          .stale=${this.stale}
          .hasData=${this.sessions.length > 0 || this.sessionDetail !== null}
          @session-connect=${this.handleConnect}
          @session-disconnect=${this.handleDisconnect}
          @session-interval-changed=${this.handleIntervalChanged}
          @session-clear=${this.handleClear}
        ></session-connection-picker>

        ${this.view === 'detail'
          ? html`<session-detail-view
                   class="flex-1 min-h-0"
                   .session=${this.sessionDetail}
                   .loading=${this.loading}
                   .stale=${this.stale}
                   @session-detail-back=${this.handleDetailBack}
                 ></session-detail-view>`
          : html`<session-list-view
                   class="flex-1 min-h-0"
                   .sessions=${this.sessions}
                   .loading=${this.loading}
                   .connected=${this.connected}
                   .stale=${this.stale}
                   .error=${this.error}
                   @session-selected=${this.handleSessionSelected}
                 ></session-list-view>`
        }
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'session-manager-tab': SessionManagerTab;
  }
}
