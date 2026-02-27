/**
 * Built-in SQL Script exporter plugin.
 * Writes DDL/schema scripts to a .sql text file.
 * Used for the "Scripted only" export option.
 * Runs in the main process.
 */

import * as fs from 'fs';
import type {
  ExporterPlugin,
  ExporterPluginManifest,
  ExporterConfig,
  ExportDocument,
  ExporterValidationResult,
} from '../../tools/exporter/types/exporter-plugin';

const manifest: ExporterPluginManifest = {
  id: 'sql-script',
  name: 'SQL Script',
  version: '1.0.0',
  fileExtension: 'sql',
  mimeType: 'text/plain',
  supportsStreaming: false,
  configSchema: [],
};

class SqlScriptExporter implements ExporterPlugin {
  manifest = manifest;

  private writeStream: fs.WriteStream | null = null;
  private documentCount = 0;

  async beginExport(config: ExporterConfig): Promise<void> {
    this.documentCount = 0;
    this.writeStream = fs.createWriteStream(config.filePath, {
      encoding: (config.encoding as BufferEncoding) || 'utf-8',
    });
  }

  async writeBatch(documents: ExportDocument[], _bundleName: string): Promise<number> {
    if (!this.writeStream) throw new Error('Export not started. Call beginExport() first.');

    let written = 0;
    for (const doc of documents) {
      // Each document should have a 'content' field with the script text
      const content = typeof doc.content === 'string' ? doc.content : JSON.stringify(doc);

      if (this.documentCount > 0) {
        this.writeStream.write('\n');
      }

      this.writeStream.write(content);
      this.documentCount++;
      written++;
    }

    return written;
  }

  async endExport(): Promise<{ fileSize: number }> {
    if (!this.writeStream) throw new Error('Export not started.');

    return new Promise((resolve) => {
      this.writeStream!.end(() => {
        const filePath = (this.writeStream as unknown as { path: string }).path;
        try {
          const stat = fs.statSync(filePath as string);
          this.writeStream = null;
          resolve({ fileSize: stat.size });
        } catch {
          this.writeStream = null;
          resolve({ fileSize: 0 });
        }
      });
    });
  }

  validateConfig(config: ExporterConfig): ExporterValidationResult {
    const errors: string[] = [];
    if (!config.filePath) {
      errors.push('File path is required.');
    }
    return { valid: errors.length === 0, errors };
  }
}

export const sqlScriptExporter = new SqlScriptExporter();
