/**
 * SyndrQL Tokenizer Implementation
 * Follows Single Responsibility Principle: Only handles tokenization of SyndrQL text
 * Clean implementation without whitespace handling bugs from original
 */

import { SyntaxToken, TokenType, ITokenizer } from './types.js';
import { 
  isSyndrQLKeyword, 
  isSyndrQLOperator, 
  isSyndrQLPunctuation,
  getKeywordInfo
} from './keywords.js';

/**
 * Clean, robust SyndrQL tokenizer
 * Handles whitespace, line breaks, and position tracking accurately
 */
export class SyndrQLTokenizer implements ITokenizer {
  private input: string = '';
  private position: number = 0;
  private line: number = 1;
  private column: number = 1;

  /**
   * Tokenize SyndrQL input text into syntax tokens
   */
  tokenize(input: string): SyntaxToken[] {
    this.input = input;
    this.position = 0;
    this.line = 1;
    this.column = 1;

    const tokens: SyntaxToken[] = [];

    while (this.position < this.input.length) {
      const token = this.nextToken();
      if (token) {
        tokens.push(token);
      }
    }

    return tokens;
  }

  /**
   * Extract the next token from input
   */
  private nextToken(): SyntaxToken | null {
    if (this.position >= this.input.length) {
      return null;
    }

    const startPos = this.position;
    const startLine = this.line;
    const startColumn = this.column;

    // Skip past token and get its value
    const tokenValue = this.consumeToken();
    if (!tokenValue) {
      return null;
    }

    // Determine token type
    const tokenType = this.classifyToken(tokenValue);

    return {
      type: tokenType,
      value: tokenValue,
      startPosition: startPos,
      endPosition: this.position,
      line: startLine,
      column: startColumn,
      semantic: this.getSemanticInfo(tokenValue, tokenType)
    };
  }

  /**
   * Consume and return the next token value from input
   */
  private consumeToken(): string | null {
    const char = this.input[this.position];

    // Handle newlines (preserve for formatting)
    if (char === '\n') {
      this.position++;
      this.line++;
      this.column = 1;
      return '\n';
    }

    if (char === '\r') {
      this.position++;
      // Handle \r\n sequences
      if (this.position < this.input.length && this.input[this.position] === '\n') {
        this.position++;
      }
      this.line++;
      this.column = 1;
      return '\r\n';
    }

    // Handle whitespace (spaces, tabs)
    if (this.isWhitespace(char)) {
      return this.consumeWhitespace();
    }

    // Handle string literals
    if (char === "'" || char === '"') {
      return this.consumeStringLiteral();
    }

    // Handle comments
    if (char === '-' && this.peek() === '-') {
      return this.consumeLineComment();
    }

    if (char === '/' && this.peek() === '*') {
      return this.consumeBlockComment();
    }

    // Handle numbers
    if (this.isDigit(char)) {
      return this.consumeNumber();
    }

    // Handle operators (check multi-character first)
    const multiCharOp = this.tryConsumeMultiCharOperator();
    if (multiCharOp) {
      return multiCharOp;
    }

    // Handle single-character operators and punctuation
    if (isSyndrQLOperator(char) || isSyndrQLPunctuation(char)) {
      this.position++;
      this.column++;
      return char;
    }

    // Handle identifiers and keywords
    if (this.isIdentifierStart(char)) {
      return this.consumeIdentifier();
    }

    // Handle unknown characters
    this.position++;
    this.column++;
    return char;
  }

  /**
   * Consume whitespace characters
   */
  private consumeWhitespace(): string {
    const start = this.position;
    
    while (this.position < this.input.length && 
           this.isWhitespace(this.input[this.position]) &&
           this.input[this.position] !== '\n' && 
           this.input[this.position] !== '\r') {
      this.position++;
      this.column++;
    }

    return this.input.substring(start, this.position);
  }

  /**
   * Consume string literal with proper escape handling
   */
  private consumeStringLiteral(): string {
    const quote = this.input[this.position];
    const start = this.position;
    
    this.position++; // Skip opening quote
    this.column++;

    while (this.position < this.input.length) {
      const char = this.input[this.position];
      
      if (char === quote) {
        // Check for escaped quote
        if (this.position + 1 < this.input.length && this.input[this.position + 1] === quote) {
          this.position += 2; // Skip escaped quote
          this.column += 2;
          continue;
        }
        // End of string
        this.position++;
        this.column++;
        break;
      }

      if (char === '\n') {
        this.line++;
        this.column = 1;
      } else {
        this.column++;
      }
      
      this.position++;
    }

    return this.input.substring(start, this.position);
  }

  /**
   * Consume line comment (-- comment)
   */
  private consumeLineComment(): string {
    const start = this.position;
    
    // Skip the '--'
    this.position += 2;
    this.column += 2;

    // Read until end of line
    while (this.position < this.input.length && 
           this.input[this.position] !== '\n' && 
           this.input[this.position] !== '\r') {
      this.position++;
      this.column++;
    }

    return this.input.substring(start, this.position);
  }

  /**
   * Consume block comment (slash-star comment star-slash)
   */
  private consumeBlockComment(): string {
    const start = this.position;
    
    // Skip the '/*'
    this.position += 2;
    this.column += 2;

    while (this.position < this.input.length - 1) {
      if (this.input[this.position] === '*' && this.input[this.position + 1] === '/') {
        this.position += 2;
        this.column += 2;
        break;
      }

      if (this.input[this.position] === '\n') {
        this.line++;
        this.column = 1;
      } else {
        this.column++;
      }
      
      this.position++;
    }

    return this.input.substring(start, this.position);
  }

  /**
   * Consume numeric literal
   */
  private consumeNumber(): string {
    const start = this.position;
    
    // Consume integer part
    while (this.position < this.input.length && this.isDigit(this.input[this.position])) {
      this.position++;
      this.column++;
    }

    // Handle decimal point
    if (this.position < this.input.length && this.input[this.position] === '.') {
      this.position++;
      this.column++;
      
      // Consume fractional part
      while (this.position < this.input.length && this.isDigit(this.input[this.position])) {
        this.position++;
        this.column++;
      }
    }

    // Handle scientific notation (e.g., 1.23e-4)
    if (this.position < this.input.length && 
        (this.input[this.position] === 'e' || this.input[this.position] === 'E')) {
      this.position++;
      this.column++;
      
      if (this.position < this.input.length && 
          (this.input[this.position] === '+' || this.input[this.position] === '-')) {
        this.position++;
        this.column++;
      }
      
      while (this.position < this.input.length && this.isDigit(this.input[this.position])) {
        this.position++;
        this.column++;
      }
    }

    return this.input.substring(start, this.position);
  }

  /**
   * Try to consume multi-character operators
   */
  private tryConsumeMultiCharOperator(): string | null {
    const twoChar = this.input.substring(this.position, this.position + 2);
    
    if (isSyndrQLOperator(twoChar)) {
      this.position += 2;
      this.column += 2;
      return twoChar;
    }

    return null;
  }

  /**
   * Consume identifier or keyword
   */
  private consumeIdentifier(): string {
    const start = this.position;
    
    // First character is already validated
    this.position++;
    this.column++;

    while (this.position < this.input.length && this.isIdentifierPart(this.input[this.position])) {
      this.position++;
      this.column++;
    }

    return this.input.substring(start, this.position);
  }

  /**
   * Classify token by its value
   */
  private classifyToken(value: string): TokenType {
    // Handle newlines
    if (value === '\n' || value === '\r\n') {
      return TokenType.NEWLINE;
    }

    // Handle whitespace
    if (this.isWhitespace(value[0])) {
      return TokenType.WHITESPACE;
    }

    // Handle comments
    if (value.startsWith('--') || value.startsWith('/*')) {
      return TokenType.COMMENT;
    }

    // Handle strings
    if ((value.startsWith("'") && value.endsWith("'")) || 
        (value.startsWith('"') && value.endsWith('"'))) {
      return TokenType.STRING;
    }

    // Handle numbers
    if (this.isDigit(value[0])) {
      return TokenType.NUMBER;
    }

    // Handle operators
    if (isSyndrQLOperator(value)) {
      return TokenType.OPERATOR;
    }

    // Handle punctuation
    if (isSyndrQLPunctuation(value)) {
      return TokenType.PUNCTUATION;
    }

    // Handle keywords - ONLY classify as KEYWORD if it's a recognized SyndrQL keyword
    if (isSyndrQLKeyword(value)) {
      return TokenType.KEYWORD;
    }

    // Handle placeholders (starts with :, @, or $)
    if (value.startsWith(':') || value.startsWith('@') || value.startsWith('$')) {
      return TokenType.PLACEHOLDER;
    }

    // Check if it's a syntactically valid identifier
    if (this.isValidIdentifier(value)) {
      // Valid identifier syntax, but not a recognized keyword = UNKNOWN (should get red squiggly)
      return TokenType.UNKNOWN;
    }

    // Invalid syntax entirely = UNKNOWN
    return TokenType.UNKNOWN;
  }
  
  /**
   * Check if a value is a valid identifier
   */
  private isValidIdentifier(value: string): boolean {
    if (value.length === 0) {
      return false;
    }
    
    // Must start with valid identifier start character
    if (!this.isIdentifierStart(value[0])) {
      return false;
    }
    
    // All remaining characters must be valid identifier parts
    for (let i = 1; i < value.length; i++) {
      if (!this.isIdentifierPart(value[i])) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Get semantic information for token
   */
  private getSemanticInfo(value: string, type: TokenType) {
    if (type === TokenType.KEYWORD) {
      const info = getKeywordInfo(value);
      return {
        category: info?.category || 'unknown',
        description: info?.description || '',
        isFunction: info?.category === 'FUNCTIONS',
        isReserved: true
      };
    }
    return undefined;
  }

  /**
   * Helper methods for character classification
   */
  private isWhitespace(char: string): boolean {
    return char === ' ' || char === '\t';
  }

  private isDigit(char: string): boolean {
    return char >= '0' && char <= '9';
  }

  private isIdentifierStart(char: string): boolean {
    return (char >= 'a' && char <= 'z') || 
           (char >= 'A' && char <= 'Z') || 
           char === '_' || char === '$';
  }

  private isIdentifierPart(char: string): boolean {
    return this.isIdentifierStart(char) || this.isDigit(char);
  }

  private peek(): string {
    if (this.position + 1 >= this.input.length) {
      return '';
    }
    return this.input[this.position + 1];
  }
}

// TODO: Add tokenizeRange method for performance optimization during incremental parsing
// TODO: Add error recovery for malformed tokens
// TODO: Add support for custom delimiters and operators