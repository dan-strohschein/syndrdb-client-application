import { describe, it, expect } from 'vitest';
import {
  detectColumnType,
  detectColumnTypes,
} from '@/tools/importer/domain/type-detector';

describe('detectColumnType', () => {
  it('should detect INT columns', () => {
    const values = ['1', '2', '3', '42', '-7'];
    const result = detectColumnType(values);
    expect(result.type).toBe('INT');
    expect(result.confidence).toBe(1);
  });

  it('should detect DECIMAL columns', () => {
    const values = ['1.5', '2.7', '3.14', '0.99'];
    const result = detectColumnType(values);
    expect(result.type).toBe('DECIMAL');
    expect(result.confidence).toBe(1);
  });

  it('should detect BOOLEAN columns', () => {
    const values = ['true', 'false', 'true', 'false'];
    const result = detectColumnType(values);
    expect(result.type).toBe('BOOLEAN');
    expect(result.confidence).toBe(1);
  });

  it('should detect yes/no as BOOLEAN', () => {
    const values = ['yes', 'no', 'yes', 'no', 'yes'];
    const result = detectColumnType(values);
    expect(result.type).toBe('BOOLEAN');
    expect(result.confidence).toBe(1);
  });

  it('should detect DATETIME columns (ISO format)', () => {
    const values = ['2024-01-15', '2024-02-20', '2024-03-10'];
    const result = detectColumnType(values);
    expect(result.type).toBe('DATETIME');
    expect(result.confidence).toBe(1);
  });

  it('should detect DATETIME columns (US format)', () => {
    const values = ['01/15/2024', '02/20/2024', '03/10/2024'];
    const result = detectColumnType(values);
    expect(result.type).toBe('DATETIME');
    expect(result.confidence).toBe(1);
  });

  it('should fall back to STRING for mixed data', () => {
    const values = ['hello', '42', 'true', '2024-01-15'];
    const result = detectColumnType(values);
    expect(result.type).toBe('STRING');
    expect(result.confidence).toBe(1);
  });

  it('should return STRING for all-null columns', () => {
    const values: (string | null)[] = [null, null, null];
    const result = detectColumnType(values);
    expect(result.type).toBe('STRING');
  });

  it('should tolerate some nulls in otherwise typed columns', () => {
    const values: (string | null)[] = ['1', '2', null, '4', '5'];
    const result = detectColumnType(values);
    expect(result.type).toBe('INT');
  });

  it('should detect INT even with threshold boundary', () => {
    // 4 out of 5 non-null match INT = 80% confidence
    const values: (string | null)[] = ['1', '2', '3', '4', 'abc'];
    const result = detectColumnType(values, 0.8);
    expect(result.type).toBe('INT');
    expect(result.confidence).toBe(0.8);
  });

  it('should fall back to STRING below threshold', () => {
    // 3 out of 5 match INT = 60% confidence < 80% threshold
    const values: (string | null)[] = ['1', '2', '3', 'abc', 'def'];
    const result = detectColumnType(values, 0.8);
    expect(result.type).toBe('STRING');
  });
});

describe('detectColumnTypes', () => {
  it('should detect types for all columns', () => {
    const headers = ['name', 'age', 'active', 'joined'];
    const rows = [
      ['John', '30', 'true', '2024-01-15'],
      ['Jane', '25', 'false', '2024-02-20'],
      ['Bob', '42', 'true', '2024-03-10'],
    ];

    const result = detectColumnTypes(headers, rows);
    expect(result).toHaveLength(4);
    expect(result[0].type).toBe('STRING');
    expect(result[1].type).toBe('INT');
    expect(result[2].type).toBe('BOOLEAN');
    expect(result[3].type).toBe('DATETIME');
  });

  it('should respect maxSample limit', () => {
    const headers = ['id'];
    const rows = Array.from({ length: 2000 }, (_, i) => [`${i}`]);

    const result = detectColumnTypes(headers, rows, 100);
    expect(result[0].type).toBe('INT');
  });
});
