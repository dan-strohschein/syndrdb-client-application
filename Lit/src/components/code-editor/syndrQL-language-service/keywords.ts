/**
 * SyndrQL Keywords and Language Definitions
 * Follows Single Responsibility Principle: Only handles keyword identification and categorization
 * Extracted from original syndrql-keyword-identifier.ts with improvements
 */

/**
 * SyndrQL Keywords organized by functional category
 */
export const SYNDRQL_KEYWORDS = {
  // Data Definition Language (DDL) Keywords
  DDL: new Map<string, string>([
    ['CREATE', 'Creates database objects'],
    ['DELETE', 'Deletes database objects'], 
    ['DROP', 'Drops database objects'],
    ['ALTER', 'Alters database objects'],
    ['UPDATE', 'Updates existing data or structures']
  ]),

  // Data Query Language (DQL) Keywords  
  DQL: new Map<string, string>([
    ['SELECT', 'Retrieves data from bundles'],
    ['FROM', 'Specifies source bundle/table'],
    ['WHERE', 'Filters data based on conditions'],
    ['JOIN', 'Joins multiple bundles'],
    ['INNER', 'Inner join type'],
    ['LEFT', 'Left join type'],
    ['RIGHT', 'Right join type'],
    ['OUTER', 'Outer join type'],
    ['ON', 'Specifies join conditions'],
    ['ORDER', 'Orders result set'],
    ['GROUP', 'Groups result set'],
    ['BY', 'Specifies ordering or grouping field'],
    ['HAVING', 'Filters grouped results'],
    ['LIMIT', 'Limits result count'],
    ['OFFSET', 'Skips initial results']
  ]),

  // Data Manipulation Language (DML) Keywords
  DML: new Map<string, string>([
    ['INSERT', 'Inserts new data'],
    ['ADD', 'Adds data or properties'],
    ['DOCUMENT', 'References a document'],
    ['DOCUMENTS', 'References multiple documents'],
    ['TO', 'Specifies target'],
    ['IN', 'Specifies scope or container'],
    ['WITH', 'Specifies additional parameters'],
    ['VALUES', 'Specifies literal values'],
    ['SET', 'Sets field values']
  ]),

  // Database Objects
  OBJECTS: new Map<string, string>([
    ['DATABASE', 'Database container'],
    ['DATABASES', 'Multiple databases'],
    ['BUNDLE', 'Data bundle/collection'],
    ['BUNDLES', 'Multiple bundles'],
    ['INDEX', 'Database index'],
    ['BTREE', 'B-tree index type'],
    ['HASH', 'Hash index type'],
    ['UNIQUE', 'Unique constraint'],
    ['PRIMARY', 'Primary key'],
    ['KEY', 'Key constraint']
  ]),

  // Logical Operators
  LOGICAL: new Map<string, string>([
    ['AND', 'Logical AND'],
    ['OR', 'Logical OR'],
    ['NOT', 'Logical NOT'],
    ['IS', 'Identity comparison'],
    ['NULL', 'Null value'],
    ['LIKE', 'Pattern matching'],
    ['BETWEEN', 'Range comparison'],
    ['EXISTS', 'Existence check']
  ]),

  // Functions
  FUNCTIONS: new Map<string, string>([
    ['COUNT', 'Counts records'],
    ['SUM', 'Sums numeric values'],
    ['AVG', 'Calculates average'],
    ['MIN', 'Finds minimum value'],
    ['MAX', 'Finds maximum value'],
    ['CONCAT', 'Concatenates strings'],
    ['SUBSTRING', 'Extracts substring'],
    ['LENGTH', 'Gets string length'],
    ['UPPER', 'Converts to uppercase'],
    ['LOWER', 'Converts to lowercase']
  ]),

  // Data Types
  TYPES: new Map<string, string>([
    ['STRING', 'Text data type'],
    ['INTEGER', 'Integer number type'],
    ['FLOAT', 'Floating point type'],
    ['BOOLEAN', 'Boolean true/false type'],
    ['DATE', 'Date data type'],
    ['TIME', 'Time data type'],
    ['TIMESTAMP', 'Timestamp data type'],
    ['ARRAY', 'Array data type'],
    ['OBJECT', 'Object data type']
  ])
};

/**
 * All SyndrQL keywords flattened for quick lookup
 */
export const ALL_SYNDRQL_KEYWORDS: Set<string> = new Set([
  ...SYNDRQL_KEYWORDS.DDL.keys(),
  ...SYNDRQL_KEYWORDS.DQL.keys(),
  ...SYNDRQL_KEYWORDS.DML.keys(),
  ...SYNDRQL_KEYWORDS.OBJECTS.keys(),
  ...SYNDRQL_KEYWORDS.LOGICAL.keys(),
  ...SYNDRQL_KEYWORDS.FUNCTIONS.keys(),
  ...SYNDRQL_KEYWORDS.TYPES.keys()
]);

/**
 * SyndrQL operators organized by type
 */
export const SYNDRQL_OPERATORS = {
  ARITHMETIC: ['+', '-', '*', '/', '%'],
  COMPARISON: ['=', '!=', '<>', '<', '>', '<=', '>='],
  LOGICAL: ['AND', 'OR', 'NOT'],
  ASSIGNMENT: ['='],
  CONCATENATION: ['||']
};

/**
 * All operators flattened for quick lookup
 */
export const ALL_SYNDRQL_OPERATORS: Set<string> = new Set([
  ...SYNDRQL_OPERATORS.ARITHMETIC,
  ...SYNDRQL_OPERATORS.COMPARISON,
  ...SYNDRQL_OPERATORS.ASSIGNMENT,
  ...SYNDRQL_OPERATORS.CONCATENATION
]);

/**
 * Punctuation characters in SyndrQL
 */
export const SYNDRQL_PUNCTUATION = new Set([
  '(', ')', '[', ']', '{', '}', 
  ',', ';', '.', ':', 
  '?', '!', '@', '#', '$'
]);

/**
 * Check if a string is a SyndrQL keyword (case-insensitive)
 */
export function isSyndrQLKeyword(word: string): boolean {
  return ALL_SYNDRQL_KEYWORDS.has(word.toUpperCase());
}

/**
 * Check if a string is a SyndrQL operator
 */
export function isSyndrQLOperator(symbol: string): boolean {
  return ALL_SYNDRQL_OPERATORS.has(symbol);
}

/**
 * Check if a character is SyndrQL punctuation
 */
export function isSyndrQLPunctuation(char: string): boolean {
  return SYNDRQL_PUNCTUATION.has(char);
}

/**
 * Get keyword information including category and description
 */
export function getKeywordInfo(keyword: string): { category: string; description: string } | null {
  const upperKeyword = keyword.toUpperCase();
  
  for (const [category, keywords] of Object.entries(SYNDRQL_KEYWORDS)) {
    const description = keywords.get(upperKeyword);
    if (description) {
      return { category, description };
    }
  }
  
  return null;
}

/**
 * Get all keywords for a specific category
 */
export function getKeywordsByCategory(category: keyof typeof SYNDRQL_KEYWORDS): string[] {
  return Array.from(SYNDRQL_KEYWORDS[category].keys());
}

// TODO: Add support for user-defined keywords and functions
// TODO: Add context-sensitive keyword validation
// TODO: Add keyword deprecation warnings