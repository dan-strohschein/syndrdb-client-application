# Language Service V2 Migration Guide

## Overview

The Language Service V2 is a complete rewrite of the SyndrQL language service with modern architecture:

- **Grammar-driven validation** - Uses JSON grammar files instead of hardcoded patterns
- **Statement-level caching** - Validates only changed statements
- **Enhanced error analysis** - 70+ detailed error codes with suggestions
- **Context-aware suggestions** - Intelligent autocompletion based on schema
- **Server-authoritative schema** - Syncs with actual database state

## Migration Strategy

We provide a backward-compatible adapter to enable gradual migration:

### Phase 1: Add V2 alongside existing service (Current)

```typescript
import { createLanguageServiceAdapter } from './syndrQL-language-serviceV2';
import type { AppConfig } from '../../config/config-types';

// Initialize adapter
const config: AppConfig = { /* your config */ };
const adapter = await createLanguageServiceAdapter(config);

// Old API still works
const result = await adapter.validate(tokens, lineOffset);
// result.isValid, result.invalidTokens, result.errorDetails

// But you can also use new features
const suggestions = await adapter.getSuggestions(code, cursorPos);
const stats = adapter.getStatistics();
await adapter.refreshContext();
```

### Phase 2: Gradually adopt V2 APIs

Replace old patterns with new ones as you encounter them:

**Old pattern:**
```typescript
// Manual statement parsing
const statements = this.statementParser.parseStatements(code);
for (const stmt of statements) {
    const result = this.grammarValidator.validate(stmt.tokens);
    // handle result
}
```

**New pattern:**
```typescript
// Unified validation
const result = await this.languageService.validate(code, documentUri);
// result.errors contains all enhanced errors
// result.warnings contains warnings
// Caching is automatic
```

**Old pattern:**
```typescript
// Manual suggestion generation
const suggestions = this.suggestionService.getSuggestions(context);
```

**New pattern:**
```typescript
// Context-aware suggestions with grammar integration
const suggestions = await this.languageService.getSuggestions(code, cursorPosition, filterText);
// Automatically combines grammar rules + schema context
```

### Phase 3: Remove old service

After all components use V2:
1. Remove old imports
2. Delete `syndrQL-language-service/` folder
3. Update to use V2 directly (no adapter needed)

## Key API Differences

### Validation

**Old API:**
```typescript
interface ValidationResult {
    isValid: boolean;
    invalidTokens: Set<number>;
    errorDetails?: Array<{
        code: string;
        message: string;
        line: number;
        column: number;
    }>;
}
```

**New API:**
```typescript
interface ValidationResult {
    valid: boolean;
    errors: EnhancedErrorDetail[];      // Severity: error
    warnings: EnhancedErrorDetail[];    // Severity: warning
    info: EnhancedErrorDetail[];        // Severity: info
}

interface EnhancedErrorDetail {
    code: ErrorCode;                    // 70+ specific error codes
    message: string;
    severity: 'error' | 'warning' | 'info' | 'hint';
    category: ErrorCategory;            // syntax, semantic, reference, etc.
    line: number;
    column: number;
    suggestions?: string[];             // Actionable suggestions
    quickFixes?: QuickFix[];           // Automated fixes
    relatedInfo?: RelatedInfo[];       // Cross-references
}
```

### Suggestions

**Old API:**
```typescript
interface Suggestion {
    label: string;
    type: string;
}
```

**New API:**
```typescript
interface Suggestion {
    label: string;
    kind: SuggestionKind;              // DATABASE, BUNDLE, FIELD, etc.
    detail?: string;                    // Additional context
    documentation?: string;             // Full documentation
    insertText: string;                 // Text to insert
    priority: number;                   // 0-100 ranking
    filterText?: string;                // Text for filtering
}
```

## New Features Available

### 1. Context Management

```typescript
// Set active database
service.setCurrentDatabase('mydb');

// Refresh schema from server
await service.refreshContext({ force: true });

// Check staleness
if (service.isContextStale()) {
    await service.refreshContext();
}
```

### 2. Code Formatting

```typescript
const formatted = service.format(code, {
    indentSize: 4,
    useTabs: false,
    capitalizeKeywords: true,
    insertSpaceAroundOperators: true
});
```

### 3. Performance Monitoring

```typescript
const stats = service.getStatistics();
console.log(`Avg validation: ${stats.performance.avgValidationTime}ms`);
console.log(`Cache hit rate: ${stats.cache.hitRate}%`);
console.log(`Context state: ${stats.context.state}`);
```

### 4. Dynamic Context Loading

```typescript
// Expand bundle details on-demand
const bundle = await service.expandBundle('mydb', 'users');

// Set prefetch strategy
service.setPrefetchStrategy(PrefetchStrategy.MODERATE);
```

### 5. Staleness UI Components

```typescript
import { ContextStalenessIndicator } from './syndrQL-language-serviceV2';

// In your Lit component
render() {
    return html`
        <context-staleness-indicator
            .context=${this.documentContext}
            .onRefresh=${() => this.refreshContext()}
        ></context-staleness-indicator>
    `;
}
```

## Code Editor Integration

### Step 1: Replace validator initialization

**Old:**
```typescript
this.statementParser = new StatementParser();
this.grammarValidator = new SyndrQLGrammarValidator();
```

**New:**
```typescript
import { createLanguageServiceAdapter } from './syndrQL-language-serviceV2';

this.languageService = await createLanguageServiceAdapter(this.config);
```

### Step 2: Update validation calls

**Old:**
```typescript
private validateStatement(statement: CodeStatement): void {
    const validationResult = this.grammarValidator.validate(
        statement.tokens,
        statement.lineStart
    );
    // ...
}
```

**New:**
```typescript
private async validateStatement(statement: CodeStatement): Promise<void> {
    const validationResult = await this.languageService.validate(
        statement.tokens,
        statement.lineStart
    );
    // Works with old format, but also has .errors/.warnings/.info
}
```

### Step 3: Update suggestion calls

**Old:**
```typescript
const suggestions = this.suggestionService.getSuggestions(context);
```

**New:**
```typescript
const suggestions = await this.languageService.getSuggestions(
    code,
    cursorPosition,
    filterText
);
```

## Configuration

V2 uses the same `AppConfig` structure with enhanced language service options:

```typescript
interface AppConfig {
    languageService: {
        enableValidation: boolean;
        enableSuggestions: boolean;
        cacheSize: number;              // Statement cache size
        stalenessThreshold: number;     // Minutes until context is stale
        prefetchStrategy: 'aggressive' | 'moderate' | 'conservative';
    };
}
```

## Testing

V2 includes comprehensive test suites:

- `grammar_engine.test.ts` - Grammar loading and traversal
- `tokenizer.test.ts` - Enhanced tokenization
- `statement-cache.test.ts` - Cache persistence
- `error-analyzer.test.ts` - Error code generation
- `document-context.test.ts` - Context management
- `cross-statement-validator.test.ts` - Cross-statement validation
- `suggestion-engine.test.ts` - Suggestion generation
- `context-expander.test.ts` - Dynamic loading

Run tests:
```bash
npm test -- --run
```

## Troubleshooting

### "Language service not initialized"

**Solution:** Always call `await initialize()` before using the service:
```typescript
const service = new LanguageServiceV2(config);
await service.initialize();  // Required!
```

### Validation seems slow

**Solution:** Check cache statistics and context state:
```typescript
const stats = service.getStatistics();
if (stats.cache.hitRate < 50) {
    // Cache is underutilized
}
if (service.isContextStale()) {
    await service.refreshContext();
}
```

### Suggestions not showing schema items

**Solution:** Ensure context is refreshed and database is set:
```typescript
await service.refreshContext();
service.setCurrentDatabase('mydb');
const suggestions = await service.getSuggestions(code, pos);
```

## Benefits of V2

1. **Maintainability** - Grammar rules in JSON, not code
2. **Performance** - Statement-level caching, only validate what changed
3. **Accuracy** - Server-authoritative schema, real permissions
4. **User Experience** - Rich error messages with suggestions
5. **Developer Experience** - Comprehensive testing, clear APIs
6. **Extensibility** - Add new grammar rules without code changes

## Timeline

- **Phase 0-4** ✅ Complete - All V2 components built and tested
- **Phase 5** 🔄 In Progress - Integration with code-editor
- **Phase 6** - Full migration, remove old service

## Support

For questions or issues during migration, consult:
- This guide
- Component READMEs in `syndrQL-language-serviceV2/`
- Unit tests for usage examples
