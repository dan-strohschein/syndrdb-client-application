/**
 * Plugin discovery and loading for the export system.
 * Scans built-in exporters and user plugin directories.
 * Runs in the main process.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type {
  ExporterPlugin,
  ExporterPluginManifest,
} from '../tools/exporter/types/exporter-plugin';
import { jsonExporter } from './exporters/json-exporter';

const USER_PLUGIN_DIR = path.join(os.homedir(), '.syndrdb', 'plugins', 'exporters');

/**
 * Validate that an object conforms to the ExporterPlugin interface (duck-typing).
 */
function isValidPlugin(obj: unknown): obj is ExporterPlugin {
  if (!obj || typeof obj !== 'object') return false;
  const p = obj as Record<string, unknown>;
  if (!p.manifest || typeof p.manifest !== 'object') return false;
  const m = p.manifest as Record<string, unknown>;
  if (typeof m.id !== 'string' || typeof m.name !== 'string') return false;
  if (typeof m.fileExtension !== 'string') return false;
  if (typeof p.beginExport !== 'function') return false;
  if (typeof p.writeBatch !== 'function') return false;
  if (typeof p.endExport !== 'function') return false;
  if (typeof p.validateConfig !== 'function') return false;
  return true;
}

export class ExporterPluginLoader {
  private plugins: Map<string, ExporterPlugin> = new Map();

  constructor() {
    this.loadBuiltinPlugins();
  }

  /** Load built-in plugins shipped with the app */
  private loadBuiltinPlugins(): void {
    this.plugins.set(jsonExporter.manifest.id, jsonExporter);
    console.log(`Loaded built-in exporter plugin: ${jsonExporter.manifest.name}`);
  }

  /** Scan user plugin directory and load valid plugins */
  async loadUserPlugins(): Promise<void> {
    if (!fs.existsSync(USER_PLUGIN_DIR)) {
      console.log(`User exporter plugin directory does not exist: ${USER_PLUGIN_DIR}`);
      return;
    }

    const entries = fs.readdirSync(USER_PLUGIN_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const pluginDir = path.join(USER_PLUGIN_DIR, entry.name);
      const indexPath = path.join(pluginDir, 'index.js');

      if (!fs.existsSync(indexPath)) {
        console.warn(`Exporter plugin directory ${entry.name} missing index.js, skipping`);
        continue;
      }

      try {
        const module = require(indexPath);
        const plugin = module.default || module;

        if (isValidPlugin(plugin)) {
          this.plugins.set(plugin.manifest.id, plugin);
          console.log(`Loaded user exporter plugin: ${plugin.manifest.name}`);
        } else {
          console.warn(`Exporter plugin ${entry.name} does not conform to ExporterPlugin interface, skipping`);
        }
      } catch (error) {
        console.error(`Failed to load exporter plugin ${entry.name}:`, error);
      }
    }
  }

  /** Get all loaded plugin manifests (safe to send over IPC) */
  getManifests(): ExporterPluginManifest[] {
    return Array.from(this.plugins.values()).map((p) => p.manifest);
  }

  /** Get a specific plugin by ID */
  getPlugin(pluginId: string): ExporterPlugin | undefined {
    return this.plugins.get(pluginId);
  }
}
