/**
 * SyndrQL Error Analyzer
 * Follows Single Responsibility Principle: Analyzes validation results and generates detailed error information
 * Maps low-level validation failures to user-friendly error messages with specific codes and suggestions
 */

import { SyntaxToken, TokenType } from './types.js';
import { ErrorDetail, ErrorCodes } from './error-codes.js';
import { GrammarValidationResult } from './grammar-validator.js';

/**
 * Analyzes validation results and generates detailed error information
 * Following VSCode error analysis patterns for comprehensive user feedback
 */
export class SyndrQLErrorAnalyzer {
  
  /**
   * Analyze grammar validation results and generate detailed error information
   * @param tokens - The tokens that were validated
   * @param validationResult - The grammar validation result
   * @param statementLineOffset - Line offset for the statement in the document (0-based)
   * @returns Array of detailed error information
   */
  analyzeGrammarErrors(
    tokens: SyntaxToken[], 
    validationResult: GrammarValidationResult,
    statementLineOffset: number = 0
  ): ErrorDetail[] {
    const errors: ErrorDetail[] = [];
    
    if (validationResult.isValid) {
      return errors; // No errors to analyze
    }
    
    // Filter out whitespace and comment tokens for analysis
    const significantTokens = tokens.filter(token => 
      token.type !== TokenType.WHITESPACE && 
      token.type !== TokenType.COMMENT && 
      token.type !== TokenType.NEWLINE
    );
    
    if (significantTokens.length === 0) {
      errors.push(this.createEmptyStatementError(statementLineOffset));
      return errors;
    }
    
    // Analyze invalid token positions to determine specific errors
    const invalidTokenIndices = Array.from(validationResult.invalidTokens);
    
    // Check for statement-level structural errors first
    const structuralErrors = this.analyzeStatementStructure(significantTokens, statementLineOffset);
    errors.push(...structuralErrors);
    
    // Analyze individual invalid tokens
    for (const tokenIndex of invalidTokenIndices) {
      if (tokenIndex < significantTokens.length) {
        const invalidToken = significantTokens[tokenIndex];
        const contextTokens = this.getTokenContext(significantTokens, tokenIndex);
        const tokenErrors = this.analyzeInvalidToken(invalidToken, contextTokens, statementLineOffset);
        errors.push(...tokenErrors);
      }
    }
    
    // If no specific errors found but validation failed, add generic error
    if (errors.length === 0) {
      errors.push(this.createGenericSyntaxError(significantTokens[0], statementLineOffset));
    }
    
    return errors;
  }
  
  /**
   * Analyze individual token errors (invalid identifiers, literals, etc.)
   * @param tokens - All tokens to analyze
   * @param statementLineOffset - Line offset for the statement
   * @returns Array of token-level errors
   */
  analyzeTokenErrors(tokens: SyntaxToken[], statementLineOffset: number = 0): ErrorDetail[] {
    const errors: ErrorDetail[] = [];
    
    for (const token of tokens) {
      if (token.type === TokenType.UNKNOWN) {
        errors.push(this.createInvalidTokenError(token, statementLineOffset));
      } else if (token.type === TokenType.STRING && this.isUnterminatedString(token)) {
        errors.push(this.createUnterminatedStringError(token, statementLineOffset));
      } else if (token.type === TokenType.NUMBER && this.isInvalidNumber(token)) {
        errors.push(this.createInvalidNumberError(token, statementLineOffset));
      }
    }
    
    return errors;
  }
  
  /**
   * Analyze statement structure for high-level syntax errors
   * @param tokens - Significant tokens (no whitespace/comments)
   * @param lineOffset - Line offset for error reporting
   * @returns Array of structural errors
   */
  private analyzeStatementStructure(tokens: SyntaxToken[], lineOffset: number): ErrorDetail[] {
    const errors: ErrorDetail[] = [];
    
    if (tokens.length === 0) {
      return errors;
    }
    
    const firstToken = tokens[0];
    const tokenValues = tokens.map(t => t.value.toUpperCase());
    
    // Analyze SELECT statement structure
    if (firstToken.value.toUpperCase() === 'SELECT') {
      errors.push(...this.analyzeSelectStatement(tokens, lineOffset));
    }
    // Analyze INSERT statement structure
    else if (firstToken.value.toUpperCase() === 'INSERT') {
      errors.push(...this.analyzeInsertStatement(tokens, lineOffset));
    }
    // Analyze UPDATE statement structure  
    else if (firstToken.value.toUpperCase() === 'UPDATE') {
      errors.push(...this.analyzeUpdateStatement(tokens, lineOffset));
    }
    // Analyze DELETE statement structure
    else if (firstToken.value.toUpperCase() === 'DELETE') {
      errors.push(...this.analyzeDeleteStatement(tokens, lineOffset));
    }
    // Unknown statement type
    else {
      errors.push(this.createUnrecognizedCommandError(firstToken, lineOffset));
    }
    
    return errors;
  }
  
  /**
   * Analyze SELECT statement for SyndrQL-specific errors
   */
  private analyzeSelectStatement(tokens: SyntaxToken[], lineOffset: number): ErrorDetail[] {
    const errors: ErrorDetail[] = [];
    const tokenValues = tokens.map(t => t.value.toUpperCase());
    
    // Check for invalid keyword sequences like "SELECT ADD SET JOIN"
    if (tokenValues.includes('ADD') || tokenValues.includes('SET')) {
      const problemToken = tokens.find(t => ['ADD', 'SET'].includes(t.value.toUpperCase()));
      if (problemToken) {
        errors.push({
          code: ErrorCodes.SELECT_INVALID_KEYWORD_SEQUENCE,
          message: `"${problemToken.value}" is not valid in a SELECT statement. Expected DOCUMENTS, *, or field names.`,
          line: problemToken.line + lineOffset,
          column: problemToken.column,
          length: problemToken.value.length,
          source: problemToken.value,
          suggestion: 'Try SELECT DOCUMENTS FROM collection_name;'
        });
      }
    }
    
    // Check for missing target after SELECT
    if (tokens.length < 2) {
      errors.push({
        code: ErrorCodes.SELECT_MISSING_TARGET,
        message: 'SELECT statement is incomplete. Expected DOCUMENTS, *, or field names.',
        line: tokens[0].line + lineOffset,
        column: tokens[0].column + tokens[0].value.length,
        length: 1,
        source: 'SELECT',
        suggestion: 'Add DOCUMENTS or field names after SELECT'
      });
    }
    
    // Check for missing FROM clause
    if (!tokenValues.includes('FROM') && tokens.length > 2) {
      const lastToken = tokens[tokens.length - 1];
      errors.push({
        code: ErrorCodes.SELECT_MISSING_FROM,
        message: 'SELECT statement missing FROM clause.',
        line: lastToken.line + lineOffset,
        column: lastToken.column + lastToken.value.length,
        length: 1,
        source: tokenValues.join(' '),
        suggestion: 'Add FROM collection_name'
      });
    }
    
    return errors;
  }
  
  /**
   * Analyze INSERT statement structure
   */
  private analyzeInsertStatement(tokens: SyntaxToken[], lineOffset: number): ErrorDetail[] {
    const errors: ErrorDetail[] = [];
    const tokenValues = tokens.map(t => t.value.toUpperCase());
    
    if (!tokenValues.includes('INTO')) {
      errors.push({
        code: ErrorCodes.INSERT_MISSING_INTO,
        message: 'INSERT statement missing INTO clause.',
        line: tokens[0].line + lineOffset,
        column: tokens[0].column + tokens[0].value.length,
        length: 1,
        source: 'INSERT',
        suggestion: 'Add INTO collection_name'
      });
    }
    
    return errors;
  }
  
  /**
   * Analyze UPDATE statement structure
   */
  private analyzeUpdateStatement(tokens: SyntaxToken[], lineOffset: number): ErrorDetail[] {
    const errors: ErrorDetail[] = [];
    const tokenValues = tokens.map(t => t.value.toUpperCase());
    
    if (!tokenValues.includes('SET')) {
      errors.push({
        code: ErrorCodes.UPDATE_MISSING_SET,
        message: 'UPDATE statement missing SET clause.',
        line: tokens[0].line + lineOffset,
        column: tokens[0].column + tokens[0].value.length,
        length: 1,
        source: 'UPDATE',
        suggestion: 'Add SET field = value'
      });
    }
    
    return errors;
  }
  
  /**
   * Analyze DELETE statement structure
   */
  private analyzeDeleteStatement(tokens: SyntaxToken[], lineOffset: number): ErrorDetail[] {
    const errors: ErrorDetail[] = [];
    const tokenValues = tokens.map(t => t.value.toUpperCase());
    
    if (!tokenValues.includes('FROM')) {
      errors.push({
        code: ErrorCodes.DELETE_MISSING_FROM,
        message: 'DELETE statement missing FROM clause.',
        line: tokens[0].line + lineOffset,
        column: tokens[0].column + tokens[0].value.length,
        length: 1,
        source: 'DELETE',
        suggestion: 'Add FROM collection_name'
      });
    }
    
    return errors;
  }
  
  /**
   * Analyze individual invalid tokens in context
   */
  private analyzeInvalidToken(
    token: SyntaxToken, 
    context: { before: SyntaxToken[], after: SyntaxToken[] },
    lineOffset: number
  ): ErrorDetail[] {
    const errors: ErrorDetail[] = [];
    
    // Check if it's an unknown identifier
    if (token.type === TokenType.UNKNOWN || token.type === TokenType.IDENTIFIER) {
      errors.push({
        code: ErrorCodes.UNEXPECTED_TOKEN,
        message: `Unexpected token "${token.value}". Not recognized as a valid SyndrQL keyword or identifier.`,
        line: token.line + lineOffset,
        column: token.column,
        length: token.value.length,
        source: token.value,
        suggestion: 'Check spelling or refer to SyndrQL documentation'
      });
    }
    
    return errors;
  }
  
  /**
   * Get context tokens around a specific token index
   */
  private getTokenContext(tokens: SyntaxToken[], index: number): { before: SyntaxToken[], after: SyntaxToken[] } {
    const contextSize = 2;
    return {
      before: tokens.slice(Math.max(0, index - contextSize), index),
      after: tokens.slice(index + 1, Math.min(tokens.length, index + 1 + contextSize))
    };
  }
  
  /**
   * Create error for empty statement
   */
  private createEmptyStatementError(lineOffset: number): ErrorDetail {
    return {
      code: ErrorCodes.EMPTY_STATEMENT,
      message: 'Empty statement. Expected a SyndrQL command.',
      line: lineOffset,
      column: 0,
      length: 1,
      source: '',
      suggestion: 'Add a valid SyndrQL statement (SELECT, INSERT, UPDATE, DELETE, etc.)'
    };
  }
  
  /**
   * Create error for unrecognized command
   */
  private createUnrecognizedCommandError(token: SyntaxToken, lineOffset: number): ErrorDetail {
    return {
      code: ErrorCodes.UNRECOGNIZED_COMMAND,
      message: `"${token.value}" is not a recognized SyndrQL command.`,
      line: token.line + lineOffset,
      column: token.column,
      length: token.value.length,
      source: token.value,
      suggestion: 'Use SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, or ALTER'
    };
  }
  
  /**
   * Create generic syntax error
   */
  private createGenericSyntaxError(token: SyntaxToken, lineOffset: number): ErrorDetail {
    return {
      code: ErrorCodes.SYNTAX_ERROR,
      message: 'Syntax error in SyndrQL statement.',
      line: token.line + lineOffset,
      column: token.column,
      length: token.value.length,
      source: token.value,
      suggestion: 'Check statement structure and syntax'
    };
  }
  
  /**
   * Create error for invalid token
   */
  private createInvalidTokenError(token: SyntaxToken, lineOffset: number): ErrorDetail {
    return {
      code: ErrorCodes.INVALID_IDENTIFIER,
      message: `Invalid token "${token.value}". Contains invalid characters or format.`,
      line: token.line + lineOffset,
      column: token.column,
      length: token.value.length,
      source: token.value,
      suggestion: 'Use only letters, numbers, and underscores for identifiers'
    };
  }
  
  /**
   * Create error for unterminated string
   */
  private createUnterminatedStringError(token: SyntaxToken, lineOffset: number): ErrorDetail {
    return {
      code: ErrorCodes.UNTERMINATED_STRING,
      message: 'Unterminated string literal. Missing closing quote.',
      line: token.line + lineOffset,
      column: token.column,
      length: token.value.length,
      source: token.value,
      suggestion: 'Add closing quote to complete the string'
    };
  }
  
  /**
   * Create error for invalid number format
   */
  private createInvalidNumberError(token: SyntaxToken, lineOffset: number): ErrorDetail {
    return {
      code: ErrorCodes.INVALID_NUMBER_FORMAT,
      message: `Invalid number format "${token.value}".`,
      line: token.line + lineOffset,
      column: token.column,
      length: token.value.length,
      source: token.value,
      suggestion: 'Use valid number format (e.g., 123, 123.45, 1.23e-4)'
    };
  }
  
  /**
   * Check if string token is unterminated
   */
  private isUnterminatedString(token: SyntaxToken): boolean {
    const value = token.value;
    if (value.length < 2) return true;
    
    const quote = value[0];
    if (quote !== '"' && quote !== "'") return false;
    
    return value[value.length - 1] !== quote;
  }
  
  /**
   * Check if number token has invalid format
   */
  private isInvalidNumber(token: SyntaxToken): boolean {
    const value = token.value;
    // Basic number format validation
    return !/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(value);
  }
}

// TODO: I need to add more sophisticated context analysis for better error suggestions
// TODO: I should implement error recovery suggestions based on common typos
// TODO: I want to add semantic validation (checking if collection names exist, etc.)
// TODO: I need to implement error severity levels (error, warning, info)
// TODO: I should add support for multiple languages in error messages