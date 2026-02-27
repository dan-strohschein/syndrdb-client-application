/**
 * Plugin interface and shared types for the data import system.
 * Plugins run in the main process (Node.js) for fs access.
 */

/** Describes one configurable option for a parser plugin */
export interface ParserConfigField {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  defaultValue: string | number | boolean;
  options?: { label: string; value: string }[];
  placeholder?: string;
}

/** Plugin manifest — metadata and configuration schema */
export interface ImporterPluginManifest {
  id: string;
  name: string;
  version: string;
  supportedExtensions: string[];
  configSchema: ParserConfigField[];
}

/** Configuration passed to a parser for reading a file */
export interface ParserConfig {
  filePath: string;
  encoding: string;
  previewRowLimit: number;
  parserOptions: Record<string, string | number | boolean>;
  /** Rows per batch during streaming parse. Default 100, max 10000. */
  batchSize?: number;
}

/** Detected type for a column with confidence score */
export interface DetectedColumnType {
  type: 'STRING' | 'INT' | 'DECIMAL' | 'BOOLEAN' | 'DATETIME';
  confidence: number;
}

/** Result of parsing a file (preview or full) */
export interface ParseResult {
  headers: string[];
  rows: (string | null)[][];
  totalRowCount: number;
  detectedTypes: DetectedColumnType[];
  warnings: string[];
}

/** Progress update during streaming parse */
export interface StreamProgress {
  bytesRead: number;
  totalBytes: number;
  rowsProcessed: number;
  percentComplete: number;
}

/** Result from a completed streaming parse */
export interface StreamResult {
  totalRows: number;
  warnings: string[];
}

/** Batch callback for streaming: receives a batch of parsed rows */
export type OnBatchCallback = (batch: (string | null)[][], batchIndex: number) => Promise<void>;

/** Plugin interface — all importers must implement this */
export interface ImporterPlugin {
  manifest: ImporterPluginManifest;
  parsePreview(config: ParserConfig): Promise<ParseResult>;
  parseStream(
    config: ParserConfig,
    onBatch: OnBatchCallback,
    onProgress?: (progress: StreamProgress) => void,
    signal?: AbortSignal
  ): Promise<StreamResult>;
  validateConfig(config: ParserConfig): ValidationResult;
}

/** Result of config validation */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/** File info returned by importer:get-file-info */
export interface FileInfo {
  filePath: string;
  fileName: string;
  fileSize: number;
  detectedEncoding: string;
  extension: string;
}

/** Per-row error during import */
export interface ImportRowError {
  rowIndex: number;
  column?: string;
  message: string;
  value?: string;
}

/** Batch result sent back during import */
export interface ImportBatchResult {
  batchIndex: number;
  rowsInserted: number;
  errors: ImportRowError[];
}

/** Final import result summary */
export interface ImportResult {
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  failedRows: number;
  errors: ImportRowError[];
  elapsedMs: number;
}
