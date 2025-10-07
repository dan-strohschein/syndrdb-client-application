/**
 * Statement Parser for SyndrQL Code
 * Handles parsing document text into individual statements based on semicolon boundaries
 */

import { CodeStatement, SyntaxToken } from './types.js';
import { SyndrQLTokenizer } from './tokenizer.js';

/**
 * Parses SyndrQL code into individual statements for granular validation and caching
 */
export class StatementParser {
  private tokenizer: SyndrQLTokenizer;

  constructor() {
    this.tokenizer = new SyndrQLTokenizer();
  }

  /**
   * Parse document text into CodeStatement objects
   * Each statement is terminated by a semicolon or end of document
   */
  parseStatements(text: string): CodeStatement[] {
    if (!text.trim()) {
      return [];
    }

    const statements: CodeStatement[] = [];
    const lines = text.split('\n');
    
    let currentStatementCode = '';
    let currentStatementStartLine = 0;
    let currentLineIndex = 0;

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      
      // Check if this line contains a semicolon
      const semicolonIndex = line.indexOf(';');
      
      if (semicolonIndex !== -1) {
        // Complete the current statement with content up to and including the semicolon
        const lineContentUpToSemicolon = line.substring(0, semicolonIndex + 1);
        currentStatementCode += (currentStatementCode ? '\n' : '') + lineContentUpToSemicolon;
        
        // Create a statement if we have content
        if (currentStatementCode.trim()) {
          const statement = this.createStatement(
            currentStatementCode,
            currentStatementStartLine,
            lineIndex
          );
          statements.push(statement);
        }
        
        // Check if there's content after the semicolon on the same line
        const remainingContent = line.substring(semicolonIndex + 1).trim();
        if (remainingContent) {
          // Start a new statement with the remaining content
          currentStatementCode = line.substring(semicolonIndex + 1);
          currentStatementStartLine = lineIndex;
        } else {
          // Reset for next statement
          currentStatementCode = '';
          currentStatementStartLine = lineIndex + 1;
        }
      } else {
        // Add this line to the current statement
        currentStatementCode += (currentStatementCode ? '\n' : '') + line;
        
        // If this is the first line of a new statement, record the start line
        if (!currentStatementCode.replace('\n', '').trim()) {
          currentStatementStartLine = lineIndex;
        }
      }
    }
    
    // Handle incomplete statement at end of document
    if (currentStatementCode.trim()) {
      const statement = this.createStatement(
        currentStatementCode,
        currentStatementStartLine,
        lines.length - 1
      );
      statements.push(statement);
    }

    return statements;
  }

  /**
   * Create a CodeStatement object from statement text and boundaries
   */
  private createStatement(code: string, startLine: number, endLine: number): CodeStatement {
    // Tokenize the statement code
    const tokens = this.tokenizer.tokenize(code);
    
    // Adjust token line numbers to be relative to document (not statement)
    const adjustedTokens = tokens.map(token => ({
      ...token,
      line: token.line + startLine
    }));

    return {
      code: code.trim(),
      lineStart: startLine,
      lineEnd: endLine,
      isValid: false, // Will be determined by validation
      isDirty: true,  // New statements start as dirty
      tokens: adjustedTokens
    };
  }

  /**
   * Find which statement contains the given line number
   */
  findStatementAtLine(statements: CodeStatement[], lineNumber: number): CodeStatement | null {
    for (const statement of statements) {
      if (lineNumber >= statement.lineStart && lineNumber <= statement.lineEnd) {
        return statement;
      }
    }
    return null;
  }

  /**
   * Find which statement contains the given position (line, column)
   */
  findStatementAtPosition(statements: CodeStatement[], line: number, column: number): CodeStatement | null {
    // First, find statements that contain the line
    const candidateStatements = statements.filter(stmt => 
      line >= stmt.lineStart && line <= stmt.lineEnd
    );

    if (candidateStatements.length === 0) {
      return null;
    }

    if (candidateStatements.length === 1) {
      return candidateStatements[0];
    }

    // If multiple statements on the same line (rare but possible with semicolons),
    // use token positions to determine the exact statement
    for (const statement of candidateStatements) {
      for (const token of statement.tokens) {
        if (token.line === line && column >= token.column && column <= token.column + token.value.length) {
          return statement;
        }
      }
    }

    // Fall back to the first candidate
    return candidateStatements[0];
  }

  /**
   * Mark a statement as dirty and return updated statements array
   */
  markStatementDirty(statements: CodeStatement[], targetStatement: CodeStatement): CodeStatement[] {
    return statements.map(stmt => 
      stmt === targetStatement 
        ? { ...stmt, isDirty: true }
        : stmt
    );
  }

  /**
   * Mark a statement as clean after successful validation
   */
  markStatementClean(statements: CodeStatement[], targetStatement: CodeStatement, isValid: boolean): CodeStatement[] {
    return statements.map(stmt =>
      stmt === targetStatement
        ? { ...stmt, isDirty: false, isValid }
        : stmt
    );
  }

  /**
   * Update a statement's code content and mark it dirty
   */
  updateStatementCode(statements: CodeStatement[], targetStatement: CodeStatement, newCode: string): CodeStatement[] {
    const updatedTokens = this.tokenizer.tokenize(newCode);
    
    // Adjust token line numbers relative to the statement's position in document
    const adjustedTokens = updatedTokens.map(token => ({
      ...token,
      line: token.line + targetStatement.lineStart
    }));

    return statements.map(stmt =>
      stmt === targetStatement
        ? {
            ...stmt,
            code: newCode.trim(),
            isDirty: true,
            tokens: adjustedTokens
          }
        : stmt
    );
  }
}