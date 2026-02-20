/**
 * Bundle and field definition utilities.
 * Single source of truth for normalizing FieldDefinitions from API or component state.
 *
 * APIs may return FieldDefinitions as either an array or an object keyed by field name.
 * This module normalizes to a single array form used across the app.
 */

import type { FieldDefinition } from '../types/field-definition';
import type { BundleIndex } from '../types/bundle';

/** Reserved keys to exclude when converting object-shaped FieldDefinitions to array. */
const RESERVED_FIELD_KEYS = new Set(['DocumentID']);

/**
 * Normalizes FieldDefinitions from API or state into a single array form.
 * Handles: null/undefined, array, or object (keyed by field name).
 *
 * @param fieldDefinitions - Raw value from bundle.DocumentStructure?.FieldDefinitions or bundle.FieldDefinitions
 * @returns Normalized array; each item has Name and optional id
 */
export function fieldDefinitionsToArray(fieldDefinitions: unknown): FieldDefinition[] {
  if (fieldDefinitions == null) {
    return [];
  }

  if (Array.isArray(fieldDefinitions)) {
    return fieldDefinitions.map((item: any) => ({
      ...item,
      Name: item.Name ?? item.name ?? '',
      id: item.id ?? crypto.randomUUID(),
    })) as FieldDefinition[];
  }

  if (typeof fieldDefinitions === 'object' && !Array.isArray(fieldDefinitions)) {
    const obj = fieldDefinitions as Record<string, any>;
    return Object.keys(obj)
      .filter((key) => !RESERVED_FIELD_KEYS.has(key))
      .map((name) => {
        const value = obj[name];
        return {
          ...value,
          Name: value?.Name ?? value?.name ?? name,
          id: value?.id ?? crypto.randomUUID(),
        } as FieldDefinition;
      });
  }

  return [];
}

/**
 * Normalizes Indexes from API into a single array form.
 * Handles: null/undefined, array, or object (keyed by index name).
 *
 * @param indexes - Raw value from bundle.Indexes
 * @returns Normalized BundleIndex array
 */
export function indexesToArray(indexes: unknown): BundleIndex[] {
  if (indexes == null) return [];
  if (Array.isArray(indexes)) return indexes as BundleIndex[];
  if (typeof indexes === 'object') {
    return Object.entries(indexes as Record<string, any>).map(([key, value]) => ({
      ...value,
      IndexName: value?.IndexName ?? key,
    }));
  }
  return [];
}
