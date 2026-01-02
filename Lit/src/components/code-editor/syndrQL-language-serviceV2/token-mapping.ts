/**
 * Token Type Mapping System for V2 Renderer
 * 
 * Maps V2's specific token types (TOKEN_SELECT, TOKEN_CREATE, etc.) to 
 * V1's generic rendering categories (KEYWORD, IDENTIFIER, etc.) for theme color application.
 * 
 * This enables V2's comprehensive tokenization to use the existing theme infrastructure
 * while maintaining backward compatibility with the rendering system.
 */

import { TokenType } from './token_types.js';

/**
 * Rendering categories that map to theme colors
 * These match V1's TokenType enum for rendering purposes
 */
export enum RenderingCategory {
  KEYWORD = 'keyword',
  IDENTIFIER = 'identifier',
  LITERAL = 'literal',
  OPERATOR = 'operator',
  PUNCTUATION = 'punctuation',
  WHITESPACE = 'whitespace',
  NEWLINE = 'newline',
  COMMENT = 'comment',
  STRING = 'string',
  NUMBER = 'number',
  PLACEHOLDER = 'placeholder',
  UNKNOWN = 'unknown'
}

/**
 * Maps V2 token types to rendering categories
 * Multiple V2 tokens can map to the same rendering category
 */
const TOKEN_TO_RENDERING_CATEGORY: Map<TokenType, RenderingCategory> = new Map([
  // DDL Keywords
  [TokenType.TOKEN_CREATE, RenderingCategory.KEYWORD],
  [TokenType.TOKEN_ALTER, RenderingCategory.KEYWORD],
  [TokenType.TOKEN_DROP, RenderingCategory.KEYWORD],
  [TokenType.TOKEN_SHOW, RenderingCategory.KEYWORD],
  [TokenType.TOKEN_DATABASE, RenderingCategory.KEYWORD],
  [TokenType.TOKEN_DATABASES, RenderingCategory.KEYWORD],
  [TokenType.TOKEN_BUNDLE, RenderingCategory.KEYWORD],
  [TokenType.TOKEN_BUNDLES, RenderingCategory.KEYWORD],
  [TokenType.TOKEN_FIELD, RenderingCategory.KEYWORD],
  [TokenType.TOKEN_INDEX, RenderingCategory.KEYWORD],
  
  // DML Keywords
  [TokenType.TOKEN_SELECT, RenderingCategory.KEYWORD],
  [TokenType.TOKEN_ADD, RenderingCategory.KEYWORD],
  [TokenType.TOKEN_UPDATE, RenderingCategory.KEYWORD],
  [TokenType.TOKEN_DELETE, RenderingCategory.KEYWORD],
  [TokenType.TOKEN_FROM, RenderingCategory.KEYWORD],
  [TokenType.TOKEN_WHERE, RenderingCategory.KEYWORD],
  [TokenType.TOKEN_SET, RenderingCategory.KEYWORD],
  [TokenType.TOKEN_TO, RenderingCategory.KEYWORD],
  [TokenType.TOKEN_IN, RenderingCategory.KEYWORD],
  
  // DOL Keywords
  [TokenType.TOKEN_GRANT, RenderingCategory.KEYWORD],
  [TokenType.TOKEN_REVOKE, RenderingCategory.KEYWORD],
  [TokenType.TOKEN_ON, RenderingCategory.KEYWORD],
  [TokenType.TOKEN_FOR, RenderingCategory.KEYWORD],
  
  // Migration Keywords
  [TokenType.TOKEN_MIGRATION, RenderingCategory.KEYWORD],
  [TokenType.TOKEN_APPLY, RenderingCategory.KEYWORD],
  [TokenType.TOKEN_VALIDATE, RenderingCategory.KEYWORD],
  [TokenType.TOKEN_ROLLBACK, RenderingCategory.KEYWORD],
  
  // Other Keywords
  [TokenType.TOKEN_USE, RenderingCategory.KEYWORD],
  [TokenType.TOKEN_AS, RenderingCategory.KEYWORD],
  [TokenType.TOKEN_AND, RenderingCategory.KEYWORD],
  [TokenType.TOKEN_OR, RenderingCategory.KEYWORD],
  [TokenType.TOKEN_NOT, RenderingCategory.KEYWORD],
  [TokenType.TOKEN_NULL, RenderingCategory.KEYWORD],
  [TokenType.TOKEN_TRUE, RenderingCategory.KEYWORD],
  [TokenType.TOKEN_FALSE, RenderingCategory.KEYWORD],
  [TokenType.TOKEN_UNIQUE, RenderingCategory.KEYWORD],
  [TokenType.TOKEN_NULLABLE, RenderingCategory.KEYWORD],
  [TokenType.TOKEN_DEFAULT, RenderingCategory.KEYWORD],
  [TokenType.TOKEN_REFERENCES, RenderingCategory.KEYWORD],
  [TokenType.TOKEN_KEYWORD, RenderingCategory.KEYWORD],
  
  // Identifiers
  [TokenType.TOKEN_IDENT, RenderingCategory.IDENTIFIER],
  [TokenType.TOKEN_IDENTIFIER, RenderingCategory.IDENTIFIER],
  
  // Literals
  [TokenType.TOKEN_STRING, RenderingCategory.STRING],
  [TokenType.TOKEN_NUMBER, RenderingCategory.NUMBER],
  
  // Operators
  [TokenType.TOKEN_OPERATOR, RenderingCategory.OPERATOR],
  [TokenType.TOKEN_ASSIGN, RenderingCategory.OPERATOR],
  [TokenType.TOKEN_EQ, RenderingCategory.OPERATOR],
  [TokenType.TOKEN_NE, RenderingCategory.OPERATOR],
  [TokenType.TOKEN_NOT_EQ, RenderingCategory.OPERATOR],
  [TokenType.TOKEN_LT, RenderingCategory.OPERATOR],
  [TokenType.TOKEN_LE, RenderingCategory.OPERATOR],
  [TokenType.TOKEN_LT_EQ, RenderingCategory.OPERATOR],
  [TokenType.TOKEN_GT, RenderingCategory.OPERATOR],
  [TokenType.TOKEN_GE, RenderingCategory.OPERATOR],
  [TokenType.TOKEN_GT_EQ, RenderingCategory.OPERATOR],
  [TokenType.TOKEN_PLUS, RenderingCategory.OPERATOR],
  [TokenType.TOKEN_MINUS, RenderingCategory.OPERATOR],
  [TokenType.TOKEN_ASTERISK, RenderingCategory.OPERATOR],
  [TokenType.TOKEN_SLASH, RenderingCategory.OPERATOR],
  [TokenType.TOKEN_PERCENT, RenderingCategory.OPERATOR],
  
  // Punctuation
  [TokenType.TOKEN_COMMA, RenderingCategory.PUNCTUATION],
  [TokenType.TOKEN_SEMICOLON, RenderingCategory.PUNCTUATION],
  [TokenType.TOKEN_DOT, RenderingCategory.PUNCTUATION],
  [TokenType.TOKEN_COLON, RenderingCategory.PUNCTUATION],
  [TokenType.TOKEN_LPAREN, RenderingCategory.PUNCTUATION],
  [TokenType.TOKEN_RPAREN, RenderingCategory.PUNCTUATION],
  [TokenType.TOKEN_LBRACE, RenderingCategory.PUNCTUATION],
  [TokenType.TOKEN_RBRACE, RenderingCategory.PUNCTUATION],
  [TokenType.TOKEN_LBRACKET, RenderingCategory.PUNCTUATION],
  [TokenType.TOKEN_RBRACKET, RenderingCategory.PUNCTUATION],
  
  // Special
  [TokenType.TOKEN_NEWLINE, RenderingCategory.NEWLINE],
  [TokenType.TOKEN_WHITESPACE, RenderingCategory.WHITESPACE],
  [TokenType.TOKEN_COMMENT, RenderingCategory.COMMENT],
  [TokenType.TOKEN_ILLEGAL, RenderingCategory.UNKNOWN],
  [TokenType.TOKEN_UNKNOWN, RenderingCategory.UNKNOWN],
  [TokenType.TOKEN_EOF, RenderingCategory.WHITESPACE], // Treat EOF as whitespace (no visual rendering)
]);

/**
 * Get the rendering category for a V2 token type
 * @param tokenType V2 TokenType enum value
 * @returns Rendering category for theme color lookup
 */
export function getRenderingCategory(tokenType: TokenType): RenderingCategory {
  const category = TOKEN_TO_RENDERING_CATEGORY.get(tokenType);
  
  // Default to UNKNOWN if no mapping exists
  if (!category) {
    console.warn(`No rendering category mapping for token type: ${tokenType}`);
    return RenderingCategory.UNKNOWN;
  }
  
  return category;
}

/**
 * Check if a token type should be rendered with an error underline
 * @param tokenType V2 TokenType enum value
 * @returns true if token should have error underline (small squiggly)
 */
export function shouldRenderTokenError(tokenType: TokenType): boolean {
  return tokenType === TokenType.TOKEN_ILLEGAL || tokenType === TokenType.TOKEN_UNKNOWN;
}

/**
 * Check if a token type is a keyword
 * @param tokenType V2 TokenType enum value
 * @returns true if token is a keyword type
 */
export function isKeywordToken(tokenType: TokenType): boolean {
  const category = getRenderingCategory(tokenType);
  return category === RenderingCategory.KEYWORD;
}

/**
 * Check if a token type is an operator
 * @param tokenType V2 TokenType enum value
 * @returns true if token is an operator type
 */
export function isOperatorToken(tokenType: TokenType): boolean {
  const category = getRenderingCategory(tokenType);
  return category === RenderingCategory.OPERATOR;
}

/**
 * Check if a token type should be skipped during rendering (whitespace/newline)
 * @param tokenType V2 TokenType enum value
 * @returns true if token should not be visually rendered
 */
export function shouldSkipRendering(tokenType: TokenType): boolean {
  const category = getRenderingCategory(tokenType);
  return category === RenderingCategory.WHITESPACE || 
         category === RenderingCategory.NEWLINE ||
         tokenType === TokenType.TOKEN_EOF;
}
