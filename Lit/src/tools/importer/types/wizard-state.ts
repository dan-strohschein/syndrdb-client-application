/**
 * State types for the 5-step import wizard.
 */

import type {
  ImporterPluginManifest,
  DetectedColumnType,
  ImportRowError,
  ParseResult,
} from './importer-plugin';

/** Transform to apply on a column during import */
export type TransformType = 'none' | 'trim' | 'uppercase' | 'lowercase' | 'date-format' | 'default-value';

export interface ColumnTransform {
  type: TransformType;
  /** For date-format: the format string. For default-value: the value to use. */
  param?: string;
}

/** How to handle NULL (empty cell) values */
export type NullHandling = 'null' | 'empty-string' | 'default-value';

/** Error handling policy during import */
export type ErrorPolicy = 'skip' | 'abort' | 'log';

/** Mapping of one source column to a target field */
export interface ColumnMapping {
  sourceIndex: number;
  sourceHeader: string;
  targetField: string | null;
  targetType: string;
  transform: ColumnTransform;
  enabled: boolean;
}

/** Target mode: import into existing bundle or create a new one */
export type TargetMode = 'existing' | 'new';

/** Step 1 state: source file and parser config */
export interface SourceStepState {
  filePath: string | null;
  fileName: string | null;
  fileSize: number;
  selectedPluginId: string | null;
  encoding: string;
  parserOptions: Record<string, string | number | boolean>;
}

/** Step 2 state: preview data */
export interface PreviewStepState {
  parseResult: ParseResult | null;
  hasHeaderRow: boolean;
  loading: boolean;
  error: string | null;
}

/** Step 3 state: mapping configuration */
export interface MappingStepState {
  targetMode: TargetMode;
  connectionId: string | null;
  databaseName: string | null;
  bundleName: string | null;
  newBundleName: string;
  columnMappings: ColumnMapping[];
  nullHandling: NullHandling;
}

/** Step 4 state: validation results */
export interface ValidationStepState {
  validated: boolean;
  validRows: number;
  invalidRows: number;
  errors: ImportRowError[];
  errorPolicy: ErrorPolicy;
  batchSize: number;
  loading: boolean;
}

/** Step 5 state: execution progress */
export interface ExecutionStepState {
  status: 'idle' | 'running' | 'paused' | 'completed' | 'aborted' | 'error';
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  failedRows: number;
  percentComplete: number;
  elapsedMs: number;
  estimatedRemainingMs: number;
  errors: ImportRowError[];
}

/** Full wizard state */
export interface ImportWizardState {
  currentStep: number;
  availablePlugins: ImporterPluginManifest[];
  source: SourceStepState;
  preview: PreviewStepState;
  mapping: MappingStepState;
  validation: ValidationStepState;
  execution: ExecutionStepState;
}

/** Initial wizard state factory */
export function createInitialWizardState(): ImportWizardState {
  return {
    currentStep: 0,
    availablePlugins: [],
    source: {
      filePath: null,
      fileName: null,
      fileSize: 0,
      selectedPluginId: null,
      encoding: 'utf-8',
      parserOptions: {},
    },
    preview: {
      parseResult: null,
      hasHeaderRow: true,
      loading: false,
      error: null,
    },
    mapping: {
      targetMode: 'existing',
      connectionId: null,
      databaseName: null,
      bundleName: null,
      newBundleName: '',
      columnMappings: [],
      nullHandling: 'null',
    },
    validation: {
      validated: false,
      validRows: 0,
      invalidRows: 0,
      errors: [],
      errorPolicy: 'skip',
      batchSize: 100,
      loading: false,
    },
    execution: {
      status: 'idle',
      totalRows: 0,
      importedRows: 0,
      skippedRows: 0,
      failedRows: 0,
      percentComplete: 0,
      elapsedMs: 0,
      estimatedRemainingMs: 0,
      errors: [],
    },
  };
}
