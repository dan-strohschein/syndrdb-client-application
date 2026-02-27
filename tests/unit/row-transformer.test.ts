import { describe, it, expect } from 'vitest';
import {
  applyTransform,
  transformRow,
  transformBatch,
} from '@/tools/importer/domain/row-transformer';
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

describe('applyTransform', () => {
  const baseMapping = makeMapping({ sourceIndex: 0, sourceHeader: 'col' });

  describe('null handling', () => {
    it('should return null for null values with null handling', () => {
      expect(applyTransform(null, baseMapping, 'null')).toBeNull();
    });

    it('should return empty string for null values with empty-string handling', () => {
      expect(applyTransform(null, baseMapping, 'empty-string')).toBe('');
    });

    it('should return default value for null values with default-value handling', () => {
      const mapping = makeMapping({
        sourceIndex: 0,
        sourceHeader: 'col',
        transform: { type: 'default-value', param: 'N/A' },
      });
      expect(applyTransform(null, mapping, 'default-value')).toBe('N/A');
    });

    it('should return null for empty string values with null handling', () => {
      expect(applyTransform('', baseMapping, 'null')).toBeNull();
    });
  });

  describe('trim transform', () => {
    it('should trim whitespace', () => {
      const mapping = makeMapping({
        sourceIndex: 0,
        sourceHeader: 'col',
        transform: { type: 'trim' },
      });
      expect(applyTransform('  hello  ', mapping, 'null')).toBe('hello');
    });
  });

  describe('uppercase transform', () => {
    it('should convert to uppercase', () => {
      const mapping = makeMapping({
        sourceIndex: 0,
        sourceHeader: 'col',
        transform: { type: 'uppercase' },
      });
      expect(applyTransform('hello', mapping, 'null')).toBe('HELLO');
    });
  });

  describe('lowercase transform', () => {
    it('should convert to lowercase', () => {
      const mapping = makeMapping({
        sourceIndex: 0,
        sourceHeader: 'col',
        transform: { type: 'lowercase' },
      });
      expect(applyTransform('HELLO', mapping, 'null')).toBe('hello');
    });
  });

  describe('date-format transform', () => {
    it('should format a date with a pattern', () => {
      const mapping = makeMapping({
        sourceIndex: 0,
        sourceHeader: 'col',
        transform: { type: 'date-format', param: 'YYYY-MM-DD' },
      });
      const result = applyTransform('2024-01-15T10:30:00', mapping, 'null');
      expect(result).toBe('2024-01-15');
    });

    it('should return original value if date is unparseable', () => {
      const mapping = makeMapping({
        sourceIndex: 0,
        sourceHeader: 'col',
        transform: { type: 'date-format', param: 'YYYY-MM-DD' },
      });
      expect(applyTransform('not-a-date', mapping, 'null')).toBe('not-a-date');
    });
  });

  describe('none transform', () => {
    it('should pass value through unchanged', () => {
      expect(applyTransform('hello', baseMapping, 'null')).toBe('hello');
    });
  });
});

describe('transformRow', () => {
  it('should transform specific columns and leave others unchanged', () => {
    const row = ['  hello  ', 'world', '42'];
    const mappings: ColumnMapping[] = [
      makeMapping({ sourceIndex: 0, sourceHeader: 'a', targetField: 'A', transform: { type: 'trim' } }),
      makeMapping({ sourceIndex: 1, sourceHeader: 'b', targetField: 'B', transform: { type: 'uppercase' } }),
      makeMapping({ sourceIndex: 2, sourceHeader: 'c', targetField: null }),
    ];

    const result = transformRow(row, mappings, 'null');
    expect(result[0]).toBe('hello');
    expect(result[1]).toBe('WORLD');
    expect(result[2]).toBe('42'); // unchanged (null targetField)
  });
});

describe('transformBatch', () => {
  it('should transform all rows in a batch', () => {
    const rows = [
      ['hello', 'WORLD'],
      ['foo', 'BAR'],
    ];
    const mappings: ColumnMapping[] = [
      makeMapping({ sourceIndex: 0, sourceHeader: 'a', targetField: 'A', transform: { type: 'uppercase' } }),
      makeMapping({ sourceIndex: 1, sourceHeader: 'b', targetField: 'B', transform: { type: 'lowercase' } }),
    ];

    const result = transformBatch(rows, mappings, 'null');
    expect(result[0]).toEqual(['HELLO', 'world']);
    expect(result[1]).toEqual(['FOO', 'bar']);
  });
});
