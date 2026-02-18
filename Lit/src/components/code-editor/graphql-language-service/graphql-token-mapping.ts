/**
 * GraphQL Token → RenderingCategory Mapping
 *
 * Maps GraphQL token types to the shared RenderingCategory enum
 * so the same SyntaxTheme colors can be applied.
 */

import { GraphQLTokenType } from './graphql-token-types.js';
import { RenderingCategory } from '../syndrQL-language-serviceV2/token-mapping.js';

const TOKEN_TO_CATEGORY = new Map<GraphQLTokenType, RenderingCategory>([
  // Keywords
  [GraphQLTokenType.QUERY, RenderingCategory.KEYWORD],
  [GraphQLTokenType.MUTATION, RenderingCategory.KEYWORD],
  [GraphQLTokenType.SUBSCRIPTION, RenderingCategory.KEYWORD],
  [GraphQLTokenType.FRAGMENT, RenderingCategory.KEYWORD],
  [GraphQLTokenType.ON, RenderingCategory.KEYWORD],
  [GraphQLTokenType.TRUE, RenderingCategory.KEYWORD],
  [GraphQLTokenType.FALSE, RenderingCategory.KEYWORD],
  [GraphQLTokenType.NULL, RenderingCategory.KEYWORD],

  // Names / identifiers
  [GraphQLTokenType.NAME, RenderingCategory.IDENTIFIER],

  // Values
  [GraphQLTokenType.INT_VALUE, RenderingCategory.NUMBER],
  [GraphQLTokenType.FLOAT_VALUE, RenderingCategory.NUMBER],
  [GraphQLTokenType.STRING_VALUE, RenderingCategory.STRING],
  [GraphQLTokenType.BLOCK_STRING, RenderingCategory.STRING],

  // Punctuation
  [GraphQLTokenType.LBRACE, RenderingCategory.PUNCTUATION],
  [GraphQLTokenType.RBRACE, RenderingCategory.PUNCTUATION],
  [GraphQLTokenType.LPAREN, RenderingCategory.PUNCTUATION],
  [GraphQLTokenType.RPAREN, RenderingCategory.PUNCTUATION],
  [GraphQLTokenType.LBRACKET, RenderingCategory.PUNCTUATION],
  [GraphQLTokenType.RBRACKET, RenderingCategory.PUNCTUATION],
  [GraphQLTokenType.COLON, RenderingCategory.PUNCTUATION],
  [GraphQLTokenType.COMMA, RenderingCategory.PUNCTUATION],

  // Operators / sigils
  [GraphQLTokenType.BANG, RenderingCategory.OPERATOR],
  [GraphQLTokenType.DOLLAR, RenderingCategory.OPERATOR],
  [GraphQLTokenType.AMP, RenderingCategory.OPERATOR],
  [GraphQLTokenType.EQUALS, RenderingCategory.OPERATOR],
  [GraphQLTokenType.AT, RenderingCategory.OPERATOR],
  [GraphQLTokenType.PIPE, RenderingCategory.OPERATOR],
  [GraphQLTokenType.SPREAD, RenderingCategory.OPERATOR],

  // Special
  [GraphQLTokenType.COMMENT, RenderingCategory.COMMENT],
  [GraphQLTokenType.WHITESPACE, RenderingCategory.WHITESPACE],
  [GraphQLTokenType.NEWLINE, RenderingCategory.NEWLINE],
  [GraphQLTokenType.ILLEGAL, RenderingCategory.UNKNOWN],
  [GraphQLTokenType.EOF, RenderingCategory.WHITESPACE],
]);

/**
 * Get the rendering category for a GraphQL token type.
 */
export function getGraphQLRenderingCategory(tokenType: GraphQLTokenType): RenderingCategory {
  return TOKEN_TO_CATEGORY.get(tokenType) ?? RenderingCategory.UNKNOWN;
}

/**
 * Whether a GraphQL token should be skipped during rendering.
 */
export function shouldSkipGraphQLRendering(tokenType: GraphQLTokenType): boolean {
  return (
    tokenType === GraphQLTokenType.WHITESPACE ||
    tokenType === GraphQLTokenType.NEWLINE ||
    tokenType === GraphQLTokenType.EOF
  );
}
