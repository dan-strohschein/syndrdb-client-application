/**
 * SyndrQL command builders for bundle create/update.
 * Pure functions; no Lit or DOM dependencies.
 */

import type { FieldDefinition } from '../types/field-definition';
import type { Bundle } from '../types/bundle';
import { fieldDefinitionsToArray } from '../lib/bundle-utils';

function defaultOrNull(value: unknown): string {
  if (value === undefined || value === null || value === '') {
    return 'NULL';
  }
  return String(value);
}

function fieldToCreateFragment(field: FieldDefinition): string {
  const type = (field.Type ?? 'STRING').toUpperCase();
  const required = field.IsRequired ? 'TRUE' : 'FALSE';
  const unique = field.IsUnique ? 'TRUE' : 'FALSE';
  const def = defaultOrNull(field.DefaultValue);
  return `{"${field.Name}", ${type}, ${required}, ${unique}, ${def}}`;
}

/**
 * Build CREATE BUNDLE "name" WITH FIELDS (...); command.
 */
export function buildCreateBundleCommand(
  name: string,
  fieldDefinitions: FieldDefinition[]
): string {
  if (fieldDefinitions.length === 0) {
    return `CREATE BUNDLE "${name}" WITH FIELDS ();`;
  }
  const fieldStrings = fieldDefinitions.map(fieldToCreateFragment);
  return `CREATE BUNDLE "${name}" WITH FIELDS (${fieldStrings.join(', ')});`;
}

/**
 * Build UPDATE BUNDLE commands: RENAME, ADD FIELD, MODIFY, REMOVE FIELD, then relationship statements.
 * Returns a single string of concatenated statements (space-separated).
 */
export function buildUpdateBundleCommands(
  existing: Bundle,
  newData: { name: string; fieldDefinitions: FieldDefinition[] },
  relationshipStatements?: string[]
): string {
  const parts: string[] = [];
  const existingFields = fieldDefinitionsToArray(existing.FieldDefinitions);
  const bundleName = newData.name;

  if (existing.Name !== newData.name) {
    parts.push(`UPDATE BUNDLE "${existing.Name}" RENAME TO "${newData.name}";`);
  }

  for (const field of newData.fieldDefinitions) {
    const existingField = existingFields.find((f) => f.Name === field.Name);
    if (!existingField) {
      parts.push(
        `UPDATE BUNDLE "${bundleName}" ADD FIELD ${fieldToCreateFragment(field)};`
      );
    } else {
      const modifications: string[] = [];
      if (existingField.Name !== field.Name) {
        modifications.push(`"${existingField.Name}" = "${field.Name}"`);
      }
      if (existingField.Type !== field.Type) {
        modifications.push((field.Type ?? 'STRING').toUpperCase());
      }
      if (existingField.IsRequired !== field.IsRequired) {
        modifications.push(field.IsRequired ? 'TRUE' : 'FALSE');
      }
      if (existingField.IsUnique !== field.IsUnique) {
        modifications.push(field.IsUnique ? 'TRUE' : 'FALSE');
      }
      if (existingField.DefaultValue !== field.DefaultValue) {
        modifications.push(defaultOrNull(field.DefaultValue));
      }
      if (modifications.length > 0) {
        parts.push(
          `UPDATE BUNDLE "${bundleName}" SET ( {MODIFY ${modifications.join(', ')} });`
        );
      }
    }
  }

  for (const existingField of existingFields) {
    const stillExists = newData.fieldDefinitions.some((f) => f.Name === existingField.Name);
    if (!stillExists) {
      parts.push(`UPDATE BUNDLE "${bundleName}" REMOVE FIELD "${existingField.Name}";`);
    }
  }

  if (relationshipStatements?.length) {
    parts.push(...relationshipStatements);
  }

  return parts.join(' ');
}
