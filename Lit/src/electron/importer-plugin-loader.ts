/**
 * Plugin discovery and loading for the import system.
 * Scans built-in parsers and user plugin directories.
 * Runs in the main process.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type {
  ImporterPlugin,
  ImporterPluginManifest,
} from '../tools/importer/types/importer-plugin';
import { csvParser } from './parsers/csv-parser';

const USER_PLUGIN_DIR = path.join(os.homedir(), '.syndrdb', 'plugins', 'importers');

/**
 * Validate that an object conforms to the ImporterPlugin interface (duck-typing).
 */
function isValidPlugin(obj: unknown): obj is ImporterPlugin {
  if (!obj || typeof obj !== 'object') return false;
  const p = obj as Record<string, unknown>;
  if (!p.manifest || typeof p.manifest !== 'object') return false;
  const m = p.manifest as Record<string, unknown>;
  if (typeof m.id !== 'string' || typeof m.name !== 'string') return false;
  if (!Array.isArray(m.supportedExtensions)) return false;
  if (typeof p.parsePreview !== 'function') return false;
  if (typeof p.parseStream !== 'function') return false;
  if (typeof p.validateConfig !== 'function') return false;
  return true;
}

export class ImporterPluginLoader {
  private plugins: Map<string, ImporterPlugin> = new Map();

  constructor() {
    this.loadBuiltinPlugins();
  }

  /** Load built-in plugins shipped with the app */
  private loadBuiltinPlugins(): void {
    this.plugins.set(csvParser.manifest.id, csvParser);
    console.log(`Loaded built-in plugin: ${csvParser.manifest.name}`);
  }

  /** Scan user plugin directory and load valid plugins */
  async loadUserPlugins(): Promise<void> {
    if (!fs.existsSync(USER_PLUGIN_DIR)) {
      console.log(`User plugin directory does not exist: ${USER_PLUGIN_DIR}`);
      return;
    }

    const entries = fs.readdirSync(USER_PLUGIN_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const pluginDir = path.join(USER_PLUGIN_DIR, entry.name);
      const indexPath = path.join(pluginDir, 'index.js');

      if (!fs.existsSync(indexPath)) {
        console.warn(`Plugin directory ${entry.name} missing index.js, skipping`);
        continue;
      }

      try {
        const module = require(indexPath);
        const plugin = module.default || module;

        if (isValidPlugin(plugin)) {
          this.plugins.set(plugin.manifest.id, plugin);
          console.log(`Loaded user plugin: ${plugin.manifest.name}`);
        } else {
          console.warn(`Plugin ${entry.name} does not conform to ImporterPlugin interface, skipping`);
        }
      } catch (error) {
        console.error(`Failed to load plugin ${entry.name}:`, error);
      }
    }
  }

  /** Get all loaded plugin manifests (safe to send over IPC) */
  getManifests(): ImporterPluginManifest[] {
    return Array.from(this.plugins.values()).map((p) => p.manifest);
  }

  /** Get a specific plugin by ID */
  getPlugin(pluginId: string): ImporterPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  /** Find plugins that support a given file extension */
  getPluginsForExtension(extension: string): ImporterPluginManifest[] {
    const ext = extension.toLowerCase().replace(/^\./, '');
    return this.getManifests().filter((m) =>
      m.supportedExtensions.some((e) => e.toLowerCase() === ext)
    );
  }
}
