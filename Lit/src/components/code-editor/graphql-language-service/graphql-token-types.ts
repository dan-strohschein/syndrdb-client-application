/**
 * GraphQL Token Types
 *
 * Enum of all token types produced by the GraphQL tokenizer.
 * Follows the GraphQL specification lexical grammar.
 */

export enum GraphQLTokenType {
  // Keywords
  QUERY = 'query',
  MUTATION = 'mutation',
  SUBSCRIPTION = 'subscription',
  FRAGMENT = 'fragment',
  ON = 'on',
  TRUE = 'true',
  FALSE = 'false',
  NULL = 'null',

  // Names / identifiers
  NAME = 'name',

  // Values
  INT_VALUE = 'int_value',
  FLOAT_VALUE = 'float_value',
  STRING_VALUE = 'string_value',
  BLOCK_STRING = 'block_string',

  // Punctuation
  BANG = 'bang',               // !
  DOLLAR = 'dollar',           // $
  AMP = 'amp',                 // &
  LPAREN = 'lparen',           // (
  RPAREN = 'rparen',           // )
  LBRACKET = 'lbracket',       // [
  RBRACKET = 'rbracket',       // ]
  LBRACE = 'lbrace',           // {
  RBRACE = 'rbrace',           // }
  COLON = 'colon',             // :
  EQUALS = 'equals',           // =
  AT = 'at',                   // @
  PIPE = 'pipe',               // |
  SPREAD = 'spread',           // ...

  // Special
  COMMENT = 'comment',         // # to end of line
  WHITESPACE = 'whitespace',
  NEWLINE = 'newline',
  COMMA = 'comma',             // , (insignificant in GraphQL)
  ILLEGAL = 'illegal',
  EOF = 'eof',
}

/** Set of GraphQL keywords (operation and value keywords). */
export const GRAPHQL_KEYWORDS = new Set<string>([
  'query', 'mutation', 'subscription', 'fragment', 'on',
  'true', 'false', 'null',
]);

/**
 * Shape of a GraphQL token produced by the tokenizer.
 */
export interface GraphQLToken {
  Type: GraphQLTokenType;
  Value: string;
  /** Original literal from source (same as Value for most tokens) */
  Literal: string;
  /** 1-based line number */
  Line: number;
  /** 1-based column number */
  Column: number;
  /** 0-based start character position in the source */
  StartPosition: number;
  /** 0-based end character position (exclusive) */
  EndPosition: number;
}
