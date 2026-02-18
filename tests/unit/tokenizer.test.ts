/**
 * Unit tests for Enhanced Tokenizer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Tokenizer, Token } from '../../Lit/src/components/code-editor/syndrQL-language-serviceV2/tokenizer.js';
import { TokenType } from '../../Lit/src/components/code-editor/syndrQL-language-serviceV2/token_types.js';

describe('Tokenizer', () => {
  let tokenizer: Tokenizer;

  beforeEach(() => {
    tokenizer = new Tokenizer();
  });

  describe('basic tokenization', () => {
    it('should tokenize simple keyword', () => {
      const tokens = tokenizer.tokenize('SELECT');
      
      expect(tokens).toHaveLength(1);
      expect(tokens[0].Value).toBe('SELECT');
      expect(tokens[0].Line).toBe(1);
      expect(tokens[0].Column).toBe(1);
    });

    it('should tokenize multiple keywords', () => {
      const tokens = tokenizer.tokenize('SELECT FROM WHERE');
      
      const keywords = tokens.filter((t: Token) => t.Type !== TokenType.TOKEN_NEWLINE);
      expect(keywords.length).toBeGreaterThanOrEqual(3);
    });

    it('should track position correctly', () => {
      const tokens = tokenizer.tokenize('SELECT * FROM users');
      
      expect(tokens[0].StartPosition).toBe(0);
      expect(tokens[0].EndPosition).toBeGreaterThan(0);
    });
  });

  describe('string literal handling', () => {
    it('should tokenize double-quoted strings', () => {
      const tokens = tokenizer.tokenize('"hello world"');
      
      expect(tokens).toHaveLength(1);
      expect(tokens[0].Type).toBe(TokenType.TOKEN_STRING);
      expect(tokens[0].Literal).toBe('hello world');
    });

    it('should tokenize single-quoted strings', () => {
      const tokens = tokenizer.tokenize("'hello world'");
      
      expect(tokens).toHaveLength(1);
      expect(tokens[0].Type).toBe(TokenType.TOKEN_STRING);
      expect(tokens[0].Literal).toBe('hello world');
    });

    it('should handle escape sequences in strings', () => {
      const tokens = tokenizer.tokenize('"hello\\nworld"');
      
      expect(tokens).toHaveLength(1);
      expect(tokens[0].Literal).toBe('hello\nworld');
    });

    it('should handle escaped quotes', () => {
      const tokens = tokenizer.tokenize('"hello\\"world"');
      
      expect(tokens).toHaveLength(1);
      expect(tokens[0].Literal).toBe('hello"world');
    });

    it('should detect unterminated strings', () => {
      const tokens = tokenizer.tokenize('"unterminated');
      
      expect(tokens).toHaveLength(1);
      expect(tokens[0].Type).toBe(TokenType.TOKEN_ILLEGAL);
    });
  });

  describe('comment detection', () => {
    it('should tokenize single-line comments with --', () => {
      const tokens = tokenizer.tokenize('-- this is a comment');
      
      expect(tokens).toHaveLength(1);
      expect(tokens[0].Type).toBe(TokenType.TOKEN_COMMENT);
      expect(tokens[0].Value).toContain('this is a comment');
    });

    it('should tokenize single-line comments with //', () => {
      const tokens = tokenizer.tokenize('// this is a comment');
      
      expect(tokens).toHaveLength(1);
      expect(tokens[0].Type).toBe(TokenType.TOKEN_COMMENT);
    });

    it('should tokenize multi-line comments', () => {
      const tokens = tokenizer.tokenize('/* this is\na multi-line\ncomment */');
      
      expect(tokens).toHaveLength(1);
      expect(tokens[0].Type).toBe(TokenType.TOKEN_COMMENT);
      expect(tokens[0].Value).toContain('multi-line');
    });

    it('should handle code after comments', () => {
      const tokens = tokenizer.tokenize('SELECT -- comment\nFROM');
      
      const nonNewline = tokens.filter((t: Token) => t.Type !== TokenType.TOKEN_NEWLINE);
      expect(nonNewline.length).toBeGreaterThanOrEqual(3); // SELECT, comment, FROM
    });
  });

  describe('number handling', () => {
    it('should tokenize integers', () => {
      const tokens = tokenizer.tokenize('42');
      
      expect(tokens).toHaveLength(1);
      expect(tokens[0].Type).toBe(TokenType.TOKEN_NUMBER);
      expect(tokens[0].Literal).toBe(42);
    });

    it('should tokenize decimal numbers', () => {
      const tokens = tokenizer.tokenize('3.14159');
      
      expect(tokens).toHaveLength(1);
      expect(tokens[0].Type).toBe(TokenType.TOKEN_NUMBER);
      expect(tokens[0].Literal).toBeCloseTo(3.14159);
    });

    it('should tokenize negative numbers', () => {
      const tokens = tokenizer.tokenize('-42');
      
      // Should be tokenized as minus operator + number
      expect(tokens.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('position tracking', () => {
    it('should track line numbers correctly', () => {
      const tokens = tokenizer.tokenize('SELECT\nFROM\nWHERE');
      
      const select = tokens.find((t: Token) => t.Value === 'SELECT');
      const from = tokens.find((t: Token) => t.Value === 'FROM');
      const where = tokens.find((t: Token) => t.Value === 'WHERE');
      
      expect(select?.Line).toBe(1);
      expect(from?.Line).toBe(2);
      expect(where?.Line).toBe(3);
    });

    it('should track column numbers correctly', () => {
      const tokens = tokenizer.tokenize('SELECT * FROM');
      
      expect(tokens[0].Column).toBe(1); // SELECT at column 1
    });

    it('should track start and end positions', () => {
      const tokens = tokenizer.tokenize('SELECT');
      
      expect(tokens[0].StartPosition).toBe(0);
      expect(tokens[0].EndPosition).toBe(6);
    });
  });

  describe('operators and punctuation', () => {
    it('should tokenize comparison operators', () => {
      const tokens = tokenizer.tokenize('= == != < > <= >=');
      
      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens.some((t: Token) => t.Type === TokenType.TOKEN_EQ)).toBe(true);
      expect(tokens.some((t: Token) => t.Type === TokenType.TOKEN_NOT_EQ)).toBe(true);
    });

    it('should tokenize punctuation', () => {
      const tokens = tokenizer.tokenize('( ) { } [ ] , ; .');
      
      expect(tokens.some((t: Token) => t.Type === TokenType.TOKEN_LPAREN)).toBe(true);
      expect(tokens.some((t: Token) => t.Type === TokenType.TOKEN_RPAREN)).toBe(true);
      expect(tokens.some((t: Token) => t.Type === TokenType.TOKEN_COMMA)).toBe(true);
      expect(tokens.some((t: Token) => t.Type === TokenType.TOKEN_SEMICOLON)).toBe(true);
    });
  });

  describe('complex statements', () => {
    it('should tokenize a complete SELECT statement', () => {
      const sql = 'SELECT * FROM "users" WHERE id = 42;';
      const tokens = tokenizer.tokenize(sql);
      
      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens.some((t: Token) => t.Value === 'SELECT')).toBe(true);
      expect(tokens.some((t: Token) => t.Value === 'FROM')).toBe(true);
      expect(tokens.some((t: Token) => t.Literal === 'users')).toBe(true);
      expect(tokens.some((t: Token) => t.Literal === 42)).toBe(true);
    });

    it('should handle mixed content', () => {
      const sql = 'SELECT "name", age FROM users -- get all users';
      const tokens = tokenizer.tokenize(sql);
      
      const hasKeywords = tokens.some((t: Token) => t.Value === 'SELECT');
      const hasStrings = tokens.some((t: Token) => t.Type === TokenType.TOKEN_STRING);
      const hasComments = tokens.some((t: Token) => t.Type === TokenType.TOKEN_COMMENT);
      
      expect(hasKeywords).toBe(true);
      expect(hasStrings).toBe(true);
      expect(hasComments).toBe(true);
    });
  });
});
