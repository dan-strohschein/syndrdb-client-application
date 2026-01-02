/**
 * Cross-Statement Validator for SyndrQL Language Service V2
 * Validates references across statements using document context
 * Checks bundle existence, field references, permissions, and migration dependencies
 */

import type { Token } from './tokenizer';
import type { DocumentContext } from './document-context';
import { ErrorCodes, ErrorAnalyzer, type EnhancedErrorDetail, ErrorCategory } from './error-analyzer';
import { TokenType } from './token_types';

/**
 * Cross-statement validation result
 */
export interface CrossStatementValidationResult {
    isValid: boolean;
    errors: EnhancedErrorDetail[];
    warnings: EnhancedErrorDetail[];
}

/**
 * Statement reference extracted from tokens
 */
interface StatementReference {
    type: 'database' | 'bundle' | 'field' | 'user' | 'migration' | 'relationship';
    name: string;
    database?: string;
    bundle?: string;
    position: { start: number; end: number };
}

/**
 * Cross-statement validator
 */
export class CrossStatementValidator {
    private errorAnalyzer: ErrorAnalyzer;

    constructor() {
        this.errorAnalyzer = new ErrorAnalyzer();
    }

    /**
     * Validate statement against document context
     */
    validate(
        tokens: Token[],
        statementText: string,
        context: DocumentContext
    ): CrossStatementValidationResult {
        const errors: EnhancedErrorDetail[] = [];
        const warnings: EnhancedErrorDetail[] = [];

        if (tokens.length === 0) {
            return { isValid: true, errors: [], warnings: [] };
        }

        // Extract references from statement
        const references = this.extractReferences(tokens, context);

        // Validate each reference
        for (const ref of references) {
            const validationErrors = this.validateReference(ref, context);
            errors.push(...validationErrors);
        }

        // Check for warnings (stale context, etc.)
        if (context.isStale()) {
            warnings.push({
                code: 'CONTEXT_STALE',
                message: 'Schema context is stale. Refresh to ensure accurate validation.',
                severity: 'warning',
                startPosition: 0,
                endPosition: statementText.length,
                category: ErrorCategory.SEMANTIC,
                suggestion: 'Click "Refresh Schema" to update context from server'
            });
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Extract references from tokens
     */
    private extractReferences(tokens: Token[], context: DocumentContext): StatementReference[] {
        const references: StatementReference[] = [];
        const currentDatabase = context.getCurrentDatabase();

        // Analyze token sequence to identify references
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            const nextToken = i + 1 < tokens.length ? tokens[i + 1] : null;
            const tokenValue = token.Value.toUpperCase();

            // Database references
            if (tokenValue === 'DATABASE' && nextToken && nextToken.Type === TokenType.TOKEN_IDENTIFIER.toLowerCase()) {
                references.push({
                    type: 'database',
                    name: nextToken.Value,
                    position: { start: nextToken.StartPosition, end: nextToken.EndPosition }
                });
                i++; // Skip next token
            }
            // Bundle references (FROM, TO, INTO clauses)
            else if ((tokenValue === 'FROM' || tokenValue === 'TO' || tokenValue === 'INTO') && 
                     nextToken && nextToken.Type === TokenType.TOKEN_IDENTIFIER.toLowerCase()) {
                references.push({
                    type: 'bundle',
                    name: nextToken.Value,
                    database: currentDatabase || undefined,
                    position: { start: nextToken.StartPosition, end: nextToken.EndPosition }
                });
                i++; // Skip next token
            }
            // Bundle references (BUNDLE keyword)
            else if (tokenValue === 'BUNDLE' && nextToken && nextToken.Type === TokenType.TOKEN_IDENTIFIER.toLowerCase()) {
                references.push({
                    type: 'bundle',
                    name: nextToken.Value,
                    database: currentDatabase || undefined,
                    position: { start: nextToken.StartPosition, end: nextToken.EndPosition }
                });
                i++; // Skip next token
            }
            // User references
            else if (tokenValue === 'USER' && nextToken && nextToken.Type === TokenType.TOKEN_IDENTIFIER.toLowerCase()) {
                references.push({
                    type: 'user',
                    name: nextToken.Value,
                    position: { start: nextToken.StartPosition, end: nextToken.EndPosition }
                });
                i++; // Skip next token
            }
            // Migration references
            else if (tokenValue === 'MIGRATION' && nextToken && nextToken.Type === TokenType.TOKEN_IDENTIFIER.toLowerCase()) {
                references.push({
                    type: 'migration',
                    name: nextToken.Value,
                    position: { start: nextToken.StartPosition, end: nextToken.EndPosition }
                });
                i++; // Skip next token
            }
            // Field references (WHERE, SET clauses)
            else if ((tokenValue === 'WHERE' || tokenValue === 'SET') && 
                     nextToken && nextToken.Type === TokenType.TOKEN_IDENTIFIER.toLowerCase()) {
                // Extract field names from WHERE/SET conditions
                const fields = this.extractFieldsFromClause(tokens, i + 1);
                for (const field of fields) {
                    references.push({
                        type: 'field',
                        name: field.name,
                        database: currentDatabase || undefined,
                        position: field.position
                    });
                }
            }
        }

        return references;
    }

    /**
     * Extract field names from WHERE or SET clause
     */
    private extractFieldsFromClause(
        tokens: Token[],
        startIndex: number
    ): Array<{ name: string; position: { start: number; end: number } }> {
        const fields: Array<{ name: string; position: { start: number; end: number } }> = [];
        
        // Parse until we hit a clause terminator (semicolon, ORDER, GROUP, LIMIT, etc.)
        for (let i = startIndex; i < tokens.length; i++) {
            const token = tokens[i];
            const tokenValue = token.Value.toUpperCase();

            // Stop at clause terminators
            if ([';', 'ORDER', 'GROUP', 'LIMIT', 'OFFSET'].includes(tokenValue)) {
                break;
            }

            // Collect identifiers that are likely field names
            if (token.Type === TokenType.TOKEN_IDENTIFIER.toLowerCase()) {
                // Check if next token is assignment or comparison operator
                const nextToken = i + 1 < tokens.length ? tokens[i + 1] : null;
                if (nextToken && ['=', '!=', '<', '>', '<=', '>='].includes(nextToken.Value)) {
                    fields.push({
                        name: token.Value,
                        position: { start: token.StartPosition, end: token.EndPosition }
                    });
                }
            }
        }

        return fields;
    }

    /**
     * Validate a single reference against context
     */
    private validateReference(
        ref: StatementReference,
        context: DocumentContext
    ): EnhancedErrorDetail[] {
        const errors: EnhancedErrorDetail[] = [];

        switch (ref.type) {
            case 'database':
                if (!context.hasDatabase(ref.name)) {
                    errors.push({
                        code: ErrorCodes.DATABASE_NOT_FOUND,
                        message: `Database not found: ${ref.name}`,
                        severity: 'error',
                        startPosition: ref.position.start,
                        endPosition: ref.position.end,
                        category: ErrorCategory.REFERENCE,
                        suggestion: `Create database: CREATE DATABASE ${ref.name};`
                    });
                }
                break;

            case 'bundle':
                if (ref.database) {
                    if (!context.hasBundle(ref.database, ref.name)) {
                        errors.push({
                            code: ErrorCodes.BUNDLE_NOT_FOUND,
                            message: `Bundle not found: ${ref.name} in database ${ref.database}`,
                            severity: 'error',
                            startPosition: ref.position.start,
                            endPosition: ref.position.end,
                            category: ErrorCategory.REFERENCE,
                            suggestion: `Create bundle: CREATE BUNDLE ${ref.name} WITH FIELDS (...);`
                        });
                    }
                } else {
                    // No database context - can't validate
                    errors.push({
                        code: 'NO_DATABASE_CONTEXT',
                        message: `Cannot validate bundle reference without database context. Use "USE DATABASE name;" first.`,
                        severity: 'warning',
                        startPosition: ref.position.start,
                        endPosition: ref.position.end,
                        category: ErrorCategory.SEMANTIC,
                        suggestion: 'Specify database: USE DATABASE mydb;'
                    });
                }
                break;

            case 'field':
                if (ref.database && ref.bundle) {
                    if (!context.hasField(ref.database, ref.bundle, ref.name)) {
                        errors.push({
                            code: ErrorCodes.FIELD_NOT_FOUND,
                            message: `Field not found: ${ref.name} in bundle ${ref.bundle}`,
                            severity: 'error',
                            startPosition: ref.position.start,
                            endPosition: ref.position.end,
                            category: ErrorCategory.REFERENCE,
                            suggestion: `Add field: ALTER BUNDLE ${ref.bundle} ADD FIELD ${ref.name} text;`
                        });
                    }
                }
                break;

            case 'user':
                // User validation would require checking against user directory
                // This is a placeholder for future implementation
                break;

            case 'migration':
                if (!context.hasMigration(ref.name)) {
                    errors.push({
                        code: ErrorCodes.MIGRATION_DEPENDENCY_NOT_FOUND,
                        message: `Migration not found: ${ref.name}`,
                        severity: 'error',
                        startPosition: ref.position.start,
                        endPosition: ref.position.end,
                        category: ErrorCategory.MIGRATION,
                        suggestion: `Define migration: MIGRATION ${ref.name} { ... };`
                    });
                } else {
                    // Check for circular dependencies
                    if (context.hasCircularDependency(ref.name)) {
                        errors.push({
                            code: ErrorCodes.MIGRATION_CIRCULAR_DEPENDENCY,
                            message: `Circular dependency detected in migration: ${ref.name}`,
                            severity: 'error',
                            startPosition: ref.position.start,
                            endPosition: ref.position.end,
                            category: ErrorCategory.MIGRATION,
                            suggestion: 'Remove circular dependencies from migration chain'
                        });
                    }

                    // Check for missing dependencies
                    const { valid, missing } = context.validateMigrationDependencies(ref.name);
                    if (!valid) {
                        errors.push({
                            code: ErrorCodes.MIGRATION_DEPENDENCY_NOT_FOUND,
                            message: `Migration ${ref.name} has missing dependencies: ${missing.join(', ')}`,
                            severity: 'error',
                            startPosition: ref.position.start,
                            endPosition: ref.position.end,
                            category: ErrorCategory.MIGRATION,
                            suggestion: `Define missing migrations: ${missing.join(', ')}`
                        });
                    }
                }
                break;
        }

        return errors;
    }

    /**
     * Validate CREATE statement
     */
    validateCreateStatement(
        tokens: Token[],
        statementText: string,
        context: DocumentContext
    ): CrossStatementValidationResult {
        const errors: EnhancedErrorDetail[] = [];
        const warnings: EnhancedErrorDetail[] = [];

        // Extract what's being created
        const objectType = tokens.length > 1 ? tokens[1].Value.toUpperCase() : '';
        const objectName = tokens.length > 2 ? tokens[2].Value : '';

        // Check for duplicate names
        if (objectType === 'DATABASE' && context.hasDatabase(objectName)) {
            warnings.push({
                code: 'DUPLICATE_DATABASE',
                message: `Database ${objectName} already exists`,
                severity: 'warning',
                startPosition: tokens[2].StartPosition,
                endPosition: tokens[2].EndPosition,
                category: ErrorCategory.SEMANTIC,
                suggestion: 'Use ALTER DATABASE or choose a different name'
            });
        } else if (objectType === 'BUNDLE' && context.getCurrentDatabase()) {
            const db = context.getCurrentDatabase()!;
            if (context.hasBundle(db, objectName)) {
                warnings.push({
                    code: 'DUPLICATE_BUNDLE',
                    message: `Bundle ${objectName} already exists in database ${db}`,
                    severity: 'warning',
                    startPosition: tokens[2].StartPosition,
                    endPosition: tokens[2].EndPosition,
                    category: ErrorCategory.SEMANTIC,
                    suggestion: 'Use ALTER BUNDLE or choose a different name'
                });
            }
        }

        return { isValid: errors.length === 0, errors, warnings };
    }

    /**
     * Validate DROP statement
     */
    validateDropStatement(
        tokens: Token[],
        statementText: string,
        context: DocumentContext
    ): CrossStatementValidationResult {
        const errors: EnhancedErrorDetail[] = [];
        const warnings: EnhancedErrorDetail[] = [];

        // Extract what's being dropped
        const objectType = tokens.length > 1 ? tokens[1].Value.toUpperCase() : '';
        const objectName = tokens.length > 2 ? tokens[2].Value : '';

        // Warn about destructive operation
        warnings.push({
            code: 'DESTRUCTIVE_OPERATION',
            message: `DROP ${objectType} is a destructive operation that cannot be undone`,
            severity: 'warning',
            startPosition: tokens[0].StartPosition,
            endPosition: tokens[0].EndPosition,
            category: ErrorCategory.SEMANTIC,
            suggestion: 'Consider creating a backup before dropping'
        });

        return { isValid: errors.length === 0, errors, warnings };
    }
}
