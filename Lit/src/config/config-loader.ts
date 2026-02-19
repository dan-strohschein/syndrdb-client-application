/**
 * Configuration Loader
 * Loads and parses YAML configuration file for the application
 */

import { AppConfig, DEFAULT_CONFIG } from './config-types.js';
// Import for Window.electronAPI global type
import '../types/electron-api';

/**
 * Simple YAML parser for configuration file
 * Handles basic YAML structure without external dependencies
 */
class SimpleYAMLParser {
  /**
   * Parse YAML string into JavaScript object
   */
  parse(yamlContent: string): Record<string, unknown> {
    const lines = yamlContent.split('\n');
    const result: Record<string, unknown> = {};
    const stack: { obj: Record<string, unknown>; indent: number }[] = [{ obj: result, indent: -1 }];
    let currentObj: Record<string, unknown> = result;
    let currentIndent = 0;

    for (let line of lines) {
      // Skip comments and empty lines
      if (line.trim().startsWith('#') || line.trim() === '') {
        continue;
      }

      // Calculate indentation
      const indent = line.search(/\S/);
      if (indent === -1) continue;

      // Handle indentation changes
      while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
        stack.pop();
      }
      currentObj = stack[stack.length - 1].obj;

      // Parse key-value pair
      const trimmedLine = line.trim();
      const colonIndex = trimmedLine.indexOf(':');
      
      if (colonIndex !== -1) {
        const key = trimmedLine.substring(0, colonIndex).trim();
        const value = trimmedLine.substring(colonIndex + 1).trim();

        if (value === '') {
          // Nested object
          const nestedObj: Record<string, unknown> = {};
          currentObj[key] = nestedObj;
          stack.push({ obj: nestedObj, indent });
        } else {
          // Parse value
          currentObj[key] = this.parseValue(value);
        }
      }
    }

    return result;
  }

  /**
   * Parse individual value from YAML
   */
  private parseValue(value: string): string | number | boolean | null {
    // Remove comments from value
    const commentIndex = value.indexOf('#');
    if (commentIndex !== -1) {
      value = value.substring(0, commentIndex).trim();
    }

    // Boolean
    if (value === 'true') return true;
    if (value === 'false') return false;

    // Null
    if (value === 'null' || value === '~') return null;

    // Number
    if (/^-?\d+$/.test(value)) return parseInt(value, 10);
    if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value);

    // String (remove quotes if present)
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      return value.substring(1, value.length - 1);
    }

    return value;
  }
}

/**
 * Configuration loader singleton
 */
class ConfigLoader {
  private static instance: ConfigLoader;
  private config: AppConfig | null = null;
  private parser = new SimpleYAMLParser();

  private constructor() {}

  static getInstance(): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader();
    }
    return ConfigLoader.instance;
  }

  /**
   * Load configuration from YAML file
   */
  async loadConfig(configPath: string): Promise<AppConfig> {
    try {
      // In Electron, use fs to read file (only if readFile method exists)
      if (typeof window !== 'undefined' && window.electronAPI?.readFile) {
        const yamlContent = await window.electronAPI.readFile(configPath);
        const parsed = this.parser.parse(yamlContent);
        this.config = this.mergeWithDefaults(parsed);
      } else {
        // For development/testing, try to fetch
        try {
          const response = await fetch(configPath);
          const yamlContent = await response.text();
          const parsed = this.parser.parse(yamlContent);
          this.config = this.mergeWithDefaults(parsed);
        } catch (error) {
          console.warn('Could not load config file, using defaults:', error);
          this.config = DEFAULT_CONFIG;
        }
      }

      this.validateConfig(this.config);
      return this.config;
    } catch (error) {
      console.error('Error loading configuration:', error);
      console.log('Using default configuration');
      this.config = DEFAULT_CONFIG;
      return this.config;
    }
  }

  /**
   * Merge loaded config with defaults to ensure all fields are present
   */
  private mergeWithDefaults(loaded: Record<string, unknown>): AppConfig {
    return {
      environment: (loaded.environment as AppConfig['environment']) || DEFAULT_CONFIG.environment,
      languageService: {
        ...DEFAULT_CONFIG.languageService,
        ...((loaded.languageService as Record<string, unknown>) || {})
      },
      editor: {
        ...DEFAULT_CONFIG.editor,
        ...((loaded.editor as Record<string, unknown>) || {})
      },
      context: {
        ...DEFAULT_CONFIG.context,
        ...((loaded.context as Record<string, unknown>) || {})
      },
      monitoring: {
        ...DEFAULT_CONFIG.monitoring,
        ...((loaded.monitoring as Record<string, unknown>) || {})
      },
      aiAssistant: {
        ...(DEFAULT_CONFIG.aiAssistant || {}),
        ...((loaded.aiAssistant as Record<string, unknown>) || {})
      }
    };
  }

  /**
   * Validate configuration values
   */
  private validateConfig(config: AppConfig): void {
    // Validate environment
    if (config.environment !== 'production' && config.environment !== 'development') {
      throw new Error(`Invalid environment: ${config.environment}. Must be 'production' or 'development'`);
    }

    // Validate language service config
    if (config.languageService.statementCacheBufferSize <= 0) {
      throw new Error('statementCacheBufferSize must be greater than 0');
    }

    if (config.languageService.cacheAccessWeightFactor < 0 || config.languageService.cacheAccessWeightFactor > 1) {
      throw new Error('cacheAccessWeightFactor must be between 0 and 1');
    }

    if (config.languageService.cachePersistenceInterval < 1000) {
      throw new Error('cachePersistenceInterval must be at least 1000ms');
    }

    if (config.languageService.suggestionPrefetchDelay < 0) {
      throw new Error('suggestionPrefetchDelay must be non-negative');
    }

    if (config.languageService.validationDebounceDelay < 0) {
      throw new Error('validationDebounceDelay must be non-negative');
    }

    // Validate context config
    if (config.context.schemaAgeWarningThreshold <= 0) {
      throw new Error('schemaAgeWarningThreshold must be greater than 0');
    }

    // Validate AI assistant config (optional)
    if (config.aiAssistant?.requestTimeout !== undefined && config.aiAssistant.requestTimeout <= 0) {
      throw new Error('aiAssistant.requestTimeout must be greater than 0');
    }
    if (config.aiAssistant?.maxResponseTokens !== undefined && config.aiAssistant.maxResponseTokens <= 0) {
      throw new Error('aiAssistant.maxResponseTokens must be greater than 0');
    }

    console.log('✅ Configuration validated successfully');
  }

  /**
   * Get current configuration
   */
  getConfig(): AppConfig {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call loadConfig() first.');
    }
    return this.config;
  }

  /**
   * Check if running in development mode
   */
  isDevelopment(): boolean {
    return this.config?.environment === 'development';
  }

  /**
   * Check if running in production mode
   */
  isProduction(): boolean {
    return this.config?.environment === 'production';
  }
}

// Export singleton instance
export const configLoader = ConfigLoader.getInstance();
