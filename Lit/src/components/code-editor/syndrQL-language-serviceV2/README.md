# SyndrQL Language Service V2

Modern, grammar-driven language service for SyndrQL with intelligent validation, context-aware suggestions, and comprehensive error analysis.

## Features

### 🎯 Grammar-Driven Architecture
- JSON-based grammar definitions for DDL, DML, DOL, and Migration statements
- Version-controlled grammar files with semantic versioning
- Grammar traversal engine for accurate validation
- No hardcoded patterns - all rules in configuration

### 🚀 Performance Optimizations
- **Statement-level caching** - Only revalidate changed statements
- **LRU cache** with access-weighted eviction
- **Disk persistence** - Cache survives restarts
- **Background prefetching** - Load context data proactively
- Average validation time: <5ms per statement (cached)

### 🔍 Enhanced Error Analysis
- **70+ specific error codes** organized by category:
  - Syntax errors (missing tokens, invalid structure)
  - Semantic errors (type mismatches, logic errors)
  - Reference errors (unknown databases/bundles/fields)
  - Permission errors (insufficient privileges)
  - Migration errors (circular dependencies)
- **Rich error messages** with context and explanations
- **Actionable suggestions** for fixing errors
- **Quick fixes** for automated corrections
- **Related information** linking to documentation

### 💡 Context-Aware Suggestions
- **Grammar-based suggestions** from statement context
- **Schema-aware suggestions** for databases, bundles, fields
- **Snippet templates** for common statement patterns
- **Operator suggestions** in WHERE/SET clauses
- **Fuzzy matching** with intelligent ranking
- **Usage tracking** to prioritize frequent items
- **Priority scoring** (0-100) for relevance

### 📊 Server-Authoritative Context
- **Live schema tracking** - Databases, bundles, fields, relationships
- **Permission awareness** - Validates against user permissions
- **Migration dependencies** - Detects circular dependencies
- **Staleness detection** - Warns when context is outdated (5min threshold)
- **Manual refresh** - User-controlled schema updates
- **Cache serialization** - Persist context across sessions

### 🎨 UI Integration
- **Staleness indicators** - Visual feedback on context freshness
- **Refresh controls** - Manual context update triggers
- **Status panels** - Database/bundle counts, refresh times
- **Loading states** - Feedback during async operations

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    LanguageServiceV2                         │
│                     (Unified API)                            │
└─────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
  ┌──────────────┐    ┌──────────────┐   ┌──────────────┐
  │Grammar Engine│    │  Tokenizer   │   │Statement     │
  │              │    │              │   │Cache         │
  │- Load JSON   │    │- Lex code    │   │              │
  │  grammars    │    │- Position    │   │- Disk        │
  │- Validate    │    │  tracking    │   │  persist     │
  │- Traverse    │    │- Token types │   │- LRU evict   │
  └──────────────┘    └──────────────┘   └──────────────┘
          │                   │
          ▼                   ▼
  ┌─────────────────────────────────────┐
  │      Error Analyzer                 │
  │                                     │
  │  - Enhance errors with context     │
  │  - Generate suggestions            │
  │  - Create quick fixes              │
  └─────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
┌──────────────────┐    ┌─────────────────┐
│Document Context  │    │Cross-Statement  │
│                  │    │Validator        │
│- Databases       │    │                 │
│- Bundles         │    │- Reference      │
│- Fields          │    │  checking       │
│- Permissions     │    │- Dependency     │
│- Migrations      │    │  validation     │
│- Staleness       │    │                 │
└──────────────────┘    └─────────────────┘
        │
        ▼
┌──────────────────────────────────────────┐
│     Suggestion Engine                     │
│                                          │
│  - Grammar suggestions                   │
│  - Context suggestions                   │
│  - Snippet suggestions                   │
│  - Fuzzy matching                        │
│  - Priority ranking                      │
│  - Usage tracking                        │
└──────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────┐
│     Context Expander                      │
│                                          │
│  - Dynamic bundle loading                │
│  - Field expansion                       │
│  - Prefetch strategies                   │
│  - Background queue                      │
│  - Cache management                      │
└──────────────────────────────────────────┘
```

## Quick Start

### Installation

```typescript
import { createLanguageService } from './syndrQL-language-serviceV2';
import type { AppConfig } from '../../config/config-types';

const config: AppConfig = {
    languageService: {
        enableValidation: true,
        enableSuggestions: true,
        cacheSize: 1000,
        stalenessThreshold: 5,
        prefetchStrategy: 'moderate'
    },
    // ... other config
};

const service = await createLanguageService(config);
```

### Basic Usage

```typescript
// Validate code
const result = await service.validate(code, 'myfile.sql');
if (!result.valid) {
    result.errors.forEach(error => {
        console.log(`${error.code}: ${error.message}`);
        if (error.suggestions) {
            console.log('Suggestions:', error.suggestions);
        }
    });
}

// Get suggestions
const suggestions = await service.getSuggestions(code, cursorPosition);
suggestions.forEach(s => {
    console.log(`${s.label} (${s.kind}) - priority: ${s.priority}`);
});

// Refresh context
await service.refreshContext({ force: true });

// Format code
const formatted = service.format(code, {
    indentSize: 4,
    capitalizeKeywords: true
});
```

### Advanced Usage

```typescript
// Set active database
service.setCurrentDatabase('production');

// Expand bundle details
const bundle = await service.expandBundle('production', 'users');
console.log(`Bundle has ${bundle.fields.size} fields`);

// Check context state
if (service.isContextStale()) {
    console.log('Context is stale, refreshing...');
    await service.refreshContext();
}

// Monitor performance
const stats = service.getStatistics();
console.log(`Cache hit rate: ${stats.cache.hitRate}%`);
console.log(`Avg validation: ${stats.performance.avgValidationTime}ms`);
```

## API Reference

### LanguageServiceV2

#### `initialize(): Promise<void>`
Initialize the service. Must be called before any other methods.

#### `validate(code: string, documentUri?: string): Promise<ValidationResult>`
Validate SyndrQL code and return detailed results.

**Returns:**
```typescript
{
    valid: boolean;
    errors: EnhancedErrorDetail[];
    warnings: EnhancedErrorDetail[];
    info: EnhancedErrorDetail[];
}
```

#### `getSuggestions(code: string, cursorPosition: number, filterText?: string): Promise<Suggestion[]>`
Get context-aware autocompletion suggestions.

#### `refreshContext(options?: RefreshOptions): Promise<void>`
Refresh schema context from server.

**Options:**
```typescript
{
    database?: string | null;     // Specific database or all
    force?: boolean;              // Refresh even if not stale
    prefetchStrategy?: PrefetchStrategy;
}
```

#### `format(code: string, options?: FormatOptions): string`
Format SyndrQL code according to style rules.

**Options:**
```typescript
{
    indentSize?: number;
    useTabs?: boolean;
    insertSpaceAroundOperators?: boolean;
    capitalizeKeywords?: boolean;
}
```

#### `getStatistics(): ServiceStats`
Get comprehensive service statistics.

#### `clearCaches(): void`
Clear all internal caches.

#### `dispose(): void`
Clean up resources.

### Types

#### `EnhancedErrorDetail`
```typescript
{
    code: ErrorCode;              // Specific error code
    message: string;              // Human-readable message
    severity: 'error' | 'warning' | 'info' | 'hint';
    category: ErrorCategory;      // syntax, semantic, reference, etc.
    line: number;                 // 1-based line number
    column: number;               // 1-based column number
    suggestions?: string[];       // Fix suggestions
    quickFixes?: QuickFix[];     // Automated fixes
    relatedInfo?: RelatedInfo[];  // Cross-references
}
```

#### `Suggestion`
```typescript
{
    label: string;                // Display text
    kind: SuggestionKind;        // Type of suggestion
    detail?: string;              // Additional context
    documentation?: string;       // Full documentation
    insertText: string;           // Text to insert
    priority: number;             // Ranking (0-100)
    filterText?: string;          // Filter matching
}
```

## Error Codes

The service provides 70+ specific error codes organized by category:

### Syntax Errors
- `CREATE_DATABASE_MISSING_NAME` - Database name not specified
- `SELECT_MISSING_FROM` - FROM clause required
- `UNEXPECTED_TOKEN` - Token not valid in this context

### Semantic Errors
- `DUPLICATE_DATABASE` - Database already exists
- `INVALID_FIELD_TYPE` - Unknown field type
- `CONSTRAINT_VIOLATION` - Constraint cannot be satisfied

### Reference Errors
- `DATABASE_NOT_FOUND` - Referenced database doesn't exist
- `BUNDLE_NOT_FOUND` - Referenced bundle doesn't exist
- `FIELD_NOT_FOUND` - Referenced field doesn't exist

### Permission Errors
- `INSUFFICIENT_PERMISSIONS` - User lacks required permission
- `GRANT_INVALID_PERMISSION` - Permission type doesn't exist

### Migration Errors
- `MIGRATION_CIRCULAR_DEPENDENCY` - Circular dependency detected
- `MIGRATION_MISSING_DEPENDENCY` - Depends on non-existent migration

See [error-analyzer.ts](./error-analyzer.ts) for complete list.

## Configuration

```typescript
interface AppConfig {
    languageService: {
        // Enable/disable features
        enableValidation: boolean;
        enableSuggestions: boolean;
        
        // Cache settings
        cacheSize: number;              // Max cached statements
        stalenessThreshold: number;     // Minutes until stale
        
        // Prefetch strategy
        prefetchStrategy: 'aggressive' | 'moderate' | 'conservative';
    };
}
```

### Prefetch Strategies

- **AGGRESSIVE** - Prefetch all bundles in database (high memory, fast)
- **MODERATE** - Prefetch only related bundles (balanced)
- **CONSERVATIVE** - No prefetching (low memory, slower)

## Testing

Comprehensive test coverage with unit tests for all components:

```bash
# Run all tests
npm test -- --run

# Run specific test suite
npm test -- error-analyzer.test.ts --run

# Watch mode
npm test
```

Test coverage:
- Grammar engine: 50+ tests
- Tokenizer: 40+ tests  
- Error analyzer: 30+ tests
- Document context: 20+ tests
- Cross-statement validator: 25+ tests
- Suggestion engine: 80+ tests
- Context expander: 70+ tests

## Performance

Benchmarks on typical workload:

| Operation | Cached | Uncached |
|-----------|--------|----------|
| Validate statement | <5ms | 15-30ms |
| Get suggestions | <10ms | 20-40ms |
| Refresh context | N/A | 100-300ms |
| Format code | <20ms | <20ms |

Cache hit rates: 85-95% typical

## Migration

See [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) for detailed migration instructions from the old language service.

Key changes:
- Grammar-driven validation (no hardcoded patterns)
- Enhanced error details with suggestions
- Context-aware suggestions
- Server-authoritative schema
- Statement-level caching

## Components

- `language-service-v2.ts` - Main unified API
- `grammar_engine.ts` - Grammar loading and validation
- `tokenizer.ts` - Enhanced lexical analysis
- `statement-cache.ts` - Persistent caching layer
- `error-analyzer.ts` - Error enhancement and analysis
- `document-context.ts` - Schema context management
- `cross-statement-validator.ts` - Cross-reference validation
- `suggestion-engine.ts` - Suggestion generation
- `context-expander.ts` - Dynamic context loading
- `staleness-ui.ts` - UI components for staleness

## License

Part of SyndrDB Client Application
