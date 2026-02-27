/**
 * Import execution engine — orchestrates parse -> transform -> INSERT.
 * Runs in the main process. Communicates progress/results back to renderer via callbacks.
 */

import type { BrowserWindow } from 'electron';
import type {
  ImporterPlugin,
  ParserConfig,
  ImportRowError,
  ImportBatchResult,
  ImportResult,
} from '../tools/importer/types/importer-plugin';
import type {
  ColumnMapping,
  NullHandling,
  ErrorPolicy,
} from '../tools/importer/types/wizard-state';
import type { ImporterPluginLoader } from './importer-plugin-loader';

/** Configuration sent from renderer to start an import */
export interface ImportExecutionConfig {
  pluginId: string;
  parserConfig: ParserConfig;
  connectionId: string;
  databaseName: string;
  bundleName: string;
  createBundle: boolean;
  createBundleCommand?: string;
  columnMappings: ColumnMapping[];
  nullHandling: NullHandling;
  errorPolicy: ErrorPolicy;
  batchSize: number;
}

/** Apply a column transform to a cell value */
function applyTransform(
  value: string | null,
  mapping: ColumnMapping,
  nullHandling: NullHandling
): string | null {
  if (value === null || value === undefined || value === '') {
    switch (nullHandling) {
      case 'null': return null;
      case 'empty-string': return '';
      case 'default-value':
        return mapping.transform.type === 'default-value' && mapping.transform.param !== undefined
          ? mapping.transform.param
          : null;
    }
  }
  switch (mapping.transform.type) {
    case 'trim': return value!.trim();
    case 'uppercase': return value!.toUpperCase();
    case 'lowercase': return value!.toLowerCase();
    case 'default-value': return value;
    case 'none':
    default: return value;
  }
}

/** Format a value for BULK INSERT syntax */
function formatBulkValue(value: string | null, targetType: string): string {
  if (value === null || value === undefined) return 'NULL';
  const upper = targetType.toUpperCase();
  switch (upper) {
    case 'INT':
    case 'DECIMAL':
      return value;
    case 'BOOLEAN':
      return value.toLowerCase() === 'true' || value === '1' ? 'true' : 'false';
    default:
      return `"${value.replace(/"/g, '\\"')}"`;
  }
}

/** Build a BULK ADD DOCUMENTS statement for a batch of rows */
function buildBulkInsert(
  rows: (string | null)[][],
  mappings: ColumnMapping[],
  bundleName: string,
  nullHandling: NullHandling
): string {
  const enabled = mappings.filter((m) => m.enabled && m.targetField);
  if (enabled.length === 0 || rows.length === 0) return '';

  const documents = rows.map((row) => {
    const fields = enabled.map((m) => {
      const transformed = applyTransform(row[m.sourceIndex], m, nullHandling);
      const formatted = formatBulkValue(transformed, m.targetType);
      return `{"${m.targetField!}" = ${formatted}}`;
    });
    return `  (${fields.join(', ')})`;
  });

  return `BULK ADD DOCUMENTS TO BUNDLE "${bundleName}" WITH (\n${documents.join(',\n')}\n);`;
}

export class ImportExecutionEngine {
  private pluginLoader: ImporterPluginLoader;
  private syndrdbService: { executeQuery: (connectionId: string, query: string) => Promise<{ success: boolean; error?: string }> };
  private abortControllers: Map<string, AbortController> = new Map();
  private pauseResolvers: Map<string, (() => void) | null> = new Map();
  private importId = 0;

  constructor(
    pluginLoader: ImporterPluginLoader,
    syndrdbService: { executeQuery: (connectionId: string, query: string) => Promise<{ success: boolean; error?: string }> }
  ) {
    this.pluginLoader = pluginLoader;
    this.syndrdbService = syndrdbService;
  }

  /** Validate an import config without executing (dry-run on preview data) */
  async validateImport(
    config: ImportExecutionConfig,
    previewRows: (string | null)[][]
  ): Promise<{ validRows: number; invalidRows: number; errors: ImportRowError[] }> {
    const errors: ImportRowError[] = [];
    let validRows = 0;
    let invalidRows = 0;
    const enabledMappings = config.columnMappings.filter((m) => m.enabled && m.targetField);

    for (let i = 0; i < previewRows.length; i++) {
      const row = previewRows[i];
      let rowValid = true;

      for (const mapping of enabledMappings) {
        const value = row[mapping.sourceIndex];
        const transformed = applyTransform(value, mapping, config.nullHandling);

        // Type coercion check
        if (transformed !== null && transformed !== '') {
          const targetType = mapping.targetType.toUpperCase();
          if (targetType === 'INT' && !/^-?\d+$/.test(transformed)) {
            errors.push({
              rowIndex: i,
              column: mapping.targetField!,
              message: `Cannot convert "${transformed}" to INT`,
              value: transformed,
            });
            rowValid = false;
          } else if (targetType === 'DECIMAL' && isNaN(parseFloat(transformed))) {
            errors.push({
              rowIndex: i,
              column: mapping.targetField!,
              message: `Cannot convert "${transformed}" to DECIMAL`,
              value: transformed,
            });
            rowValid = false;
          } else if (targetType === 'BOOLEAN' && !/^(true|false|0|1|yes|no)$/i.test(transformed)) {
            errors.push({
              rowIndex: i,
              column: mapping.targetField!,
              message: `Cannot convert "${transformed}" to BOOLEAN`,
              value: transformed,
            });
            rowValid = false;
          }
        }
      }

      if (rowValid) validRows++;
      else invalidRows++;
    }

    return { validRows, invalidRows, errors };
  }

  /** Start a full import */
  async startImport(
    config: ImportExecutionConfig,
    mainWindow: BrowserWindow | null
  ): Promise<ImportResult> {
    const id = `import_${++this.importId}`;
    const abortController = new AbortController();
    this.abortControllers.set(id, abortController);

    const startTime = Date.now();
    let importedRows = 0;
    let skippedRows = 0;
    let failedRows = 0;
    const allErrors: ImportRowError[] = [];
    let globalRowIndex = 0;

    const plugin = this.pluginLoader.getPlugin(config.pluginId);
    if (!plugin) {
      return {
        totalRows: 0, importedRows: 0, skippedRows: 0, failedRows: 0,
        errors: [{ rowIndex: -1, message: `Plugin not found: ${config.pluginId}` }],
        elapsedMs: Date.now() - startTime,
      };
    }

    try {
      // Step 1: Create bundle if needed
      if (config.createBundle && config.createBundleCommand) {
        const useDb = `USE "${config.databaseName}";`;
        await this.syndrdbService.executeQuery(config.connectionId, useDb);
        const createResult = await this.syndrdbService.executeQuery(config.connectionId, config.createBundleCommand);
        if (!createResult.success) {
          return {
            totalRows: 0, importedRows: 0, skippedRows: 0, failedRows: 0,
            errors: [{ rowIndex: -1, message: `Failed to create bundle: ${createResult.error}` }],
            elapsedMs: Date.now() - startTime,
          };
        }
      }

      // Step 2: Set database context
      await this.syndrdbService.executeQuery(config.connectionId, `USE "${config.databaseName}";`);

      // Step 3: Stream parse and bulk insert
      // Pass batchSize to parser config (capped at 10,000 for BULK INSERT limit)
      const parserConfig = {
        ...config.parserConfig,
        batchSize: Math.min(config.batchSize || 100, 10_000),
      };
      const enabledMappings = config.columnMappings.filter((m) => m.enabled && m.targetField);

      await plugin.parseStream(
        parserConfig,
        async (batch, batchIndex) => {
          // Check for pause
          if (this.pauseResolvers.has(id)) {
            await new Promise<void>((resolve) => {
              this.pauseResolvers.set(id, resolve);
            });
          }

          const batchErrors: ImportRowError[] = [];
          let batchInserted = 0;

          // Build BULK INSERT statement for the entire batch
          const bulkStatement = buildBulkInsert(batch, enabledMappings, config.bundleName, config.nullHandling);

          if (bulkStatement) {
            const result = await this.syndrdbService.executeQuery(config.connectionId, bulkStatement);

            if (result.success) {
              batchInserted = batch.length;
            } else {
              // BULK INSERT is all-or-nothing — entire batch failed
              const error: ImportRowError = {
                rowIndex: globalRowIndex,
                message: `Batch ${batchIndex} failed (${batch.length} rows): ${result.error || 'BULK INSERT failed'}`,
              };
              batchErrors.push(error);

              if (config.errorPolicy === 'abort') {
                allErrors.push(error);
                throw new Error(`Aborted at batch ${batchIndex} (row ${globalRowIndex}): ${error.message}`);
              }
              // For 'skip' and 'log' policies, mark entire batch as failed
              failedRows += batch.length;
            }
          }

          importedRows += batchInserted;
          allErrors.push(...batchErrors);
          globalRowIndex += batch.length;

          // Send progress to renderer
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('importer:import-progress', {
              importedRows,
              skippedRows,
              failedRows: allErrors.length > 0 ? globalRowIndex - importedRows : 0,
              totalRows: globalRowIndex,
              percentComplete: 0, // Will be updated by stream progress
              elapsedMs: Date.now() - startTime,
            });

            if (batchErrors.length > 0) {
              mainWindow.webContents.send('importer:import-batch-result', {
                batchIndex,
                rowsInserted: batchInserted,
                errors: batchErrors,
              } as ImportBatchResult);
            }
          }
        },
        (progress) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('importer:import-progress', {
              importedRows,
              skippedRows,
              failedRows: allErrors.length,
              totalRows: globalRowIndex,
              percentComplete: progress.percentComplete,
              elapsedMs: Date.now() - startTime,
            });
          }
        },
        abortController.signal
      );
    } catch (error) {
      if (!abortController.signal.aborted) {
        allErrors.push({
          rowIndex: globalRowIndex,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    } finally {
      this.abortControllers.delete(id);
      this.pauseResolvers.delete(id);
    }

    const result: ImportResult = {
      totalRows: globalRowIndex,
      importedRows,
      skippedRows,
      failedRows: allErrors.length,
      errors: allErrors,
      elapsedMs: Date.now() - startTime,
    };

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('importer:import-complete', result);
    }

    return result;
  }

  /** Abort a running import */
  abort(importId?: string): void {
    // Abort the most recent or specified import
    if (importId && this.abortControllers.has(importId)) {
      this.abortControllers.get(importId)!.abort();
    } else {
      // Abort all
      for (const controller of this.abortControllers.values()) {
        controller.abort();
      }
    }
  }

  /** Pause a running import */
  pause(importId?: string): void {
    const key = importId || Array.from(this.pauseResolvers.keys()).pop();
    if (key) this.pauseResolvers.set(key, null);
  }

  /** Resume a paused import */
  resume(importId?: string): void {
    const key = importId || Array.from(this.pauseResolvers.keys()).pop();
    if (key) {
      const resolver = this.pauseResolvers.get(key);
      if (resolver) resolver();
      this.pauseResolvers.delete(key);
    }
  }
}
