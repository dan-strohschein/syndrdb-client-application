/**
 * Plugin Registry - Renderer process singleton that manages visual plugin lifecycle.
 * Discovers plugins via IPC, loads their modules, builds sandboxed APIs, and tracks state.
 */

import type { ElectronAPI } from '../types/electron-api';
import { buildPluginAPI } from './plugin-api-builder';
import { connectionManager } from './connection-manager';

export type PluginState = 'discovered' | 'loading' | 'active' | 'error' | 'disabled';

interface PluginManifest {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  icon: string;
  iconColor?: string;
  permissions: string[];
  contributes: {
    sidebarSections?: SidebarSection[];
    tabTypes?: TabType[];
    menuItems?: MenuItem[];
    commandPalette?: CommandPaletteEntry[];
    statusBarWidgets?: StatusBarWidget[];
    toolbarActions?: ToolbarAction[];
  };
  main: string;
  styles?: string;
}

export interface SidebarSection {
  id: string;
  label: string;
  icon: string;
  iconColor?: string;
  children: SidebarItem[];
}

export interface SidebarItem {
  id: string;
  label: string;
  icon: string;
  iconColor?: string;
  tabTypeId: string;
  config?: Record<string, unknown>;
}

export interface TabType {
  id: string;
  label: string;
  icon: string;
  componentTag: string;
  singleton?: boolean;
}

export interface MenuItem {
  id: string;
  menu: 'tools' | 'database' | 'settings';
  label: string;
  icon: string;
  shortcut?: string;
  separator?: boolean;
  tabTypeId?: string;
  config?: Record<string, unknown>;
  command?: string;
}

export interface CommandPaletteEntry {
  id: string;
  label: string;
  icon?: string;
  keywords?: string[];
  tabTypeId?: string;
  config?: Record<string, unknown>;
  command?: string;
}

export interface StatusBarWidget {
  id: string;
  componentTag: string;
  position?: 'left' | 'right';
  priority?: number;
}

export interface ToolbarAction {
  id: string;
  label: string;
  icon: string;
  tooltip?: string;
  position?: 'left' | 'right';
}

interface PluginModule {
  activate(api: unknown): Promise<void> | void;
  deactivate?(): Promise<void> | void;
}

interface LoadedPlugin {
  manifest: PluginManifest;
  state: PluginState;
  module?: PluginModule;
  error?: string;
  pluginDir: string;
  mainPath: string;
  stylesPath?: string;
}

type RegistryEventCallback = () => void;

class PluginRegistryImpl {
  private plugins: Map<string, LoadedPlugin> = new Map();
  private listeners: Map<string, Set<RegistryEventCallback>> = new Map();
  private _loaded = false;

  get loaded(): boolean {
    return this._loaded;
  }

  /**
   * Initialize: discover and load all plugins.
   */
  async initialize(): Promise<void> {
    const electronAPI = (window as unknown as { electronAPI?: ElectronAPI }).electronAPI;
    if (!electronAPI?.plugins) {
      console.log('Plugins API not available (not running in Electron)');
      this._loaded = true;
      this.emit('pluginsLoaded');
      return;
    }

    try {
      console.log('Discovering visual plugins...');
      const discovered = await electronAPI.plugins.discover();

      for (const plugin of discovered) {
        this.plugins.set(plugin.manifest.id, {
          manifest: plugin.manifest as PluginManifest,
          state: plugin.error ? 'error' : 'discovered',
          error: plugin.error,
          pluginDir: plugin.pluginDir,
          mainPath: plugin.mainPath,
          stylesPath: plugin.stylesPath,
        });
      }

      // Load each discovered plugin
      for (const [id, plugin] of this.plugins) {
        if (plugin.state === 'error') continue;
        await this.loadPlugin(id, electronAPI);
      }

      console.log(`Loaded ${this.getActivePlugins().length} visual plugin(s)`);
    } catch (error) {
      console.error('Failed to discover visual plugins:', error);
    }

    this._loaded = true;
    this.emit('pluginsLoaded');
  }

  /**
   * Load a single plugin: read source, evaluate, build API, activate.
   */
  private async loadPlugin(pluginId: string, electronAPI: ElectronAPI): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return;

    plugin.state = 'loading';
    this.emit('pluginStateChanged');

    try {
      // Inject plugin CSS if present
      if (plugin.stylesPath) {
        try {
          const css = await electronAPI.plugins!.readStyles(plugin.stylesPath);
          if (css) {
            const style = document.createElement('style');
            style.setAttribute('data-plugin', pluginId);
            style.textContent = css;
            document.head.appendChild(style);
          }
        } catch {
          // CSS is optional, continue
        }
      }

      // Read and evaluate the plugin module
      const source = await electronAPI.plugins!.readModule(plugin.mainPath);

      // Evaluate in a sandboxed scope with access to lit and the SDK
      const module = this.evaluateModule(source, pluginId);
      if (!module || typeof module.activate !== 'function') {
        throw new Error('Plugin module must export an activate function');
      }

      plugin.module = module;

      // Build permission-checked API
      const api = buildPluginAPI(pluginId, plugin.manifest.permissions, connectionManager);

      // Activate the plugin
      await module.activate(api);

      plugin.state = 'active';
      this.emit('pluginStateChanged');
    } catch (error) {
      console.error(`Failed to load plugin ${pluginId}:`, error);
      plugin.state = 'error';
      plugin.error = error instanceof Error ? error.message : 'Unknown error';
      this.emit('pluginStateChanged');
    }
  }

  /**
   * Evaluate a CJS plugin module source in a restricted scope.
   * Provides require() for lit and @syndrdb/plugin-sdk peer dependencies.
   */
  private evaluateModule(source: string, pluginId: string): PluginModule {
    const exports: Record<string, unknown> = {};
    const module = { exports };

    // Provide peer dependencies via a restricted require()
    const pluginRequire = (id: string): unknown => {
      if (id === 'lit' || id.startsWith('lit/')) {
        // Return the host app's lit instance
        return require(id);
      }
      if (id === '@syndrdb/plugin-sdk' || id.startsWith('@syndrdb/plugin-sdk/')) {
        // SDK types are compile-time only; base classes are from lit
        // Return a stub that provides createPlugin
        return {
          createPlugin: (def: PluginModule) => def,
          BasePluginPanel: class extends (require('lit').LitElement) {
            createRenderRoot() { return this; }
          },
          BasePluginModal: class extends (require('lit').LitElement) {
            createRenderRoot() { return this; }
          },
        };
      }
      throw new Error(`Plugin ${pluginId}: require("${id}") is not allowed`);
    };

    try {
      const fn = new Function('require', 'module', 'exports', source);
      fn(pluginRequire, module, exports);
    } catch (error) {
      throw new Error(`Failed to evaluate plugin ${pluginId}: ${error}`);
    }

    const result = (module.exports as Record<string, unknown>).default || module.exports;
    return result as PluginModule;
  }

  /**
   * Deactivate and unload a plugin.
   */
  async deactivatePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin || !plugin.module) return;

    try {
      if (plugin.module.deactivate) {
        await plugin.module.deactivate();
      }
    } catch (error) {
      console.error(`Error deactivating plugin ${pluginId}:`, error);
    }

    // Remove injected CSS
    const style = document.querySelector(`style[data-plugin="${pluginId}"]`);
    if (style) style.remove();

    plugin.state = 'disabled';
    plugin.module = undefined;
    this.emit('pluginStateChanged');
  }

  // ── Query methods ──

  getActivePlugins(): LoadedPlugin[] {
    return Array.from(this.plugins.values()).filter(p => p.state === 'active');
  }

  getAllPlugins(): LoadedPlugin[] {
    return Array.from(this.plugins.values());
  }

  getSidebarSections(): Array<SidebarSection & { pluginId: string }> {
    const sections: Array<SidebarSection & { pluginId: string }> = [];
    for (const [id, plugin] of this.plugins) {
      if (plugin.state !== 'active') continue;
      const contributed = plugin.manifest.contributes.sidebarSections;
      if (contributed) {
        for (const section of contributed) {
          sections.push({ ...section, pluginId: id });
        }
      }
    }
    return sections;
  }

  getTabTypes(): Map<string, TabType & { pluginId: string }> {
    const types = new Map<string, TabType & { pluginId: string }>();
    for (const [id, plugin] of this.plugins) {
      if (plugin.state !== 'active') continue;
      const contributed = plugin.manifest.contributes.tabTypes;
      if (contributed) {
        for (const tabType of contributed) {
          types.set(tabType.id, { ...tabType, pluginId: id });
        }
      }
    }
    return types;
  }

  getMenuItems(menu: string): Array<MenuItem & { pluginId: string }> {
    const items: Array<MenuItem & { pluginId: string }> = [];
    for (const [id, plugin] of this.plugins) {
      if (plugin.state !== 'active') continue;
      const contributed = plugin.manifest.contributes.menuItems;
      if (contributed) {
        for (const item of contributed) {
          if (item.menu === menu) {
            items.push({ ...item, pluginId: id });
          }
        }
      }
    }
    return items;
  }

  getCommandPaletteEntries(): Array<CommandPaletteEntry & { pluginId: string }> {
    const entries: Array<CommandPaletteEntry & { pluginId: string }> = [];
    for (const [id, plugin] of this.plugins) {
      if (plugin.state !== 'active') continue;
      const contributed = plugin.manifest.contributes.commandPalette;
      if (contributed) {
        for (const entry of contributed) {
          entries.push({ ...entry, pluginId: id });
        }
      }
    }
    return entries;
  }

  getStatusBarWidgets(): Array<StatusBarWidget & { pluginId: string }> {
    const widgets: Array<StatusBarWidget & { pluginId: string }> = [];
    for (const [id, plugin] of this.plugins) {
      if (plugin.state !== 'active') continue;
      const contributed = plugin.manifest.contributes.statusBarWidgets;
      if (contributed) {
        for (const widget of contributed) {
          widgets.push({ ...widget, pluginId: id });
        }
      }
    }
    return widgets;
  }

  // ── Event system ──

  on(event: string, callback: RegistryEventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: RegistryEventCallback): void {
    this.listeners.get(event)?.delete(callback);
  }

  private emit(event: string): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      for (const cb of callbacks) {
        try { cb(); } catch (e) { console.error('Plugin registry event error:', e); }
      }
    }
  }
}

export const pluginRegistry = new PluginRegistryImpl();
