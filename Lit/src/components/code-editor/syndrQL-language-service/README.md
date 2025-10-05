# SyndrQL Syntax Highlighting System

A clean, robust syntax highlighting implementation for SyndrQL language, designed specifically for the canvas-based code editor.

## Architecture

The system follows **Single Responsibility Principle** and **Open/Closed Principle** with these components:

### Core Components

- **`types.ts`** - Core interfaces and type definitions
- **`keywords.ts`** - SyndrQL language keyword definitions and utilities  
- **`tokenizer.ts`** - Robust tokenizer that handles whitespace correctly
- **`renderer.ts`** - Canvas-based rendering for syntax-highlighted tokens
- **`index.ts`** - Main service orchestrating tokenization and rendering

### Design Principles

1. **Single Responsibility**: Each file has one clear purpose
2. **Open/Closed**: Extensible for new features without modifying existing code  
3. **Clean Implementation**: No whitespace handling bugs from original implementation
4. **Performance Focused**: Token caching and efficient rendering
5. **Integration Ready**: Designed to work seamlessly with existing code editor

## Features

- ✅ **Complete SyndrQL tokenization** - Keywords, operators, strings, comments, etc.
- ✅ **Accurate position tracking** - Line/column information for each token
- ✅ **Canvas rendering** - Integrates with code editor's rendering pipeline
- ✅ **Theme support** - Customizable syntax highlighting colors
- ✅ **Performance caching** - Caches tokenization results for efficiency
- ✅ **Whitespace handling** - Proper handling of spaces, tabs, and newlines
- ✅ **Comment support** - Line (`--`) and block (`/* */`) comments
- ✅ **String literals** - Proper escape sequence handling

## Quick Start

```typescript
import { createSyndrQLHighlighter } from './syndrQL-language-service';

// Create highlighter instance
const highlighter = createSyndrQLHighlighter({
  theme: {
    keyword: '#569CD6',
    string: '#CE9178', 
    comment: '#6A9955'
  }
});

// Initialize with canvas context
highlighter.initialize(canvasContext, fontMetrics);

// Render syntax-highlighted line
highlighter.renderLine(context, lineText, lineNumber, y, fontMetrics, scrollOffset);
```

## Integration

See `INTEGRATION.md` for detailed integration steps with the code editor.

## Future Enhancements (TODOs)

- [ ] Incremental tokenization for large documents
- [ ] Syntax error highlighting  
- [ ] Semantic highlighting (variable references)
- [ ] Auto-completion integration
- [ ] Hover information support
- [ ] Code folding
- [ ] Language server protocol support
- [ ] Custom keyword extensions
- [ ] Performance mode configuration
- [ ] Memory management for token cache

## Testing

Run the example tests:

```typescript
import { runAllTests } from './example';
runAllTests();
```

## Architecture Benefits

1. **No Whitespace Bugs** - Clean tokenizer implementation handles all whitespace correctly
2. **Modular Design** - Easy to extend with new features
3. **Performance Optimized** - Caching and efficient rendering
4. **Type Safe** - Full TypeScript support with proper interfaces
5. **Canvas Integrated** - Works seamlessly with existing code editor rendering