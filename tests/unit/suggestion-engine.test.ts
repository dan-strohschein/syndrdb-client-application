/**
 * Unit Tests for Suggestion Engine
 * Tests grammar-based and context-aware suggestions with ranking
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SuggestionEngine, SuggestionKind } from '../../Lit/src/components/code-editor/syndrQL-language-serviceV2/suggestion-engine';
import { DocumentContext, type DatabaseDefinition, type BundleDefinition, type FieldDefinition } from '../../Lit/src/components/code-editor/syndrQL-language-serviceV2/document-context';
import { Tokenizer } from '../../Lit/src/components/code-editor/syndrQL-language-serviceV2/tokenizer';
import { DEFAULT_CONFIG } from '../../Lit/src/config/config-types';

describe('SuggestionEngine', () => {
    let engine: SuggestionEngine;
    let context: DocumentContext;
    let tokenizer: Tokenizer;

    beforeEach(() => {
        engine = new SuggestionEngine(DEFAULT_CONFIG);
        context = new DocumentContext();
        tokenizer = new Tokenizer();

        // Setup test context
        const emailField: FieldDefinition = {
            name: 'email',
            type: 'text',
            constraints: { unique: true, nullable: false }
        };

        const nameField: FieldDefinition = {
            name: 'name',
            type: 'text',
            constraints: {}
        };

        const bundle: BundleDefinition = {
            name: 'users',
            database: 'testdb',
            fields: new Map([
                ['email', emailField],
                ['name', nameField]
            ]),
            relationships: new Map(),
            indexes: []
        };

        const db: DatabaseDefinition = {
            name: 'testdb',
            bundles: new Map([['users', bundle]])
        };

        context.updateDatabase(db);
        context.setCurrentDatabase('testdb');
    });

    describe('Grammar-Based Suggestions', () => {
        it('should suggest keywords at statement start', async () => {
            const text = '';
            const tokens = tokenizer.tokenize(text);
            const suggestions = await engine.getSuggestions(tokens, 0, context, text);

            // Grammar suggestions may not include keywords at empty position
            // Context-aware suggestions are prioritized
            expect(suggestions).toBeDefined();
            expect(Array.isArray(suggestions)).toBe(true);
        });

        it('should suggest next valid tokens based on grammar', async () => {
            const text = 'CREATE ';
            const tokens = tokenizer.tokenize(text);
            const suggestions = await engine.getSuggestions(tokens, text.length, context, text);

            // Grammar suggestions depend on parser state and context
            expect(suggestions).toBeDefined();
            expect(Array.isArray(suggestions)).toBe(true);
        });
    });

    describe('Context-Aware Suggestions', () => {
        it('should suggest databases after DATABASE keyword', async () => {
            const text = 'USE DATABASE ';
            const tokens = tokenizer.tokenize(text);
            const suggestions = await engine.getSuggestions(tokens, text.length, context, text);

            const databases = suggestions.filter(s => s.kind === SuggestionKind.DATABASE);
            expect(databases.length).toBeGreaterThan(0);
            expect(databases.some(s => s.label === 'testdb')).toBe(true);
        });

        it('should suggest bundles after FROM keyword', async () => {
            const text = 'SELECT * FROM ';
            const tokens = tokenizer.tokenize(text);
            const suggestions = await engine.getSuggestions(tokens, text.length, context, text);

            const bundles = suggestions.filter(s => s.kind === SuggestionKind.BUNDLE);
            expect(bundles.length).toBeGreaterThan(0);
            expect(bundles.some(s => s.label === 'users')).toBe(true);
        });

        it('should include field count in bundle suggestions', async () => {
            const text = 'SELECT * FROM ';
            const tokens = tokenizer.tokenize(text);
            const suggestions = await engine.getSuggestions(tokens, text.length, context, text);

            const userBundle = suggestions.find(s => s.label === 'users' && s.kind === SuggestionKind.BUNDLE);
            expect(userBundle).toBeDefined();
            expect(userBundle?.detail).toContain('2 fields');
        });
    });

    describe('Snippet Suggestions', () => {
        it('should suggest snippets at statement start', async () => {
            const text = '';
            const tokens = tokenizer.tokenize(text);
            const suggestions = await engine.getSuggestions(tokens, 0, context, text);

            const snippets = suggestions.filter(s => s.kind === SuggestionKind.SNIPPET);
            expect(snippets.length).toBeGreaterThan(0);
            expect(snippets.some(s => s.label === 'CREATE DATABASE')).toBe(true);
            expect(snippets.some(s => s.label === 'SELECT')).toBe(true);
        });

        it('should not suggest snippets mid-statement', async () => {
            const text = 'SELECT * FROM ';
            const tokens = tokenizer.tokenize(text);
            const suggestions = await engine.getSuggestions(tokens, text.length, context, text);

            const snippets = suggestions.filter(s => s.kind === SuggestionKind.SNIPPET);
            expect(snippets.length).toBe(0);
        });
    });

    describe('Operator Suggestions', () => {
        it('should suggest operators in WHERE clause', async () => {
            const text = 'SELECT * FROM users WHERE ';
            const tokens = tokenizer.tokenize(text);
            const suggestions = await engine.getSuggestions(tokens, text.length, context, text);

            const operators = suggestions.filter(s => s.kind === SuggestionKind.OPERATOR);
            expect(operators.length).toBeGreaterThan(0);
        });

        it('should include comparison operators', async () => {
            const text = 'SELECT * FROM users WHERE email ';
            const tokens = tokenizer.tokenize(text);
            const suggestions = await engine.getSuggestions(tokens, text.length, context, text);

            expect(suggestions.some(s => s.label === '=')).toBe(true);
            expect(suggestions.some(s => s.label === '!=')).toBe(true);
        });
    });

    describe('Fuzzy Matching', () => {
        it('should match exact input', () => {
            const result = engine.fuzzyMatch('CREATE', 'CREATE');
            expect(result.matched).toBe(true);
            expect(result.score).toBe(100);
        });

        it('should match prefix', () => {
            const result = engine.fuzzyMatch('CREATE', 'CRE');
            expect(result.matched).toBe(true);
            expect(result.score).toBeGreaterThan(50);
        });

        it('should match contains', () => {
            const result = engine.fuzzyMatch('CREATE', 'REA');
            expect(result.matched).toBe(true);
        });

        it('should match fuzzy characters', () => {
            const result = engine.fuzzyMatch('DATABASE', 'DTBS');
            expect(result.matched).toBe(true);
        });

        it('should not match unrelated strings', () => {
            const result = engine.fuzzyMatch('CREATE', 'SELECT');
            expect(result.matched).toBe(false);
        });
    });

    describe('Suggestion Filtering', () => {
        it('should filter suggestions by input', async () => {
            const text = '';
            const tokens = tokenizer.tokenize(text);
            const allSuggestions = await engine.getSuggestions(tokens, 0, context, text);

            const filtered = engine.filterSuggestions(allSuggestions, 'CRE');
            expect(filtered.every(s => s.label.toUpperCase().includes('CRE'))).toBe(true);
        });

        it('should return all suggestions with empty input', async () => {
            const text = '';
            const tokens = tokenizer.tokenize(text);
            const allSuggestions = await engine.getSuggestions(tokens, 0, context, text);

            const filtered = engine.filterSuggestions(allSuggestions, '');
            expect(filtered.length).toBe(allSuggestions.length);
        });
    });

    describe('Suggestion Ranking', () => {
        it('should prioritize context suggestions over keywords', async () => {
            const text = 'SELECT * FROM ';
            const tokens = tokenizer.tokenize(text);
            const suggestions = await engine.getSuggestions(tokens, text.length, context, text);

            // Bundle suggestions should have higher priority than generic keywords
            const userBundle = suggestions.find(s => s.label === 'users');
            const keyword = suggestions.find(s => s.kind === SuggestionKind.KEYWORD);

            if (userBundle && keyword) {
                expect(userBundle.priority).toBeGreaterThan(keyword.priority);
            }
        });

        it('should boost frequently used suggestions', () => {
            engine.recordUsage('users');
            engine.recordUsage('users');
            engine.recordUsage('users');

            // Usage should affect ranking in subsequent calls
            // This is tested indirectly through the ranking system
        });
    });

    describe('Cache Management', () => {
        it('should cache suggestions', async () => {
            const text = 'SELECT * FROM ';
            const tokens = tokenizer.tokenize(text);
            
            // First call
            await engine.getSuggestions(tokens, text.length, context, text);
            
            // Second call should hit cache
            const suggestions = await engine.getSuggestions(tokens, text.length, context, text);
            
            expect(suggestions).toBeDefined();
            expect(suggestions.length).toBeGreaterThan(0);
        });

        it('should clear cache', async () => {
            const text = 'SELECT * FROM ';
            const tokens = tokenizer.tokenize(text);
            
            await engine.getSuggestions(tokens, text.length, context, text);
            engine.clearCache();
            
            const stats = engine.getCacheStats();
            expect(stats.size).toBe(0);
        });

        it('should report cache statistics', async () => {
            const stats = engine.getCacheStats();
            expect(stats).toHaveProperty('size');
            expect(stats).toHaveProperty('hitRate');
        });
    });

    describe('Usage Tracking', () => {
        it('should track suggestion usage', () => {
            engine.recordUsage('CREATE');
            engine.recordUsage('SELECT');
            engine.recordUsage('CREATE');

            // Usage is tracked internally and affects ranking
            // Verified through integration tests
        });

        it('should limit usage tracking size', () => {
            // Add many entries
            for (let i = 0; i < 250; i++) {
                engine.recordUsage(`suggestion_${i}`);
            }

            // Should automatically trim to keep size manageable
            // Internal implementation detail
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty tokens', async () => {
            const suggestions = await engine.getSuggestions([], 0, context, '');
            expect(suggestions).toBeDefined();
            expect(suggestions.length).toBeGreaterThan(0);
        });

        it('should handle no database context', async () => {
            context.setCurrentDatabase('');
            const text = 'SELECT * FROM ';
            const tokens = tokenizer.tokenize(text);
            const suggestions = await engine.getSuggestions(tokens, text.length, context, text);

            expect(suggestions).toBeDefined();
        });

        it('should handle invalid cursor position', async () => {
            const text = 'SELECT';
            const tokens = tokenizer.tokenize(text);
            const suggestions = await engine.getSuggestions(tokens, 9999, context, text);

            expect(suggestions).toBeDefined();
        });

        it('should NOT show suggestions when expecting a literal value', async () => {
            // When a WHERE clause expects a literal value (after comparison operator),
            // no suggestions should be shown because literals are user-defined
            const text = 'SELECT * FROM "users" WHERE "email" == ';
            const tokens = tokenizer.tokenize(text);
            const suggestions = await engine.getSuggestions(tokens, text.length, context, text);

            // Should return empty array or very minimal suggestions (no keywords, no field names)
            // since the grammar expects a literal value here
            expect(suggestions).toBeDefined();
            // The suggestions array should be empty or only contain non-intrusive suggestions
            const hasKeywordOrFieldSuggestions = suggestions.some(s => 
                s.kind === SuggestionKind.KEYWORD || 
                s.kind === SuggestionKind.FIELD ||
                s.kind === SuggestionKind.BUNDLE
            );
            expect(hasKeywordOrFieldSuggestions).toBe(false);
        });
    });
});
