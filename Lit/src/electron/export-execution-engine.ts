/**
 * Export execution engine — orchestrates query execution and file writing.
 * Runs in the main process. Communicates progress back to renderer via IPC.
 */

import * as fs from 'fs';
import type { BrowserWindow } from 'electron';
import type { ExporterPlugin } from '../tools/exporter/types/exporter-plugin';
import type { ExportExecutionConfig, ExportQueryConfig } from '../tools/exporter/types/export-config';
import type { ExporterPluginLoader } from './exporter-plugin-loader';

export class ExportExecutionEngine {
  private pluginLoader: ExporterPluginLoader;
  private syndrdbService: {
    executeQuery: (connectionId: string, query: string) => Promise<{
      success: boolean;
      error?: string;
      data?: unknown[];
      ResultCount?: number;
    }>;
  };
  private abortController: AbortController | null = null;

  constructor(
    pluginLoader: ExporterPluginLoader,
    syndrdbService: {
      executeQuery: (connectionId: string, query: string) => Promise<{
        success: boolean;
        error?: string;
        data?: unknown[];
        ResultCount?: number;
      }>;
    }
  ) {
    this.pluginLoader = pluginLoader;
    this.syndrdbService = syndrdbService;
  }

  /** Export schema DDL to a file */
  async exportSchema(ddlScript: string, filePath: string): Promise<{ success: boolean; error?: string }> {
    try {
      fs.writeFileSync(filePath, ddlScript, 'utf-8');
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to write schema file',
      };
    }
  }

  /** Export data using queries and an exporter plugin */
  async exportData(
    config: ExportExecutionConfig,
    mainWindow: BrowserWindow | null
  ): Promise<{
    totalDocuments: number;
    bundlesExported: number;
    fileSize: number;
    filePath: string;
    elapsedMs: number;
    errors: { bundleName?: string; message: string }[];
  }> {
    const startTime = Date.now();
    this.abortController = new AbortController();
    const errors: { bundleName?: string; message: string }[] = [];
    let totalDocuments = 0;
    let bundlesExported = 0;

    if (!config.pluginId || !config.exporterConfig) {
      return {
        totalDocuments: 0,
        bundlesExported: 0,
        fileSize: 0,
        filePath: '',
        elapsedMs: Date.now() - startTime,
        errors: [{ message: 'Missing plugin or exporter config' }],
      };
    }

    const plugin = this.pluginLoader.getPlugin(config.pluginId);
    if (!plugin) {
      return {
        totalDocuments: 0,
        bundlesExported: 0,
        fileSize: 0,
        filePath: config.exporterConfig.filePath,
        elapsedMs: Date.now() - startTime,
        errors: [{ message: `Exporter plugin not found: ${config.pluginId}` }],
      };
    }

    try {
      // Begin export
      await plugin.beginExport({
        filePath: config.exporterConfig.filePath,
        encoding: config.exporterConfig.encoding,
        exporterOptions: config.exporterConfig.exporterOptions,
      });

      const queries = config.queries || [];

      for (let i = 0; i < queries.length; i++) {
        if (this.abortController.signal.aborted) break;

        const queryConfig = queries[i];

        try {
          // Set database context
          const useResult = await this.syndrdbService.executeQuery(
            config.connectionId,
            `USE "${queryConfig.databaseName}";`
          );
          if (!useResult.success) {
            errors.push({
              bundleName: queryConfig.bundleName,
              message: `Failed to set database context: ${useResult.error}`,
            });
            continue;
          }

          // Execute query
          const queryResult = await this.syndrdbService.executeQuery(
            config.connectionId,
            queryConfig.query
          );

          if (!queryResult.success) {
            errors.push({
              bundleName: queryConfig.bundleName,
              message: `Query failed: ${queryResult.error}`,
            });
            continue;
          }

          // Write results via plugin
          const documents = Array.isArray(queryResult.data) ? queryResult.data : [];
          if (documents.length > 0) {
            const batchSize = config.batchSize || 1000;
            for (let offset = 0; offset < documents.length; offset += batchSize) {
              if (this.abortController.signal.aborted) break;

              const batch = documents.slice(offset, offset + batchSize);
              const written = await plugin.writeBatch(
                batch as Record<string, unknown>[],
                queryConfig.bundleName
              );
              totalDocuments += written;

              // Send progress
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('exporter:export-progress', {
                  documentsExported: totalDocuments,
                  totalDocuments: totalDocuments, // We don't know total ahead of time
                  currentBundle: queryConfig.bundleName,
                  percentComplete: ((i + 1) / queries.length) * 100,
                  elapsedMs: Date.now() - startTime,
                });
              }
            }
          }

          bundlesExported++;
        } catch (error) {
          errors.push({
            bundleName: queryConfig.bundleName,
            message: error instanceof Error ? error.message : 'Unknown query error',
          });
        }
      }

      // End export
      const endResult = await plugin.endExport();

      const result = {
        totalDocuments,
        bundlesExported,
        fileSize: endResult.fileSize,
        filePath: config.exporterConfig.filePath,
        elapsedMs: Date.now() - startTime,
        errors,
      };

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('exporter:export-complete', result);
      }

      return result;
    } catch (error) {
      const result = {
        totalDocuments,
        bundlesExported,
        fileSize: 0,
        filePath: config.exporterConfig.filePath,
        elapsedMs: Date.now() - startTime,
        errors: [
          ...errors,
          { message: error instanceof Error ? error.message : 'Export failed' },
        ],
      };

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('exporter:export-error', result);
      }

      return result;
    } finally {
      this.abortController = null;
    }
  }

  /** Abort a running export */
  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }
}
