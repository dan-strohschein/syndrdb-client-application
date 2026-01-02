/**
 * Error Analyzer for SyndrQL Language Service V2
 * Enhanced error analysis with support for DDL/DML/DOL/Migration statements
 * Provides detailed error messages, suggestions, and contextual information
 */

import type { Token } from './tokenizer';
import type { ValidationError, ValidationResult } from './grammar_engine';

/**
 * Error severity levels
 */
export enum ErrorSeverity {
    ERROR = 'error',
    WARNING = 'warning',
    INFO = 'info',
    HINT = 'hint'
}

/**
 * Error categories for classification
 */
export enum ErrorCategory {
    SYNTAX = 'syntax',
    SEMANTIC = 'semantic',
    REFERENCE = 'reference',
    TYPE = 'type',
    PERMISSION = 'permission',
    MIGRATION = 'migration'
}

/**
 * Enhanced error detail with additional context
 */
export interface EnhancedErrorDetail extends ValidationError {
    category: ErrorCategory;
    suggestion?: string;
    relatedInfo?: Array<{
        message: string;
        filePath?: string;
        startPosition: number;
        endPosition: number;
    }>;
    quickFixes?: Array<{
        title: string;
        edit: string;
    }>;
}

/**
 * Error code constants for all statement types
 */
export const ErrorCodes = {
    // General syntax errors
    SYNTAX_ERROR: 'SYNTAX_ERROR',
    UNEXPECTED_TOKEN: 'UNEXPECTED_TOKEN',
    UNEXPECTED_EOF: 'UNEXPECTED_EOF',
    EMPTY_STATEMENT: 'EMPTY_STATEMENT',
    UNKNOWN_STATEMENT: 'UNKNOWN_STATEMENT',
    NO_GRAMMAR: 'NO_GRAMMAR',
    NO_MATCHING_RULE: 'NO_MATCHING_RULE',
    NO_BRANCH_MATCH: 'NO_BRANCH_MATCH',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    
    // DDL errors
    CREATE_DATABASE_MISSING_NAME: 'CREATE_DATABASE_MISSING_NAME',
    CREATE_BUNDLE_MISSING_NAME: 'CREATE_BUNDLE_MISSING_NAME',
    CREATE_BUNDLE_MISSING_FIELDS: 'CREATE_BUNDLE_MISSING_FIELDS',
    DROP_DATABASE_MISSING_NAME: 'DROP_DATABASE_MISSING_NAME',
    DROP_BUNDLE_MISSING_NAME: 'DROP_BUNDLE_MISSING_NAME',
    ALTER_BUNDLE_MISSING_NAME: 'ALTER_BUNDLE_MISSING_NAME',
    ALTER_BUNDLE_MISSING_ACTION: 'ALTER_BUNDLE_MISSING_ACTION',
    INVALID_FIELD_TYPE: 'INVALID_FIELD_TYPE',
    INVALID_FIELD_CONSTRAINT: 'INVALID_FIELD_CONSTRAINT',
    DUPLICATE_FIELD_NAME: 'DUPLICATE_FIELD_NAME',
    
    // DML errors
    SELECT_MISSING_FROM: 'SELECT_MISSING_FROM',
    SELECT_INVALID_FIELD: 'SELECT_INVALID_FIELD',
    ADD_MISSING_TO: 'ADD_MISSING_TO',
    ADD_MISSING_DATA: 'ADD_MISSING_DATA',
    UPDATE_MISSING_SET: 'UPDATE_MISSING_SET',
    UPDATE_INVALID_FIELD: 'UPDATE_INVALID_FIELD',
    DELETE_MISSING_FROM: 'DELETE_MISSING_FROM',
    DELETE_MISSING_WHERE: 'DELETE_MISSING_WHERE',
    INVALID_WHERE_CLAUSE: 'INVALID_WHERE_CLAUSE',
    
    // DOL errors
    GRANT_MISSING_PERMISSION: 'GRANT_MISSING_PERMISSION',
    GRANT_MISSING_RESOURCE: 'GRANT_MISSING_RESOURCE',
    GRANT_MISSING_USER: 'GRANT_MISSING_USER',
    REVOKE_MISSING_PERMISSION: 'REVOKE_MISSING_PERMISSION',
    REVOKE_MISSING_RESOURCE: 'REVOKE_MISSING_RESOURCE',
    REVOKE_MISSING_USER: 'REVOKE_MISSING_USER',
    INVALID_PERMISSION: 'INVALID_PERMISSION',
    INVALID_RESOURCE_TYPE: 'INVALID_RESOURCE_TYPE',
    
    // Migration errors
    MIGRATION_MISSING_NAME: 'MIGRATION_MISSING_NAME',
    MIGRATION_MISSING_BODY: 'MIGRATION_MISSING_BODY',
    MIGRATION_INVALID_STATEMENT: 'MIGRATION_INVALID_STATEMENT',
    APPLY_MIGRATION_MISSING_NAME: 'APPLY_MIGRATION_MISSING_NAME',
    ROLLBACK_MIGRATION_MISSING_NAME: 'ROLLBACK_MIGRATION_MISSING_NAME',
    VALIDATE_MIGRATION_MISSING_NAME: 'VALIDATE_MIGRATION_MISSING_NAME',
    MIGRATION_DEPENDENCY_NOT_FOUND: 'MIGRATION_DEPENDENCY_NOT_FOUND',
    MIGRATION_CIRCULAR_DEPENDENCY: 'MIGRATION_CIRCULAR_DEPENDENCY',
    
    // Reference errors (cross-statement)
    BUNDLE_NOT_FOUND: 'BUNDLE_NOT_FOUND',
    DATABASE_NOT_FOUND: 'DATABASE_NOT_FOUND',
    FIELD_NOT_FOUND: 'FIELD_NOT_FOUND',
    USER_NOT_FOUND: 'USER_NOT_FOUND',
    RELATIONSHIP_NOT_FOUND: 'RELATIONSHIP_NOT_FOUND',
    UNDEFINED_REFERENCE: 'UNDEFINED_REFERENCE',
    
    // Type errors
    TYPE_MISMATCH: 'TYPE_MISMATCH',
    INVALID_TYPE_CONVERSION: 'INVALID_TYPE_CONVERSION',
    INCOMPATIBLE_TYPES: 'INCOMPATIBLE_TYPES',
    
    // String and literal errors
    UNTERMINATED_STRING: 'UNTERMINATED_STRING',
    INVALID_NUMBER_FORMAT: 'INVALID_NUMBER_FORMAT',
    INVALID_ESCAPE_SEQUENCE: 'INVALID_ESCAPE_SEQUENCE',
    
    // Permission errors
    PERMISSION_DENIED: 'PERMISSION_DENIED',
    INSUFFICIENT_PRIVILEGES: 'INSUFFICIENT_PRIVILEGES',
    INVALID_PERMISSION_SCOPE: 'INVALID_PERMISSION_SCOPE'
};

/**
 * Error message templates with context-aware formatting
 */
const ErrorMessages: Record<string, (context: any) => string> = {
    [ErrorCodes.SYNTAX_ERROR]: () => 'Syntax error in statement',
    [ErrorCodes.UNEXPECTED_TOKEN]: (ctx) => `Expected ${ctx.expected} but found ${ctx.found}`,
    [ErrorCodes.UNEXPECTED_EOF]: (ctx) => `Expected ${ctx.expected} but reached end of statement`,
    [ErrorCodes.EMPTY_STATEMENT]: () => 'Statement is empty',
    [ErrorCodes.UNKNOWN_STATEMENT]: (ctx) => `Unknown statement type: ${ctx.token}`,
    
    // DDL messages
    [ErrorCodes.CREATE_DATABASE_MISSING_NAME]: () => 'CREATE DATABASE requires a database name',
    [ErrorCodes.CREATE_BUNDLE_MISSING_NAME]: () => 'CREATE BUNDLE requires a bundle name',
    [ErrorCodes.CREATE_BUNDLE_MISSING_FIELDS]: () => 'CREATE BUNDLE requires field definitions',
    [ErrorCodes.INVALID_FIELD_TYPE]: (ctx) => `Invalid field type: ${ctx.type}. Expected text, number, boolean, date, or json`,
    [ErrorCodes.DUPLICATE_FIELD_NAME]: (ctx) => `Duplicate field name: ${ctx.field}`,
    
    // DML messages
    [ErrorCodes.SELECT_MISSING_FROM]: () => 'SELECT statement requires FROM clause',
    [ErrorCodes.ADD_MISSING_TO]: () => 'ADD statement requires TO clause specifying target bundle',
    [ErrorCodes.ADD_MISSING_DATA]: () => 'ADD statement requires data to insert',
    [ErrorCodes.UPDATE_MISSING_SET]: () => 'UPDATE statement requires SET clause',
    [ErrorCodes.DELETE_MISSING_WHERE]: () => 'DELETE without WHERE clause will delete all records. Add WHERE clause or use DELETE ALL',
    
    // DOL messages
    [ErrorCodes.GRANT_MISSING_PERMISSION]: () => 'GRANT requires permission (read, write, execute, admin)',
    [ErrorCodes.GRANT_MISSING_RESOURCE]: () => 'GRANT requires resource specification (database, bundle, or field)',
    [ErrorCodes.GRANT_MISSING_USER]: () => 'GRANT requires TO USER clause',
    [ErrorCodes.INVALID_PERMISSION]: (ctx) => `Invalid permission: ${ctx.permission}. Expected read, write, execute, or admin`,
    
    // Migration messages
    [ErrorCodes.MIGRATION_MISSING_NAME]: () => 'MIGRATION requires a unique name',
    [ErrorCodes.MIGRATION_MISSING_BODY]: () => 'MIGRATION requires body with statements enclosed in braces',
    [ErrorCodes.APPLY_MIGRATION_MISSING_NAME]: () => 'APPLY MIGRATION requires migration name',
    [ErrorCodes.MIGRATION_DEPENDENCY_NOT_FOUND]: (ctx) => `Migration dependency not found: ${ctx.migration}`,
    [ErrorCodes.MIGRATION_CIRCULAR_DEPENDENCY]: (ctx) => `Circular dependency detected in migration: ${ctx.migration}`,
    
    // Reference messages
    [ErrorCodes.BUNDLE_NOT_FOUND]: (ctx) => `Bundle not found: ${ctx.bundle}`,
    [ErrorCodes.DATABASE_NOT_FOUND]: (ctx) => `Database not found: ${ctx.database}`,
    [ErrorCodes.FIELD_NOT_FOUND]: (ctx) => `Field not found: ${ctx.field} in bundle ${ctx.bundle}`,
    [ErrorCodes.USER_NOT_FOUND]: (ctx) => `User not found: ${ctx.user}`,
    
    // Permission messages
    [ErrorCodes.PERMISSION_DENIED]: (ctx) => `Permission denied: ${ctx.action} on ${ctx.resource}`,
    [ErrorCodes.INSUFFICIENT_PRIVILEGES]: (ctx) => `Insufficient privileges to ${ctx.action}`
};

/**
 * Error suggestions for common issues
 */
const ErrorSuggestions: Record<string, (context: any) => string> = {
    [ErrorCodes.CREATE_DATABASE_MISSING_NAME]: () => 'Add a valid database name: CREATE DATABASE mydb;',
    [ErrorCodes.CREATE_BUNDLE_MISSING_FIELDS]: () => 'Add field definitions: CREATE BUNDLE users WITH FIELDS (name text, email text);',
    [ErrorCodes.SELECT_MISSING_FROM]: () => 'Add FROM clause: SELECT * FROM bundle_name;',
    [ErrorCodes.ADD_MISSING_TO]: () => 'Add TO clause: ADD TO bundle_name { field: value };',
    [ErrorCodes.DELETE_MISSING_WHERE]: () => 'Add WHERE clause: DELETE FROM bundle_name WHERE condition; or use DELETE ALL FROM bundle_name;',
    [ErrorCodes.GRANT_MISSING_PERMISSION]: () => 'Specify permission: GRANT read ON database mydb TO user john;',
    [ErrorCodes.MIGRATION_MISSING_NAME]: () => 'Add migration name: MIGRATION create_users { statements };',
    [ErrorCodes.BUNDLE_NOT_FOUND]: (ctx) => `Create the bundle first: CREATE BUNDLE ${ctx.bundle} WITH FIELDS (...);`,
    [ErrorCodes.FIELD_NOT_FOUND]: (ctx) => `Check field name or add field: ALTER BUNDLE ${ctx.bundle} ADD FIELD ${ctx.field} text;`
};

/**
 * Enhanced error analyzer for V2 language service
 */
export class ErrorAnalyzer {
    /**
     * Enhance validation errors with detailed context
     */
    enhanceErrors(
        validationResult: ValidationResult,
        tokens: Token[],
        statementText: string
    ): EnhancedErrorDetail[] {
        if (validationResult.isValid) {
            return [];
        }

        return validationResult.errors.map(error => 
            this.enhanceError(error, tokens, statementText)
        );
    }

    /**
     * Enhance a single validation error
     */
    private enhanceError(
        error: ValidationError,
        tokens: Token[],
        statementText: string
    ): EnhancedErrorDetail {
        const category = this.categorizeError(error.code);
        const context = this.extractErrorContext(error, tokens, statementText);
        const message = this.formatErrorMessage(error.code, context);
        const suggestion = this.generateSuggestion(error.code, context);
        const quickFixes = this.generateQuickFixes(error.code, context);

        return {
            ...error,
            message: message || error.message,
            category,
            suggestion,
            quickFixes
        };
    }

    /**
     * Categorize error by code
     */
    private categorizeError(code: string): ErrorCategory {
        if (code.includes('NOT_FOUND') || code.includes('UNDEFINED')) {
            return ErrorCategory.REFERENCE;
        }
        if (code.includes('TYPE') || code.includes('CONVERSION')) {
            return ErrorCategory.TYPE;
        }
        if (code.includes('PERMISSION') || code.includes('PRIVILEGES')) {
            return ErrorCategory.PERMISSION;
        }
        if (code.includes('MIGRATION')) {
            return ErrorCategory.MIGRATION;
        }
        if (code.includes('MISSING') || code.includes('INVALID') || 
            code.includes('UNEXPECTED') || code.includes('SYNTAX')) {
            return ErrorCategory.SYNTAX;
        }
        return ErrorCategory.SEMANTIC;
    }

    /**
     * Extract context information from error
     */
    private extractErrorContext(
        error: ValidationError,
        tokens: Token[],
        statementText: string
    ): any {
        // Find tokens around error position
        const errorTokens = tokens.filter(t => 
            t.StartPosition <= error.endPosition && 
            t.EndPosition >= error.startPosition
        );

        const context: any = {
            tokens: errorTokens,
            text: statementText.substring(error.startPosition, error.endPosition)
        };

        // Extract specific context based on error code
        if (error.code === ErrorCodes.UNEXPECTED_TOKEN) {
            context.found = context.text;
            context.expected = this.inferExpectedToken(error, tokens);
        }

        return context;
    }

    /**
     * Infer what token was expected
     */
    private inferExpectedToken(error: ValidationError, tokens: Token[]): string {
        // Extract expected token from error message if available
        const match = error.message.match(/Expected (\w+)/i);
        return match ? match[1] : 'valid token';
    }

    /**
     * Format error message with context
     */
    private formatErrorMessage(code: string, context: any): string {
        const formatter = ErrorMessages[code];
        return formatter ? formatter(context) : `Error: ${code}`;
    }

    /**
     * Generate suggestion for fixing error
     */
    private generateSuggestion(code: string, context: any): string | undefined {
        const suggestionFn = ErrorSuggestions[code];
        return suggestionFn ? suggestionFn(context) : undefined;
    }

    /**
     * Generate quick fix actions
     */
    private generateQuickFixes(
        code: string,
        context: any
    ): Array<{ title: string; edit: string }> | undefined {
        const fixes: Array<{ title: string; edit: string }> = [];

        // Generate quick fixes based on error type
        switch (code) {
            case ErrorCodes.CREATE_DATABASE_MISSING_NAME:
                fixes.push({
                    title: 'Add database name',
                    edit: 'CREATE DATABASE mydb;'
                });
                break;
            
            case ErrorCodes.SELECT_MISSING_FROM:
                fixes.push({
                    title: 'Add FROM clause',
                    edit: context.text + ' FROM bundle_name'
                });
                break;
            
            case ErrorCodes.DELETE_MISSING_WHERE:
                fixes.push({
                    title: 'Add WHERE clause',
                    edit: context.text + ' WHERE field = value'
                });
                fixes.push({
                    title: 'Use DELETE ALL',
                    edit: context.text.replace('DELETE FROM', 'DELETE ALL FROM')
                });
                break;
        }

        return fixes.length > 0 ? fixes : undefined;
    }

    /**
     * Analyze token-level errors
     */
    analyzeTokenErrors(tokens: Token[]): EnhancedErrorDetail[] {
        const errors: EnhancedErrorDetail[] = [];

        for (const token of tokens) {
            if (token.Type === TOKEN_ILLEGAL) {
                errors.push({
                    code: ErrorCodes.UNEXPECTED_TOKEN,
                    message: `Unexpected or invalid token: ${token.Value}`,
                    severity: 'error',
                    startPosition: token.StartPosition,
                    endPosition: token.EndPosition,
                    category: ErrorCategory.SYNTAX,
                    suggestion: 'Check for typos or invalid characters'
                });
            }
        }

        return errors;
    }
}
