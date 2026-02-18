/**
 * Unit tests for Grammar Loader
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { GrammarEngine } from '../../Lit/src/components/code-editor/syndrQL-language-serviceV2/grammar_engine.js';

describe('Grammar Loader', () => {
  let grammarEngine: GrammarEngine;

  beforeAll(async () => {
    // Initialize grammar engine before tests
    grammarEngine = GrammarEngine.getInstance();
    await grammarEngine.initialize();
  });

  describe('initialization', () => {
    it('should initialize successfully', () => {
      expect(grammarEngine.isInitialized()).toBe(true);
    });

    it('should load all four grammar types', () => {
      const grammars = grammarEngine.getAllGrammars();
      expect(grammars.size).toBe(4);
    });

    it('should have valid versions for all grammars', () => {
      const grammars = grammarEngine.getAllGrammars();
      
      for (const [type, grammar] of grammars.entries()) {
        expect(grammar.version).toBeDefined();
        expect(grammar.version).toMatch(/^\d+\.\d+\.\d+$/);
      }
    });
  });

  describe('grammar structure', () => {
    it('should have grammarEntries map for each grammar', () => {
      const grammars = grammarEngine.getAllGrammars();
      
      for (const [type, grammar] of grammars.entries()) {
        expect(grammar.grammarEntries).toBeInstanceOf(Map);
        expect(grammar.grammarEntries.size).toBeGreaterThan(0);
      }
    });

    it('should have valid grammar entries with root and rules', () => {
      const grammars = grammarEngine.getAllGrammars();
      
      for (const [type, grammar] of grammars.entries()) {
        expect(grammar.grammar).toBeInstanceOf(Array);
        expect(grammar.grammar.length).toBeGreaterThan(0);
        
        for (const entry of grammar.grammar) {
          expect(entry.root).toBeDefined();
          expect(entry.rules).toBeInstanceOf(Array);
          expect(entry.rules.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('statement type detection', () => {
    it('should detect DDL statements', () => {
      const createToken = {
        Type: 'CREATE' as any,
        Value: 'CREATE',
        Literal: null,
        Line: 1,
        Column: 1,
        StartPosition: 0,
        EndPosition: 6
      };

      const grammar = grammarEngine.getGrammarForStatement(createToken);
      expect(grammar.type).toBe('DDL');
    });

    it('should detect DML statements', () => {
      const selectToken = {
        Type: 'SELECT' as any,
        Value: 'SELECT',
        Literal: null,
        Line: 1,
        Column: 1,
        StartPosition: 0,
        EndPosition: 6
      };

      const grammar = grammarEngine.getGrammarForStatement(selectToken);
      expect(grammar.type).toBe('DML');
    });

    it('should handle unknown statement types', () => {
      const unknownToken = {
        Type: 'UNKNOWN' as any,
        Value: 'UNKNOWN',
        Literal: null,
        Line: 1,
        Column: 1,
        StartPosition: 0,
        EndPosition: 7
      };

      const grammar = grammarEngine.getGrammarForStatement(unknownToken);
      // Grammar engine may return null or default grammar for unknown types
      expect(grammar !== undefined).toBe(true);
    });
  });
});
