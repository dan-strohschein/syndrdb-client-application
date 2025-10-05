/**
 * Integration Guide for SyndrQL Syntax Highlighting
 * Shows how to integrate the syntax highlighting system with the code editor
 */

/**
 * INTEGRATION STEPS:
 * 
 * 1. Import the syntax highlighter in code-editor.ts:
 * ```typescript
 * import { createSyndrQLHighlighter, SyndrQLSyntaxHighlighter } from './syndrQL-language-service/index.js';
 * ```
 * 
 * 2. Add syntax highlighter property to CodeEditor class:
 * ```typescript
 * private syntaxHighlighter!: SyndrQLSyntaxHighlighter;
 * ```
 * 
 * 3. Initialize in initializeEditor():
 * ```typescript
 * // Initialize syntax highlighter
 * this.syntaxHighlighter = createSyndrQLHighlighter({
 *   theme: {
 *     keyword: '#569CD6',
 *     identifier: '#9CDCFE',
 *     string: '#CE9178',
 *     comment: '#6A9955'
 *   }
 * });
 * this.syntaxHighlighter.initialize(this.context, fontMetrics);
 * ```
 * 
 * 4. Modify renderLine() method to use syntax highlighting:
 * ```typescript
 * private renderLine(lineText: string, lineIndex: number, y: number, fontMetrics: FontMetrics): void {
 *   const selection = this.documentModel.getCurrentSelection();
 *   
 *   if (!selection || !this.documentModel.hasSelection()) {
 *     // Render with syntax highlighting instead of plain text
 *     this.syntaxHighlighter.renderLine(
 *       this.context,
 *       lineText,
 *       lineIndex + 1, // Convert to 1-based line number
 *       y,
 *       fontMetrics,
 *       this.viewportManager.getScrollOffset()
 *     );
 *     return;
 *   }
 *   
 *   // For lines with selection, you'll need to integrate selection rendering
 *   // TODO: Implement selection + syntax highlighting combination
 * }
 * ```
 * 
 * 5. Update font metrics when font properties change:
 * ```typescript
 * // Add a willUpdate() method to handle property changes:
 * willUpdate(changedProperties: Map<string, any>) {
 *   super.willUpdate(changedProperties);
 *   
 *   // If font properties changed, update font metrics
 *   if (changedProperties.has('fontFamily') || changedProperties.has('fontSize')) {
 *     if (this.isInitialized && this.fontMeasurer && this.syntaxHighlighter) {
 *       const fontMetrics = this.fontMeasurer.measureFont(this.fontFamily, this.fontSize);
 *       this.coordinateSystem.setFontMetrics(fontMetrics);
 *       this.syntaxHighlighter.updateFontMetrics(fontMetrics);
 *     }
 *   }
 * }
 * ```
 * 
 * 6. Clear cache when document changes significantly:
 * ```typescript
 * // In document change handlers:
 * this.syntaxHighlighter.clearCache();
 * ```
 * 
 * 7. Add syntax highlighting configuration properties:
 * ```typescript
 * @property({ type: Object })
 * syntaxTheme: Partial<SyntaxTheme> = {};
 * 
 * @property({ type: Boolean })
 * enableSyntaxHighlighting: boolean = true;
 * ```
 */

/**
 * EXAMPLE IMPLEMENTATION FOR CODE-EDITOR.TS:
 */

/*
// Add these imports at the top
import { createSyndrQLHighlighter, SyndrQLSyntaxHighlighter, SyntaxTheme } from './syndrQL-language-service/index.js';

// Add to class properties
private syntaxHighlighter!: SyndrQLSyntaxHighlighter;

@property({ type: Boolean })
enableSyntaxHighlighting: boolean = true;

@property({ type: Object })
syntaxTheme: Partial<SyntaxTheme> = {};

// In initializeEditor(), after font metrics initialization:
if (this.enableSyntaxHighlighting) {
  this.syntaxHighlighter = createSyndrQLHighlighter({
    theme: {
      keyword: '#569CD6',
      identifier: '#9CDCFE', 
      string: '#CE9178',
      comment: '#6A9955',
      number: '#B5CEA8',
      operator: '#D4D4D4',
      punctuation: '#D4D4D4',
      placeholder: '#4EC9B0',
      literal: '#CE9178',
      unknown: '#D4D4D4',
      ...this.syntaxTheme
    }
  });
  this.syntaxHighlighter.initialize(this.context, fontMetrics);
}

// Replace the plain text rendering in renderLine():
private renderLine(lineText: string, lineIndex: number, y: number, fontMetrics: FontMetrics): void {
  const selection = this.documentModel.getCurrentSelection();
  
  if (!selection || !this.documentModel.hasSelection()) {
    if (this.enableSyntaxHighlighting && this.syntaxHighlighter) {
      // Render with syntax highlighting
      this.syntaxHighlighter.renderLine(
        this.context,
        lineText,
        lineIndex + 1,
        y,
        fontMetrics,
        this.viewportManager.getScrollOffset()
      );
    } else {
      // Fallback to plain text rendering
      this.context.fillStyle = this.getThemeColor(this.textColor);
      this.context.fillText(lineText, 0, y);
    }
    return;
  }
  
  // Selection rendering - integrate with syntax highlighting
  this.renderLineWithSelection(lineText, lineIndex, y, selectionStart, selectionEnd, fontMetrics);
}

// Add method to update syntax highlighting theme:
public updateSyntaxTheme(theme: Partial<SyntaxTheme>): void {
  this.syntaxTheme = { ...this.syntaxTheme, ...theme };
  if (this.syntaxHighlighter) {
    this.syntaxHighlighter.setTheme(theme);
    this.renderEditor(); // Re-render with new theme
  }
}
*/

/**
 * PERFORMANCE CONSIDERATIONS:
 * 
 * 1. The syntax highlighter caches tokenization results for performance
 * 2. Only visible lines should be tokenized during scrolling
 * 3. Clear cache when document changes to avoid stale highlighting
 * 4. Consider debouncing cache clearing for rapid typing
 * 
 * FUTURE ENHANCEMENTS:
 * 
 * 1. Incremental tokenization for large documents
 * 2. Syntax error highlighting
 * 3. Semantic highlighting (variable references, etc.)
 * 4. Code folding support
 * 5. Auto-completion integration
 * 6. Hover information
 * 7. Go-to-definition functionality
 */

export {}; // Make this a module