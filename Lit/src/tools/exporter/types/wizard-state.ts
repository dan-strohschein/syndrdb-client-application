/**
 * State types for the export wizard steps.
 */

import type { ExporterPluginManifest } from './exporter-plugin';
import type { Bundle } from '../../../types/bundle';

/** Export mode: what to export */
export type ExportMode = 'schema-only' | 'data-only' | 'both';

/** Data source mode: tree selection or custom query */
export type DataSourceMode = 'tree-selection' | 'custom-query';

/** Schema tree node: represents a database, bundle, or user in the selection tree */
export interface SchemaTreeNode {
  type: 'connection' | 'database' | 'bundle' | 'user';
  id: string;
  name: string;
  connectionId: string;
  databaseName?: string;
  checked: boolean;
  indeterminate: boolean;
  children: SchemaTreeNode[];
  expanded: boolean;
  bundleData?: Bundle;
}

/** Step 1 state: export type selection */
export interface TypeStepState {
  exportMode: ExportMode;
}

/** Step 2 state: connection + entity selection */
export interface SelectionStepState {
  connectionId: string | null;
  schemaTree: SchemaTreeNode[];
  dataSourceMode: DataSourceMode;
  customQuery: string;
  customQueryDatabase: string | null;
  customQueryValid: boolean;
}

/** Step 3 state: format and destination */
export interface FormatStepState {
  selectedPluginId: string | null;
  exporterOptions: Record<string, string | number | boolean>;
  dataFilePath: string | null;
  schemaFilePath: string | null;
  encoding: string;
}

/** Step 4 state: preview */
export interface PreviewStepState {
  ddlScript: string;
  queries: { databaseName: string; bundleName: string; query: string }[];
  previewRows: Record<string, unknown>[] | null;
  loading: boolean;
  error: string | null;
}

/** Step 5 state: execution progress */
export interface ExecutionStepState {
  status: 'idle' | 'running' | 'completed' | 'aborted' | 'error';
  documentsExported: number;
  bundlesExported: number;
  totalDocuments: number;
  percentComplete: number;
  elapsedMs: number;
  errors: { bundleName?: string; message: string }[];
  schemaOutputPath: string | null;
  dataOutputPath: string | null;
}

/** Full wizard state */
export interface ExportWizardState {
  currentStep: number;
  availablePlugins: ExporterPluginManifest[];
  type: TypeStepState;
  selection: SelectionStepState;
  format: FormatStepState;
  preview: PreviewStepState;
  execution: ExecutionStepState;
}

/** Initial wizard state factory */
export function createInitialExportWizardState(): ExportWizardState {
  return {
    currentStep: 0,
    availablePlugins: [],
    type: {
      exportMode: 'schema-only',
    },
    selection: {
      connectionId: null,
      schemaTree: [],
      dataSourceMode: 'tree-selection',
      customQuery: '',
      customQueryDatabase: null,
      customQueryValid: false,
    },
    format: {
      selectedPluginId: null,
      exporterOptions: {},
      dataFilePath: null,
      schemaFilePath: null,
      encoding: 'utf-8',
    },
    preview: {
      ddlScript: '',
      queries: [],
      previewRows: null,
      loading: false,
      error: null,
    },
    execution: {
      status: 'idle',
      documentsExported: 0,
      bundlesExported: 0,
      totalDocuments: 0,
      percentComplete: 0,
      elapsedMs: 0,
      errors: [],
      schemaOutputPath: null,
      dataOutputPath: null,
    },
  };
}
