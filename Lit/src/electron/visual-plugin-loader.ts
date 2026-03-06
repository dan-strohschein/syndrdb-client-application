/**
 * Plugin discovery and loading for the visual plugin system.
 * Scans ~/.syndrdb/plugins/visual/ for plugin directories with syndrdb-plugin.json manifests.
 * Runs in the main process.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const USER_PLUGIN_DIR = path.join(os.homedir(), '.syndrdb', 'plugins', 'visual');

export interface DiscoveredPlugin {
  manifest: PluginManifestRaw;
  pluginDir: string;
  mainPath: string;
  stylesPath?: string;
  error?: string;
}

interface PluginManifestRaw {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  icon: string;
  iconColor?: string;
  engines: {
    syndrdbClient: string;
    syndrdbServer?: string;
  };
  requiredServerFeatures?: string[];
  permissions: string[];
  contributes: {
    sidebarSections?: unknown[];
    tabTypes?: unknown[];
    toolbarActions?: unknown[];
    statusBarWidgets?: unknown[];
    menuItems?: unknown[];
    commandPalette?: unknown[];
  };
  main: string;
  styles?: string;
}

/**
 * Validate that a parsed JSON object has the minimum required manifest fields.
 */
function isValidManifest(obj: unknown): obj is PluginManifestRaw {
  if (!obj || typeof obj !== 'object') return false;
  const m = obj as Record<string, unknown>;
  if (typeof m.id !== 'string' || !m.id) return false;
  if (typeof m.name !== 'string' || !m.name) return false;
  if (typeof m.version !== 'string') return false;
  if (typeof m.main !== 'string' || !m.main) return false;
  if (!m.engines || typeof m.engines !== 'object') return false;
  if (!m.contributes || typeof m.contributes !== 'object') return false;
  if (!Array.isArray(m.permissions)) return false;
  return true;
}

export class VisualPluginLoader {
  /**
   * Scan the visual plugin directory and return discovered plugins.
   */
  async discoverPlugins(): Promise<DiscoveredPlugin[]> {
    const discovered: DiscoveredPlugin[] = [];

    if (!fs.existsSync(USER_PLUGIN_DIR)) {
      console.log(`Visual plugin directory does not exist: ${USER_PLUGIN_DIR}`);
      return discovered;
    }

    const entries = fs.readdirSync(USER_PLUGIN_DIR, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const pluginDir = path.join(USER_PLUGIN_DIR, entry.name);
      const manifestPath = path.join(pluginDir, 'syndrdb-plugin.json');

      if (!fs.existsSync(manifestPath)) {
        console.warn(`Visual plugin directory ${entry.name} missing syndrdb-plugin.json, skipping`);
        continue;
      }

      try {
        const manifestJson = fs.readFileSync(manifestPath, 'utf8');
        const manifest = JSON.parse(manifestJson);

        if (!isValidManifest(manifest)) {
          console.warn(`Visual plugin ${entry.name} has invalid manifest, skipping`);
          continue;
        }

        const mainPath = path.resolve(pluginDir, manifest.main);
        if (!fs.existsSync(mainPath)) {
          discovered.push({
            manifest,
            pluginDir,
            mainPath,
            error: `Main file not found: ${manifest.main}`,
          });
          continue;
        }

        const plugin: DiscoveredPlugin = {
          manifest,
          pluginDir,
          mainPath,
        };

        if (manifest.styles) {
          const stylesPath = path.resolve(pluginDir, manifest.styles);
          if (fs.existsSync(stylesPath)) {
            plugin.stylesPath = stylesPath;
          }
        }

        discovered.push(plugin);
        console.log(`Discovered visual plugin: ${manifest.name} (${manifest.id})`);
      } catch (error) {
        console.error(`Failed to load visual plugin ${entry.name}:`, error);
      }
    }

    return discovered;
  }

  /**
   * Read a plugin's JavaScript module source.
   */
  readModuleSource(mainPath: string): string {
    return fs.readFileSync(mainPath, 'utf8');
  }

  /**
   * Read a plugin's CSS styles.
   */
  readStyles(stylesPath: string): string {
    return fs.readFileSync(stylesPath, 'utf8');
  }
}
