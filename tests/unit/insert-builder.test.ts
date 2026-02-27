import { describe, it, expect } from 'vitest';
import {
  formatBulkValue,
  buildDocumentFields,
  buildBulkInsertStatement,
} from '@/tools/importer/domain/insert-builder';
import type { ColumnMapping } from '@/tools/importer/types/wizard-state';

function makeMapping(overrides: Partial<ColumnMapping> & { sourceIndex: number; sourceHeader: string }): ColumnMapping {
  return {
    targetField: 'field',
    targetType: 'STRING',
    transform: { type: 'none' },
    enabled: true,
    ...overrides,
  };
}

describe('formatBulkValue', () => {
  it('should return NULL for null values', () => {
    expect(formatBulkValue(null, 'STRING')).toBe('NULL');
  });

  it('should wrap STRING values in double quotes', () => {
    expect(formatBulkValue('hello', 'STRING')).toBe('"hello"');
  });

  it('should escape double quotes in STRING values', () => {
    expect(formatBulkValue('say "hi"', 'STRING')).toBe('"say \\"hi\\""');
  });

  it('should return numeric values unquoted for INT', () => {
    expect(formatBulkValue('42', 'INT')).toBe('42');
  });

  it('should return numeric values unquoted for DECIMAL', () => {
    expect(formatBulkValue('3.14', 'DECIMAL')).toBe('3.14');
  });

  it('should return lowercase true/false for BOOLEAN', () => {
    expect(formatBulkValue('true', 'BOOLEAN')).toBe('true');
    expect(formatBulkValue('1', 'BOOLEAN')).toBe('true');
    expect(formatBulkValue('false', 'BOOLEAN')).toBe('false');
    expect(formatBulkValue('0', 'BOOLEAN')).toBe('false');
  });

  it('should wrap DATETIME values in double quotes', () => {
    expect(formatBulkValue('2024-01-15', 'DATETIME')).toBe('"2024-01-15"');
  });

  it('should return NULL for undefined values', () => {
    expect(formatBulkValue(undefined as unknown as null, 'STRING')).toBe('NULL');
  });
});

describe('buildDocumentFields', () => {
  it('should build a valid document field tuple', () => {
    const row = ['Alice', '28'];
    const mappings: ColumnMapping[] = [
      makeMapping({ sourceIndex: 0, sourceHeader: 'name', targetField: 'Name', targetType: 'STRING' }),
      makeMapping({ sourceIndex: 1, sourceHeader: 'age', targetField: 'Age', targetType: 'INT' }),
    ];

    const result = buildDocumentFields(row, mappings);
    expect(result).toBe('({"Name" = "Alice"}, {"Age" = 28})');
  });

  it('should skip disabled mappings', () => {
    const row = ['John', '30'];
    const mappings: ColumnMapping[] = [
      makeMapping({ sourceIndex: 0, sourceHeader: 'name', targetField: 'Name', targetType: 'STRING' }),
      makeMapping({ sourceIndex: 1, sourceHeader: 'age', targetField: 'Age', targetType: 'INT', enabled: false }),
    ];

    const result = buildDocumentFields(row, mappings);
    expect(result).toBe('({"Name" = "John"})');
  });

  it('should skip mappings with null target field', () => {
    const row = ['John', '30'];
    const mappings: ColumnMapping[] = [
      makeMapping({ sourceIndex: 0, sourceHeader: 'name', targetField: 'Name', targetType: 'STRING' }),
      makeMapping({ sourceIndex: 1, sourceHeader: 'age', targetField: null, targetType: 'INT' }),
    ];

    const result = buildDocumentFields(row, mappings);
    expect(result).toBe('({"Name" = "John"})');
  });

  it('should return empty string when no mappings are enabled', () => {
    const row = ['John'];
    const mappings: ColumnMapping[] = [
      makeMapping({ sourceIndex: 0, sourceHeader: 'name', targetField: 'Name', enabled: false }),
    ];

    expect(buildDocumentFields(row, mappings)).toBe('');
  });

  it('should handle NULL values in cells', () => {
    const row = [null, '30'];
    const mappings: ColumnMapping[] = [
      makeMapping({ sourceIndex: 0, sourceHeader: 'name', targetField: 'Name', targetType: 'STRING' }),
      makeMapping({ sourceIndex: 1, sourceHeader: 'age', targetField: 'Age', targetType: 'INT' }),
    ];

    const result = buildDocumentFields(row, mappings);
    expect(result).toBe('({"Name" = NULL}, {"Age" = 30})');
  });
});

describe('buildBulkInsertStatement', () => {
  it('should build a valid BULK ADD DOCUMENTS statement', () => {
    const rows = [
      ['John', '30', 'true'],
      ['Jane', '25', 'false'],
    ];
    const mappings: ColumnMapping[] = [
      makeMapping({ sourceIndex: 0, sourceHeader: 'name', targetField: 'Name', targetType: 'STRING' }),
      makeMapping({ sourceIndex: 1, sourceHeader: 'age', targetField: 'Age', targetType: 'INT' }),
      makeMapping({ sourceIndex: 2, sourceHeader: 'active', targetField: 'IsActive', targetType: 'BOOLEAN' }),
    ];

    const result = buildBulkInsertStatement(rows, mappings, 'Users');
    expect(result).toBe(
      'BULK ADD DOCUMENTS TO BUNDLE "Users" WITH (\n' +
      '  ({"Name" = "John"}, {"Age" = 30}, {"IsActive" = true}),\n' +
      '  ({"Name" = "Jane"}, {"Age" = 25}, {"IsActive" = false})\n' +
      ');'
    );
  });

  it('should return empty string for empty rows', () => {
    const mappings: ColumnMapping[] = [
      makeMapping({ sourceIndex: 0, sourceHeader: 'name', targetField: 'Name', targetType: 'STRING' }),
    ];

    expect(buildBulkInsertStatement([], mappings, 'Users')).toBe('');
  });

  it('should handle a single row', () => {
    const rows = [['Alice']];
    const mappings: ColumnMapping[] = [
      makeMapping({ sourceIndex: 0, sourceHeader: 'name', targetField: 'Name', targetType: 'STRING' }),
    ];

    const result = buildBulkInsertStatement(rows, mappings, 'Users');
    expect(result).toBe(
      'BULK ADD DOCUMENTS TO BUNDLE "Users" WITH (\n' +
      '  ({"Name" = "Alice"})\n' +
      ');'
    );
  });

  it('should return empty string when all mappings are disabled', () => {
    const rows = [['John', '30']];
    const mappings: ColumnMapping[] = [
      makeMapping({ sourceIndex: 0, sourceHeader: 'name', targetField: 'Name', enabled: false }),
      makeMapping({ sourceIndex: 1, sourceHeader: 'age', targetField: 'Age', enabled: false }),
    ];

    expect(buildBulkInsertStatement(rows, mappings, 'Users')).toBe('');
  });
});
