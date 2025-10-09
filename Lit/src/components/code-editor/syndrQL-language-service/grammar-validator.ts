/**
 * SyndrQL Grammar Validator
 * Validates sequences of tokens against SyndrQL grammar rules
 */

import { SyntaxToken, TokenType } from './types.js';
import { ALL_SYNDRQL_KEYWORDS } from '../../query-editor/syndrQL-language-service/syndrql-keyword-identifier.js';
import { ErrorDetail } from './error-codes.js';
import { SyndrQLErrorAnalyzer } from './error-analyzer.js';

/**
 * Grammar validation result for a token sequence
 * Enhanced to include detailed error information following VSCode error patterns
 */
export interface GrammarValidationResult {
  isValid: boolean;
  invalidTokens: Set<number>; // Indices of invalid tokens
  expectedTokens?: string[];   // What was expected at error point
  errorMessage?: string;       // Legacy error message
  errorDetails?: ErrorDetail[]; // Detailed error information for user feedback
}

/**
 * Simple grammar state machine for SyndrQL validation
 */
class SyndrQLGrammarState {
  private static readonly STATEMENT_STARTERS = new Set(['SELECT', 'ADD', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'USE', 'SHOW', 'GRANT']);
  private static readonly DQL_KEYWORDS = new Set(['SELECT', 'DOCUMENTS', 'FROM', 'WHERE', 'JOIN', 'ON', 'ORDER', 'GROUP', 'BY']);
  private static readonly DDL_KEYWORDS = new Set(['CREATE', 'DROP', 'ALTER']);
  private static readonly DML_KEYWORDS = new Set(['INSERT', 'UPDATE', 'DELETE', 'ADD']);
  
  private currentStatement: string = '';
  private tokenSequence: string[] = [];
  private invalidIndices: Set<number> = new Set();

  /**
   * Validate a sequence of tokens
   */
  validateTokens(tokens: SyntaxToken[]): GrammarValidationResult {
    this.reset();
    
    // Filter out whitespace, comments, and newlines for grammar analysis
    const significantTokens = tokens.filter(token => 
      token.type !== TokenType.WHITESPACE && 
      token.type !== TokenType.COMMENT && 
      token.type !== TokenType.NEWLINE
    );

    if (significantTokens.length === 0) {
      return { isValid: true, invalidTokens: new Set() };
    }

    // Check if statement is completed (ends with semicolon)
    const isCompleteStatement = this.isCompleteStatement(significantTokens);

    // Build token sequence and validate
    for (let i = 0; i < significantTokens.length; i++) {
      const token = significantTokens[i];
      const isValid = this.validateNextToken(token, i, significantTokens, isCompleteStatement);
      
      if (!isValid) {
        // Map back to original token index
        const originalIndex = tokens.indexOf(token);
        this.invalidIndices.add(originalIndex);
      }
    }

    return {
      isValid: this.invalidIndices.size === 0,
      invalidTokens: this.invalidIndices
    };
  }

  /**
   * Check if the token sequence represents a complete statement (ends with semicolon)
   */
  private isCompleteStatement(tokens: SyntaxToken[]): boolean {
    if (tokens.length === 0) {
      return false;
    }
    
    const lastToken = tokens[tokens.length - 1];
    return lastToken.type === TokenType.PUNCTUATION && lastToken.value === ';';
  }

  /**
   * Validate the next token in sequence
   */
  private validateNextToken(token: SyntaxToken, index: number, tokens: SyntaxToken[], isCompleteStatement: boolean = false): boolean {
    const tokenValue = token.value.toUpperCase();
    
    // Handle punctuation and operators - they're generally context-dependent but valid
    if (token.type === TokenType.PUNCTUATION || token.type === TokenType.OPERATOR) {
      return this.validatePunctuation(tokenValue, index, tokens);
    }

    // Handle string literals and numbers - valid in most contexts
    if (token.type === TokenType.STRING || token.type === TokenType.NUMBER) {
      return true;
    }

    // Handle keywords
    if (token.type === TokenType.KEYWORD) {
      return this.validateKeyword(tokenValue, index, tokens, isCompleteStatement);
    }

    // Handle identifiers - need to check if they're in valid context
    if (token.type === TokenType.IDENTIFIER) {
      return this.validateIdentifier(tokenValue, index, tokens);
    }

    // Already unknown tokens should be marked invalid
    if (token.type === TokenType.UNKNOWN) {
      return false;
    }

    return true;
  }

  /**
   * Validate keyword placement
   */
  private validateKeyword(keyword: string, index: number, tokens: SyntaxToken[], isCompleteStatement: boolean = false): boolean {
    this.tokenSequence.push(keyword);

    // First token should be a statement starter
    if (index === 0) {
      return SyndrQLGrammarState.STATEMENT_STARTERS.has(keyword);
    }

    // Basic sequence validation
    const previousKeywords = this.tokenSequence.slice(0, -1);
    
    // SELECT statement validation - check all tokens, not just keywords
    if (previousKeywords.includes('SELECT')) {
      return this.validateSelectStatementAllTokens(keyword, index, tokens, isCompleteStatement);
    }

    // CREATE statement validation
    if (previousKeywords.includes('CREATE')) {
      return this.validateCreateStatement(keyword, previousKeywords);
    }

    // INSERT statement validation
    if (previousKeywords.includes('INSERT')) {
      return this.validateInsertStatement(keyword, previousKeywords);
    }

    // If no specific validation rule, check if it's a valid SyndrQL keyword
    return ALL_SYNDRQL_KEYWORDS.has(keyword);
  }

  /**
   * Validate SELECT statement considering all tokens (keywords, identifiers, strings)
   */
  private validateSelectStatementAllTokens(keyword: string, index: number, allTokens: SyntaxToken[], isCompleteStatement: boolean = false): boolean {
    // Get all significant tokens for context
    const significantTokens = allTokens.filter(token => 
      token.type !== TokenType.WHITESPACE && 
      token.type !== TokenType.COMMENT && 
      token.type !== TokenType.NEWLINE
    );
    
    // Find SELECT keyword position
    const selectIndex = significantTokens.findIndex(token => 
      token.type === TokenType.KEYWORD && token.value.toUpperCase() === 'SELECT'
    );
    
    if (selectIndex === -1) return false;
    
    // Validate the pattern: SELECT <fields|*|DOCUMENTS> FROM <bundle_name> [; ]
    let expectingFieldsOrWildcard = true;
    let expectingFrom = false;
    let expectingBundleName = false;
    
    for (let i = selectIndex + 1; i < significantTokens.length; i++) {
      const token = significantTokens[i];
      const tokenValue = token.value.toUpperCase();
      
      if (expectingFieldsOrWildcard) {
        if (token.type === TokenType.KEYWORD && (tokenValue === 'DOCUMENTS' || tokenValue === '*')) {
          expectingFieldsOrWildcard = false;
          expectingFrom = true;
        } else if (token.type === TokenType.IDENTIFIER) {
          // Field name - continue expecting FROM
          expectingFieldsOrWildcard = false;
          expectingFrom = true;
        } else if (token.type === TokenType.PUNCTUATION && tokenValue === '*') {
          expectingFieldsOrWildcard = false;
          expectingFrom = true;
        } else {
          return false; // Unexpected token after SELECT
        }
      } else if (expectingFrom) {
        if (token.type === TokenType.KEYWORD && tokenValue === 'FROM') {
          expectingFrom = false;
          expectingBundleName = true;
        } else {
          return false; // Expected FROM keyword
        }
      } else if (expectingBundleName) {
        if (token.type === TokenType.STRING || token.type === TokenType.IDENTIFIER) {
          expectingBundleName = false;
          // Statement is potentially complete, check for semicolon or end
        } else {
          return false; // Expected bundle name
        }
      } else if (token.type === TokenType.PUNCTUATION && tokenValue === ';') {
        // Semicolon ends the statement - this is valid
        return true;
      } else {
        // Additional clauses like WHERE, JOIN, etc. - for now, allow them
        // TODO: Implement full clause validation
        continue;
      }
    }
    
    // If we reach here, check if the statement is complete
    // If it ends with semicolon, it's valid even if it looks incomplete
    if (isCompleteStatement) {
      return true; // Semicolon indicates intentional completion
    }
    
    // Otherwise, it's only valid if we're not expecting anything critical
    return !expectingFieldsOrWildcard && !expectingFrom && !expectingBundleName;
  }

  /**
   * Validate SELECT statement keywords with proper state machine
   * Pattern: SELECT <* or DOCUMENTS or field_list> FROM <bundle_name> 
   *          [INNER JOIN | JOIN <bundle>.<field> == <bundle2>.<field>]
   *          [WHERE <conditions>] 
   *          [GROUP BY <field_list>] 
   *          [ORDER BY <field_list> [ASC|DESC]]
   */
  private validateSelectStatement(keyword: string, previousKeywords: string[], isCompleteStatement: boolean = false): boolean {
    const sequence = [...previousKeywords, keyword];
    
    // State tracking
    let expectingFieldsOrWildcard = false;
    let expectingFrom = false;
    let expectingBundleName = false;
    let expectingJoinTarget = false;
    let expectingJoinCondition = false;
    let expectingWhereCondition = false;
    let expectingGroupByFields = false;
    let expectingOrderByFields = false;
    let expectingSortDirection = false;
    
    for (let i = 0; i < sequence.length; i++) {
      const current = sequence[i];
      const next = i + 1 < sequence.length ? sequence[i + 1] : null;
      
      switch (current) {
        case 'SELECT':
          if (i !== 0) return false; // SELECT must be first
          expectingFieldsOrWildcard = true;
          break;
          
        case 'DOCUMENTS':
        case '*':
          if (!expectingFieldsOrWildcard) return false;
          expectingFieldsOrWildcard = false;
          expectingFrom = true;
          break;
          
        case 'FROM':
          if (!expectingFrom) return false;
          expectingFrom = false;
          expectingBundleName = true;
          break;
          
        case 'INNER':
          if (next !== 'JOIN') return false;
          if (expectingBundleName || expectingFieldsOrWildcard || expectingFrom) return false;
          break;
          
        case 'JOIN':
          if (expectingBundleName || expectingFieldsOrWildcard || expectingFrom) return false;
          expectingJoinTarget = true;
          break;
          
        case 'WHERE':
          if (expectingBundleName || expectingFieldsOrWildcard || expectingFrom || 
              expectingJoinTarget || expectingJoinCondition) return false;
          expectingWhereCondition = true;
          break;
          
        case 'GROUP':
          if (next !== 'BY') return false;
          if (expectingBundleName || expectingFieldsOrWildcard || expectingFrom || 
              expectingJoinTarget || expectingJoinCondition || expectingWhereCondition) return false;
          break;
          
        case 'BY':
          const prevKeyword = i > 0 ? sequence[i - 1] : null;
          if (prevKeyword === 'GROUP') {
            expectingGroupByFields = true;
          } else if (prevKeyword === 'ORDER') {
            expectingOrderByFields = true;
          } else {
            return false;
          }
          break;
          
        case 'ORDER':
          if (next !== 'BY') return false;
          if (expectingBundleName || expectingFieldsOrWildcard || expectingFrom || 
              expectingJoinTarget || expectingJoinCondition || expectingWhereCondition || 
              expectingGroupByFields) return false;
          break;
          
        case 'ASC':
        case 'DESC':
          if (!expectingSortDirection) return false;
          expectingSortDirection = false;
          break;
          
        default:
          // Handle other keywords that might be valid in specific contexts
          if (expectingFieldsOrWildcard) {
            // Field names or identifiers are handled separately
            expectingFieldsOrWildcard = false;
            expectingFrom = true;
          } else if (expectingBundleName) {
            // Bundle names are handled as identifiers/strings
            expectingBundleName = false;
          } else if (expectingJoinTarget) {
            // Join target handling
            expectingJoinTarget = false;
            expectingJoinCondition = true;
          } else if (expectingJoinCondition) {
            // Join condition keywords
            expectingJoinCondition = false;
          } else if (expectingWhereCondition) {
            // WHERE condition keywords
            expectingWhereCondition = false;
          } else if (expectingGroupByFields) {
            // GROUP BY field handling
            expectingGroupByFields = false;
          } else if (expectingOrderByFields) {
            // ORDER BY field handling
            expectingOrderByFields = false;
            expectingSortDirection = true; // ASC/DESC is optional
          } else {
            // Unexpected keyword in this context
            return false;
          }
          break;
      }
    }
    
    // Validate that we're not in an incomplete state for the last token
    if (keyword === sequence[sequence.length - 1]) {
      // These states indicate incomplete statements
      if (expectingFieldsOrWildcard || expectingFrom || expectingBundleName || 
          expectingJoinTarget || expectingGroupByFields || expectingOrderByFields) {
        // If the statement is complete (ends with semicolon), allow it to pass validation
        // even if it appears "incomplete" - the semicolon indicates intentional completion
        return isCompleteStatement;
      }
    }
    
    return true;
  }

  /**
   * Validate CREATE statement keywords
   */
  private validateCreateStatement(keyword: string, previousKeywords: string[]): boolean {
    // CREATE should be followed by object types
    if (previousKeywords.length === 1 && previousKeywords[0] === 'CREATE') {
      return ['DATABASE', 'BUNDLE', 'INDEX'].includes(keyword);
    }
    
    return true; // Allow other keywords in CREATE statements for now
  }

  /**
   * Validate INSERT statement keywords
   */
  private validateInsertStatement(keyword: string, previousKeywords: string[]): boolean {
    // INSERT should be followed by INTO or other DML keywords
    if (previousKeywords.length === 1 && previousKeywords[0] === 'ADD') {
      return ['INTO', 'DOCUMENT', 'DOCUMENTS'].includes(keyword);
    }
    
    return true; // Allow other keywords in INSERT statements for now
  }

  /**
   * Validate identifier placement with context awareness
   */
  private validateIdentifier(identifier: string, index: number, tokens: SyntaxToken[]): boolean {
    if (index === 0) {
      // Identifiers can't start a statement
      return false;
    }

    const previousToken = tokens[index - 1];
    const previousValue = previousToken.value.toUpperCase();
    
    // Get the sequence of keywords so far for context
    const keywordSequence = tokens.slice(0, index)
      .filter(t => t.type === TokenType.KEYWORD)
      .map(t => t.value.toUpperCase());

    // In SELECT statements, validate identifier contexts
    if (keywordSequence.includes('SELECT')) {
      return this.validateSelectIdentifierContext(previousValue, keywordSequence, tokens, index);
    }

    // General identifier validation for other statement types
    const validPrecedingKeywords = ['FROM', 'INTO', 'WHERE', 'JOIN', 'ON', 'CREATE', 'DATABASE', 'BUNDLE', 'BY'];
    const validPrecedingOperators = ['=', '==', '<', '>', '<=', '>=', '!=', '!=='];
    const validPrecedingPunctuation = [',', '(', '.'];

    if (previousToken.type === TokenType.KEYWORD && validPrecedingKeywords.includes(previousValue)) {
      return true;
    }

    if (previousToken.type === TokenType.OPERATOR && validPrecedingOperators.includes(previousValue)) {
      return true;
    }

    if (previousToken.type === TokenType.PUNCTUATION && validPrecedingPunctuation.includes(previousValue)) {
      return true;
    }

    // Allow identifiers after other identifiers (e.g., qualified names like bundle.field)
    if (previousToken.type === TokenType.IDENTIFIER) {
      return true;
    }

    // Allow identifiers after string literals in some contexts (like comparisons)
    if (previousToken.type === TokenType.STRING) {
      return true;
    }

    return false;
  }

  /**
   * Validate identifier in SELECT statement context
   */
  private validateSelectIdentifierContext(previousValue: string, keywordSequence: string[], tokens: SyntaxToken[], currentIndex: number): boolean {
    const hasFrom = keywordSequence.includes('FROM');
    const hasDocuments = keywordSequence.includes('DOCUMENTS');
    const hasWildcard = tokens.some(t => t.value === '*');
    
    // After SELECT: field names or bundle names (if no DOCUMENTS/*)
    if (previousValue === 'SELECT' && !hasDocuments && !hasWildcard) {
      return true; // Field name
    }
    
    // After FROM: bundle name
    if (previousValue === 'FROM') {
      return true; // Bundle name
    }
    
    // After JOIN: bundle name
    if (previousValue === 'JOIN' || previousValue === 'INNER') {
      return true; // Bundle name for join
    }
    
    // After WHERE, ON: field names in conditions
    if (previousValue === 'WHERE' || previousValue === 'ON') {
      return true; // Field name in condition
    }
    
    // After BY (GROUP BY or ORDER BY): field names
    if (previousValue === 'BY') {
      return true; // Field name
    }
    
    // After comma: additional field names or conditions
    if (previousValue === ',' && hasFrom) {
      return true; // Additional field or condition element
    }
    
    // After operators: field names, values, or bundle references
    if (['=', '==', '<', '>', '<=', '>=', '!=', '!=='].includes(previousValue)) {
      return true;
    }
    
    // After dot: field name in qualified reference (bundle.field)
    if (previousValue === '.') {
      return true; // Field name in qualified reference
    }
    
    // After another identifier: could be part of qualified name
    const previousToken = tokens[currentIndex - 1];
    if (previousToken.type === TokenType.IDENTIFIER) {
      // Check if next token is a dot (for bundle.field pattern)
      const nextToken = currentIndex + 1 < tokens.length ? tokens[currentIndex + 1] : null;
      return nextToken?.value === '.' || nextToken?.type === TokenType.OPERATOR;
    }
    
    return false;
  }

  /**
   * Validate punctuation placement
   */
  private validatePunctuation(punctuation: string, index: number, tokens: SyntaxToken[]): boolean {
    // Basic punctuation validation
    switch (punctuation) {
      case ';':
        // Semicolons can end statements
        return index > 0;
      case '(':
        // Opening parentheses are generally valid
        return true;
      case ')':
        // Closing parentheses need matching opening
        return true; // Simplified - would need stack-based validation for proper matching
      case ',':
        // Commas separate items in lists
        return index > 0;
      default:
        return true;
    }
  }

  /**
   * Reset the validation state
   */
  private reset(): void {
    this.currentStatement = '';
    this.tokenSequence = [];
    this.invalidIndices.clear();
  }
}

/**
 * Main grammar validator class
 * Enhanced with comprehensive error analysis for detailed user feedback
 */
export class SyndrQLGrammarValidator {
  private grammarState: SyndrQLGrammarState;
  private errorAnalyzer: SyndrQLErrorAnalyzer;

  constructor() {
    this.grammarState = new SyndrQLGrammarState();
    this.errorAnalyzer = new SyndrQLErrorAnalyzer();
  }

  /**
   * Validate a sequence of tokens for grammatical correctness
   * Enhanced to include comprehensive error analysis
   * @param tokens - Tokens to validate
   * @param statementLineOffset - Line offset for error reporting (0-based)
   * @returns Detailed validation result with error information
   */
  validate(tokens: SyntaxToken[], statementLineOffset: number = 0): GrammarValidationResult {
    // Get basic grammar validation result
    const baseResult = this.grammarState.validateTokens(tokens);
    
    // Analyze errors if validation failed
    let errorDetails: ErrorDetail[] = [];
    if (!baseResult.isValid) {
      // Analyze grammar-level errors
      const grammarErrors = this.errorAnalyzer.analyzeGrammarErrors(tokens, baseResult, statementLineOffset);
      
      // Analyze token-level errors
      const tokenErrors = this.errorAnalyzer.analyzeTokenErrors(tokens, statementLineOffset);
      
      // Combine all errors
      errorDetails = [...grammarErrors, ...tokenErrors];
    }
    
    // Return enhanced result with error details
    return {
      ...baseResult,
      errorDetails
    };
  }

  /**
   * Check if a single token is grammatically valid in context
   */
  isTokenValid(token: SyntaxToken, context: SyntaxToken[]): boolean {
    const result = this.validate([...context, token]);
    const tokenIndex = context.length;
    return !result.invalidTokens.has(tokenIndex);
  }
  
  /**
   * Get detailed error analysis for a validation result
   * @param tokens - The tokens that were validated
   * @param validationResult - The validation result to analyze
   * @param statementLineOffset - Line offset for error reporting
   * @returns Array of detailed error information
   */
  getDetailedErrors(
    tokens: SyntaxToken[], 
    validationResult: GrammarValidationResult,
    statementLineOffset: number = 0
  ): ErrorDetail[] {
    if (validationResult.errorDetails) {
      return validationResult.errorDetails;
    }
    
    // Fallback analysis if errorDetails not available
    return this.errorAnalyzer.analyzeGrammarErrors(tokens, validationResult, statementLineOffset);
  }
}