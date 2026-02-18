# Unit Tests

This directory contains unit tests for individual components, functions, and modules in isolation.

## Running Tests

```bash
npm run test:unit          # Run all unit tests
npm run test:unit:watch   # Run tests in watch mode
```

## Guidelines

### What to Test
- **Pure Functions**: Grammar validation logic, tokenization, parsing
- **Data Structures**: Cache eviction, LRU algorithms, statement tracking
- **Utilities**: Error code generation, suggestion ranking, fuzzy matching
- **Isolated Components**: Individual classes without external dependencies

### Test Structure
```typescript
import { describe, it, expect } from 'vitest';
import { YourModule } from '../../src/path/to/module';

describe('ModuleName', () => {
  describe('functionName', () => {
    it('should handle expected input correctly', () => {
      // Arrange
      const input = 'test';
      
      // Act
      const result = YourModule.functionName(input);
      
      // Assert
      expect(result).toBe('expected');
    });
    
    it('should throw error on invalid input', () => {
      expect(() => YourModule.functionName(null)).toThrow();
    });
  });
});
```

### Best Practices
1. **Test one thing at a time** - Each test should verify a single behavior
2. **Use descriptive names** - Test names should clearly state what's being tested
3. **Arrange-Act-Assert** - Structure tests with clear setup, execution, and verification
4. **Mock external dependencies** - Use mocks/stubs for file I/O, network, etc.
5. **Test edge cases** - Empty inputs, null values, boundary conditions
6. **Keep tests fast** - Unit tests should run in milliseconds

### Coverage Goals
- Critical paths: 100% coverage
- Grammar engine: 95%+ coverage
- Error handling: 90%+ coverage
- Utilities: 85%+ coverage
