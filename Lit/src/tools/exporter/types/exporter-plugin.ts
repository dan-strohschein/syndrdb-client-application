/**
 * Plugin interface and shared types for the data export system.
 * Plugins run in the main process (Node.js) for fs access.
 */

/** Describes one configurable option for an exporter plugin */
export interface ExporterConfigField {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  defaultValue: string | number | boolean;
  options?: { label: string; value: string }[];
  placeholder?: string;
}

/** Plugin manifest — metadata and configuration schema */
export interface ExporterPluginManifest {
  id: string;
  name: string;
  version: string;
  fileExtension: string;
  mimeType: string;
  supportsStreaming: boolean;
  configSchema: ExporterConfigField[];
}

/** Configuration passed to an exporter for writing a file */
export interface ExporterConfig {
  filePath: string;
  encoding: string;
  exporterOptions: Record<string, string | number | boolean>;
}

/** A single document to export */
export interface ExportDocument {
  [key: string]: unknown;
}

/** Progress update during export */
export interface ExportProgress {
  documentsExported: number;
  totalDocuments: number;
  currentBundle: string;
  percentComplete: number;
  elapsedMs: number;
}

/** Result from a completed export */
export interface ExportResult {
  totalDocuments: number;
  bundlesExported: number;
  fileSize: number;
  filePath: string;
  elapsedMs: number;
  errors: ExportError[];
}

/** Per-bundle or per-document error during export */
export interface ExportError {
  bundleName?: string;
  message: string;
  detail?: string;
}

/** Result of config validation */
export interface ExporterValidationResult {
  valid: boolean;
  errors: string[];
}

/** Plugin interface — all exporters must implement this */
export interface ExporterPlugin {
  manifest: ExporterPluginManifest;
  beginExport(config: ExporterConfig): Promise<void>;
  writeBatch(documents: ExportDocument[], bundleName: string): Promise<number>;
  endExport(): Promise<{ fileSize: number }>;
  validateConfig(config: ExporterConfig): ExporterValidationResult;
}
