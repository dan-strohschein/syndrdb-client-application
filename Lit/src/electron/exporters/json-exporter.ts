/**
 * Built-in JSON exporter plugin.
 * Writes exported documents as a JSON array to a file.
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
  id: 'json',
  name: 'JSON Exporter',
  version: '1.0.0',
  fileExtension: 'json',
  mimeType: 'application/json',
  supportsStreaming: true,
  configSchema: [
    {
      key: 'pretty',
      label: 'Pretty Print',
      type: 'boolean',
      defaultValue: true,
    },
    {
      key: 'indent',
      label: 'Indent Spaces',
      type: 'number',
      defaultValue: 2,
    },
  ],
};

class JsonExporter implements ExporterPlugin {
  manifest = manifest;

  private writeStream: fs.WriteStream | null = null;
  private documentCount = 0;
  private pretty = true;
  private indent = 2;

  async beginExport(config: ExporterConfig): Promise<void> {
    this.pretty = config.exporterOptions.pretty !== false;
    this.indent = typeof config.exporterOptions.indent === 'number' ? config.exporterOptions.indent : 2;
    this.documentCount = 0;

    this.writeStream = fs.createWriteStream(config.filePath, {
      encoding: (config.encoding as BufferEncoding) || 'utf-8',
    });

    // Write opening bracket
    this.writeStream.write('[\n');
  }

  async writeBatch(documents: ExportDocument[], bundleName: string): Promise<number> {
    if (!this.writeStream) throw new Error('Export not started. Call beginExport() first.');

    let written = 0;
    for (const doc of documents) {
      // Add comma separator before all documents except the first
      if (this.documentCount > 0) {
        this.writeStream.write(',\n');
      }

      const json = this.pretty
        ? JSON.stringify(doc, null, this.indent)
        : JSON.stringify(doc);

      // Indent each line for pretty output within the array
      if (this.pretty) {
        const indented = json
          .split('\n')
          .map((line) => '  ' + line)
          .join('\n');
        this.writeStream.write(indented);
      } else {
        this.writeStream.write(json);
      }

      this.documentCount++;
      written++;
    }

    return written;
  }

  async endExport(): Promise<{ fileSize: number }> {
    if (!this.writeStream) throw new Error('Export not started.');

    return new Promise((resolve, reject) => {
      this.writeStream!.write('\n]\n', () => {
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

export const jsonExporter = new JsonExporter();
