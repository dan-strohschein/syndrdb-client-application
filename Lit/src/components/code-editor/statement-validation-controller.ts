/**
 * Statement Validation Controller - Owns statement cache, validation results, and debounced validation.
 * Follows Single Responsibility Principle: only handles statement boundaries and validation state.
 * Used by CodeEditor to delegate statement cache and validation; host provides language service and requestRender.
 */

import type { Position } from './types.js';
import type { ILanguageService, ILanguageServiceValidationResult, ILanguageServiceParsedStatement } from './language-service-interface.js';
import type { Token } from './syndrQL-language-serviceV2/index.js';

export interface CodeStatement {
  code: string;
  lineStart: number;
  lineEnd: number;
  tokens: Token[];
  isValid: boolean;
  isDirty: boolean;
}

export interface StatementValidationControllerDeps {
  getDocumentLines: () => readonly string[];
  getCursorPosition: () => Position;
  getLanguageService: () => ILanguageService;
  onValidationComplete: () => void;
}

const STATEMENT_VALIDATION_DELAY_MS = 200;

export class StatementValidationController {
  private codeCache: { statements: CodeStatement[] } = { statements: [] };
  private validationResults = new Map<string, ILanguageServiceValidationResult>();
  private statementValidationTimeout: number | null = null;

  constructor(private readonly deps: StatementValidationControllerDeps) {}

  getStatements(): CodeStatement[] {
    return this.codeCache.statements;
  }

  getStatementForLine(lineIndex: number): CodeStatement | null {
    return (
      this.codeCache.statements.find(
        (stmt) => lineIndex >= stmt.lineStart && lineIndex <= stmt.lineEnd
      ) || null
    );
  }

  getCurrentStatement(cursorPosition: Position): CodeStatement | null {
    if (this.codeCache.statements.length === 0) return null;
    const line = cursorPosition.line;
    return (
      this.codeCache.statements.find(
        (stmt) => line >= stmt.lineStart && line <= stmt.lineEnd
      ) || null
    );
  }

  getValidationResult(statementKey: string): ILanguageServiceValidationResult | undefined {
    return this.validationResults.get(statementKey);
  }

  /**
   * Rebuild statement cache from document text using the language service.
   */
  updateStatementCache(): void {
    const lines = this.deps.getDocumentLines();
    const fullText = lines.join('\n');
    const lang = this.deps.getLanguageService();
    lang.updateDocument(fullText);
    const parsedStatements = lang.parseStatements(fullText, 'editor');
    const statements: CodeStatement[] = parsedStatements.map((stmt) => ({
      code: stmt.text,
      lineStart: stmt.startLine - 1,
      lineEnd: stmt.endLine - 1,
      tokens: stmt.tokens,
      isValid: true,
      isDirty: true,
    }));
    this.codeCache = { statements };
  }

  /**
   * Mark the statement containing the current cursor as dirty and schedule validation.
   */
  markCurrentStatementDirty(): void {
    const cursorPosition = this.deps.getCursorPosition();
    const currentStatement = this.getCurrentStatement(cursorPosition);
    if (!currentStatement) return;
    if (!currentStatement.isDirty) {
      currentStatement.isDirty = true;
    }
    this.scheduleStatementValidation(currentStatement);
  }

  private scheduleStatementValidation(statement: CodeStatement): void {
    if (this.statementValidationTimeout) {
      clearTimeout(this.statementValidationTimeout);
    }
    this.statementValidationTimeout = window.setTimeout(() => {
      this.validateStatement(statement);
      this.statementValidationTimeout = null;
    }, STATEMENT_VALIDATION_DELAY_MS);
  }

  private async validateStatement(statement: CodeStatement): Promise<void> {
    const currentStatement = this.codeCache.statements.find(
      (s) =>
        s.lineStart === statement.lineStart && s.lineEnd === statement.lineEnd
    );
    if (!currentStatement || !currentStatement.isDirty) return;

    try {
      const lang = this.deps.getLanguageService();
      const validationResult = await lang.validate(
        currentStatement.code,
        `editor:${currentStatement.lineStart}`
      );
      currentStatement.isValid = validationResult.valid;
      currentStatement.isDirty = false;
      const statementKey = `${currentStatement.lineStart}-${currentStatement.lineEnd}`;
      this.validationResults.set(statementKey, validationResult);
      this.deps.onValidationComplete();
    } catch (error) {
      console.error('Statement validation error:', error);
      currentStatement.isValid = false;
      currentStatement.isDirty = false;
      this.deps.onValidationComplete();
    }
  }
}
