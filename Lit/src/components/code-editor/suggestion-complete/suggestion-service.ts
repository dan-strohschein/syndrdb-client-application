import { Tokenizer } from "../syndrQL-language-serviceV2/tokenizer";
import type { Token } from "../syndrQL-language-serviceV2/index";
import { TokenType as TokenTypeEnum } from "../syndrQL-language-serviceV2/token_types";



export interface Suggestion {
  value: string;           // The actual text to insert
  type: TokenTypeEnum;     // What kind of token this is
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

export enum SuggestionKind {
  KEYWORD = 'keyword',
  FUNCTION = 'function',
  TABLE = 'table',
  COLUMN = 'column',
  OPERATOR = 'operator',
  VALUE = 'value',
  PLACEHOLDER = 'placeholder'
}

export class SuggestionService {

    private tokenizer: Tokenizer = new Tokenizer();

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
    const tokens = this.tokenizer.tokenize(inputUpToCursor);
    
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
    if (firstToken.Type === TokenTypeEnum.TOKEN_KEYWORD) {
      return firstToken.Value.toUpperCase();
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
      case 'ADD':
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
        type: TokenTypeEnum.TOKEN_KEYWORD,
        kind: SuggestionKind.KEYWORD,
        description: 'Add filter conditions',
        priority: 6
      },
      {
        value: 'ORDER',
        type: TokenTypeEnum.TOKEN_KEYWORD,
        kind: SuggestionKind.KEYWORD,
        description: 'Order results',
        priority: 5
      },
      {
        value: 'GROUP',
        type: TokenTypeEnum.TOKEN_KEYWORD,
        kind: SuggestionKind.KEYWORD,
        description: 'Group results',
        priority: 4
      },
      {
        value: 'FROM',
        type: TokenTypeEnum.TOKEN_KEYWORD,
        kind: SuggestionKind.KEYWORD,
        description: 'Specify source bundle',
        priority: 8
      },
      {
        value: 'DOCUMENT',
        type: TokenTypeEnum.TOKEN_KEYWORD,
        kind: SuggestionKind.KEYWORD,
        description: 'Add a document',
        priority: 7
      },
      {
        value: 'DATABASE',
        type: TokenTypeEnum.TOKEN_KEYWORD,
        kind: SuggestionKind.KEYWORD,
        description: 'Database object',
        priority: 7
      },
      {
        value: 'BUNDLE',
        type: TokenTypeEnum.TOKEN_KEYWORD,
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
        type: TokenTypeEnum.TOKEN_KEYWORD,
        kind: SuggestionKind.KEYWORD,
        category: 'DQL',
        description: 'Retrieve data from bundles',
        priority: 10
      },
      {
        value: 'ADD',
        type: TokenTypeEnum.TOKEN_KEYWORD,
        kind: SuggestionKind.KEYWORD,
        category: 'DML',
        description: 'ADD a new Document',
        priority: 9
      },
      {
        value: 'CREATE',
        type: TokenTypeEnum.TOKEN_KEYWORD,
        kind: SuggestionKind.KEYWORD,
        category: 'DDL',
        description: 'Create database objects',
        priority: 8
      },
      {
        value: 'DROP',
        type: TokenTypeEnum.TOKEN_KEYWORD,
        kind: SuggestionKind.KEYWORD,
        category: 'DDL',
        description: 'Drop database objects',
        priority: 7
      },
      {
        value: 'USE',
        type: TokenTypeEnum.TOKEN_KEYWORD,
        kind: SuggestionKind.KEYWORD,
        category: 'Utility',
        description: 'Set database context',
        priority: 6
      },
      {
        value: 'SHOW',
        type: TokenTypeEnum.TOKEN_KEYWORD,
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
          type: TokenTypeEnum.TOKEN_KEYWORD,
          kind: SuggestionKind.KEYWORD,
          description: 'Select all documents (empty SELECT list)',
          priority: 10
        },
        {
          value: 'DISTINCT',
          type: TokenTypeEnum.TOKEN_KEYWORD,
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
    if (tokens.length === 2 && tokens[1].Value.toUpperCase() === 'DOCUMENTS' && !this.hasKeyword(tokens, 'FROM')) {
      suggestions.push({
        value: 'FROM',
        type: TokenTypeEnum.TOKEN_KEYWORD,
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
        type: TokenTypeEnum.TOKEN_KEYWORD,
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
        type: TokenTypeEnum.TOKEN_KEYWORD,
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
        type: TokenTypeEnum.TOKEN_KEYWORD,
        kind: SuggestionKind.KEYWORD,
        description: 'Add a document',
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
        type: TokenTypeEnum.TOKEN_KEYWORD,
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
          type: TokenTypeEnum.TOKEN_KEYWORD,
          kind: SuggestionKind.KEYWORD,
          description: 'Create a new database',
          priority: 10
        },
        {
          value: 'BUNDLE',
          type: TokenTypeEnum.TOKEN_KEYWORD,
          kind: SuggestionKind.KEYWORD,
          description: 'Create a new bundle',
          priority: 9
        },
        {
          value: 'INDEX',
          type: TokenTypeEnum.TOKEN_KEYWORD,
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
          type: TokenTypeEnum.TOKEN_KEYWORD,
          kind: SuggestionKind.KEYWORD,
          description: 'Drop a database',
          priority: 10
        },
        {
          value: 'BUNDLE',
          type: TokenTypeEnum.TOKEN_KEYWORD,
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
          type: TokenTypeEnum.TOKEN_KEYWORD,
          kind: SuggestionKind.KEYWORD,
          description: 'Show all databases',
          priority: 10
        },
        {
          value: 'BUNDLES',
          type: TokenTypeEnum.TOKEN_KEYWORD,
          kind: SuggestionKind.KEYWORD,
          description: 'Show all bundles',
          priority: 9
        },
        {
          value: 'USERS',
          type: TokenTypeEnum.TOKEN_KEYWORD,
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
        value: '==',
        type: TokenTypeEnum.TOKEN_OPERATOR,
        kind: SuggestionKind.OPERATOR,
        description: 'Equals operator',
        priority: 5
      },
      {
        value: '!=',
        type: TokenTypeEnum.TOKEN_OPERATOR,
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
      type: TokenTypeEnum.TOKEN_IDENTIFIER,
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
      token.Type === TokenTypeEnum.TOKEN_KEYWORD && 
      token.Value.toUpperCase() === keyword.toUpperCase()
    );
  }

  /**
   * Check if the last keyword token matches the given keyword
   */
  private lastKeywordIs(tokens: Token[], keyword: string): boolean {
    for (let i = tokens.length - 1; i >= 0; i--) {
      if (tokens[i].Type === TokenTypeEnum.TOKEN_KEYWORD) {
        return tokens[i].Value.toUpperCase() === keyword.toUpperCase();
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
