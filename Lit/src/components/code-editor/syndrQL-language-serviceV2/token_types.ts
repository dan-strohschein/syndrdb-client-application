/**
 * Token types for SyndrQL tokenizer
 */

export enum TokenType {
    // Literals
    TOKEN_IDENT = 'IDENT',
    TOKEN_IDENTIFIER = 'IDENTIFIER',
    TOKEN_STRING = 'STRING',
    TOKEN_NUMBER = 'NUMBER',
    
    // Keywords (will be identified during parsing)
    TOKEN_KEYWORD = 'KEYWORD',
    
    // SyndrQL Keywords - DDL
    TOKEN_CREATE = 'CREATE',
    TOKEN_ALTER = 'ALTER',
    TOKEN_DROP = 'DROP',
    TOKEN_SHOW = 'SHOW',
    TOKEN_DATABASE = 'DATABASE',
    TOKEN_DATABASES = 'DATABASES',
    TOKEN_BUNDLE = 'BUNDLE',
    TOKEN_BUNDLES = 'BUNDLES',
    TOKEN_FIELD = 'FIELD',
    TOKEN_INDEX = 'INDEX',
    
    // SyndrQL Keywords - DML
    TOKEN_SELECT = 'SELECT',
    TOKEN_ADD = 'ADD',
    TOKEN_UPDATE = 'UPDATE',
    TOKEN_DELETE = 'DELETE',
    TOKEN_FROM = 'FROM',
    TOKEN_WHERE = 'WHERE',
    TOKEN_SET = 'SET',
    TOKEN_TO = 'TO',
    TOKEN_IN = 'IN',
    
    // SyndrQL Keywords - DOL
    TOKEN_GRANT = 'GRANT',
    TOKEN_REVOKE = 'REVOKE',
    TOKEN_ON = 'ON',
    TOKEN_FOR = 'FOR',
    
    // SyndrQL Keywords - Migration
    TOKEN_MIGRATION = 'MIGRATION',
    TOKEN_APPLY = 'APPLY',
    TOKEN_VALIDATE = 'VALIDATE',
    TOKEN_ROLLBACK = 'ROLLBACK',
    
    // Other Keywords
    TOKEN_USE = 'USE',
    TOKEN_AS = 'AS',
    TOKEN_AND = 'AND',
    TOKEN_OR = 'OR',
    TOKEN_NOT = 'NOT',
    TOKEN_NULL = 'NULL',
    TOKEN_TRUE = 'TRUE',
    TOKEN_FALSE = 'FALSE',
    TOKEN_UNIQUE = 'UNIQUE',
    TOKEN_NULLABLE = 'NULLABLE',
    TOKEN_DEFAULT = 'DEFAULT',
    TOKEN_REFERENCES = 'REFERENCES',
    
    // Operators
    TOKEN_OPERATOR = 'OPERATOR',
    TOKEN_ASSIGN = 'ASSIGN',
    TOKEN_EQ = 'EQ',
    TOKEN_NE = 'NE',
    TOKEN_NOT_EQ = 'NOT_EQ',
    TOKEN_LT = 'LT',
    TOKEN_LE = 'LE',
    TOKEN_LT_EQ = 'LT_EQ',
    TOKEN_GT = 'GT',
    TOKEN_GE = 'GE',
    TOKEN_GT_EQ = 'GT_EQ',
    TOKEN_PLUS = 'PLUS',
    TOKEN_MINUS = 'MINUS',
    TOKEN_ASTERISK = 'ASTERISK',
    TOKEN_SLASH = 'SLASH',
    TOKEN_PERCENT = 'PERCENT',
    
    // Punctuation
    TOKEN_COMMA = 'COMMA',
    TOKEN_SEMICOLON = 'SEMICOLON',
    TOKEN_DOT = 'DOT',
    TOKEN_COLON = 'COLON',
    TOKEN_LPAREN = 'LPAREN',
    TOKEN_RPAREN = 'RPAREN',
    TOKEN_LBRACE = 'LBRACE',
    TOKEN_RBRACE = 'RBRACE',
    TOKEN_LBRACKET = 'LBRACKET',
    TOKEN_RBRACKET = 'RBRACKET',
    
    // Special
    TOKEN_NEWLINE = 'NEWLINE',
    TOKEN_WHITESPACE = 'WHITESPACE',
    TOKEN_COMMENT = 'COMMENT',
    TOKEN_EOF = 'EOF',
    TOKEN_ILLEGAL = 'ILLEGAL',
    TOKEN_UNKNOWN = 'UNKNOWN'
}
