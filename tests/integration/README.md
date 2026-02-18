# Integration Tests

This directory contains integration tests that verify interactions between multiple components working together.

## Running Tests

```bash
npm run test:integration          # Run all integration tests
npm run test:integration:watch   # Run tests in watch mode
```

## Guidelines

### What to Test
- **Component Interactions**: Grammar engine + cache + validation flow
- **Data Flow**: Context updates → suggestion engine → UI rendering
- **Service Integration**: Language service API with all subsystems
- **State Management**: Document context + server context + local modifications
- **Persistence**: Cache loading/saving to disk

### Test Structure
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LanguageService } from '../../Lit/src/components/code-editor/syndrQL-language-serviceV2';

describe('Language Service Integration', () => {
  let service: LanguageService;
  let documentId: string;
  
  beforeEach(() => {
    documentId = 'test-doc-' + Date.now();
    service = new LanguageService();
    service.initialize(documentId, mockContext, config);
  });
  
  afterEach(async () => {
    await service.dispose(documentId);
  });
  
  it('should validate document and cache results', async () => {
    // Arrange
    const code = 'SELECT DOCUMENTS FROM "users";';
    
    // Act
    service.onTextChange(documentId, { text: code });
    await service.validateDocument(documentId);
    const errors = service.getErrors(documentId);
    
    // Assert
    expect(errors).toHaveLength(0);
    // Verify cache was updated
    expect(service.getCacheHitRate(documentId)).toBeGreaterThan(0);
  });
});
```

### Best Practices
1. **Test realistic workflows** - Simulate actual user interactions
2. **Setup and teardown** - Clean up resources after each test
3. **Use real implementations** - Minimize mocking, use actual components
4. **Test error scenarios** - Network failures, corrupted cache, invalid state
5. **Verify side effects** - File writes, cache updates, event emissions
6. **Test async flows** - Debouncing, background workers, promises

### Test Scenarios
- **Validation Flow**: Text change → mark dirty → debounce → validate → cache → errors
- **Suggestion Flow**: Cursor move → check cache → generate → pre-fetch → display
- **Context Updates**: SHOW BUNDLES → update context → invalidate cache → revalidate
- **Cross-Statement**: Create bundle → reference in next statement → validate both
- **Cache Persistence**: Write statements → save to disk → reload → verify cached
- **Multi-Document**: Two tabs → isolated caches → no interference

### Performance Benchmarks
Integration tests should monitor:
- Validation time < 100ms for 1000-line documents
- Suggestion generation < 50ms
- Cache hit rate > 80% after warmup
- Background persistence < 500ms
