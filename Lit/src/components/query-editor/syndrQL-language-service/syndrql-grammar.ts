/**
 * SyndrQL Tokenizer - Grammar rules and patterns for SyndrQL statements
 */

/**
 * Token types for SyndrQL grammar elements
 */
export enum TokenType {
  KEYWORD = 'KEYWORD',
  IDENTIFIER = 'IDENTIFIER',
  STRING_LITERAL = 'STRING_LITERAL',
  PLACEHOLDER = 'PLACEHOLDER',
  OPERATOR = 'OPERATOR',
  SEPARATOR = 'SEPARATOR',
  PARENTHESIS_OPEN = 'PARENTHESIS_OPEN',
  PARENTHESIS_CLOSE = 'PARENTHESIS_CLOSE',
  BRACE_OPEN = 'BRACE_OPEN',
  BRACE_CLOSE = 'BRACE_CLOSE',
  BRACKET_OPEN = 'BRACKET_OPEN',
  BRACKET_CLOSE = 'BRACKET_CLOSE',
  SEMICOLON = 'SEMICOLON',
  COMMA = 'COMMA',
  EQUALS = 'EQUALS',
  WILDCARD = 'WILDCARD'
}

/**
 * Grammar rule element interface
 */
export interface GrammarElement {
  type: TokenType;
  value?: string;
  optional?: boolean;
  repeatable?: boolean;
  choices?: string[];
  placeholder?: string;
}

/**
 * Complete grammar rule for a statement type
 */
export interface GrammarRule {
  statementType: string;
  description: string;
  pattern: GrammarElement[];
  examples: string[];
}

/**
 * SyndrQL Grammar Rules derived from valid command formats
 */
export const SYNDRQL_GRAMMAR_RULES: { [key: string]: GrammarRule } = {
  // Database Management Commands
  CREATE_DATABASE: {
    statementType: 'CREATE_DATABASE',
    description: 'Creates a new database',
    pattern: [
      { type: TokenType.KEYWORD, value: 'CREATE' },
      { type: TokenType.KEYWORD, value: 'DATABASE' },
      { type: TokenType.STRING_LITERAL, placeholder: 'DATABASE_NAME' },
      { type: TokenType.SEMICOLON }
    ],
    examples: ['CREATE DATABASE "my_database";']
  },

  DELETE_DATABASE: {
    statementType: 'DELETE_DATABASE',
    description: 'Deletes a database',
    pattern: [
      { type: TokenType.KEYWORD, value: 'DELETE' },
      { type: TokenType.KEYWORD, value: 'DATABASE' },
      { type: TokenType.STRING_LITERAL, placeholder: 'DATABASE_NAME' },
      { type: TokenType.SEMICOLON }
    ],
    examples: ['DELETE DATABASE "old_database";']
  },

  SELECT_DATABASES: {
    statementType: 'SELECT_DATABASES',
    description: 'Lists databases',
    pattern: [
      { type: TokenType.KEYWORD, value: 'SELECT' },
      { type: TokenType.KEYWORD, value: 'DATABASES' },
      { type: TokenType.STRING_LITERAL, placeholder: 'DATABASE_NAME' },
      { type: TokenType.SEMICOLON }
    ],
    examples: ['SELECT DATABASES "production";']
  },

  USE_DATABASE: {
    statementType: 'USE_DATABASE',
    description: 'Sets active database context',
    pattern: [
      { type: TokenType.KEYWORD, value: 'USE' },
      { type: TokenType.STRING_LITERAL, placeholder: 'DATABASE_NAME' },
      { type: TokenType.SEMICOLON }
    ],
    examples: ['USE "production";']
  },

  // Bundle Management Commands
  CREATE_BUNDLE: {
    statementType: 'CREATE_BUNDLE',
    description: 'Creates a new bundle with field definitions',
    pattern: [
      { type: TokenType.KEYWORD, value: 'CREATE' },
      { type: TokenType.KEYWORD, value: 'BUNDLE' },
      { type: TokenType.STRING_LITERAL, placeholder: 'BUNDLE_NAME' },
      { type: TokenType.KEYWORD, value: 'WITH' },
      { type: TokenType.KEYWORD, value: 'FIELDS' },
      { type: TokenType.PARENTHESIS_OPEN },
      { 
        type: TokenType.BRACE_OPEN,
        repeatable: true,
        optional: false
      },
      { type: TokenType.STRING_LITERAL, placeholder: 'FIELDNAME', repeatable: true },
      { type: TokenType.COMMA, repeatable: true },
      { type: TokenType.PLACEHOLDER, placeholder: 'FIELDTYPE', repeatable: true },
      { type: TokenType.COMMA, repeatable: true },
      { type: TokenType.PLACEHOLDER, placeholder: 'REQUIRED', repeatable: true },
      { type: TokenType.COMMA, repeatable: true },
      { type: TokenType.PLACEHOLDER, placeholder: 'UNIQUE', repeatable: true },
      { 
        type: TokenType.BRACE_CLOSE,
        repeatable: true
      },
      { type: TokenType.COMMA, optional: true, repeatable: true },
      { type: TokenType.PARENTHESIS_CLOSE },
      { type: TokenType.SEMICOLON }
    ],
    examples: ['CREATE BUNDLE "users" WITH FIELDS ({"name", TEXT, true, false}, {"email", TEXT, true, true});']
  },

  DELETE_BUNDLE: {
    statementType: 'DELETE_BUNDLE',
    description: 'Deletes a bundle',
    pattern: [
      { type: TokenType.KEYWORD, value: 'DELETE' },
      { type: TokenType.KEYWORD, value: 'BUNDLE' },
      { type: TokenType.STRING_LITERAL, placeholder: 'BUNDLE_NAME' },
      { type: TokenType.SEMICOLON }
    ],
    examples: ['DELETE BUNDLE "old_bundle";']
  },

  UPDATE_BUNDLE: {
    statementType: 'UPDATE_BUNDLE',
    description: 'Updates bundle structure',
    pattern: [
      { type: TokenType.KEYWORD, value: 'UPDATE' },
      { type: TokenType.KEYWORD, value: 'BUNDLE' },
      { type: TokenType.STRING_LITERAL, placeholder: 'BUNDLE_NAME' },
      { type: TokenType.BRACKET_OPEN },
      { type: TokenType.PLACEHOLDER, placeholder: 'UPDATE_OPERATIONS' },
      { type: TokenType.BRACKET_CLOSE },
      { type: TokenType.SEMICOLON }
    ],
    examples: ['UPDATE BUNDLE "users" [ADD FIELD "age" INTEGER];']
  },

  // Document Management Commands
  INSERT_DOCUMENT: {
    statementType: 'INSERT_DOCUMENT',
    description: 'Adds a document to a bundle',
    pattern: [
      { type: TokenType.KEYWORD, value: 'ADD' },
      { type: TokenType.KEYWORD, value: 'DOCUMENT' },
      { type: TokenType.KEYWORD, value: 'TO' },
      { type: TokenType.KEYWORD, value: 'BUNDLE' },
      { type: TokenType.STRING_LITERAL, placeholder: 'BUNDLE_NAME' },
      { type: TokenType.KEYWORD, value: 'WITH' },
      { type: TokenType.PARENTHESIS_OPEN },
      { type: TokenType.BRACE_OPEN },
      { type: TokenType.PLACEHOLDER, placeholder: 'KEY_VALUE_PAIRS', repeatable: true },
      { type: TokenType.BRACE_CLOSE },
      { type: TokenType.PARENTHESIS_CLOSE },
      { type: TokenType.SEMICOLON }
    ],
    examples: ['ADD DOCUMENT TO BUNDLE "users" WITH ({name="John", age=25});']
  },

  SELECT_DOCUMENTS: {
    statementType: 'SELECT_DOCUMENTS',
    description: 'Retrieves documents from a bundle',
    pattern: [
      { type: TokenType.KEYWORD, value: 'SELECT' },
      { type: TokenType.KEYWORD, value: 'DOCUMENTS' },
      { type: TokenType.KEYWORD, value: 'FROM' },
      { type: TokenType.STRING_LITERAL, placeholder: 'BUNDLE_NAME' },
      { type: TokenType.SEMICOLON }
    ],
    examples: ['SELECT DOCUMENTS FROM "users";']
  },

  SELECT_DOCUMENTS_WHERE: {
    statementType: 'SELECT_DOCUMENTS_WHERE',
    description: 'Retrieves documents with conditions',
    pattern: [
      { type: TokenType.KEYWORD, value: 'SELECT' },
      { type: TokenType.KEYWORD, value: 'DOCUMENTS' },
      { type: TokenType.KEYWORD, value: 'FROM' },
      { type: TokenType.STRING_LITERAL, placeholder: 'BUNDLE_NAME' },
      { type: TokenType.KEYWORD, value: 'WHERE' },
      { type: TokenType.PLACEHOLDER, placeholder: 'CONDITIONS' },
      { type: TokenType.SEMICOLON }
    ],
    examples: ['SELECT DOCUMENTS FROM "users" WHERE age > 18;']
  },

  SELECT_ALL: {
    statementType: 'SELECT_ALL',
    description: 'Selects all fields from a bundle',
    pattern: [
      { type: TokenType.KEYWORD, value: 'SELECT' },
      { type: TokenType.WILDCARD, value: '*' },
      { type: TokenType.KEYWORD, value: 'FROM' },
      { type: TokenType.STRING_LITERAL, placeholder: 'BUNDLE_NAME' },
      { type: TokenType.SEMICOLON }
    ],
    examples: ['SELECT * FROM "users";']
  },

  SELECT_WITH_JOIN: {
    statementType: 'SELECT_WITH_JOIN',
    description: 'Selects documents with join operations',
    pattern: [
      { type: TokenType.KEYWORD, value: 'SELECT' },
      { type: TokenType.KEYWORD, value: 'DOCUMENTS' },
      { type: TokenType.KEYWORD, value: 'FROM' },
      { type: TokenType.STRING_LITERAL, placeholder: 'BUNDLE_NAME' },
      { type: TokenType.KEYWORD, value: 'JOIN' },
      { type: TokenType.STRING_LITERAL, placeholder: 'OTHER_BUNDLE' },
      { type: TokenType.KEYWORD, value: 'ON' },
      { type: TokenType.PLACEHOLDER, placeholder: 'JOIN_CONDITIONS' },
      { type: TokenType.KEYWORD, value: 'WHERE', optional: true },
      { type: TokenType.PLACEHOLDER, placeholder: 'CONDITIONS', optional: true },
      { type: TokenType.SEMICOLON }
    ],
    examples: ['SELECT DOCUMENTS FROM "users" JOIN "profiles" ON users.id = profiles.user_id WHERE users.active = true;']
  },

  SELECT_ORDER_BY: {
    statementType: 'SELECT_ORDER_BY',
    description: 'Selects documents with ordering',
    pattern: [
      { type: TokenType.KEYWORD, value: 'SELECT' },
      { type: TokenType.KEYWORD, value: 'DOCUMENTS' },
      { type: TokenType.KEYWORD, value: 'FROM' },
      { type: TokenType.STRING_LITERAL, placeholder: 'BUNDLE_NAME' },
      { type: TokenType.KEYWORD, value: 'WHERE', optional: true },
      { type: TokenType.PLACEHOLDER, placeholder: 'CONDITIONS', optional: true },
      { type: TokenType.KEYWORD, value: 'ORDER' },
      { type: TokenType.KEYWORD, value: 'BY' },
      { type: TokenType.PLACEHOLDER, placeholder: 'FIELD_NAME' },
      { type: TokenType.KEYWORD, value: 'ASC', optional: true, choices: ['ASC', 'DESC'] },
      { type: TokenType.SEMICOLON }
    ],
    examples: ['SELECT DOCUMENTS FROM "users" WHERE active = true ORDER BY name ASC;']
  },

  SELECT_GROUP_BY: {
    statementType: 'SELECT_GROUP_BY',
    description: 'Selects documents with grouping',
    pattern: [
      { type: TokenType.KEYWORD, value: 'SELECT' },
      { type: TokenType.KEYWORD, value: 'DOCUMENTS' },
      { type: TokenType.KEYWORD, value: 'FROM' },
      { type: TokenType.STRING_LITERAL, placeholder: 'BUNDLE_NAME' },
      { type: TokenType.KEYWORD, value: 'WHERE', optional: true },
      { type: TokenType.PLACEHOLDER, placeholder: 'CONDITIONS', optional: true },
      { type: TokenType.KEYWORD, value: 'GROUP' },
      { type: TokenType.KEYWORD, value: 'BY' },
      { type: TokenType.PLACEHOLDER, placeholder: 'FIELD_NAME' },
      { type: TokenType.SEMICOLON }
    ],
    examples: ['SELECT DOCUMENTS FROM "orders" WHERE status = "completed" GROUP BY customer_id;']
  },

  UPDATE_DOCUMENTS: {
    statementType: 'UPDATE_DOCUMENTS',
    description: 'Updates documents in a bundle',
    pattern: [
      { type: TokenType.KEYWORD, value: 'UPDATE' },
      { type: TokenType.KEYWORD, value: 'DOCUMENTS' },
      { type: TokenType.KEYWORD, value: 'IN' },
      { type: TokenType.KEYWORD, value: 'BUNDLE' },
      { type: TokenType.STRING_LITERAL, placeholder: 'BUNDLE_NAME' },
      { type: TokenType.PARENTHESIS_OPEN },
      { type: TokenType.BRACE_OPEN },
      { type: TokenType.PLACEHOLDER, placeholder: 'KEY_VALUE_UPDATES', repeatable: true },
      { type: TokenType.BRACE_CLOSE },
      { type: TokenType.PARENTHESIS_CLOSE },
      { type: TokenType.KEYWORD, value: 'WHERE' },
      { type: TokenType.PLACEHOLDER, placeholder: 'CONDITIONS' },
      { type: TokenType.SEMICOLON }
    ],
    examples: ['UPDATE DOCUMENTS IN BUNDLE "users" ({name="Jane", age=30}) WHERE id = 1;']
  },

  DELETE_DOCUMENTS: {
    statementType: 'DELETE_DOCUMENTS',
    description: 'Deletes documents from a bundle',
    pattern: [
      { type: TokenType.KEYWORD, value: 'DELETE' },
      { type: TokenType.KEYWORD, value: 'DOCUMENTS' },
      { type: TokenType.KEYWORD, value: 'FROM' },
      { type: TokenType.KEYWORD, value: 'BUNDLE' },
      { type: TokenType.STRING_LITERAL, placeholder: 'BUNDLE_NAME' },
      { type: TokenType.KEYWORD, value: 'WHERE' },
      { type: TokenType.PLACEHOLDER, placeholder: 'CONDITIONS' },
      { type: TokenType.SEMICOLON }
    ],
    examples: ['DELETE DOCUMENTS FROM BUNDLE "users" WHERE active = false;']
  },

  // Index Management Commands
  CREATE_BTREE_INDEX: {
    statementType: 'CREATE_BTREE_INDEX',
    description: 'Creates a B-tree index',
    pattern: [
      { type: TokenType.KEYWORD, value: 'CREATE' },
      { type: TokenType.KEYWORD, value: 'BTREE' },
      { type: TokenType.KEYWORD, value: 'INDEX' },
      { type: TokenType.STRING_LITERAL, placeholder: 'INDEX_NAME' },
      { type: TokenType.KEYWORD, value: 'ON' },
      { type: TokenType.KEYWORD, value: 'BUNDLE' },
      { type: TokenType.STRING_LITERAL, placeholder: 'BUNDLE_NAME' },
      { type: TokenType.PARENTHESIS_OPEN },
      { type: TokenType.PLACEHOLDER, placeholder: 'FIELD_NAME', repeatable: true },
      { type: TokenType.COMMA, optional: true, repeatable: true },
      { type: TokenType.PARENTHESIS_CLOSE },
      { type: TokenType.SEMICOLON }
    ],
    examples: ['CREATE BTREE INDEX "user_name_idx" ON BUNDLE "users" (name, email);']
  },

  CREATE_HASH_INDEX: {
    statementType: 'CREATE_HASH_INDEX',
    description: 'Creates a hash index',
    pattern: [
      { type: TokenType.KEYWORD, value: 'CREATE' },
      { type: TokenType.KEYWORD, value: 'HASH' },
      { type: TokenType.KEYWORD, value: 'INDEX' },
      { type: TokenType.STRING_LITERAL, placeholder: 'INDEX_NAME' },
      { type: TokenType.KEYWORD, value: 'ON' },
      { type: TokenType.KEYWORD, value: 'BUNDLE' },
      { type: TokenType.STRING_LITERAL, placeholder: 'BUNDLE_NAME' },
      { type: TokenType.PARENTHESIS_OPEN },
      { type: TokenType.PLACEHOLDER, placeholder: 'FIELD_NAME' },
      { type: TokenType.PARENTHESIS_CLOSE },
      { type: TokenType.SEMICOLON }
    ],
    examples: ['CREATE HASH INDEX "user_id_idx" ON BUNDLE "users" (id);']
  },

  // System Information Commands
  SHOW_DATABASES: {
    statementType: 'SHOW_DATABASES',
    description: 'Shows all databases',
    pattern: [
      { type: TokenType.KEYWORD, value: 'SHOW' },
      { type: TokenType.KEYWORD, value: 'DATABASES' },
      { type: TokenType.SEMICOLON }
    ],
    examples: ['SHOW DATABASES;']
  },

  SHOW_BUNDLES: {
    statementType: 'SHOW_BUNDLES',
    description: 'Shows all bundles',
    pattern: [
      { type: TokenType.KEYWORD, value: 'SHOW' },
      { type: TokenType.KEYWORD, value: 'BUNDLES' },
      { type: TokenType.SEMICOLON }
    ],
    examples: ['SHOW BUNDLES;']
  },

  SHOW_BUNDLES_FOR_DATABASE: {
    statementType: 'SHOW_BUNDLES_FOR_DATABASE',
    description: 'Shows bundles for a specific database',
    pattern: [
      { type: TokenType.KEYWORD, value: 'SHOW' },
      { type: TokenType.KEYWORD, value: 'BUNDLES' },
      { type: TokenType.KEYWORD, value: 'FOR' },
      { type: TokenType.STRING_LITERAL, placeholder: 'DATABASE_NAME' },
      { type: TokenType.SEMICOLON }
    ],
    examples: ['SHOW BUNDLES FOR "production";']
  },

  SHOW_BUNDLE: {
    statementType: 'SHOW_BUNDLE',
    description: 'Shows details of a specific bundle',
    pattern: [
      { type: TokenType.KEYWORD, value: 'SHOW' },
      { type: TokenType.KEYWORD, value: 'BUNDLE' },
      { type: TokenType.STRING_LITERAL, placeholder: 'BUNDLE_NAME' },
      { type: TokenType.SEMICOLON }
    ],
    examples: ['SHOW BUNDLE "users";']
  },

  SHOW_USERS: {
    statementType: 'SHOW_USERS',
    description: 'Shows all system users',
    pattern: [
      { type: TokenType.KEYWORD, value: 'SHOW' },
      { type: TokenType.KEYWORD, value: 'USERS' },
      { type: TokenType.SEMICOLON }
    ],
    examples: ['SHOW USERS;']
  },

  SHOW_RATE_LIMIT: {
    statementType: 'SHOW_RATE_LIMIT',
    description: 'Shows current rate limit settings',
    pattern: [
      { type: TokenType.KEYWORD, value: 'SHOW' },
      { type: TokenType.KEYWORD, value: 'RATE' },
      { type: TokenType.KEYWORD, value: 'LIMIT' },
      { type: TokenType.SEMICOLON }
    ],
    examples: ['SHOW RATE LIMIT;']
  },

  // Security and Access Control Commands
  GRANT_PERMISSION: {
    statementType: 'GRANT_PERMISSION',
    description: 'Grants permissions to users or roles',
    pattern: [
      { type: TokenType.KEYWORD, value: 'GRANT' },
      { type: TokenType.PLACEHOLDER, placeholder: 'PERMISSION_TYPE' },
      { type: TokenType.KEYWORD, value: 'ON' },
      { type: TokenType.PLACEHOLDER, placeholder: 'RESOURCE' },
      { type: TokenType.KEYWORD, value: 'TO' },
      { type: TokenType.PLACEHOLDER, placeholder: 'USER_OR_ROLE' },
      { type: TokenType.SEMICOLON }
    ],
    examples: ['GRANT READ ON "users" TO "analyst_role";']
  },

  ATTACH_RESOURCE: {
    statementType: 'ATTACH_RESOURCE',
    description: 'Attaches external resources',
    pattern: [
      { type: TokenType.KEYWORD, value: 'ATTACH' },
      { type: TokenType.PLACEHOLDER, placeholder: 'RESOURCE_SPECIFICATION' },
      { type: TokenType.SEMICOLON }
    ],
    examples: ['ATTACH DATABASE "/path/to/external.db";']
  },

  INVALIDATE_SESSION: {
    statementType: 'INVALIDATE_SESSION',
    description: 'Invalidates user sessions',
    pattern: [
      { type: TokenType.KEYWORD, value: 'INVALIDATE' },
      { type: TokenType.KEYWORD, value: 'SESSION' },
      { type: TokenType.SEMICOLON }
    ],
    examples: ['INVALIDATE SESSION;']
  },

  INVALIDATE_SESSION_ID: {
    statementType: 'INVALIDATE_SESSION_ID',
    description: 'Invalidates a specific session',
    pattern: [
      { type: TokenType.KEYWORD, value: 'INVALIDATE' },
      { type: TokenType.KEYWORD, value: 'SESSION' },
      { type: TokenType.STRING_LITERAL, placeholder: 'SESSION_ID' },
      { type: TokenType.SEMICOLON }
    ],
    examples: ['INVALIDATE SESSION "session-123-abc";']
  }
};

/**
 * Get all available grammar rules
 * @returns Object containing all SyndrQL grammar rules
 */
export function getAllGrammarRules(): { [key: string]: GrammarRule } {
  return SYNDRQL_GRAMMAR_RULES;
}

/**
 * Get a specific grammar rule by statement type
 * @param statementType - The type of statement to get the rule for
 * @returns The grammar rule or null if not found
 */
export function getGrammarRule(statementType: string): GrammarRule | null {
  return SYNDRQL_GRAMMAR_RULES[statementType] || null;
}

/**
 * Get all statement types that are supported
 * @returns Array of supported statement type strings
 */
export function getSupportedStatementTypes(): string[] {
  return Object.keys(SYNDRQL_GRAMMAR_RULES);
}

/**
 * Find grammar rule that matches the beginning of a statement
 * @param statement - The statement to analyze
 * @returns Array of possible matching grammar rules
 */
export function findMatchingGrammarRules(statement: string): GrammarRule[] {
  const upperStatement = statement.trim().toUpperCase();
  const matchingRules: GrammarRule[] = [];
  
  for (const rule of Object.values(SYNDRQL_GRAMMAR_RULES)) {
    // Check if the statement starts with the expected pattern
    const firstKeywords = rule.pattern
      .filter(element => element.type === TokenType.KEYWORD && element.value)
      .slice(0, 3) // Check first few keywords for pattern matching
      .map(element => element.value)
      .join(' ');
    
    if (upperStatement.startsWith(firstKeywords)) {
      matchingRules.push(rule);
    }
  }
  
  return matchingRules;
}
