/**
 * Configuration sent from renderer to main process to execute an export.
 */

import type { ExportMode } from './wizard-state';

/** Single query to execute for data export */
export interface ExportQueryConfig {
  databaseName: string;
  bundleName: string;
  query: string;
}

/** Full execution config sent over IPC */
export interface ExportExecutionConfig {
  exportMode: ExportMode;
  connectionId: string;
  /** DDL script for schema export (schema-only or both modes) */
  ddlScript?: string;
  /** File path for schema DDL output */
  schemaFilePath?: string;
  /** Queries to execute for data export (data-only or both modes) */
  queries?: ExportQueryConfig[];
  /** Exporter plugin ID (e.g. 'json') */
  pluginId?: string;
  /** Exporter configuration (file path, encoding, options) */
  exporterConfig?: {
    filePath: string;
    encoding: string;
    exporterOptions: Record<string, string | number | boolean>;
  };
  /** Rows per batch during data export */
  batchSize: number;
}
