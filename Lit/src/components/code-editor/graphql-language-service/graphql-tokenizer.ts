/**
 * GraphQL Tokenizer — Character-by-character scanner
 *
 * Follows the GraphQL specification lexical grammar:
 * https://spec.graphql.org/October2021/#sec-Appendix-Grammar-Summary.Lexical-Tokens
 *
 * Produces a flat array of GraphQLToken for a given source string.
 */

import { GraphQLTokenType, GRAPHQL_KEYWORDS, type GraphQLToken } from './graphql-token-types.js';

export class GraphQLTokenizer {
  private source = '';
  private pos = 0;
  private line = 1;
  private column = 1;

  /**
   * Tokenize a full GraphQL source string.
   */
  tokenize(source: string): GraphQLToken[] {
    this.source = source;
    this.pos = 0;
    this.line = 1;
    this.column = 1;

    const tokens: GraphQLToken[] = [];

    while (this.pos < this.source.length) {
      const token = this.nextToken();
      if (token) {
        tokens.push(token);
      }
    }

    // EOF token
    tokens.push(this.makeToken(GraphQLTokenType.EOF, '', this.pos));
    return tokens;
  }

  // ── Core scanner ───────────────────────────────────────────────────────────

  private nextToken(): GraphQLToken | null {
    const ch = this.source[this.pos];

    // Whitespace (space, tab, BOM, formfeed — but NOT newline)
    if (ch === ' ' || ch === '\t' || ch === '\uFEFF' || ch === '\f') {
      return this.readWhitespace();
    }

    // Newlines
    if (ch === '\n') {
      return this.readNewline();
    }
    if (ch === '\r') {
      return this.readNewline();
    }

    // Comment: # to end of line
    if (ch === '#') {
      return this.readComment();
    }

    // Strings
    if (ch === '"') {
      // Check for block string """
      if (this.source[this.pos + 1] === '"' && this.source[this.pos + 2] === '"') {
        return this.readBlockString();
      }
      return this.readString();
    }

    // Numbers (IntValue / FloatValue)
    if (ch === '-' || (ch >= '0' && ch <= '9')) {
      return this.readNumber();
    }

    // Names and keywords: /[_A-Za-z][_0-9A-Za-z]*/
    if (this.isNameStart(ch)) {
      return this.readName();
    }

    // Spread: ...
    if (ch === '.' && this.source[this.pos + 1] === '.' && this.source[this.pos + 2] === '.') {
      const start = this.pos;
      this.advance(3);
      return this.makeToken(GraphQLTokenType.SPREAD, '...', start);
    }

    // Single-character punctuation
    const singleChar = this.readSingleCharToken(ch);
    if (singleChar) {
      return singleChar;
    }

    // Illegal character
    const start = this.pos;
    const value = ch;
    this.advance(1);
    return this.makeToken(GraphQLTokenType.ILLEGAL, value, start);
  }

  // ── Token readers ──────────────────────────────────────────────────────────

  private readWhitespace(): GraphQLToken {
    const start = this.pos;
    while (
      this.pos < this.source.length &&
      (this.source[this.pos] === ' ' ||
        this.source[this.pos] === '\t' ||
        this.source[this.pos] === '\uFEFF' ||
        this.source[this.pos] === '\f')
    ) {
      this.advance(1);
    }
    return this.makeToken(GraphQLTokenType.WHITESPACE, this.source.slice(start, this.pos), start);
  }

  private readNewline(): GraphQLToken {
    const start = this.pos;
    if (this.source[this.pos] === '\r' && this.source[this.pos + 1] === '\n') {
      this.pos += 2;
    } else {
      this.pos += 1;
    }
    const value = this.source.slice(start, this.pos);
    const token = this.makeTokenAt(GraphQLTokenType.NEWLINE, value, start, this.line, this.column);
    this.line++;
    this.column = 1;
    return token;
  }

  private readComment(): GraphQLToken {
    const start = this.pos;
    this.advance(1); // skip #
    while (this.pos < this.source.length && this.source[this.pos] !== '\n' && this.source[this.pos] !== '\r') {
      this.advance(1);
    }
    return this.makeToken(GraphQLTokenType.COMMENT, this.source.slice(start, this.pos), start);
  }

  private readString(): GraphQLToken {
    const start = this.pos;
    const startLine = this.line;
    const startCol = this.column;
    this.advance(1); // skip opening "

    let value = '';
    while (this.pos < this.source.length) {
      const ch = this.source[this.pos];

      if (ch === '"') {
        this.advance(1); // skip closing "
        return this.makeTokenAt(GraphQLTokenType.STRING_VALUE, this.source.slice(start, this.pos), start, startLine, startCol);
      }

      if (ch === '\\') {
        // escape sequence
        this.advance(1);
        if (this.pos < this.source.length) {
          this.advance(1);
        }
        continue;
      }

      if (ch === '\n' || ch === '\r') {
        // Unterminated string
        break;
      }

      this.advance(1);
    }

    // Unterminated string — return as illegal
    return this.makeTokenAt(GraphQLTokenType.ILLEGAL, this.source.slice(start, this.pos), start, startLine, startCol);
  }

  private readBlockString(): GraphQLToken {
    const start = this.pos;
    const startLine = this.line;
    const startCol = this.column;
    this.advance(3); // skip opening """

    while (this.pos < this.source.length) {
      if (
        this.source[this.pos] === '"' &&
        this.source[this.pos + 1] === '"' &&
        this.source[this.pos + 2] === '"'
      ) {
        this.advance(3); // skip closing """
        return this.makeTokenAt(GraphQLTokenType.BLOCK_STRING, this.source.slice(start, this.pos), start, startLine, startCol);
      }

      // Handle newlines inside block strings
      if (this.source[this.pos] === '\n') {
        this.pos++;
        this.line++;
        this.column = 1;
        continue;
      }
      if (this.source[this.pos] === '\r') {
        this.pos++;
        if (this.source[this.pos] === '\n') {
          this.pos++;
        }
        this.line++;
        this.column = 1;
        continue;
      }

      this.advance(1);
    }

    // Unterminated block string
    return this.makeTokenAt(GraphQLTokenType.ILLEGAL, this.source.slice(start, this.pos), start, startLine, startCol);
  }

  private readNumber(): GraphQLToken {
    const start = this.pos;
    let isFloat = false;

    // Optional negative sign
    if (this.source[this.pos] === '-') {
      this.advance(1);
    }

    // Integer part
    if (this.source[this.pos] === '0') {
      this.advance(1);
    } else if (this.source[this.pos] >= '1' && this.source[this.pos] <= '9') {
      this.advance(1);
      while (this.pos < this.source.length && this.source[this.pos] >= '0' && this.source[this.pos] <= '9') {
        this.advance(1);
      }
    }

    // Fractional part
    if (this.pos < this.source.length && this.source[this.pos] === '.') {
      isFloat = true;
      this.advance(1);
      while (this.pos < this.source.length && this.source[this.pos] >= '0' && this.source[this.pos] <= '9') {
        this.advance(1);
      }
    }

    // Exponent part
    if (this.pos < this.source.length && (this.source[this.pos] === 'e' || this.source[this.pos] === 'E')) {
      isFloat = true;
      this.advance(1);
      if (this.pos < this.source.length && (this.source[this.pos] === '+' || this.source[this.pos] === '-')) {
        this.advance(1);
      }
      while (this.pos < this.source.length && this.source[this.pos] >= '0' && this.source[this.pos] <= '9') {
        this.advance(1);
      }
    }

    const value = this.source.slice(start, this.pos);
    return this.makeToken(isFloat ? GraphQLTokenType.FLOAT_VALUE : GraphQLTokenType.INT_VALUE, value, start);
  }

  private readName(): GraphQLToken {
    const start = this.pos;
    this.advance(1);
    while (this.pos < this.source.length && this.isNameContinue(this.source[this.pos])) {
      this.advance(1);
    }

    const value = this.source.slice(start, this.pos);

    // Check for keywords
    if (GRAPHQL_KEYWORDS.has(value)) {
      const keywordType = value as GraphQLTokenType;
      return this.makeToken(keywordType, value, start);
    }

    return this.makeToken(GraphQLTokenType.NAME, value, start);
  }

  private readSingleCharToken(ch: string): GraphQLToken | null {
    const start = this.pos;
    let type: GraphQLTokenType | null = null;

    switch (ch) {
      case '!': type = GraphQLTokenType.BANG; break;
      case '$': type = GraphQLTokenType.DOLLAR; break;
      case '&': type = GraphQLTokenType.AMP; break;
      case '(': type = GraphQLTokenType.LPAREN; break;
      case ')': type = GraphQLTokenType.RPAREN; break;
      case '[': type = GraphQLTokenType.LBRACKET; break;
      case ']': type = GraphQLTokenType.RBRACKET; break;
      case '{': type = GraphQLTokenType.LBRACE; break;
      case '}': type = GraphQLTokenType.RBRACE; break;
      case ':': type = GraphQLTokenType.COLON; break;
      case '=': type = GraphQLTokenType.EQUALS; break;
      case '@': type = GraphQLTokenType.AT; break;
      case '|': type = GraphQLTokenType.PIPE; break;
      case ',': type = GraphQLTokenType.COMMA; break;
      default: return null;
    }

    this.advance(1);
    return this.makeToken(type, ch, start);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private isNameStart(ch: string): boolean {
    return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_';
  }

  private isNameContinue(ch: string): boolean {
    return this.isNameStart(ch) || (ch >= '0' && ch <= '9');
  }

  private advance(count: number): void {
    for (let i = 0; i < count; i++) {
      this.pos++;
      this.column++;
    }
  }

  private makeToken(type: GraphQLTokenType, value: string, startPos: number): GraphQLToken {
    // Calculate the line/column at the start position
    // Since we track line/column as we go, we need the line/column at startPos.
    // For single-line tokens this works via a cached approach:
    const col = this.column - (this.pos - startPos);
    return {
      Type: type,
      Value: value,
      Literal: value,
      Line: this.line,
      Column: Math.max(1, col),
      StartPosition: startPos,
      EndPosition: this.pos,
    };
  }

  private makeTokenAt(
    type: GraphQLTokenType,
    value: string,
    startPos: number,
    line: number,
    column: number,
  ): GraphQLToken {
    return {
      Type: type,
      Value: value,
      Literal: value,
      Line: line,
      Column: column,
      StartPosition: startPos,
      EndPosition: this.pos,
    };
  }
}
