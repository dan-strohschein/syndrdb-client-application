import { html, LitElement, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { connectionManager } from '../../services/connection-manager';
import { ConnectionConfig } from '../../drivers/syndrdb-driver';
import type { ServerMetric } from './profiler-types';
import { categorizeMetricName, inferMetricType } from './profiler-types';
import './profiler-connection-picker';
import './profiler-metrics-display';

@customElement('server-profiler-tab')
export class ServerProfilerTab extends LitElement {
  createRenderRoot() { return this; }

  @property({ type: String })
  connectionId = '';

  @property({ type: Boolean })
  isActive = false;

  @state()
  private profilerConnectionId = '';

  @state()
  private connected = false;

  @state()
  private loading = false;

  @state()
  private error = '';

  @state()
  private metrics: ServerMetric[] = [];

  @state()
  private autoRefreshEnabled = true;

  @state()
  private autoRefreshInterval = 10;

  @state()
  private lastRefreshed = '';

  /** Whether the profiler created the connection (so we clean it up on disconnect) */
  private isTemporaryConnection = false;

  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  updated(changedProperties: PropertyValues) {
    // Manage auto-refresh based on active state
    if (changedProperties.has('isActive') || changedProperties.has('autoRefreshEnabled') || changedProperties.has('autoRefreshInterval')) {
      this.manageAutoRefresh();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.stopAutoRefresh();
    if (this.isTemporaryConnection && this.profilerConnectionId) {
      connectionManager.disconnect(this.profilerConnectionId).catch(() => {});
    }
  }

  private manageAutoRefresh() {
    this.stopAutoRefresh();
    if (this.connected && this.autoRefreshEnabled && this.isActive) {
      this.refreshTimer = setInterval(() => this.fetchMetrics(), this.autoRefreshInterval * 1000);
    }
  }

  private stopAutoRefresh() {
    if (this.refreshTimer !== null) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private async handleConnect(e: CustomEvent) {
    const { mode, connectionId, config } = e.detail;
    this.loading = true;
    this.error = '';

    try {
      if (mode === 'existing') {
        this.profilerConnectionId = connectionId;
        this.isTemporaryConnection = false;
      } else {
        // Create a new temporary connection
        const connConfig: ConnectionConfig = {
          name: config.name,
          hostname: config.hostname,
          port: config.port,
          database: '',
          username: config.username,
          password: config.password
        };
        const newId = await connectionManager.addConnection(connConfig);
        const success = await connectionManager.connect(newId);
        if (!success) {
          throw new Error('Failed to connect to server');
        }
        this.profilerConnectionId = newId;
        this.isTemporaryConnection = true;
      }

      this.connected = true;
      await this.fetchMetrics();
      this.manageAutoRefresh();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Connection failed';
      this.connected = false;
    } finally {
      this.loading = false;
    }
  }

  private async handleDisconnect() {
    this.stopAutoRefresh();
    if (this.isTemporaryConnection && this.profilerConnectionId) {
      try {
        await connectionManager.disconnect(this.profilerConnectionId);
      } catch { /* ignore */ }
    }
    this.profilerConnectionId = '';
    this.connected = false;
    this.metrics = [];
    this.lastRefreshed = '';
    this.isTemporaryConnection = false;
    this.error = '';
  }

  private handleAutoRefreshChanged(e: CustomEvent) {
    const { enabled, interval } = e.detail;
    this.autoRefreshEnabled = enabled;
    this.autoRefreshInterval = interval;
  }

  async fetchMetrics() {
    if (!this.profilerConnectionId || !this.connected) return;
    this.loading = true;

    try {
      const allMetrics: ServerMetric[] = [];

      // Fetch server stats
      const serverResult = await connectionManager.executeQueryOnConnectionId(
        this.profilerConnectionId,
        'SHOW SERVER STATS;'
      );

      if (serverResult.success && serverResult.data) {
        this.parseMetricsFromResult(serverResult.data, allMetrics);
      }

      // Fetch cache stats
      try {
        const cacheResult = await connectionManager.executeQueryOnConnectionId(
          this.profilerConnectionId,
          'SHOW CACHE STATS;'
        );
        if (cacheResult.success && cacheResult.data) {
          this.parseMetricsFromResult(cacheResult.data, allMetrics);
        }
      } catch {
        // Cache stats might not be available on all versions
      }

      this.metrics = allMetrics;
      this.lastRefreshed = new Date().toLocaleTimeString();
      this.error = '';
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to fetch metrics';
    } finally {
      this.loading = false;
    }
  }

  private parseMetricsFromResult(data: unknown, target: ServerMetric[]) {
    if (Array.isArray(data)) {
      for (const item of data) {
        if (!item || typeof item !== 'object') continue;
        const obj = item as Record<string, unknown>;

        // Detect {Name, Value} row format
        if ('Name' in obj && 'Value' in obj) {
          const name = String(obj.Name);
          const rawValue = obj.Value;
          const metricValue = typeof rawValue === 'number' ? rawValue : String(rawValue ?? '');
          target.push({
            name,
            value: metricValue,
            type: inferMetricType(name, metricValue),
            category: categorizeMetricName(name)
          });
        } else {
          this.parseMetricObject(obj, target);
        }
      }
    } else if (data && typeof data === 'object') {
      this.parseMetricObject(data as Record<string, unknown>, target);
    }
  }

  private parseMetricObject(obj: Record<string, unknown>, target: ServerMetric[]) {
    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) continue;

      // Nested object: recurse WITHOUT prefixing (parent key is likely a wrapper like "Result")
      if (typeof value === 'object' && !Array.isArray(value)) {
        this.parseMetricObject(value as Record<string, unknown>, target);
        continue;
      }

      // Nested array: recurse into each item
      if (Array.isArray(value)) {
        this.parseMetricsFromResult(value, target);
        continue;
      }

      if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
        const metricValue = typeof value === 'number' ? value : String(value);
        target.push({
          name: key,
          value: metricValue,
          type: inferMetricType(key, metricValue),
          category: categorizeMetricName(key)
        });
      }
    }
  }

  render() {
    return html`
      <div class="h-full flex flex-col">
        <profiler-connection-picker
          .connected=${this.connected}
          .loading=${this.loading}
          .autoRefreshInterval=${this.autoRefreshInterval}
          .autoRefreshEnabled=${this.autoRefreshEnabled}
          .lastRefreshed=${this.lastRefreshed}
          @profiler-connect=${this.handleConnect}
          @profiler-disconnect=${this.handleDisconnect}
          @profiler-refresh=${() => this.fetchMetrics()}
          @auto-refresh-changed=${this.handleAutoRefreshChanged}
        ></profiler-connection-picker>

        <profiler-metrics-display
          class="flex-1 min-h-0"
          .metrics=${this.metrics}
          .loading=${this.loading}
          .connected=${this.connected}
          .error=${this.error}
        ></profiler-metrics-display>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'server-profiler-tab': ServerProfilerTab;
  }
}
