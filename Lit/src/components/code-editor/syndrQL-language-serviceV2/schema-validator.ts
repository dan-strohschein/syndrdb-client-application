/**
 * Grammar Schema Validator
 * Validates SyndrQL grammar JSON files against the defined schema
 */

import grammarSchema from './grammar-schema.json';
import ddlGrammarJSON from './ddl_grammar.json';
import dmlGrammarJSON from './dml_grammar.json';
import dolGrammarJSON from './dol_grammar.json';
import migrationGrammarJSON from './migration_grammar.json';

/** Shape of a node in a JSON Schema document (simplified for internal validator) */
export interface JsonSchemaNode {
  type?: string | string[];
  properties?: Record<string, JsonSchemaNode>;
  required?: string[];
  items?: JsonSchemaNode;
  minItems?: number;
  oneOf?: JsonSchemaNode[];
  $ref?: string;
  pattern?: string;
  minimum?: number;
  definitions?: Record<string, JsonSchemaNode>;
  [key: string]: unknown;
}

/**
 * Simple JSON Schema validator
 * Implements basic validation without external dependencies
 */
export class SchemaValidator {
  private schema: JsonSchemaNode;

  constructor(schema: JsonSchemaNode) {
    this.schema = schema;
  }

  /**
   * Validate data against the schema
   */
  validate(data: unknown): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    this.validateValue(data, this.schema, '', errors);
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Recursively validate a value against a schema
   */
  private validateValue(value: unknown, schema: JsonSchemaNode, path: string, errors: string[]): void {
    // Handle type validation
    if (schema.type) {
      if (Array.isArray(schema.type)) {
        const typeArr = schema.type as string[];
        const matchesType = typeArr.some((t: string) => this.checkType(value, t));
        if (!matchesType) {
          errors.push(`${path}: expected one of types [${schema.type.join(', ')}], got ${typeof value}`);
        }
      } else {
        if (!this.checkType(value, schema.type)) {
          errors.push(`${path}: expected type ${schema.type}, got ${typeof value}`);
          return;
        }
      }
    }

    // Handle array validation
    if (schema.type === 'array' && Array.isArray(value)) {
      if (schema.minItems && value.length < schema.minItems) {
        errors.push(`${path}: array must have at least ${schema.minItems} items, has ${value.length}`);
      }

      if (schema.items) {
        (value as unknown[]).forEach((item, index) => {
          this.validateValue(item, schema.items!, `${path}[${index}]`, errors);
        });
      }
    }

    // Handle object validation
    if (schema.type === 'object' && typeof value === 'object' && value !== null) {
      const obj = value as Record<string, unknown>;
      // Check required fields
      if (schema.required) {
        for (const requiredField of schema.required) {
          if (!(requiredField in obj)) {
            errors.push(`${path}: missing required field '${requiredField}'`);
          }
        }
      }

      // Validate properties
      if (schema.properties) {
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          if (key in obj) {
            this.validateValue(obj[key], propSchema, `${path}.${key}`, errors);
          }
        }
      }
    }

    // Handle oneOf validation
    if (schema.oneOf) {
      const matchingSchemas = schema.oneOf.filter((subSchema: JsonSchemaNode) => {
        const subErrors: string[] = [];
        this.validateValue(value, subSchema, path, subErrors);
        return subErrors.length === 0;
      });

      if (matchingSchemas.length === 0) {
        errors.push(`${path}: value does not match any of the oneOf schemas`);
      } else if (matchingSchemas.length > 1) {
        errors.push(`${path}: value matches multiple oneOf schemas (should match exactly one)`);
      }
    }

    // Handle $ref validation
    if (schema.$ref) {
      const refPath = schema.$ref.replace('#/definitions/', '');
      const refSchema = this.schema.definitions?.[refPath];
      if (refSchema) {
        this.validateValue(value, refSchema, path, errors);
      }
    }

    // Handle pattern validation for strings
    if (schema.pattern && typeof value === 'string') {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(value)) {
        errors.push(`${path}: string does not match pattern ${schema.pattern}`);
      }
    }

    // Handle minimum validation for numbers
    if (schema.minimum !== undefined && typeof value === 'number') {
      if (value < schema.minimum) {
        errors.push(`${path}: value ${value} is less than minimum ${schema.minimum}`);
      }
    }
  }

  /**
   * Check if a value matches the expected type
   */
  private checkType(value: unknown, type: string): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
      case 'integer':
        return typeof value === 'number';
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'null':
        return value === null;
      default:
        return false;
    }
  }
}

/**
 * Validate grammar file against schema
 */
export function validateGrammar(grammar: unknown, grammarName: string): { valid: boolean; errors: string[] } {
  const validator = new SchemaValidator(grammarSchema as unknown as JsonSchemaNode);
  const result = validator.validate(grammar);

  if (!result.valid) {
    console.error(`❌ Grammar validation failed for ${grammarName}:`);
    result.errors.forEach(error => console.error(`  - ${error}`));
  } else {
    console.log(`✅ Grammar ${grammarName} validated successfully`);
  }

  return result;
}

/**
 * Validate grammar version format
 */
export function validateGrammarVersion(version: string): boolean {
  const versionRegex = /^\d+\.\d+\.\d+$/;
  return versionRegex.test(version);
}

/**
 * Validate all grammar files
 */
export async function validateAllGrammars(): Promise<boolean> {
  try {
    // Use static imports instead of dynamic imports for browser compatibility
    const grammars = [
      { name: 'DDL', data: ddlGrammarJSON },
      { name: 'DML', data: dmlGrammarJSON },
      { name: 'DOL', data: dolGrammarJSON },
      { name: 'Migration', data: migrationGrammarJSON }
    ];

    let allValid = true;

    for (const { name, data } of grammars) {
      const result = validateGrammar(data, name);
      if (!result.valid) {
        allValid = false;
      }

      // Check version in first grammar object
      if (data[0]?.version) {
        if (!validateGrammarVersion(data[0].version)) {
          console.error(`❌ Invalid version format in ${name} grammar: ${data[0].version}`);
          allValid = false;
        }
      } else {
        console.error(`❌ Missing version field in ${name} grammar`);
        allValid = false;
      }
    }

    if (allValid) {
      console.log('✅ All grammar files validated successfully');
    } else {
      throw new Error('Grammar validation failed');
    }

    return allValid;
  } catch (error) {
    console.error('❌ Error validating grammars:', error);
    throw error;
  }
}
