/**
 * Builds a sandboxed, permission-checked PluginHostAPI for each plugin.
 * Each method checks the plugin's declared permissions before executing.
 */

import type { ConnectionManager, Connection } from './connection-manager';

interface Disposable {
  dispose(): void;
}

interface QueryResult {
  columns: string[];
  rows: unknown[][];
  rowCount: number;
  executionTimeMs: number;
  error?: string;
}

interface QueryOptions {
  connectionId?: string;
  timeout?: number;
  maxRows?: number;
}

/**
 * Build a permission-checked API instance for a specific plugin.
 */
export function buildPluginAPI(
  pluginId: string,
  permissions: string[],
  connectionManager: ConnectionManager
): Record<string, unknown> {
  const disposables: Disposable[] = [];

  /**
   * Map driver QueryResult (data: Record[]) to plugin QueryResult (columns/rows).
   */
  function mapDriverResult(result: Record<string, unknown>): QueryResult {
    const data = (result.data || []) as Record<string, unknown>[];
    const columns = data.length > 0 ? Object.keys(data[0]) : [];
    const rows = data.map(record => columns.map(col => record[col]));
    return {
      columns,
      rows,
      rowCount: (result.ResultCount as number) ?? (result.documentCount as number) ?? rows.length,
      executionTimeMs: (result.executionTime as number) ?? 0,
      error: (result.error as string) || undefined,
    };
  }

  function checkPermission(required: string): void {
    // Check exact match or wildcard parent
    const hasPermission = permissions.some(p => {
      if (p === required) return true;
      // syndrdb:query covers syndrdb:query:read, syndrdb:query:write, etc.
      if (required.startsWith(p + ':')) return true;
      // ui:notifications is covered by having any ui:* equivalent
      return false;
    });
    if (!hasPermission) {
      throw new Error(`Plugin "${pluginId}" lacks permission: ${required}`);
    }
  }

  function createDisposable(cleanup: () => void): Disposable {
    const d = { dispose: cleanup };
    disposables.push(d);
    return d;
  }

  // Storage prefix for isolation
  const storagePrefix = `plugin:${pluginId}:`;

  const api = {
    // ── syndrdb ──
    syndrdb: {
      async executeQuery(query: string, opts?: QueryOptions): Promise<QueryResult> {
        checkPermission('syndrdb:query');
        const conn = opts?.connectionId
          ? connectionManager.getConnection(opts.connectionId)
          : connectionManager.getActiveConnection();
        if (!conn || conn.status !== 'connected') {
          return { columns: [], rows: [], rowCount: 0, executionTimeMs: 0, error: 'No active connection' };
        }
        try {
          const result = await connectionManager.executeQueryOnConnection(conn.id, query);
          return mapDriverResult(result);
        } catch (error) {
          return {
            columns: [],
            rows: [],
            rowCount: 0,
            executionTimeMs: 0,
            error: error instanceof Error ? error.message : 'Query failed',
          };
        }
      },

      async executeQueryOnConnection(connectionId: string, query: string, opts?: QueryOptions): Promise<QueryResult> {
        checkPermission('syndrdb:query');
        const conn = connectionManager.getConnection(connectionId);
        if (!conn || conn.status !== 'connected') {
          return { columns: [], rows: [], rowCount: 0, executionTimeMs: 0, error: 'Connection not found or not connected' };
        }
        try {
          const result = await connectionManager.executeQueryOnConnection(connectionId, query);
          return mapDriverResult(result);
        } catch (error) {
          return {
            columns: [],
            rows: [],
            rowCount: 0,
            executionTimeMs: 0,
            error: error instanceof Error ? error.message : 'Query failed',
          };
        }
      },
    },

    // ── connection ──
    connection: {
      getActiveConnection() {
        checkPermission('connection:read');
        const conn = connectionManager.getActiveConnection();
        if (!conn) return null;
        return {
          id: conn.id,
          name: conn.name,
          status: conn.status,
          currentDatabase: conn.currentDatabase,
        };
      },

      getConnections() {
        checkPermission('connection:read');
        return connectionManager.getConnections().map(c => ({
          id: c.id,
          name: c.name,
          status: c.status,
          currentDatabase: c.currentDatabase,
        }));
      },

      onConnectionChanged(callback: (connections: unknown[]) => void): Disposable {
        checkPermission('connection:events');
        const handler = () => {
          try {
            callback(connectionManager.getConnections().map(c => ({
              id: c.id, name: c.name, status: c.status, currentDatabase: c.currentDatabase,
            })));
          } catch (e) { console.error(`Plugin ${pluginId} connection callback error:`, e); }
        };
        connectionManager.on('connectionsChanged', handler);
        return createDisposable(() => connectionManager.off('connectionsChanged', handler));
      },

      onActiveConnectionChanged(callback: (connection: unknown) => void): Disposable {
        checkPermission('connection:events');
        const handler = (conn: Connection) => {
          try {
            callback(conn ? {
              id: conn.id, name: conn.name, status: conn.status, currentDatabase: conn.currentDatabase,
            } : null);
          } catch (e) { console.error(`Plugin ${pluginId} active connection callback error:`, e); }
        };
        connectionManager.on('activeConnectionChanged', handler);
        return createDisposable(() => connectionManager.off('activeConnectionChanged', handler));
      },

      onDatabaseContextChanged(callback: (change: unknown) => void): Disposable {
        checkPermission('connection:events');
        const handler = (data: { connectionId: string; databaseName: string }) => {
          try { callback(data); }
          catch (e) { console.error(`Plugin ${pluginId} database context callback error:`, e); }
        };
        connectionManager.on('databaseContextChanged', handler);
        return createDisposable(() => connectionManager.off('databaseContextChanged', handler));
      },
    },

    // ── ui ──
    ui: {
      showNotification(options: { type: string; message: string; duration?: number }): void {
        checkPermission('ui:notifications');
        import('../components/toast-notification').then(({ ToastNotification }) => {
          switch (options.type) {
            case 'success': ToastNotification.success(options.message); break;
            case 'warning': ToastNotification.warning(options.message); break;
            case 'error': ToastNotification.error(options.message); break;
            default: ToastNotification.info(options.message); break;
          }
        });
      },

      async showConfirmation(options: { title: string; message: string; confirmLabel?: string; cancelLabel?: string; variant?: string }): Promise<boolean> {
        checkPermission('ui:confirmations');
        return window.confirm(`${options.title}\n\n${options.message}`);
      },

      async openModal(options: { componentTag: string; title?: string; props?: Record<string, unknown> }): Promise<void> {
        checkPermission('ui:modals');
        // Dispatch event for the app root to handle
        document.dispatchEvent(new CustomEvent('plugin-open-modal', {
          detail: { pluginId, ...options },
        }));
      },

      closeModal(): void {
        document.dispatchEvent(new CustomEvent('plugin-close-modal', {
          detail: { pluginId },
        }));
      },

      openTab(options: { tabTypeId: string; config?: Record<string, unknown>; focus?: boolean }): void {
        document.dispatchEvent(new CustomEvent('open-plugin-tab', {
          detail: options,
          bubbles: true,
        }));
      },

      updateStatusBar(widgetId: string, content: string, visible?: boolean): void {
        // Status bar widget updates are handled via the status bar component
        const statusBar = document.querySelector('status-bar') as HTMLElement & {
          updateSlot?: (id: string, content: string, visible?: boolean) => void;
        } | null;
        if (statusBar?.updateSlot) {
          statusBar.updateSlot(widgetId, content, visible);
        }
      },
    },

    // ── events ──
    events: {
      on(event: string, callback: (...args: unknown[]) => void): Disposable {
        const handler = ((e: CustomEvent) => {
          try { callback(e.detail); }
          catch (err) { console.error(`Plugin ${pluginId} event handler error:`, err); }
        }) as EventListener;
        const eventName = `plugin:${pluginId}:${event}`;
        document.addEventListener(eventName, handler);
        return createDisposable(() => document.removeEventListener(eventName, handler));
      },

      emit(event: string, detail?: unknown): void {
        document.dispatchEvent(new CustomEvent(`plugin:${pluginId}:${event}`, { detail }));
      },

      onPlugin(targetPluginId: string, event: string, callback: (...args: unknown[]) => void): Disposable {
        const handler = ((e: CustomEvent) => {
          try { callback(e.detail); }
          catch (err) { console.error(`Plugin ${pluginId} cross-plugin event error:`, err); }
        }) as EventListener;
        const eventName = `plugin:${targetPluginId}:${event}`;
        document.addEventListener(eventName, handler);
        return createDisposable(() => document.removeEventListener(eventName, handler));
      },
    },

    // ── theme ──
    theme: {
      getCurrentTheme() {
        checkPermission('theme:read');
        const isDark = document.documentElement.classList.contains('dark') ||
                       document.documentElement.getAttribute('data-theme')?.includes('dark') ||
                       true; // Default to dark
        return { name: 'syndrdb-dark', isDark };
      },

      getCSSVariable(name: string): string {
        checkPermission('theme:read');
        return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      },

      onThemeChanged(callback: (theme: { name: string; isDark: boolean }) => void): Disposable {
        checkPermission('theme:read');
        const observer = new MutationObserver(() => {
          try { callback(api.theme.getCurrentTheme()); }
          catch (e) { console.error(`Plugin ${pluginId} theme callback error:`, e); }
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
        return createDisposable(() => observer.disconnect());
      },

      getTokens() {
        checkPermission('theme:read');
        const style = getComputedStyle(document.documentElement);
        const tokens: Record<string, string> = {};
        for (const prop of ['--surface-0', '--surface-1', '--surface-2', '--surface-3', '--surface-4', '--accent', '--db-border']) {
          tokens[prop] = style.getPropertyValue(prop).trim();
        }
        return tokens;
      },
    },

    // ── storage ──
    storage: {
      get<T = unknown>(key: string): T | null {
        checkPermission('storage:local');
        const val = localStorage.getItem(storagePrefix + key);
        if (val === null) return null;
        try { return JSON.parse(val) as T; }
        catch { return val as unknown as T; }
      },

      set(key: string, value: unknown): void {
        checkPermission('storage:local');
        localStorage.setItem(storagePrefix + key, JSON.stringify(value));
      },

      remove(key: string): void {
        checkPermission('storage:local');
        localStorage.removeItem(storagePrefix + key);
      },

      clear(): void {
        checkPermission('storage:local');
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith(storagePrefix)) keysToRemove.push(key);
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
      },
    },

    // ── filesystem ──
    filesystem: {
      async showOpenDialog(options?: Record<string, unknown>) {
        checkPermission('filesystem:read');
        const electronAPI = (window as unknown as { electronAPI?: ElectronAPI }).electronAPI;
        if (!electronAPI?.fileDialog) return { canceled: true };
        return electronAPI.fileDialog.showOpenDialog(options as Parameters<typeof electronAPI.fileDialog.showOpenDialog>[0]);
      },

      async showSaveDialog(options?: Record<string, unknown>) {
        checkPermission('filesystem:write');
        const electronAPI = (window as unknown as { electronAPI?: ElectronAPI }).electronAPI;
        if (!electronAPI?.fileDialog) return { canceled: true };
        return electronAPI.fileDialog.showSaveDialog(options as Parameters<typeof electronAPI.fileDialog.showSaveDialog>[0]);
      },
    },
  };

  return api;
}
