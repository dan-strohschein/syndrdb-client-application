# GraphQL Language Service — Full Spec Roadmap

Current implementation supports **queries** and **mutations** with basic validation, syntax highlighting, and context-aware suggestions. This document outlines what's needed for full GraphQL specification support.

## Currently Implemented

- [x] Tokenizer (full GraphQL lexical grammar)
- [x] Syntax highlighting (keywords, identifiers, strings, numbers, comments, punctuation)
- [x] Basic validation (balanced delimiters, operation structure, empty selection sets)
- [x] Context-aware suggestions (root fields, nested fields, arguments, types, directives)
- [x] Schema context (bundle-to-type mapping, query/mutation root fields)
- [x] `GraphQL::` execution prefix

## Roadmap

### Subscriptions
- **New operation type**: `subscription { ... }`
- **Transport**: Requires WebSocket transport (currently SyndrDB uses TCP)
- **Validation**: Same structure as queries but with subscription-specific rules
- **Effort**: Medium (transport layer is the main work)

### Fragments
- **Named fragment definitions**: `fragment UserFields on User { name email }`
- **Fragment spread**: `...UserFields` inside selection sets
- **Inline fragments**: `... on User { name }` for union/interface types
- **Validation**: Fragment name uniqueness, used-fragment checks, type condition validity
- **Effort**: Medium

### Variables
- **Default values**: `query ($limit: Int = 10) { ... }`
- **Variable usage validation**: Ensure `$var` references match declared variables
- **Input coercion**: Validate variable types match argument expectations
- **Effort**: Medium

### Directives
- **Built-in directives**: `@skip(if: Boolean!)`, `@include(if: Boolean!)`
- **Custom directive definitions**: Server-defined directives
- **Directive location validation**: Ensure directives are used in valid positions
- **Effort**: Low-Medium

### Union Types
- **Abstract type resolution**: Union types combining multiple object types
- **Inline fragment requirements**: Must use `... on Type` to select fields
- **Effort**: Low (mostly validation rules)

### Interfaces
- **`implements` clause**: Types implementing interfaces
- **Interface field validation**: Implementing types must include interface fields
- **Effort**: Low

### Input Types
- **Separate input object type mapping**: Mutation arguments use input types, not object types
- **Nested input validation**: Input objects can contain other input objects
- **SyndrDB mapping**: Bundle fields map to input type fields for mutations
- **Effort**: Medium

### Enums
- **SyndrDB enum fields to GraphQL enum types**: Map constrained field values to enums
- **Validation**: Enum values must match defined values
- **Suggestion support**: Autocomplete enum values in arguments
- **Effort**: Low

### Custom Scalars
- **DateTime**: SyndrDB DATETIME fields could use a custom DateTime scalar
- **JSON**: For complex nested document fields
- **Validation**: Custom scalar values are opaque (pass-through)
- **Effort**: Low

## Architecture Notes

The current architecture supports extension:
- `GraphQLSchemaContext` can be extended to generate union types, interfaces, input types, and enums from SyndrDB schema
- `GraphQLValidator` rule methods are independent and can be added incrementally
- `GraphQLSuggestionEngine` context detection already handles brace depth tracking needed for fragments and inline fragments
- `GraphQLTokenizer` already handles the full lexical grammar (no changes needed for any of the above)
