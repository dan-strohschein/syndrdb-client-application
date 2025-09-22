/**
 * SyndrQL Keyword Identifier - Extracts and categorizes SyndrQL language keywords
 */

/**
 * SyndrQL Keywords organized by category
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
    ['ON', 'Specifies join conditions'],
    ['ORDER', 'Orders result set'],
    ['GROUP', 'Groups result set'],
    ['BY', 'Specifies ordering or grouping field']
  ]),

  // Data Manipulation Language (DML) Keywords
  DML: new Map<string, string>([
    ['INSERT', 'Inserts new data'],
    ['ADD', 'Adds data or properties'],
    ['DOCUMENT', 'References a document'],
    ['DOCUMENTS', 'References multiple documents'],
    ['TO', 'Specifies target'],
    ['IN', 'Specifies scope or container'],
    ['WITH', 'Specifies additional parameters']
  ]),

  // Database Objects
  OBJECTS: new Map<string, string>([
    ['DATABASE', 'Database container'],
    ['DATABASES', 'Multiple databases'],
    ['BUNDLE', 'Data bundle/collection'],
    ['BUNDLES', 'Multiple bundles'],
    ['INDEX', 'Database index'],
    ['BTREE', 'B-tree index type'],
    ['HASH', 'Hash index type']
  ]),

  // Field and Data Types
  FIELDS: new Map<string, string>([
    ['FIELDS', 'Bundle field definitions'],
    ['FIELD', 'Single field reference'],
    ['TEXT', 'Text data type'],
    ['INTEGER', 'Integer data type'],
    ['BOOLEAN', 'Boolean data type'],
    ['REQUIRED', 'Field constraint - required'],
    ['UNIQUE', 'Field constraint - unique']
  ]),

  // Control and Flow Keywords
  CONTROL: new Map<string, string>([
    ['USE', 'Sets active database context'],
    ['SHOW', 'Displays information'],
    ['FOR', 'Specifies scope or target']
  ]),

  // Security and Access Control
  SECURITY: new Map<string, string>([
    ['GRANT', 'Grants permissions'],
    ['USERS', 'System users'],
    ['PERMISSION', 'Access permission'],
    ['ROLE', 'User role'],
    ['SESSION', 'User session'],
    ['INVALIDATE', 'Invalidates session/cache']
  ]),

  // System and Utility Keywords
  SYSTEM: new Map<string, string>([
    ['RATE', 'Rate limiting'],
    ['LIMIT', 'Limit/constraint'],
    ['ATTACH', 'Attaches resource'],
    ['RESOURCE', 'System resource']
  ]),

  // Logical and Comparison Operators
  OPERATORS: new Map<string, string>([
    ['AND', 'Logical AND operator'],
    ['OR', 'Logical OR operator'],
    ['NOT', 'Logical NOT operator'],
    ['ASC', 'Ascending sort order'],
    ['DESC', 'Descending sort order']
  ]),

  // Reserved Words and Symbols
  RESERVED: new Map<string, string>([
    ['NULL', 'Null value'],
    ['TRUE', 'Boolean true'],
    ['FALSE', 'Boolean false'],
    ['WILDCARD', 'Wildcard selector (*)']
  ])
} as const;

/**
 * Flattened map of all SyndrQL keywords for quick lookup
 */
export const ALL_SYNDRQL_KEYWORDS = new Map<string, { category: string; description: string }>([
  // DDL Keywords
  ...Array.from(SYNDRQL_KEYWORDS.DDL.entries()).map(([keyword, desc]) => 
    [keyword, { category: 'DDL', description: desc }] as [string, { category: string; description: string }]
  ),
  
  // DQL Keywords
  ...Array.from(SYNDRQL_KEYWORDS.DQL.entries()).map(([keyword, desc]) => 
    [keyword, { category: 'DQL', description: desc }] as [string, { category: string; description: string }]
  ),
  
  // DML Keywords
  ...Array.from(SYNDRQL_KEYWORDS.DML.entries()).map(([keyword, desc]) => 
    [keyword, { category: 'DML', description: desc }] as [string, { category: string; description: string }]
  ),
  
  // Objects
  ...Array.from(SYNDRQL_KEYWORDS.OBJECTS.entries()).map(([keyword, desc]) => 
    [keyword, { category: 'OBJECTS', description: desc }] as [string, { category: string; description: string }]
  ),
  
  // Fields
  ...Array.from(SYNDRQL_KEYWORDS.FIELDS.entries()).map(([keyword, desc]) => 
    [keyword, { category: 'FIELDS', description: desc }] as [string, { category: string; description: string }]
  ),
  
  // Control
  ...Array.from(SYNDRQL_KEYWORDS.CONTROL.entries()).map(([keyword, desc]) => 
    [keyword, { category: 'CONTROL', description: desc }] as [string, { category: string; description: string }]
  ),
  
  // Security
  ...Array.from(SYNDRQL_KEYWORDS.SECURITY.entries()).map(([keyword, desc]) => 
    [keyword, { category: 'SECURITY', description: desc }] as [string, { category: string; description: string }]
  ),
  
  // System
  ...Array.from(SYNDRQL_KEYWORDS.SYSTEM.entries()).map(([keyword, desc]) => 
    [keyword, { category: 'SYSTEM', description: desc }] as [string, { category: string; description: string }]
  ),
  
  // Operators
  ...Array.from(SYNDRQL_KEYWORDS.OPERATORS.entries()).map(([keyword, desc]) => 
    [keyword, { category: 'OPERATORS', description: desc }] as [string, { category: string; description: string }]
  ),
  
  // Reserved
  ...Array.from(SYNDRQL_KEYWORDS.RESERVED.entries()).map(([keyword, desc]) => 
    [keyword, { category: 'RESERVED', description: desc }] as [string, { category: string; description: string }]
  )
]);

/**
 * Check if a given word is a SyndrQL keyword
 * @param word - The word to check (case-insensitive)
 * @returns True if the word is a keyword
 */
export function isSyndrQLKeyword(word: string): boolean {
  return ALL_SYNDRQL_KEYWORDS.has(word.toUpperCase());
}

/**
 * Get keyword information for a given word
 * @param word - The word to look up (case-insensitive)
 * @returns Keyword information or null if not found
 */
export function getKeywordInfo(word: string): { category: string; description: string } | null {
  return ALL_SYNDRQL_KEYWORDS.get(word.toUpperCase()) || null;
}

/**
 * Extract all keywords from a SyndrQL statement
 * @param statement - The SyndrQL statement to analyze
 * @returns Array of found keywords with their information
 */
export function extractKeywordsFromStatement(statement: string): Array<{ 
  keyword: string; 
  category: string; 
  description: string;
  position: number;
}> {
  const keywords: Array<{ keyword: string; category: string; description: string; position: number }> = [];
  const words = statement.split(/\s+/);
  let position = 0;
  
  for (const word of words) {
    const cleanWord = word.replace(/[^\w]/g, ''); // Remove punctuation
    const keywordInfo = getKeywordInfo(cleanWord);
    
    if (keywordInfo) {
      keywords.push({
        keyword: cleanWord.toUpperCase(),
        category: keywordInfo.category,
        description: keywordInfo.description,
        position: position
      });
    }
    
    position += word.length + 1; // +1 for space
  }
  
  return keywords;
}

/**
 * Get keywords by category
 * @param category - The category to filter by
 * @returns Map of keywords in the specified category
 */
export function getKeywordsByCategory(category: keyof typeof SYNDRQL_KEYWORDS): Map<string, string> {
  return SYNDRQL_KEYWORDS[category];
}

/**
 * Get all keyword categories
 * @returns Array of all available categories
 */
export function getKeywordCategories(): string[] {
  return Object.keys(SYNDRQL_KEYWORDS);
}

/**
 * Identifies the type of SyndrQL statement based on its leading keywords
 * @param statement - The SyndrQL statement to analyze
 * @returns The statement type or 'UNKNOWN' if not recognized
 */
export function identifyStatementType(statement: string): string {
  const trimmed = statement.trim().toUpperCase();
  
  if (trimmed.startsWith('CREATE DATABASE')) return 'CREATE_DATABASE';
  if (trimmed.startsWith('DELETE DATABASE') || trimmed.startsWith('DROP DATABASE')) return 'DROP_DATABASE';
  if (trimmed.startsWith('CREATE BUNDLE')) return 'CREATE_BUNDLE';
  if (trimmed.startsWith('DELETE BUNDLE') || trimmed.startsWith('DROP BUNDLE')) return 'DROP_BUNDLE';
  if (trimmed.startsWith('UPDATE BUNDLE')) return 'UPDATE_BUNDLE';
  if (trimmed.startsWith('CREATE BTREE INDEX')) return 'CREATE_BTREE_INDEX';
  if (trimmed.startsWith('CREATE HASH INDEX')) return 'CREATE_HASH_INDEX';
  if (trimmed.startsWith('SELECT DATABASES')) return 'SELECT_DATABASES';
  if (trimmed.startsWith('SELECT DOCUMENTS')) return 'SELECT_DOCUMENTS';
  if (trimmed.startsWith('SELECT DOCUMENTS')) return 'SELECT_ALL';
  if (trimmed.startsWith('ADD DOCUMENT')) return 'INSERT_DOCUMENT';
  if (trimmed.startsWith('UPDATE DOCUMENTS')) return 'UPDATE_DOCUMENTS';
  if (trimmed.startsWith('DELETE DOCUMENTS')) return 'DELETE_DOCUMENTS';
  if (trimmed.startsWith('USE ')) return 'USE_DATABASE';
  if (trimmed.startsWith('SHOW DATABASES')) return 'SHOW_DATABASES';
  if (trimmed.startsWith('SHOW BUNDLES FOR')) return 'SHOW_BUNDLES_FOR_DATABASE';
  if (trimmed.startsWith('SHOW BUNDLES')) return 'SHOW_BUNDLES';
  if (trimmed.startsWith('SHOW BUNDLE ')) return 'SHOW_BUNDLE_DETAILS';
  if (trimmed.startsWith('SHOW USERS')) return 'SHOW_USERS';
  if (trimmed.startsWith('SHOW RATE LIMIT')) return 'SHOW_RATE_LIMIT';
  if (trimmed.startsWith('GRANT ')) return 'GRANT_PERMISSION';
  if (trimmed.startsWith('ATTACH ')) return 'ATTACH_RESOURCE';
  if (trimmed.startsWith('INVALIDATE SESSION')) return 'INVALIDATE_SESSION';
  
  return 'UNKNOWN';
}

/**
 * Validates if a statement has the minimum required keywords for its type
 * @param statement - The SyndrQL statement to validate
 * @returns Validation result with success status and any issues
 */
export function validateStatementKeywords(statement: string): { 
  isValid: boolean; 
  statementType: string; 
  issues: string[]; 
  requiredKeywords: string[];
  foundKeywords: string[];
} {
  const statementType = identifyStatementType(statement);
  const foundKeywords = extractKeywordsFromStatement(statement).map(k => k.keyword);
  const issues: string[] = [];
  
  // Define required keywords for each statement type
  const requiredKeywords: { [key: string]: string[] } = {
    'CREATE_DATABASE': ['CREATE', 'DATABASE'],
    'DROP_DATABASE': ['DELETE', 'DATABASE'],
    'CREATE_BUNDLE': ['CREATE', 'BUNDLE', 'WITH', 'FIELDS'],
    'DROP_BUNDLE': ['DELETE', 'BUNDLE'],
    'UPDATE_BUNDLE': ['UPDATE', 'BUNDLE'],
    'CREATE_BTREE_INDEX': ['CREATE', 'BTREE', 'INDEX', 'ON', 'BUNDLE'],
    'CREATE_HASH_INDEX': ['CREATE', 'HASH', 'INDEX', 'ON', 'BUNDLE'],
    'SELECT_DOCUMENTS': ['SELECT', 'DOCUMENTS', 'FROM'],
    'SELECT_ALL': ['SELECT', 'FROM'],
    'INSERT_DOCUMENT': ['ADD', 'DOCUMENT', 'TO', 'BUNDLE', 'WITH'],
    'UPDATE_DOCUMENTS': ['UPDATE', 'DOCUMENTS', 'IN', 'BUNDLE'],
    'DELETE_DOCUMENTS': ['DELETE', 'DOCUMENTS', 'FROM', 'BUNDLE'],
    'USE_DATABASE': ['USE'],
    'SHOW_DATABASES': ['SHOW', 'DATABASES'],
    'SHOW_BUNDLES': ['SHOW', 'BUNDLES'],
    'SHOW_BUNDLES_FOR_DATABASE': ['SHOW', 'BUNDLES', 'FOR'],
    'SHOW_USERS': ['SHOW', 'USERS'],
    'GRANT_PERMISSION': ['GRANT', 'ON', 'TO'],
    'INVALIDATE_SESSION': ['INVALIDATE', 'SESSION']
  };
  
  const required = requiredKeywords[statementType] || [];
  
  // Check for missing required keywords
  for (const keyword of required) {
    if (!foundKeywords.includes(keyword)) {
      issues.push(`Missing required keyword: ${keyword}`);
    }
  }
  
  const isValid = issues.length === 0 && statementType !== 'UNKNOWN';
  
  if (statementType === 'UNKNOWN') {
    issues.push('Unable to identify statement type');
  }
  
  return {
    isValid,
    statementType,
    issues,
    requiredKeywords: required,
    foundKeywords
  };
}

/**
 * Highlights SyndrQL keywords in a string by wrapping them with span elements
 * @param input - The input string containing SyndrQL code
 * @returns The input string with keywords wrapped in <span class="text-info"> elements
 */
export function highlightKeywords(input: string): string {
  if (!input || typeof input !== 'string') {
    return input;
  }

  // Get all keywords from our keyword maps
  const allKeywords = Array.from(ALL_SYNDRQL_KEYWORDS.keys());
  
  // Sort keywords by length (longest first) to avoid partial matches
  // e.g., match "DATABASE" before "DATA" 
  const sortedKeywords = allKeywords.sort((a, b) => b.length - a.length);
  
  // Create a regex pattern that matches any of our keywords
  // Use word boundaries (\b) to ensure we only match whole words
  const keywordPattern = sortedKeywords
    .map(keyword => `\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
    .join('|');
  
  const regex = new RegExp(`(${keywordPattern})`, 'gi');
  
  // Replace keywords with highlighted spans, but preserve the original case
  return input.replace(regex, (match) => {
    // Check if this match is actually a keyword (case-insensitive)
    if (isSyndrQLKeyword(match)) {
      return `<span class="text-info">${match}</span>`;
    }
    return match;
  });
}

/**
 * Highlights SyndrQL keywords in a string with custom wrapper elements
 * @param input - The input string containing SyndrQL code
 * @param wrapperStart - The opening wrapper (default: '<span class="text-info">')
 * @param wrapperEnd - The closing wrapper (default: '</span>')
 * @returns The input string with keywords wrapped in custom elements
 */
export function highlightKeywordsCustom(
  input: string, 
  wrapperStart: string = '<span class="text-info">', 
  wrapperEnd: string = '</span>'
): string {
  if (!input || typeof input !== 'string') {
    return input;
  }

  // Get all keywords from our keyword maps
  const allKeywords = Array.from(ALL_SYNDRQL_KEYWORDS.keys());
  
  // Sort keywords by length (longest first) to avoid partial matches
  const sortedKeywords = allKeywords.sort((a, b) => b.length - a.length);
  
  // Create a regex pattern that matches any of our keywords
  const keywordPattern = sortedKeywords
    .map(keyword => `\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
    .join('|');
  
  const regex = new RegExp(`(${keywordPattern})`, 'gi');
  
  // Replace keywords with custom wrappers, preserving original case
  return input.replace(regex, (match) => {
    if (isSyndrQLKeyword(match)) {
      return `${wrapperStart}${match}${wrapperEnd}`;
    }
    return match;
  });
}
