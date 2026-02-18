/**
 * Configuration type definitions for SyndrDB Client Application
 */

export interface LanguageServiceConfig {
  statementCacheBufferSize: number;
  cacheAccessWeightFactor: number;
  cachePersistenceInterval: number;
  suggestionPrefetchEnabled: boolean;
  suggestionPrefetchDelay: number;
  validationDebounceDelay: number;
}

export interface EditorConfig {
  syntaxHighlightingEnabled: boolean;
  autoSuggestionsEnabled: boolean;
  errorHighlightingEnabled: boolean;
}

export interface ContextConfig {
  displaySchemaAge: boolean;
  schemaAgeWarningThreshold: number;
}

export interface MonitoringConfig {
  enabled: boolean;
  metricsCollectionInterval: number;
}

/**
 * AI Assistant (SyndrQL-from-NL) configuration.
 * premiumEnabled: when true (default), show AI panel without license check (stub).
 */
export interface AIAssistantConfig {
  enabled?: boolean;
  endpoint?: string;
  requestTimeout?: number;
  maxResponseTokens?: number;
  premiumEnabled?: boolean;
}

export interface AppConfig {
  environment: 'production' | 'development';
  languageService: LanguageServiceConfig;
  editor: EditorConfig;
  context: ContextConfig;
  monitoring: MonitoringConfig;
  aiAssistant?: AIAssistantConfig;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: AppConfig = {
  environment: 'production',
  languageService: {
    statementCacheBufferSize: 5242880, // 5MB
    cacheAccessWeightFactor: 0.7,
    cachePersistenceInterval: 30000, // 30 seconds
    suggestionPrefetchEnabled: true,
    suggestionPrefetchDelay: 50,
    validationDebounceDelay: 1000
  },
  editor: {
    syntaxHighlightingEnabled: true,
    autoSuggestionsEnabled: true,
    errorHighlightingEnabled: true
  },
  context: {
    displaySchemaAge: true,
    schemaAgeWarningThreshold: 30 // minutes
  },
  monitoring: {
    enabled: false,
    metricsCollectionInterval: 60000 // 1 minute
  },
  aiAssistant: {
    enabled: false,
    endpoint: '',
    requestTimeout: 30000, // 30 seconds
    maxResponseTokens: 2048,
    premiumEnabled: true // stub: show AI panel without license check
  }
};
