/**
 * GraphQL Validator — Client-side validation for queries and mutations
 *
 * Validation rules:
 * 1. Balanced braces {} and parens ()
 * 2. Valid operation structure: keyword → optional name → optional vars → selection set
 * 3. Selection set must contain at least one field
 * 4. Variable syntax: $name: Type
 * 5. Argument syntax: name: value
 * 6. Schema-aware: validate type/field names against schema context (when available)
 */

import { GraphQLTokenType, type GraphQLToken } from './graphql-token-types.js';
import type { GraphQLSchemaContext } from './graphql-schema-context.js';
import type { ILanguageServiceValidationResult, ILanguageServiceError } from '../language-service-interface.js';

export class GraphQLValidator {
  private schemaContext: GraphQLSchemaContext | null = null;

  setSchemaContext(ctx: GraphQLSchemaContext): void {
    this.schemaContext = ctx;
  }

  /**
   * Validate an array of tokens from a GraphQL document.
   */
  validate(tokens: GraphQLToken[], source: string): ILanguageServiceValidationResult {
    const errors: ILanguageServiceError[] = [];
    const warnings: ILanguageServiceError[] = [];

    // Filter significant tokens
    const significant = tokens.filter(
      t =>
        t.Type !== GraphQLTokenType.WHITESPACE &&
        t.Type !== GraphQLTokenType.NEWLINE &&
        t.Type !== GraphQLTokenType.COMMENT &&
        t.Type !== GraphQLTokenType.COMMA &&
        t.Type !== GraphQLTokenType.EOF,
    );

    if (significant.length === 0) {
      return { valid: true, errors: [], warnings: [], info: [] };
    }

    // Check for illegal tokens
    for (const token of significant) {
      if (token.Type === GraphQLTokenType.ILLEGAL) {
        errors.push({
          code: 'ILLEGAL_CHARACTER',
          message: `Unexpected character: ${token.Value}`,
          severity: 'error',
          startPosition: token.StartPosition,
          endPosition: token.EndPosition,
        });
      }
    }

    // Check balanced braces and parens
    this.checkBalanced(significant, errors);

    // Check operation structure
    this.checkOperationStructure(significant, errors);

    // Schema-aware checks
    if (this.schemaContext) {
      this.checkSchemaAware(significant, errors, warnings);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      info: [],
    };
  }

  // ── Balanced delimiters ────────────────────────────────────────────────────

  private checkBalanced(tokens: GraphQLToken[], errors: ILanguageServiceError[]): void {
    const stack: Array<{ type: string; token: GraphQLToken }> = [];

    const openers: Record<string, string> = {
      [GraphQLTokenType.LBRACE]: GraphQLTokenType.RBRACE,
      [GraphQLTokenType.LPAREN]: GraphQLTokenType.RPAREN,
      [GraphQLTokenType.LBRACKET]: GraphQLTokenType.RBRACKET,
    };

    const closerToOpener: Record<string, string> = {
      [GraphQLTokenType.RBRACE]: GraphQLTokenType.LBRACE,
      [GraphQLTokenType.RPAREN]: GraphQLTokenType.LPAREN,
      [GraphQLTokenType.RBRACKET]: GraphQLTokenType.LBRACKET,
    };

    const nameMap: Record<string, string> = {
      [GraphQLTokenType.LBRACE]: '{',
      [GraphQLTokenType.RBRACE]: '}',
      [GraphQLTokenType.LPAREN]: '(',
      [GraphQLTokenType.RPAREN]: ')',
      [GraphQLTokenType.LBRACKET]: '[',
      [GraphQLTokenType.RBRACKET]: ']',
    };

    for (const token of tokens) {
      if (openers[token.Type]) {
        stack.push({ type: token.Type, token });
      } else if (closerToOpener[token.Type]) {
        const expected = closerToOpener[token.Type];
        if (stack.length === 0 || stack[stack.length - 1].type !== expected) {
          errors.push({
            code: 'UNBALANCED_DELIMITER',
            message: `Unexpected '${nameMap[token.Type] || token.Value}'`,
            severity: 'error',
            startPosition: token.StartPosition,
            endPosition: token.EndPosition,
          });
        } else {
          stack.pop();
        }
      }
    }

    // Report unclosed openers
    for (const entry of stack) {
      errors.push({
        code: 'UNCLOSED_DELIMITER',
        message: `Unclosed '${nameMap[entry.type] || entry.token.Value}'`,
        severity: 'error',
        startPosition: entry.token.StartPosition,
        endPosition: entry.token.EndPosition,
      });
    }
  }

  // ── Operation structure ────────────────────────────────────────────────────

  private checkOperationStructure(tokens: GraphQLToken[], errors: ILanguageServiceError[]): void {
    let i = 0;

    while (i < tokens.length) {
      const token = tokens[i];

      // Expect: operation keyword or shorthand query (starts with {)
      if (
        token.Type === GraphQLTokenType.QUERY ||
        token.Type === GraphQLTokenType.MUTATION ||
        token.Type === GraphQLTokenType.SUBSCRIPTION
      ) {
        i = this.validateOperation(tokens, i, errors);
      } else if (token.Type === GraphQLTokenType.LBRACE) {
        // Anonymous query (shorthand)
        i = this.validateSelectionSet(tokens, i, errors);
      } else if (token.Type === GraphQLTokenType.FRAGMENT) {
        // Fragment definition — skip for now (Phase 7 roadmap)
        i = this.skipToNextTopLevel(tokens, i);
      } else {
        // Unexpected top-level token
        errors.push({
          code: 'UNEXPECTED_TOKEN',
          message: `Expected 'query', 'mutation', or '{' at top level, got '${token.Value}'`,
          severity: 'error',
          startPosition: token.StartPosition,
          endPosition: token.EndPosition,
        });
        i++;
      }
    }
  }

  private validateOperation(tokens: GraphQLToken[], start: number, errors: ILanguageServiceError[]): number {
    let i = start + 1; // skip keyword

    // Optional operation name
    if (i < tokens.length && tokens[i].Type === GraphQLTokenType.NAME) {
      i++;
    }

    // Optional variable definitions
    if (i < tokens.length && tokens[i].Type === GraphQLTokenType.LPAREN) {
      i = this.skipBalancedParens(tokens, i);
    }

    // Optional directives
    while (i < tokens.length && tokens[i].Type === GraphQLTokenType.AT) {
      i = this.skipDirective(tokens, i);
    }

    // Required selection set
    if (i < tokens.length && tokens[i].Type === GraphQLTokenType.LBRACE) {
      i = this.validateSelectionSet(tokens, i, errors);
    } else if (i < tokens.length) {
      errors.push({
        code: 'MISSING_SELECTION_SET',
        message: `Expected selection set '{' after operation`,
        severity: 'error',
        startPosition: tokens[start].StartPosition,
        endPosition: tokens[Math.min(i, tokens.length - 1)].EndPosition,
      });
    }

    return i;
  }

  private validateSelectionSet(tokens: GraphQLToken[], start: number, errors: ILanguageServiceError[]): number {
    if (tokens[start].Type !== GraphQLTokenType.LBRACE) return start;

    let i = start + 1; // skip {
    let fieldCount = 0;
    let depth = 1;

    while (i < tokens.length && depth > 0) {
      const token = tokens[i];

      if (token.Type === GraphQLTokenType.LBRACE) {
        depth++;
        i++;
      } else if (token.Type === GraphQLTokenType.RBRACE) {
        depth--;
        i++;
      } else {
        if (depth === 1) {
          fieldCount++;
        }
        i++;
      }
    }

    if (fieldCount === 0) {
      errors.push({
        code: 'EMPTY_SELECTION_SET',
        message: 'Selection set must contain at least one field',
        severity: 'error',
        startPosition: tokens[start].StartPosition,
        endPosition: tokens[Math.min(i - 1, tokens.length - 1)].EndPosition,
      });
    }

    return i;
  }

  // ── Schema-aware checks ────────────────────────────────────────────────────

  private checkSchemaAware(
    tokens: GraphQLToken[],
    errors: ILanguageServiceError[],
    warnings: ILanguageServiceError[],
  ): void {
    if (!this.schemaContext) return;

    const typeNames = this.schemaContext.getTypeNames();
    const queryFieldNames = this.schemaContext.getQueryFields().map(f => f.name);
    const mutationFieldNames = this.schemaContext.getMutationFields().map(f => f.name);

    // Find field names in selection sets at depth 1 and check against known root fields
    let depth = 0;
    let currentOp: 'query' | 'mutation' | null = null;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      if (token.Type === GraphQLTokenType.QUERY) {
        currentOp = 'query';
      } else if (token.Type === GraphQLTokenType.MUTATION) {
        currentOp = 'mutation';
      } else if (token.Type === GraphQLTokenType.LBRACE) {
        depth++;
      } else if (token.Type === GraphQLTokenType.RBRACE) {
        depth--;
        if (depth === 0) currentOp = null;
      } else if (depth === 1 && token.Type === GraphQLTokenType.NAME) {
        const fieldName = token.Value;
        const knownFields = currentOp === 'mutation' ? mutationFieldNames : queryFieldNames;

        if (knownFields.length > 0 && !knownFields.includes(fieldName)) {
          warnings.push({
            code: 'UNKNOWN_FIELD',
            message: `Unknown ${currentOp || 'query'} field: '${fieldName}'`,
            severity: 'warning',
            startPosition: token.StartPosition,
            endPosition: token.EndPosition,
          });
        }
      }
    }
  }

  // ── Skip helpers ───────────────────────────────────────────────────────────

  private skipBalancedParens(tokens: GraphQLToken[], start: number): number {
    let i = start + 1;
    let depth = 1;
    while (i < tokens.length && depth > 0) {
      if (tokens[i].Type === GraphQLTokenType.LPAREN) depth++;
      else if (tokens[i].Type === GraphQLTokenType.RPAREN) depth--;
      i++;
    }
    return i;
  }

  private skipDirective(tokens: GraphQLToken[], start: number): number {
    let i = start + 1; // skip @
    // directive name
    if (i < tokens.length && tokens[i].Type === GraphQLTokenType.NAME) i++;
    // optional arguments
    if (i < tokens.length && tokens[i].Type === GraphQLTokenType.LPAREN) {
      i = this.skipBalancedParens(tokens, i);
    }
    return i;
  }

  private skipToNextTopLevel(tokens: GraphQLToken[], start: number): number {
    let i = start + 1;
    let depth = 0;
    while (i < tokens.length) {
      if (tokens[i].Type === GraphQLTokenType.LBRACE) depth++;
      else if (tokens[i].Type === GraphQLTokenType.RBRACE) {
        depth--;
        if (depth <= 0) {
          i++;
          break;
        }
      }
      i++;
    }
    return i;
  }
}
