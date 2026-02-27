/**
 * Built-in CSV parser plugin for the import system.
 * Uses fs.createReadStream() for streaming (handles 100K+ row files).
 * Runs in the main process (Node.js).
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
  ImporterPlugin,
  ImporterPluginManifest,
  ParserConfig,
  ParseResult,
  StreamProgress,
  StreamResult,
  ValidationResult,
  OnBatchCallback,
  DetectedColumnType,
} from '../../tools/importer/types/importer-plugin';

const INT_RE = /^-?\d+$/;
const DECIMAL_RE = /^-?\d+\.\d+$/;
const BOOL_RE = /^(true|false|0|1|yes|no)$/i;
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}(T|\s)?\d{0,2}:?\d{0,2}:?\d{0,2}|^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/;

function detectColumnType(values: (string | null)[], threshold = 0.8): DetectedColumnType {
  const nonNull = values.filter((v) => v !== null && v !== undefined && v !== '') as string[];
  if (nonNull.length === 0) return { type: 'STRING', confidence: 1 };

  const checks: { type: DetectedColumnType['type']; test: (v: string) => boolean }[] = [
    { type: 'INT', test: (v) => INT_RE.test(v.trim()) },
    { type: 'DECIMAL', test: (v) => DECIMAL_RE.test(v.trim()) },
    { type: 'BOOLEAN', test: (v) => BOOL_RE.test(v.trim()) },
    { type: 'DATETIME', test: (v) => DATETIME_RE.test(v.trim()) && !isNaN(new Date(v.trim()).getTime()) },
  ];

  for (const check of checks) {
    const matches = nonNull.filter(check.test).length;
    const confidence = matches / nonNull.length;
    if (confidence >= threshold) return { type: check.type, confidence };
  }

  return { type: 'STRING', confidence: 1 };
}

/** Parse a single CSV line respecting text qualifiers and escape characters */
function parseCSVLine(
  line: string,
  delimiter: string,
  qualifier: string,
  escape: string
): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuoted = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];

    if (inQuoted) {
      if (char === escape && i + 1 < line.length && line[i + 1] === qualifier) {
        // Escaped qualifier
        current += qualifier;
        i += 2;
      } else if (char === qualifier) {
        // End of quoted field
        inQuoted = false;
        i++;
      } else {
        current += char;
        i++;
      }
    } else {
      if (char === qualifier && current === '') {
        // Start of quoted field
        inQuoted = true;
        i++;
      } else if (char === delimiter) {
        fields.push(current);
        current = '';
        i++;
      } else {
        current += char;
        i++;
      }
    }
  }

  fields.push(current);
  return fields;
}

/**
 * Read file content with streaming for large files, accumulating lines.
 * Handles multiline quoted fields correctly.
 */
function readLines(
  filePath: string,
  encoding: BufferEncoding,
  delimiter: string,
  qualifier: string,
  escape: string,
  limit?: number
): Promise<{ lines: string[][]; totalLineCount: number }> {
  return new Promise((resolve, reject) => {
    const rows: string[][] = [];
    let buffer = '';
    let inQuoted = false;
    let totalLineCount = 0;
    let limitReached = false;

    const stream = fs.createReadStream(filePath, { encoding });

    stream.on('data', (chunk) => {
      const chunkStr = typeof chunk === 'string' ? chunk : chunk.toString(encoding);
      if (limitReached) return;

      buffer += chunkStr;

      while (buffer.length > 0 && !limitReached) {
        let lineEnd = -1;
        // Find the next unquoted newline
        for (let i = 0; i < buffer.length; i++) {
          const c = buffer[i];
          if (c === escape && inQuoted && i + 1 < buffer.length && buffer[i + 1] === qualifier) {
            i++; // skip escaped qualifier
          } else if (c === qualifier) {
            inQuoted = !inQuoted;
          } else if ((c === '\n' || c === '\r') && !inQuoted) {
            lineEnd = i;
            break;
          }
        }

        if (lineEnd === -1) break; // need more data

        const rawLine = buffer.substring(0, lineEnd);
        // Skip \r\n
        let skip = 1;
        if (lineEnd < buffer.length - 1 && buffer[lineEnd] === '\r' && buffer[lineEnd + 1] === '\n') {
          skip = 2;
        }
        buffer = buffer.substring(lineEnd + skip);

        if (rawLine.trim() === '') continue;

        totalLineCount++;
        if (!limit || rows.length < limit) {
          rows.push(parseCSVLine(rawLine, delimiter, qualifier, escape));
        }
        if (limit && rows.length >= limit) {
          limitReached = true;
        }
      }
    });

    stream.on('end', () => {
      // Process remaining buffer
      if (buffer.trim() !== '' && !limitReached) {
        totalLineCount++;
        if (!limit || rows.length < limit) {
          rows.push(parseCSVLine(buffer, delimiter, qualifier, escape));
        }
      }
      resolve({ lines: rows, totalLineCount });
    });

    stream.on('error', reject);
  });
}

export const csvParserManifest: ImporterPluginManifest = {
  id: 'csv',
  name: 'CSV Parser',
  version: '1.0.0',
  supportedExtensions: ['csv', 'tsv', 'txt'],
  configSchema: [
    {
      key: 'delimiter',
      label: 'Delimiter',
      type: 'select',
      defaultValue: ',',
      options: [
        { label: 'Comma (,)', value: ',' },
        { label: 'Tab (\\t)', value: '\t' },
        { label: 'Pipe (|)', value: '|' },
        { label: 'Semicolon (;)', value: ';' },
      ],
    },
    {
      key: 'qualifier',
      label: 'Text Qualifier',
      type: 'select',
      defaultValue: '"',
      options: [
        { label: 'Double Quote (")', value: '"' },
        { label: "Single Quote (')", value: "'" },
        { label: 'None', value: '' },
      ],
    },
    {
      key: 'escape',
      label: 'Escape Character',
      type: 'string',
      defaultValue: '"',
      placeholder: 'Escape character (default: ")',
    },
    {
      key: 'hasHeader',
      label: 'Has Header Row',
      type: 'boolean',
      defaultValue: true,
    },
  ],
};

export class CSVParser implements ImporterPlugin {
  manifest = csvParserManifest;

  private getOptions(config: ParserConfig) {
    const opts = config.parserOptions;
    return {
      delimiter: (opts.delimiter as string) || ',',
      qualifier: (opts.qualifier as string) ?? '"',
      escape: (opts.escape as string) || '"',
      hasHeader: opts.hasHeader !== false,
      encoding: (config.encoding || 'utf-8') as BufferEncoding,
    };
  }

  validateConfig(config: ParserConfig): ValidationResult {
    const errors: string[] = [];
    if (!config.filePath) errors.push('File path is required');
    if (config.filePath && !fs.existsSync(config.filePath)) {
      errors.push(`File not found: ${config.filePath}`);
    }
    return { valid: errors.length === 0, errors };
  }

  async parsePreview(config: ParserConfig): Promise<ParseResult> {
    const opts = this.getOptions(config);
    const limit = config.previewRowLimit || 101; // +1 for header row
    const warnings: string[] = [];

    const { lines, totalLineCount } = await readLines(
      config.filePath,
      opts.encoding,
      opts.delimiter,
      opts.qualifier,
      opts.escape,
      limit
    );

    if (lines.length === 0) {
      return { headers: [], rows: [], totalRowCount: 0, detectedTypes: [], warnings: ['File is empty'] };
    }

    let headers: string[];
    let dataRows: (string | null)[][];

    if (opts.hasHeader) {
      headers = lines[0];
      dataRows = lines.slice(1).map((row) =>
        row.map((cell) => (cell === '' ? null : cell))
      );
    } else {
      headers = lines[0].map((_, i) => `Column${i + 1}`);
      dataRows = lines.map((row) =>
        row.map((cell) => (cell === '' ? null : cell))
      );
    }

    // Normalize row lengths
    const expectedLength = headers.length;
    for (let i = 0; i < dataRows.length; i++) {
      if (dataRows[i].length < expectedLength) {
        while (dataRows[i].length < expectedLength) dataRows[i].push(null);
      } else if (dataRows[i].length > expectedLength) {
        if (i === 0) warnings.push('Some rows have more columns than headers');
        dataRows[i] = dataRows[i].slice(0, expectedLength);
      }
    }

    // Detect types from sample data
    const detectedTypes = headers.map((_, colIdx) => {
      const columnValues = dataRows.slice(0, 1000).map((row) => row[colIdx] ?? null);
      return detectColumnType(columnValues);
    });

    const totalRowCount = opts.hasHeader ? totalLineCount - 1 : totalLineCount;

    return { headers, rows: dataRows, totalRowCount, detectedTypes, warnings };
  }

  async parseStream(
    config: ParserConfig,
    onBatch: OnBatchCallback,
    onProgress?: (progress: StreamProgress) => void,
    signal?: AbortSignal
  ): Promise<StreamResult> {
    const opts = this.getOptions(config);
    const warnings: string[] = [];
    const batchSize = Math.min(config.batchSize ?? 100, 10_000);

    return new Promise((resolve, reject) => {
      const stat = fs.statSync(config.filePath);
      const totalBytes = stat.size;
      let bytesRead = 0;
      let rowsProcessed = 0;
      let headerRow: string[] | null = null;
      let batch: (string | null)[][] = [];
      let batchIndex = 0;
      let buffer = '';
      let inQuoted = false;
      let isFirstLine = true;

      const stream = fs.createReadStream(config.filePath, { encoding: opts.encoding });

      if (signal) {
        signal.addEventListener('abort', () => {
          stream.destroy();
          resolve({ totalRows: rowsProcessed, warnings: [...warnings, 'Import aborted'] });
        });
      }

      const processBatch = async () => {
        if (batch.length === 0) return;
        const currentBatch = batch;
        batch = [];
        await onBatch(currentBatch, batchIndex++);
      };

      stream.on('data', async (chunk) => {
        const chunkStr = typeof chunk === 'string' ? chunk : chunk.toString(opts.encoding);
        bytesRead += Buffer.byteLength(chunkStr, opts.encoding);
        buffer += chunkStr;

        // Process complete lines
        while (buffer.length > 0) {
          let lineEnd = -1;
          for (let i = 0; i < buffer.length; i++) {
            const c = buffer[i];
            if (c === opts.escape && inQuoted && i + 1 < buffer.length && buffer[i + 1] === opts.qualifier) {
              i++;
            } else if (c === opts.qualifier) {
              inQuoted = !inQuoted;
            } else if ((c === '\n' || c === '\r') && !inQuoted) {
              lineEnd = i;
              break;
            }
          }

          if (lineEnd === -1) break;

          const rawLine = buffer.substring(0, lineEnd);
          let skip = 1;
          if (lineEnd < buffer.length - 1 && buffer[lineEnd] === '\r' && buffer[lineEnd + 1] === '\n') {
            skip = 2;
          }
          buffer = buffer.substring(lineEnd + skip);

          if (rawLine.trim() === '') continue;

          const fields = parseCSVLine(rawLine, opts.delimiter, opts.qualifier, opts.escape);

          if (isFirstLine && opts.hasHeader) {
            headerRow = fields;
            isFirstLine = false;
            continue;
          }
          isFirstLine = false;

          const row = fields.map((cell) => (cell === '' ? null : cell));
          batch.push(row);
          rowsProcessed++;

          if (batch.length >= batchSize) {
            stream.pause();
            await processBatch();
            onProgress?.({
              bytesRead,
              totalBytes,
              rowsProcessed,
              percentComplete: Math.round((bytesRead / totalBytes) * 100),
            });
            stream.resume();
          }
        }
      });

      stream.on('end', async () => {
        // Process remaining buffer
        if (buffer.trim() !== '') {
          const fields = parseCSVLine(buffer, opts.delimiter, opts.qualifier, opts.escape);
          if (!(isFirstLine && opts.hasHeader)) {
            const row = fields.map((cell) => (cell === '' ? null : cell));
            batch.push(row);
            rowsProcessed++;
          }
        }
        await processBatch();
        resolve({ totalRows: rowsProcessed, warnings });
      });

      stream.on('error', reject);
    });
  }
}

/** Singleton CSV parser instance */
export const csvParser = new CSVParser();
