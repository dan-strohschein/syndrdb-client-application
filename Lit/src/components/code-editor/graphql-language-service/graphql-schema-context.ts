/**
 * GraphQL Schema Context — Bundle → GraphQL type mapping
 *
 * Converts SyndrDB DatabaseDefinition[] to GraphQL schema types
 * for context-aware suggestions and validation.
 */

import type { ILanguageServiceDatabaseDefinition } from '../language-service-interface.js';

/** A field in a GraphQL object type. */
export interface GraphQLFieldInfo {
  name: string;
  type: string;       // e.g. "String!", "Int", "[User]"
  nonNull: boolean;
}

/** A GraphQL object type derived from a SyndrDB bundle. */
export interface GraphQLObjectType {
  name: string;
  fields: Map<string, GraphQLFieldInfo>;
}

/** A root-level query or mutation field. */
export interface GraphQLRootField {
  name: string;
  args: Array<{ name: string; type: string }>;
  returnType: string;
}

/**
 * Holds the GraphQL schema derived from SyndrDB bundles.
 */
export class GraphQLSchemaContext {
  private currentDatabase: string | null = null;
  private databases: ILanguageServiceDatabaseDefinition[] = [];

  /** Derived GraphQL types for the current database. */
  private objectTypes = new Map<string, GraphQLObjectType>();
  private queryFields: GraphQLRootField[] = [];
  private mutationFields: GraphQLRootField[] = [];

  setDatabaseContext(databaseName: string | null): void {
    this.currentDatabase = databaseName;
    this.rebuildSchema();
  }

  updateContextData(databases: ILanguageServiceDatabaseDefinition[]): void {
    this.databases = databases;
    this.rebuildSchema();
  }

  getObjectTypes(): Map<string, GraphQLObjectType> {
    return this.objectTypes;
  }

  getQueryFields(): GraphQLRootField[] {
    return this.queryFields;
  }

  getMutationFields(): GraphQLRootField[] {
    return this.mutationFields;
  }

  getTypeNames(): string[] {
    return Array.from(this.objectTypes.keys());
  }

  getFieldNames(typeName: string): string[] {
    const type = this.objectTypes.get(typeName);
    if (!type) return [];
    return Array.from(type.fields.keys());
  }

  /** Built-in scalar type names. */
  getScalarTypes(): string[] {
    return ['String', 'Int', 'Float', 'Boolean', 'ID'];
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private rebuildSchema(): void {
    this.objectTypes.clear();
    this.queryFields = [];
    this.mutationFields = [];

    if (!this.currentDatabase) return;

    const db = this.databases.find(d => d.name === this.currentDatabase);
    if (!db) return;

    for (const [bundleName, bundle] of db.bundles) {
      const gqlType = this.bundleToObjectType(bundleName, bundle);
      this.objectTypes.set(gqlType.name, gqlType);

      // Query root fields
      this.queryFields.push({
        name: `find${bundleName}`,
        args: this.buildFindArgs(bundle),
        returnType: `[${gqlType.name}]`,
      });
      this.queryFields.push({
        name: `find${bundleName}ById`,
        args: [{ name: 'DocumentID', type: 'ID!' }],
        returnType: gqlType.name,
      });

      // Mutation root fields
      this.mutationFields.push({
        name: `insert${bundleName}`,
        args: this.buildInsertArgs(bundle),
        returnType: gqlType.name,
      });
      this.mutationFields.push({
        name: `update${bundleName}`,
        args: [
          { name: 'DocumentID', type: 'ID!' },
          ...this.buildUpdateArgs(bundle),
        ],
        returnType: gqlType.name,
      });
      this.mutationFields.push({
        name: `delete${bundleName}`,
        args: [{ name: 'DocumentID', type: 'ID!' }],
        returnType: 'Boolean',
      });
    }
  }

  private bundleToObjectType(
    name: string,
    bundle: ILanguageServiceDatabaseDefinition['bundles'] extends Map<string, infer V> ? V : never,
  ): GraphQLObjectType {
    const fields = new Map<string, GraphQLFieldInfo>();

    // Always add DocumentID
    fields.set('DocumentID', { name: 'DocumentID', type: 'ID!', nonNull: true });

    for (const [fieldName, fieldDef] of bundle.fields) {
      const gqlType = this.syndrDBTypeToGraphQL(fieldDef.type, !fieldDef.constraints.nullable);
      fields.set(fieldName, {
        name: fieldName,
        type: gqlType,
        nonNull: !fieldDef.constraints.nullable,
      });
    }

    return { name, fields };
  }

  private syndrDBTypeToGraphQL(syndrType: string, nonNull: boolean): string {
    const typeMap: Record<string, string> = {
      text: 'String',
      string: 'String',
      STRING: 'String',
      number: 'Int',
      int: 'Int',
      INT: 'Int',
      decimal: 'Float',
      DECIMAL: 'Float',
      float: 'Float',
      boolean: 'Boolean',
      BOOLEAN: 'Boolean',
      date: 'String',
      datetime: 'String',
      DATETIME: 'String',
      json: 'String',
    };

    const base = typeMap[syndrType] ?? 'String';
    return nonNull ? `${base}!` : base;
  }

  private buildFindArgs(
    bundle: ILanguageServiceDatabaseDefinition['bundles'] extends Map<string, infer V> ? V : never,
  ): Array<{ name: string; type: string }> {
    const args: Array<{ name: string; type: string }> = [];
    for (const [fieldName, fieldDef] of bundle.fields) {
      const gqlType = this.syndrDBTypeToGraphQL(fieldDef.type, false);
      args.push({ name: fieldName, type: gqlType });
    }
    return args;
  }

  private buildInsertArgs(
    bundle: ILanguageServiceDatabaseDefinition['bundles'] extends Map<string, infer V> ? V : never,
  ): Array<{ name: string; type: string }> {
    const args: Array<{ name: string; type: string }> = [];
    for (const [fieldName, fieldDef] of bundle.fields) {
      const gqlType = this.syndrDBTypeToGraphQL(fieldDef.type, !fieldDef.constraints.nullable);
      args.push({ name: fieldName, type: gqlType });
    }
    return args;
  }

  private buildUpdateArgs(
    bundle: ILanguageServiceDatabaseDefinition['bundles'] extends Map<string, infer V> ? V : never,
  ): Array<{ name: string; type: string }> {
    const args: Array<{ name: string; type: string }> = [];
    for (const [fieldName, fieldDef] of bundle.fields) {
      const gqlType = this.syndrDBTypeToGraphQL(fieldDef.type, false); // all optional for update
      args.push({ name: fieldName, type: gqlType });
    }
    return args;
  }
}
