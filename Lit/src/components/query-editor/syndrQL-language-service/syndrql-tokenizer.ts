/**
 * SyndrQL Tokenizer
 * Handles tokenization of SyndrQL statements into semantic tokens
 */

import { SYNDRQL_KEYWORDS, isSyndrQLKeyword, getKeywordInfo } from './syndrql-keyword-identifier';
import { SYNDRQL_GRAMMAR_RULES } from './syndrql-grammar';

export enum TokenType {
  KEYWORD = 'keyword',
  IDENTIFIER = 'identifier',
  LITERAL = 'literal',
  OPERATOR = 'operator',
  PUNCTUATION = 'punctuation',
  WHITESPACE = 'whitespace',
  COMMENT = 'comment',
  UNKNOWN = 'unknown'
}

export enum SuggestionKind {
  KEYWORD = 'keyword',
  FUNCTION = 'function',
  TABLE = 'table',
  COLUMN = 'column',
  OPERATOR = 'operator',
  VALUE = 'value',
  PLACEHOLDER = 'placeholder'
}

export interface Suggestion {
  value: string;           // The actual text to insert
  type: TokenType;         // What kind of token this is
  description?: string;    // Human-readable description
  category?: string;       // Group suggestions (DDL, DQL, DML, etc.)
  insertText?: string;     // What to actually insert (might differ from display)
  kind: SuggestionKind;    // Semantic kind for UI rendering
  priority?: number;       // Suggestion priority (higher = more relevant)
}

export interface SuggestionContext {
  tokens: Token[];         // All tokens parsed so far
  lastToken?: Token;       // Last complete token
  currentInput?: string;   // Partial current input
  statementType?: string;  // Detected statement type (SELECT, INSERT, etc.)
  position: number;        // Current position in statement
}

export interface Token {
  type: TokenType;
  value: string;
  startPosition: number;
  endPosition: number;
  line: number;
  column: number;
}

/**
 * SyndrQL Tokenizer class for parsing SQL statements into tokens
 */
export class SyndrQLTokenizer {
  private input: string = '';
  private position: number = 0;
  private line: number = 1;
  private column: number = 1;
  private tokens: Token[] = [];

  /**
   * Tokenize a SyndrQL statement
   */
  tokenize(input: string): Token[] {
    this.input = input;
    this.position = 0;
    this.line = 1;
    this.column = 1;
    this.tokens = [];

    while (this.position < this.input.length) {
      const token = this.nextToken();
      if (token) {
        this.tokens.push(token);
      }
    }
    
    return this.tokens;
  }

  private nextToken(): Token | null {
    // Skip whitespace but track position
    this.skipWhitespace();
    
    if (this.position >= this.input.length) {
      return null;
    }

    const startPos = this.position;
    const startLine = this.line;
    const startColumn = this.column;
    const char = this.input[this.position];

    // Handle single-line comments (-- or //)
    if (this.matchComment()) {
      return this.readComment(startPos, startLine, startColumn);
    }

    // Handle multi-line comments (/* */)
    if (this.matchMultiLineComment()) {
      return this.readMultiLineComment(startPos, startLine, startColumn);
    }

    // Handle string literals
    if (char === '"' || char === "'") {
      return this.readStringLiteral(startPos, startLine, startColumn);
    }

    // Handle operators and punctuation
    if (this.isOperatorOrPunctuation(char)) {
      return this.readOperatorOrPunctuation(startPos, startLine, startColumn);
    }

    // Handle identifiers and keywords
    if (this.isIdentifierStart(char)) {
      return this.readIdentifierOrKeyword(startPos, startLine, startColumn);
    }

    // Handle numbers
    if (this.isDigit(char)) {
      return this.readNumber(startPos, startLine, startColumn);
    }

    // Unknown character
    this.advance();
    return {
      type: TokenType.UNKNOWN,
      value: char,
      startPosition: startPos,
      endPosition: this.position,
      line: startLine,
      column: startColumn
    };
  }

  private skipWhitespace(): void {
    while (this.position < this.input.length && this.isWhitespace(this.input[this.position])) {
      if (this.input[this.position] === '\n') {
        this.line++;
        this.column = 1;
      } else {
        this.column++;
      }
      this.position++;
    }
  }

  private matchComment(): boolean {
    return (
      (this.position < this.input.length - 1 && 
       this.input.substring(this.position, this.position + 2) === '--') ||
      (this.position < this.input.length - 1 && 
       this.input.substring(this.position, this.position + 2) === '//')
    );
  }

  private matchMultiLineComment(): boolean {
    return (
      this.position < this.input.length - 1 && 
      this.input.substring(this.position, this.position + 2) === '/*'
    );
  }

  private readComment(startPos: number, startLine: number, startColumn: number): Token {
    const start = this.position;
    
    // Skip comment start (-- or //)
    this.advance();
    this.advance();
    
    // Read until end of line
    while (this.position < this.input.length && this.input[this.position] !== '\n') {
      this.advance();
    }

    return {
      type: TokenType.COMMENT,
      value: this.input.substring(start, this.position),
      startPosition: startPos,
      endPosition: this.position,
      line: startLine,
      column: startColumn
    };
  }

  private readMultiLineComment(startPos: number, startLine: number, startColumn: number): Token {
    const start = this.position;
    
    // Skip /*
    this.advance();
    this.advance();
    
    // Read until */
    while (this.position < this.input.length - 1) {
      if (this.input.substring(this.position, this.position + 2) === '*/') {
        this.advance();
        this.advance();
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

    return {
      type: TokenType.COMMENT,
      value: this.input.substring(start, this.position),
      startPosition: startPos,
      endPosition: this.position,
      line: startLine,
      column: startColumn
    };
  }

  private readStringLiteral(startPos: number, startLine: number, startColumn: number): Token {
    const quote = this.input[this.position];
    const start = this.position;
    
    this.advance(); // Skip opening quote
    
    while (this.position < this.input.length && this.input[this.position] !== quote) {
      if (this.input[this.position] === '\\') {
        this.advance(); // Skip escape character
        if (this.position < this.input.length) {
          this.advance(); // Skip escaped character
        }
      } else {
        this.advance();
      }
    }
    
    if (this.position < this.input.length) {
      this.advance(); // Skip closing quote
    }

    return {
      type: TokenType.LITERAL,
      value: this.input.substring(start, this.position),
      startPosition: startPos,
      endPosition: this.position,
      line: startLine,
      column: startColumn
    };
  }

  private readOperatorOrPunctuation(startPos: number, startLine: number, startColumn: number): Token {
    const char = this.input[this.position];
    const start = this.position;
    
    // Check for multi-character operators
    if (this.position < this.input.length - 1) {
      const twoChar = this.input.substring(this.position, this.position + 2);
      if (['<=', '>=', '!=', '==', '<>'].includes(twoChar)) {
        this.advance();
        this.advance();
        return {
          type: TokenType.OPERATOR,
          value: twoChar,
          startPosition: startPos,
          endPosition: this.position,
          line: startLine,
          column: startColumn
        };
      }
    }
    
    this.advance();
    
    const tokenType = this.isOperator(char) ? TokenType.OPERATOR : TokenType.PUNCTUATION;
    
    return {
      type: tokenType,
      value: char,
      startPosition: startPos,
      endPosition: this.position,
      line: startLine,
      column: startColumn
    };
  }

  private readIdentifierOrKeyword(startPos: number, startLine: number, startColumn: number): Token {
    const start = this.position;
    
    while (this.position < this.input.length && this.isIdentifierChar(this.input[this.position])) {
      this.advance();
    }
    
    const value = this.input.substring(start, this.position);
    const upperValue = value.toUpperCase();
    
    // Check if it's a keyword using the keyword identifier
    const isKeyword = isSyndrQLKeyword(upperValue);
    
    return {
      type: isKeyword ? TokenType.KEYWORD : TokenType.IDENTIFIER,
      value: value,
      startPosition: startPos,
      endPosition: this.position,
      line: startLine,
      column: startColumn
    };
  }

  private readNumber(startPos: number, startLine: number, startColumn: number): Token {
    const start = this.position;
    
    while (this.position < this.input.length && this.isDigit(this.input[this.position])) {
      this.advance();
    }
    
    // Handle decimal numbers
    if (this.position < this.input.length && this.input[this.position] === '.') {
      this.advance();
      while (this.position < this.input.length && this.isDigit(this.input[this.position])) {
        this.advance();
      }
    }
    
    return {
      type: TokenType.LITERAL,
      value: this.input.substring(start, this.position),
      startPosition: startPos,
      endPosition: this.position,
      line: startLine,
      column: startColumn
    };
  }

  private advance(): void {
    if (this.position < this.input.length) {
      if (this.input[this.position] === '\n') {
        this.line++;
        this.column = 1;
      } else {
        this.column++;
      }
      this.position++;
    }
  }

  private isWhitespace(char: string): boolean {
    return /\s/.test(char);
  }

  private isDigit(char: string): boolean {
    return /\d/.test(char);
  }

  private isIdentifierStart(char: string): boolean {
    return /[a-zA-Z_]/.test(char);
  }

  private isIdentifierChar(char: string): boolean {
    return /[a-zA-Z0-9_]/.test(char);
  }

  private isOperator(char: string): boolean {
    return '+-*/<>=!'.includes(char);
  }

  private isOperatorOrPunctuation(char: string): boolean {
    return '+-*/<>=!(){}[];,.:'.includes(char);
  }

  /**
   * Helper method to get a human-readable representation of tokens (useful for debugging)
   */
  getTokensAsString(tokens: Token[]): string {
    return tokens.map(token => 
      `[${token.type}] "${token.value}" (${token.line}:${token.column})`
    ).join('\n');
  }

  /**
   * Get contextual suggestions for SyndrQL statement completion
   * @param input - The input string up to cursor position
   * @param cursorPosition - Optional cursor position (defaults to end of input)
   * @returns Array of structured suggestions
   */
  getSuggestions(input: string, cursorPosition?: number): Suggestion[] {
    // Clean the input and handle cursor position
    const cleanInput = this.cleanInput(input);
    const effectivePosition = cursorPosition ?? cleanInput.length;
    const inputUpToCursor = cleanInput.substring(0, effectivePosition);
    
    // Tokenize input up to cursor
    const tokens = this.tokenize(inputUpToCursor);
    
    // Build suggestion context
    const context: SuggestionContext = {
      tokens,
      lastToken: tokens[tokens.length - 1],
      currentInput: this.getCurrentPartialInput(inputUpToCursor),
      statementType: this.detectStatementType(tokens),
      position: effectivePosition
    };
    
    // Generate suggestions based on context
    return this.generateContextualSuggestions(context);
  }

  /**
   * Clean input string by removing comments and normalizing whitespace
   */
  private cleanInput(input: string): string {
    // Remove single-line comments
    let cleaned = input.replace(/--.*$/gm, '').replace(/\/\/.*$/gm, '');
    
    // Remove multi-line comments
    cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
    
    // Normalize whitespace but preserve trailing space for suggestion context
    // Replace multiple internal spaces with single spaces, but preserve leading/trailing
    const leadingSpaces = cleaned.match(/^\s*/)?.[0] || '';
    const trailingSpaces = cleaned.match(/\s*$/)?.[0] || '';
    const middle = cleaned.replace(/^\s+|\s+$/g, '').replace(/\s+/g, ' ');
    
    return leadingSpaces + middle + trailingSpaces;
  }

  /**
   * Get the current partial input being typed
   */
  private getCurrentPartialInput(input: string): string {
    // If input ends with whitespace, there's no partial input
    if (input.endsWith(' ') || input.endsWith('\t') || input.endsWith('\n')) {
      return '';
    }
    
    // Look for partial word at the end
    const match = input.match(/([a-zA-Z_][a-zA-Z0-9_]*)$/);
    return match ? match[1] : '';
  }

  /**
   * Detect the type of SQL statement being written
   */
  private detectStatementType(tokens: Token[]): string {
    if (tokens.length === 0) return 'UNKNOWN';
    
    const firstToken = tokens[0];
    if (firstToken.type === TokenType.KEYWORD) {
      return firstToken.value.toUpperCase();
    }
    
    return 'UNKNOWN';
  }

  /**
   * Generate contextual suggestions based on current parsing state
   */
  private generateContextualSuggestions(context: SuggestionContext): Suggestion[] {
    const suggestions: Suggestion[] = [];
    const { tokens, lastToken, currentInput, statementType } = context;
    
    // If no tokens yet, suggest statement starters
    if (tokens.length === 0) {
      return this.getStatementStarterSuggestions();
    }
    
    // Generate contextual suggestions based on statement type and current position
    switch (statementType) {
      case 'SELECT':
        suggestions.push(...this.getSelectSuggestions(context));
        break;
      case 'INSERT':
        suggestions.push(...this.getInsertSuggestions(context));
        break;
      case 'CREATE':
        suggestions.push(...this.getCreateSuggestions(context));
        break;
      case 'DROP':
        suggestions.push(...this.getDropSuggestions(context));
        break;
      case 'USE':
        suggestions.push(...this.getUseSuggestions(context));
        break;
      case 'SHOW':
        suggestions.push(...this.getShowSuggestions(context));
        break;
      default:
        // Fallback to general suggestions
        suggestions.push(...this.getGeneralSuggestions(context));
    }
    
    // If we have partial input, also try to match against all possible keywords
    if (currentInput && currentInput.length > 0) {
      const allKeywordSuggestions = this.getAllKeywordSuggestions();
      const matchingKeywords = allKeywordSuggestions.filter(s => 
        s.value.toLowerCase().startsWith(currentInput.toLowerCase()) &&
        !suggestions.some(existing => existing.value === s.value) // Avoid duplicates
      );
      suggestions.push(...matchingKeywords);
    }
    
    // Filter and sort suggestions
    return this.filterAndSortSuggestions(suggestions, currentInput);
  }

  /**
   * Get all possible keyword suggestions
   */
  private getAllKeywordSuggestions(): Suggestion[] {
    return [
      ...this.getStatementStarterSuggestions(),
      // Add other common keywords
      {
        value: 'WHERE',
        type: TokenType.KEYWORD,
        kind: SuggestionKind.KEYWORD,
        description: 'Add filter conditions',
        priority: 6
      },
      {
        value: 'ORDER',
        type: TokenType.KEYWORD,
        kind: SuggestionKind.KEYWORD,
        description: 'Order results',
        priority: 5
      },
      {
        value: 'GROUP',
        type: TokenType.KEYWORD,
        kind: SuggestionKind.KEYWORD,
        description: 'Group results',
        priority: 4
      },
      {
        value: 'FROM',
        type: TokenType.KEYWORD,
        kind: SuggestionKind.KEYWORD,
        description: 'Specify source bundle',
        priority: 8
      },
      {
        value: 'DOCUMENT',
        type: TokenType.KEYWORD,
        kind: SuggestionKind.KEYWORD,
        description: 'Insert a document',
        priority: 7
      },
      {
        value: 'DATABASE',
        type: TokenType.KEYWORD,
        kind: SuggestionKind.KEYWORD,
        description: 'Database object',
        priority: 7
      },
      {
        value: 'BUNDLE',
        type: TokenType.KEYWORD,
        kind: SuggestionKind.KEYWORD,
        description: 'Bundle object',
        priority: 6
      }
    ];
  }
  /**
   * Get suggestions for statement starters (when input is empty)
   */
  private getStatementStarterSuggestions(): Suggestion[] {
    return [
      {
        value: 'SELECT',
        type: TokenType.KEYWORD,
        kind: SuggestionKind.KEYWORD,
        category: 'DQL',
        description: 'Retrieve data from bundles',
        priority: 10
      },
      {
        value: 'INSERT',
        type: TokenType.KEYWORD,
        kind: SuggestionKind.KEYWORD,
        category: 'DML',
        description: 'Insert new data',
        priority: 9
      },
      {
        value: 'CREATE',
        type: TokenType.KEYWORD,
        kind: SuggestionKind.KEYWORD,
        category: 'DDL',
        description: 'Create database objects',
        priority: 8
      },
      {
        value: 'DROP',
        type: TokenType.KEYWORD,
        kind: SuggestionKind.KEYWORD,
        category: 'DDL',
        description: 'Drop database objects',
        priority: 7
      },
      {
        value: 'USE',
        type: TokenType.KEYWORD,
        kind: SuggestionKind.KEYWORD,
        category: 'Utility',
        description: 'Set database context',
        priority: 6
      },
      {
        value: 'SHOW',
        type: TokenType.KEYWORD,
        kind: SuggestionKind.KEYWORD,
        category: 'Utility',
        description: 'Show database objects',
        priority: 5
      }
    ];
  }

  /**
   * Get suggestions for SELECT statements
   */
  private getSelectSuggestions(context: SuggestionContext): Suggestion[] {
    const { tokens, lastToken } = context;
    const suggestions: Suggestion[] = [];
    
    if (tokens.length === 1) {
      // After SELECT (first token) - in SyndrQL, empty SELECT list means "all fields"
      suggestions.push(
        {
          value: 'DOCUMENTS',
          type: TokenType.KEYWORD,
          kind: SuggestionKind.KEYWORD,
          description: 'Select all documents (empty SELECT list)',
          priority: 10
        },
        {
          value: 'DISTINCT',
          type: TokenType.KEYWORD,
          kind: SuggestionKind.KEYWORD,
          description: 'Select distinct values',
          priority: 8
        }
      );
      // Add column name placeholders
      suggestions.push(this.createPlaceholderSuggestion('field_name', 'Field name'));
      return suggestions;
    }
    
    // Check if we have SELECT DOCUMENTS but no FROM yet
    if (tokens.length === 2 && tokens[1].value.toUpperCase() === 'DOCUMENTS' && !this.hasKeyword(tokens, 'FROM')) {
      suggestions.push({
        value: 'FROM',
        type: TokenType.KEYWORD,
        kind: SuggestionKind.KEYWORD,
        description: 'Specify source bundle',
        priority: 9
      });
      return suggestions;
    }
    
    // Check if we need FROM clause (for other SELECT patterns)
    if (!this.hasKeyword(tokens, 'FROM')) {
      suggestions.push({
        value: 'FROM',
        type: TokenType.KEYWORD,
        kind: SuggestionKind.KEYWORD,
        description: 'Specify source bundle',
        priority: 9
      });
    }
    
    // After FROM, suggest table/bundle names
    if (this.lastKeywordIs(tokens, 'FROM')) {
      suggestions.push(this.createPlaceholderSuggestion('bundle_name', 'Bundle or table name'));
    }
    
    // Suggest WHERE, ORDER BY, GROUP BY, etc.
    if (this.hasKeyword(tokens, 'FROM') && !this.hasKeyword(tokens, 'WHERE')) {
      suggestions.push({
        value: 'WHERE',
        type: TokenType.KEYWORD,
        kind: SuggestionKind.KEYWORD,
        description: 'Add filter conditions',
        priority: 7
      });
    }
    
    return suggestions;
  }

  /**
   * Get suggestions for INSERT statements
   */
  private getInsertSuggestions(context: SuggestionContext): Suggestion[] {
    const { tokens } = context;
    const suggestions: Suggestion[] = [];
    
    if (tokens.length === 1) {
      // After INSERT (first token)
      suggestions.push({
        value: 'DOCUMENT',
        type: TokenType.KEYWORD,
        kind: SuggestionKind.KEYWORD,
        description: 'Insert a document',
        priority: 10
      });
      return suggestions;
    }
    
    if (this.lastKeywordIs(tokens, 'DOCUMENT') || this.lastKeywordIs(tokens, 'DOCUMENTS')) {
      suggestions.push(this.createPlaceholderSuggestion("{'key': 'value'}", 'JSON document'));
    }
    
    if (!this.hasKeyword(tokens, 'TO') && this.hasKeyword(tokens, 'DOCUMENT')) {
      suggestions.push({
        value: 'TO',
        type: TokenType.KEYWORD,
        kind: SuggestionKind.KEYWORD,
        description: 'Specify target bundle',
        priority: 8
      });
    }
    
    if (this.lastKeywordIs(tokens, 'TO')) {
      suggestions.push(this.createPlaceholderSuggestion('bundle_name', 'Target bundle name'));
    }
    
    return suggestions;
  }

  /**
   * Get suggestions for CREATE statements
   */
  private getCreateSuggestions(context: SuggestionContext): Suggestion[] {
    const { tokens } = context;
    const suggestions: Suggestion[] = [];
    
    if (tokens.length === 1) {
      // After CREATE (first token)
      suggestions.push(
        {
          value: 'DATABASE',
          type: TokenType.KEYWORD,
          kind: SuggestionKind.KEYWORD,
          description: 'Create a new database',
          priority: 10
        },
        {
          value: 'BUNDLE',
          type: TokenType.KEYWORD,
          kind: SuggestionKind.KEYWORD,
          description: 'Create a new bundle',
          priority: 9
        },
        {
          value: 'INDEX',
          type: TokenType.KEYWORD,
          kind: SuggestionKind.KEYWORD,
          description: 'Create an index',
          priority: 8
        }
      );
      return suggestions;
    }
    
    if (this.lastKeywordIs(tokens, 'DATABASE') || this.lastKeywordIs(tokens, 'BUNDLE')) {
      suggestions.push(this.createPlaceholderSuggestion('object_name', 'Name for the new object'));
    }
    
    return suggestions;
  }

  /**
   * Get suggestions for DROP statements
   */
  private getDropSuggestions(context: SuggestionContext): Suggestion[] {
    const { tokens } = context;
    const suggestions: Suggestion[] = [];
    
    if (tokens.length === 1) {
      suggestions.push(
        {
          value: 'DATABASE',
          type: TokenType.KEYWORD,
          kind: SuggestionKind.KEYWORD,
          description: 'Drop a database',
          priority: 10
        },
        {
          value: 'BUNDLE',
          type: TokenType.KEYWORD,
          kind: SuggestionKind.KEYWORD,
          description: 'Drop a bundle',
          priority: 9
        }
      );
    }
    
    return suggestions;
  }

  /**
   * Get suggestions for USE statements
   */
  private getUseSuggestions(context: SuggestionContext): Suggestion[] {
    const { tokens } = context;
    
    if (tokens.length === 1) {
      return [this.createPlaceholderSuggestion('database_name', 'Database name to use')];
    }
    
    return [];
  }

  /**
   * Get suggestions for SHOW statements
   */
  private getShowSuggestions(context: SuggestionContext): Suggestion[] {
    const { tokens } = context;
    const suggestions: Suggestion[] = [];
    
    if (tokens.length === 1) {
      suggestions.push(
        {
          value: 'DATABASES',
          type: TokenType.KEYWORD,
          kind: SuggestionKind.KEYWORD,
          description: 'Show all databases',
          priority: 10
        },
        {
          value: 'BUNDLES',
          type: TokenType.KEYWORD,
          kind: SuggestionKind.KEYWORD,
          description: 'Show all bundles',
          priority: 9
        },
        {
          value: 'USERS',
          type: TokenType.KEYWORD,
          kind: SuggestionKind.KEYWORD,
          description: 'Show system users',
          priority: 8
        }
      );
    }
    
    return suggestions;
  }

  /**
   * Get general suggestions when no specific context is detected
   */
  private getGeneralSuggestions(context: SuggestionContext): Suggestion[] {
    const suggestions: Suggestion[] = [];
    
    // Add common operators
    suggestions.push(
      {
        value: '=',
        type: TokenType.OPERATOR,
        kind: SuggestionKind.OPERATOR,
        description: 'Equals operator',
        priority: 5
      },
      {
        value: '!=',
        type: TokenType.OPERATOR,
        kind: SuggestionKind.OPERATOR,
        description: 'Not equals operator',
        priority: 4
      }
    );
    
    return suggestions;
  }

  /**
   * Helper method to create placeholder suggestions
   */
  private createPlaceholderSuggestion(value: string, description: string): Suggestion {
    return {
      value,
      type: TokenType.IDENTIFIER,
      kind: SuggestionKind.PLACEHOLDER,
      description,
      priority: 3
    };
  }

  /**
   * Check if tokens contain a specific keyword
   */
  private hasKeyword(tokens: Token[], keyword: string): boolean {
    return tokens.some(token => 
      token.type === TokenType.KEYWORD && 
      token.value.toUpperCase() === keyword.toUpperCase()
    );
  }

  /**
   * Check if the last keyword token matches the given keyword
   */
  private lastKeywordIs(tokens: Token[], keyword: string): boolean {
    for (let i = tokens.length - 1; i >= 0; i--) {
      if (tokens[i].type === TokenType.KEYWORD) {
        return tokens[i].value.toUpperCase() === keyword.toUpperCase();
      }
    }
    return false;
  }

  /**
   * Filter and sort suggestions based on current input and relevance
   */
  private filterAndSortSuggestions(suggestions: Suggestion[], currentInput?: string): Suggestion[] {
    let filtered = suggestions;
    
    // Filter by current input if provided
    if (currentInput && currentInput.length > 0) {
      const lowerInput = currentInput.toLowerCase();
      filtered = suggestions.filter(suggestion => 
        suggestion.value.toLowerCase().startsWith(lowerInput)
      );
    }
    
    // Sort by priority (descending) then alphabetically
    return filtered.sort((a, b) => {
      const priorityDiff = (b.priority || 0) - (a.priority || 0);
      if (priorityDiff !== 0) return priorityDiff;
      return a.value.localeCompare(b.value);
    });
  }
}
