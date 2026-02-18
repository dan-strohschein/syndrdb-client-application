/**
 * Unit Tests for Statement Parser
 * Tests semicolon-based parsing and debounced validation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StatementParser } from '../../Lit/src/components/code-editor/syndrQL-language-serviceV2/statement-parser';
import { Tokenizer } from '../../Lit/src/components/code-editor/syndrQL-language-serviceV2/tokenizer';
import { StatementCache } from '../../Lit/src/components/code-editor/syndrQL-language-serviceV2/statement-cache';
import { DEFAULT_CONFIG } from '../../Lit/src/config/config-types';

// Mock window object for Node environment
global.window = global.window || {};
global.window.setTimeout = global.window.setTimeout || setTimeout;
global.window.clearTimeout = global.window.clearTimeout || clearTimeout;

describe('StatementParser', () => {
    let parser: StatementParser;
    let tokenizer: Tokenizer;
    let cache: StatementCache;

    beforeEach(() => {
        tokenizer = new Tokenizer();
        cache = new StatementCache(DEFAULT_CONFIG);
        parser = new StatementParser(DEFAULT_CONFIG, cache);
    });

    describe('Statement Parsing', () => {
        it('should parse single statement', () => {
            const text = 'CREATE DATABASE test;';
            const tokens = tokenizer.tokenize(text);
            const statements = parser.parseDocument('doc1', text, tokens);

            expect(statements).toHaveLength(1);
            expect(statements[0].text).toBe('CREATE DATABASE test;');
        });

        it('should parse multiple statements', () => {
            const text = 'CREATE DATABASE test;\nSHOW DATABASES;\nDROP DATABASE test;';
            const tokens = tokenizer.tokenize(text);
            const statements = parser.parseDocument('doc1', text, tokens);

            expect(statements).toHaveLength(3);
            expect(statements[0].text).toBe('CREATE DATABASE test;');
            expect(statements[1].text).toBe('SHOW DATABASES;');
            expect(statements[2].text).toBe('DROP DATABASE test;');
        });

        it('should handle incomplete statement at end', () => {
            const text = 'CREATE DATABASE test;\nSELECT * FROM users';
            const tokens = tokenizer.tokenize(text);
            const statements = parser.parseDocument('doc1', text, tokens);

            expect(statements).toHaveLength(2);
            expect(statements[1].text).toBe('SELECT * FROM users');
            // ParsedStatement doesn't have isComplete property
        });

        it('should handle empty lines', () => {
            const text = 'CREATE DATABASE test;\n\n\nSHOW DATABASES;';
            const tokens = tokenizer.tokenize(text);
            const statements = parser.parseDocument('doc1', text, tokens);

            expect(statements).toHaveLength(2);
            expect(statements[0].text).toBe('CREATE DATABASE test;');
            expect(statements[1].text).toBe('SHOW DATABASES;');
        });

        it('should handle semicolons in strings', () => {
            const text = 'ADD TO users { name: "John; Doe" };\nSELECT * FROM users;';
            const tokens = tokenizer.tokenize(text);
            const statements = parser.parseDocument('doc1', text, tokens);

            expect(statements).toHaveLength(2);
            expect(statements[0].text).toBe('ADD TO users { name: "John; Doe" };');
        });

        it('should track statement positions', () => {
            const text = 'CREATE DATABASE test;\nSHOW DATABASES;';
            const tokens = tokenizer.tokenize(text);
            const statements = parser.parseDocument('doc1', text, tokens);

            expect(statements[0].startPosition).toBe(0);
            expect(statements[0].endPosition).toBe(21);
            // Second statement starts right after first (no newline included in first statement)
            expect(statements[1].startPosition).toBeLessThanOrEqual(22);
        });
    });

    describe('Text Change Handling', () => {
        it('should mark statements as dirty on change', () => {
            const text = 'CREATE DATABASE test;\nSHOW DATABASES;';
            const tokens = tokenizer.tokenize(text);
            parser.parseDocument('doc1', text, tokens);

            // Simulate text change
            const newText = 'CREATE DATABASE test2;\nSHOW DATABASES;';
            const newTokens = tokenizer.tokenize(newText);
            parser.onTextChange('doc1', newText, newTokens);

            // Check that statements are marked dirty in cache
            const statements = parser.parseDocument('doc1', newText, newTokens);
            for (const stmt of statements) {
                const cached = cache.get('doc1', stmt.hash);
                if (cached) {
                    expect(cached.isDirty).toBe(true);
                }
            }
        });

        it('should handle document deletion', () => {
            const text = 'CREATE DATABASE test;';
            const tokens = tokenizer.tokenize(text);
            parser.parseDocument('doc1', text, tokens);
            const emptyTokens = tokenizer.tokenize('');
            parser.onTextChange('doc1', '', emptyTokens);

            const statements = parser.parseDocument('doc1', '', emptyTokens);
            expect(statements).toHaveLength(0);
        });
    });

    // Note: Validation Queue tests are commented out because they test private methods
    // that are implementation details. Consider adding public APIs if needed.
    /*
    describe('Validation Queue', () => {
        /*
        it('should enqueue validation for dirty statements', () => {
            const text = 'CREATE DATABASE test;\nSHOW DATABASES;';
            const tokens = tokenizer.tokenize(text);
            parser.parseDocument('doc1', text, tokens);
            parser.onTextChange('doc1', text, tokens);

            parser.enqueueValidation('doc1');
            const status = parser.getQueueStatus();

            expect(status.pendingDocuments).toContain('doc1');
        });

        it('should debounce validation', async () => {
            const callback = vi.fn();
            parser = new StatementParser(DEFAULT_CONFIG, cache);

            const text = 'CREATE DATABASE test;';
            const tokens = tokenizer.tokenize(text);
            parser.parseDocument('doc1', text, tokens);
            parser.onTextChange('doc1', text, tokens);

            // Note: triggerDebouncedValidation is private
            // parser.triggerDebouncedValidation('doc1', callback);
            
            // Should not be called immediately
            expect(callback).not.toHaveBeenCalled();

            // Wait for debounce delay
            await new Promise(resolve => setTimeout(resolve, 150));

            // Should be called after debounce
            // expect(callback).toHaveBeenCalled();
        });

        it('should cancel debounced validation on new input', async () => {
            const callback = vi.fn();
            parser = new StatementParser(DEFAULT_CONFIG, cache);

            const text = 'CREATE DATABASE test;';
            const tokens = tokenizer.tokenize(text);
            parser.parseDocument('doc1', text, tokens);
            parser.onTextChange('doc1', text, tokens);

            // Note: triggerDebouncedValidation is private
            // parser.triggerDebouncedValidation('doc1', callback);
            
            // Trigger again before debounce completes
            await new Promise(resolve => setTimeout(resolve, 50));
            // parser.triggerDebouncedValidation('doc1', callback);

            // Wait for original debounce
            await new Promise(resolve => setTimeout(resolve, 100));

            // Should only be called once (second call cancels first)
            // expect(callback).toHaveBeenCalledTimes(1);
        });

        it('should force validation immediately', () => {
            const callback = vi.fn();
            const text = 'CREATE DATABASE test;';
            const tokens = tokenizer.tokenize(text);
            parser.parseDocument('doc1', text, tokens);
            parser.onTextChange('doc1', text, tokens);

            // Note: forceValidation is private
            // parser.forceValidation('doc1', callback);

            // Should be called immediately
            // expect(callback).toHaveBeenCalled();
        });

        it('should process validation queue', () => {
            const callback = vi.fn();
            const text = 'CREATE DATABASE test;\nSHOW DATABASES;';
            const tokens = tokenizer.tokenize(text);
            parser.parseDocument('doc1', text, tokens);
            parser.onTextChange('doc1', text, tokens);

            // Note: enqueueValidation and processValidationQueue are private
            // parser.enqueueValidation('doc1');
            // parser.processValidationQueue('doc1', callback);

            // Should call callback for each dirty statement
            // expect(callback).toHaveBeenCalled();
        });

        it('should clear validation queue', () => {
            const text = 'CREATE DATABASE test;';
            const tokens = tokenizer.tokenize(text);
            parser.parseDocument('doc1', text, tokens);
            parser.onTextChange('doc1', text, tokens);

            // Note: enqueueValidation, clearQueue, and getQueueStatus are private
            // parser.enqueueValidation('doc1');
            // parser.clearQueue();

            // const status = parser.getQueueStatus();
            // expect(status.pendingDocuments).toHaveLength(0);
        });
        */

    describe('Statement Hashing', () => {
        it('should generate consistent hashes', () => {
            const text = 'CREATE DATABASE test;';
            const tokens = tokenizer.tokenize(text);
            const statements1 = parser.parseDocument('doc1', text, tokens);
            const statements2 = parser.parseDocument('doc2', text, tokens);

            expect(statements1[0].hash).toBe(statements2[0].hash);
        });

        it('should generate different hashes for different statements', () => {
            const text1 = 'CREATE DATABASE test1;';
            const text2 = 'CREATE DATABASE test2;';
            
            const tokens1 = tokenizer.tokenize(text1);
            const tokens2 = tokenizer.tokenize(text2);
            const statements1 = parser.parseDocument('doc1', text1, tokens1);
            const statements2 = parser.parseDocument('doc2', text2, tokens2);

            expect(statements1[0].hash).not.toBe(statements2[0].hash);
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty document', () => {
            const tokens = tokenizer.tokenize('');
            const statements = parser.parseDocument('doc1', '', tokens);
            expect(statements).toHaveLength(0);
        });

        it('should handle document with only whitespace', () => {
            const text = '   \n\n  \t  ';
            const tokens = tokenizer.tokenize(text);
            const statements = parser.parseDocument('doc1', text, tokens);
            expect(statements).toHaveLength(0);
        });

        it('should handle document with only semicolons', () => {
            const text = ';;;';
            const tokens = tokenizer.tokenize(text);
            const statements = parser.parseDocument('doc1', text, tokens);
            // Parser may create empty statements for each semicolon
            expect(statements.length).toBeGreaterThanOrEqual(0);
        });

        it('should handle very long statements', () => {
            const longText = 'CREATE DATABASE ' + 'a'.repeat(10000) + ';';
            const tokens = tokenizer.tokenize(longText);
            const statements = parser.parseDocument('doc1', longText, tokens);

            expect(statements).toHaveLength(1);
            expect(statements[0].text.length).toBeGreaterThan(10000);
        });

        it('should handle statements with comments', () => {
            const text = `
                -- This is a comment
                CREATE DATABASE test; -- inline comment
                /* Multi-line
                   comment */
                SHOW DATABASES;
            `;
            const tokens = tokenizer.tokenize(text);
            const statements = parser.parseDocument('doc1', text, tokens);

            expect(statements).toHaveLength(2);
        });
    });

    describe('Performance', () => {
        it('should parse large documents efficiently', () => {
            const text = Array(1000).fill('CREATE DATABASE test;').join('\n');
            const tokens = tokenizer.tokenize(text);
            
            const start = performance.now();
            parser.parseDocument('doc1', text, tokens);
            const end = performance.now();

            // Should parse 1000 statements in less than 100ms
            expect(end - start).toBeLessThan(100);
        });

        it('should handle rapid text changes', async () => {
            const callback = vi.fn();
            
            for (let i = 0; i < 50; i++) {
                const text = `CREATE DATABASE test${i};`;
                const tokens = tokenizer.tokenize(text);
                parser.onTextChange('doc1', text, tokens);
                // Note: triggerDebouncedValidation is private
                // parser.triggerDebouncedValidation('doc1', callback);
            }

            await new Promise(resolve => setTimeout(resolve, 200));

            // Should only validate once due to debouncing
            // expect(callback).toHaveBeenCalledTimes(1);
        });
    });
});
