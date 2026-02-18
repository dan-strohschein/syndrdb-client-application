/**
 * GraphQL Suggestion Engine — Context-aware autocomplete
 *
 * Provides suggestions based on cursor position within GraphQL source:
 * - Document start / after `}` → query, mutation
 * - Inside selection set → field names from schema context
 * - After `(` in arguments → argument names
 * - After `:` in variables → type names
 * - After `@` → directive names
 * - After `...` → on, fragment names
 */

import { GraphQLTokenType, type GraphQLToken } from './graphql-token-types.js';
import type { GraphQLSchemaContext } from './graphql-schema-context.js';
import type { ILanguageServiceSuggestion } from '../language-service-interface.js';

/** Usage frequency map for ranking. */
const usageFrequency = new Map<string, number>();

export class GraphQLSuggestionEngine {
  private schemaContext: GraphQLSchemaContext | null = null;

  setSchemaContext(ctx: GraphQLSchemaContext): void {
    this.schemaContext = ctx;
  }

  recordUsage(label: string): void {
    usageFrequency.set(label, (usageFrequency.get(label) ?? 0) + 1);
  }

  /**
   * Get suggestions for the given cursor position.
   *
   * @param tokens All tokens from the document
   * @param cursorPosition 0-based character position
   * @param source Full source text
   */
  getSuggestions(
    tokens: GraphQLToken[],
    cursorPosition: number,
    source: string,
  ): ILanguageServiceSuggestion[] {
    const context = this.determineCursorContext(tokens, cursorPosition);
    let suggestions: ILanguageServiceSuggestion[] = [];

    switch (context.kind) {
      case 'top-level':
        suggestions = this.topLevelSuggestions();
        break;
      case 'selection-set':
        suggestions = this.selectionSetSuggestions(context);
        break;
      case 'arguments':
        suggestions = this.argumentSuggestions(context);
        break;
      case 'variable-type':
        suggestions = this.typeSuggestions();
        break;
      case 'directive':
        suggestions = this.directiveSuggestions();
        break;
      case 'spread':
        suggestions = this.spreadSuggestions();
        break;
      default:
        suggestions = this.topLevelSuggestions();
    }

    // Apply filter text
    if (context.filterText) {
      const filter = context.filterText.toLowerCase();
      suggestions = suggestions.filter(s => s.label.toLowerCase().startsWith(filter));
    }

    // Rank by usage
    return suggestions.sort((a, b) => {
      const aUsage = usageFrequency.get(a.label) ?? 0;
      const bUsage = usageFrequency.get(b.label) ?? 0;
      if (aUsage !== bUsage) return bUsage - aUsage;
      return a.priority - b.priority;
    });
  }

  // ── Context detection ──────────────────────────────────────────────────────

  private determineCursorContext(
    tokens: GraphQLToken[],
    cursorPosition: number,
  ): CursorContext {
    // Find tokens before cursor
    const significant = tokens.filter(
      t =>
        t.Type !== GraphQLTokenType.WHITESPACE &&
        t.Type !== GraphQLTokenType.NEWLINE &&
        t.Type !== GraphQLTokenType.COMMENT &&
        t.Type !== GraphQLTokenType.COMMA &&
        t.Type !== GraphQLTokenType.EOF,
    );

    const before = significant.filter(t => t.EndPosition <= cursorPosition);
    const lastToken = before.length > 0 ? before[before.length - 1] : null;

    // Partial name being typed at cursor
    const currentToken = significant.find(
      t => t.StartPosition <= cursorPosition && t.EndPosition >= cursorPosition,
    );
    const filterText =
      currentToken && currentToken.Type === GraphQLTokenType.NAME
        ? currentToken.Value.substring(0, cursorPosition - currentToken.StartPosition)
        : '';

    if (!lastToken) {
      return { kind: 'top-level', filterText };
    }

    // Determine brace/paren depth
    let braceDepth = 0;
    let parenDepth = 0;
    let currentOp: 'query' | 'mutation' | null = null;
    let rootFieldName: string | null = null;

    for (const t of before) {
      if (t.Type === GraphQLTokenType.QUERY) currentOp = 'query';
      else if (t.Type === GraphQLTokenType.MUTATION) currentOp = 'mutation';
      else if (t.Type === GraphQLTokenType.LBRACE) {
        braceDepth++;
        // Track the field name at depth 1 → type for depth 2+
        if (braceDepth === 1) {
          // The name token before this brace is the root field
          const idx = before.indexOf(t);
          if (idx > 0 && before[idx - 1].Type === GraphQLTokenType.NAME) {
            rootFieldName = before[idx - 1].Value;
          }
        }
      } else if (t.Type === GraphQLTokenType.RBRACE) {
        braceDepth--;
        if (braceDepth === 0) {
          currentOp = null;
          rootFieldName = null;
        }
      } else if (t.Type === GraphQLTokenType.LPAREN) parenDepth++;
      else if (t.Type === GraphQLTokenType.RPAREN) parenDepth--;
    }

    // After @ → directive
    if (lastToken.Type === GraphQLTokenType.AT) {
      return { kind: 'directive', filterText };
    }

    // After ... → spread
    if (lastToken.Type === GraphQLTokenType.SPREAD) {
      return { kind: 'spread', filterText };
    }

    // Inside parens → arguments
    if (parenDepth > 0) {
      // After : in variable definition → type
      if (lastToken.Type === GraphQLTokenType.COLON) {
        return { kind: 'variable-type', filterText };
      }
      return { kind: 'arguments', filterText, currentOp, rootFieldName };
    }

    // At top level (depth 0 or after })
    if (braceDepth <= 0) {
      return { kind: 'top-level', filterText };
    }

    // Inside selection set
    return {
      kind: 'selection-set',
      filterText,
      currentOp,
      braceDepth,
      rootFieldName,
    };
  }

  // ── Suggestion generators ──────────────────────────────────────────────────

  private topLevelSuggestions(): ILanguageServiceSuggestion[] {
    return [
      this.makeSuggestion('query', 'keyword', 'Define a query operation', 1),
      this.makeSuggestion('mutation', 'keyword', 'Define a mutation operation', 2),
    ];
  }

  private selectionSetSuggestions(ctx: CursorContext): ILanguageServiceSuggestion[] {
    const suggestions: ILanguageServiceSuggestion[] = [];

    if (!this.schemaContext) {
      return suggestions;
    }

    if (ctx.braceDepth === 1) {
      // Root selection set → root-level query/mutation fields
      const fields =
        ctx.currentOp === 'mutation'
          ? this.schemaContext.getMutationFields()
          : this.schemaContext.getQueryFields();

      for (const field of fields) {
        suggestions.push(
          this.makeSuggestion(
            field.name,
            'field',
            `${field.returnType} — ${field.args.length} arg(s)`,
            10,
          ),
        );
      }
    } else if (ctx.rootFieldName && ctx.braceDepth && ctx.braceDepth >= 2) {
      // Nested selection set → fields of the return type
      // Determine the type name from the root field
      const rootField =
        ctx.currentOp === 'mutation'
          ? this.schemaContext.getMutationFields().find(f => f.name === ctx.rootFieldName)
          : this.schemaContext.getQueryFields().find(f => f.name === ctx.rootFieldName);

      if (rootField) {
        // Extract base type name from return type (e.g. "[User]" → "User")
        const typeName = rootField.returnType.replace(/[\[\]!]/g, '');
        const fieldNames = this.schemaContext.getFieldNames(typeName);

        for (const name of fieldNames) {
          suggestions.push(this.makeSuggestion(name, 'field', `Field of ${typeName}`, 10));
        }
      }
    }

    return suggestions;
  }

  private argumentSuggestions(ctx: CursorContext): ILanguageServiceSuggestion[] {
    const suggestions: ILanguageServiceSuggestion[] = [];

    if (!this.schemaContext || !ctx.rootFieldName) return suggestions;

    const fields =
      ctx.currentOp === 'mutation'
        ? this.schemaContext.getMutationFields()
        : this.schemaContext.getQueryFields();

    const field = fields.find(f => f.name === ctx.rootFieldName);
    if (field) {
      for (const arg of field.args) {
        suggestions.push(this.makeSuggestion(arg.name, 'field', arg.type, 10));
      }
    }

    return suggestions;
  }

  private typeSuggestions(): ILanguageServiceSuggestion[] {
    const scalars = this.schemaContext?.getScalarTypes() ?? ['String', 'Int', 'Float', 'Boolean', 'ID'];
    const types = this.schemaContext?.getTypeNames() ?? [];

    const suggestions: ILanguageServiceSuggestion[] = [];

    for (const s of scalars) {
      suggestions.push(this.makeSuggestion(s, 'keyword', 'Built-in scalar', 5));
    }
    for (const t of types) {
      suggestions.push(this.makeSuggestion(t, 'field', 'Object type', 10));
    }

    return suggestions;
  }

  private directiveSuggestions(): ILanguageServiceSuggestion[] {
    return [
      this.makeSuggestion('skip', 'keyword', '@skip(if: Boolean!)', 1, 'skip(if: )'),
      this.makeSuggestion('include', 'keyword', '@include(if: Boolean!)', 2, 'include(if: )'),
    ];
  }

  private spreadSuggestions(): ILanguageServiceSuggestion[] {
    const suggestions: ILanguageServiceSuggestion[] = [
      this.makeSuggestion('on', 'keyword', 'Inline fragment', 1),
    ];

    // Add known type names for inline fragments
    if (this.schemaContext) {
      for (const typeName of this.schemaContext.getTypeNames()) {
        suggestions.push(this.makeSuggestion(typeName, 'field', 'Fragment on type', 10));
      }
    }

    return suggestions;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private makeSuggestion(
    label: string,
    kind: string,
    detail: string,
    priority: number,
    insertText?: string,
  ): ILanguageServiceSuggestion {
    return {
      label,
      kind,
      detail,
      priority,
      insertText: insertText ?? label,
    };
  }
}

interface CursorContext {
  kind: 'top-level' | 'selection-set' | 'arguments' | 'variable-type' | 'directive' | 'spread';
  filterText?: string;
  currentOp?: 'query' | 'mutation' | null;
  braceDepth?: number;
  rootFieldName?: string | null;
}
