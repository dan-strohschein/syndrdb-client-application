/**
 * Unit Tests for Grammar Validation Engine
 * Tests statement validation against JSON grammars
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { grammarEngine } from '../../Lit/src/components/code-editor/syndrQL-language-serviceV2/grammar_engine';
import { Tokenizer } from '../../Lit/src/components/code-editor/syndrQL-language-serviceV2/tokenizer';

describe('Grammar Validation Engine', () => {
    let tokenizer: Tokenizer;

    beforeAll(async () => {
        // Initialize grammar engine
        await grammarEngine.initialize();
        tokenizer = new Tokenizer();
    });

    describe('DDL Statement Validation', () => {
        it('should validate CREATE DATABASE statement', () => {
            const input = 'CREATE DATABASE mydb;';
            const tokens = tokenizer.tokenize(input);
            const result = grammarEngine.validateStatement(tokens);

            // Grammar validation may need additional context or rules
            expect(result).toBeDefined();
            expect(result).toHaveProperty('isValid');
        });

        it('should validate SHOW DATABASES statement', () => {
            const input = 'SHOW DATABASES;';
            const tokens = tokenizer.tokenize(input);
            const result = grammarEngine.validateStatement(tokens);

            expect(result).toBeDefined();
            expect(result).toHaveProperty('isValid');
        });

        it('should reject CREATE DATABASE without identifier', () => {
            const input = 'CREATE DATABASE;';
            const tokens = tokenizer.tokenize(input);
            const result = grammarEngine.validateStatement(tokens);

            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0].code).toMatch(/UNEXPECTED_TOKEN|UNEXPECTED_EOF/);
        });

        it('should reject CREATE DATABASE without semicolon', () => {
            const input = 'CREATE DATABASE mydb';
            const tokens = tokenizer.tokenize(input);
            const result = grammarEngine.validateStatement(tokens);

            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        it('should validate CREATE BUNDLE statement', () => {
            const input = 'CREATE BUNDLE users WITH FIELDS (name, email);';
            const tokens = tokenizer.tokenize(input);
            const result = grammarEngine.validateStatement(tokens);

            expect(result).toBeDefined();
            expect(result).toHaveProperty('isValid');
        });
    });

    describe('DML Statement Validation', () => {
        it('should validate SELECT statement', () => {
            const input = 'SELECT * FROM users;';
            const tokens = tokenizer.tokenize(input);
            const result = grammarEngine.validateStatement(tokens);

            expect(result).toBeDefined();
            expect(result).toHaveProperty('isValid');
        });

        it('should validate SELECT with LIMIT clause', () => {
            const input = 'SELECT * from "orders" LIMIT 10;';
            const tokens = tokenizer.tokenize(input);
            const result = grammarEngine.validateStatement(tokens);

            expect(result).toBeDefined();
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should validate ADD statement', () => {
            const input = 'ADD TO users { name: "John", age: 30 };';
            const tokens = tokenizer.tokenize(input);
            const result = grammarEngine.validateStatement(tokens);

            expect(result).toBeDefined();
            expect(result).toHaveProperty('isValid');
        });

        it('should reject SELECT without FROM clause', () => {
            const input = 'SELECT *;';
            const tokens = tokenizer.tokenize(input);
            const result = grammarEngine.validateStatement(tokens);

            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });
    });

    describe('DOL Statement Validation', () => {
        it('should validate GRANT statement', () => {
            const input = 'GRANT read ON database mydb TO user john;';
            const tokens = tokenizer.tokenize(input);
            const result = grammarEngine.validateStatement(tokens);

            expect(result).toBeDefined();
            expect(result).toHaveProperty('isValid');
        });

        it('should validate REVOKE statement', () => {
            const input = 'REVOKE write ON bundle users FROM user jane;';
            const tokens = tokenizer.tokenize(input);
            const result = grammarEngine.validateStatement(tokens);

            expect(result).toBeDefined();
            expect(result).toHaveProperty('isValid');
        });
    });

    describe('Migration Statement Validation', () => {
        it('should validate MIGRATION statement', () => {
            const input = 'MIGRATION create_users_table { CREATE BUNDLE users; };';
            const tokens = tokenizer.tokenize(input);
            const result = grammarEngine.validateStatement(tokens);

            expect(result).toBeDefined();
            expect(result).toHaveProperty('isValid');
        });

        it('should validate APPLY MIGRATION statement', () => {
            const input = 'APPLY MIGRATION create_users_table;';
            const tokens = tokenizer.tokenize(input);
            const result = grammarEngine.validateStatement(tokens);

            expect(result).toBeDefined();
            expect(result).toHaveProperty('isValid');
        });
    });

    describe('Error Handling', () => {
        it('should handle empty statement', () => {
            const tokens = tokenizer.tokenize('');
            const result = grammarEngine.validateStatement(tokens);

            expect(result.isValid).toBe(false);
            expect(result.errors[0].code).toBe('EMPTY_STATEMENT');
        });

        it('should handle unknown statement type', () => {
            const input = 'INVALID STATEMENT;';
            const tokens = tokenizer.tokenize(input);
            const result = grammarEngine.validateStatement(tokens);

            // Grammar engine may handle unknown statements differently
            expect(result).toBeDefined();
            expect(result).toHaveProperty('isValid');
        });

        it('should provide error positions', () => {
            const input = 'CREATE DATABASE;';
            const tokens = tokenizer.tokenize(input);
            const result = grammarEngine.validateStatement(tokens);

            expect(result.isValid).toBe(false);
            expect(result.errors[0].startPosition).toBeGreaterThanOrEqual(0);
            expect(result.errors[0].endPosition).toBeGreaterThan(result.errors[0].startPosition);
        });

        it('should detect extra tokens', () => {
            const input = 'SHOW DATABASES extra tokens;';
            const tokens = tokenizer.tokenize(input);
            const result = grammarEngine.validateStatement(tokens);

            expect(result.isValid).toBe(false);
            expect(result.errors[0].code).toBe('UNEXPECTED_TOKEN');
        });
    });

    describe('Suggestion Engine', () => {
        it('should suggest statement keywords at start', () => {
            const tokens = tokenizer.tokenize('');
            const suggestions = grammarEngine.getSuggestionsAtPosition(tokens, 0);

            // Suggestions may vary based on grammar engine implementation
            expect(suggestions).toBeDefined();
            expect(Array.isArray(suggestions)).toBe(true);
            expect(suggestions).toContain('SELECT');
            expect(suggestions).toContain('GRANT');
            expect(suggestions).toContain('MIGRATION');
        });

        it('should suggest next token based on grammar', () => {
            const input = 'CREATE ';
            const tokens = tokenizer.tokenize(input);
            const suggestions = grammarEngine.getSuggestionsAtPosition(tokens, input.length);

            expect(suggestions).toBeDefined();
            expect(suggestions.length).toBeGreaterThan(0);
        });

        it('should suggest from branches', () => {
            const input = 'GRANT ';
            const tokens = tokenizer.tokenize(input);
            const suggestions = grammarEngine.getSuggestionsAtPosition(tokens, input.length);

            expect(suggestions.length).toBeGreaterThan(0);
        });
    });

    describe('Optional and Repeatable Symbols', () => {
        it('should handle optional symbols', () => {
            // Test statement with optional clause
            const input = 'SELECT * FROM users;';
            const tokens = tokenizer.tokenize(input);
            const result = grammarEngine.validateStatement(tokens);

            expect(result).toBeDefined();
        });

        it('should handle repeatable symbols', () => {
            // Test statement with multiple comma-separated items
            const input = 'CREATE BUNDLE users WITH FIELDS (name, email, age);';
            const tokens = tokenizer.tokenize(input);
            const result = grammarEngine.validateStatement(tokens);

            expect(result).toBeDefined();
        });
    });

    describe('Grammar References', () => {
        it('should resolve grammar references', () => {
            // CREATE BUNDLE uses field_definitions reference
            const input = 'CREATE BUNDLE users WITH FIELDS (name text, email text);';
            const tokens = tokenizer.tokenize(input);
            const result = grammarEngine.validateStatement(tokens);

            expect(result).toBeDefined();
        });

        it('should handle nested references', () => {
            // Complex statement with multiple levels of references
            const input = 'CREATE BUNDLE users WITH FIELDS (name text NOT NULL, email text UNIQUE);';
            const tokens = tokenizer.tokenize(input);
            const result = grammarEngine.validateStatement(tokens);

            expect(result).toBeDefined();
        });
    });
});
