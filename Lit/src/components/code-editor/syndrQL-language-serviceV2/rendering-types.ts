/**
 * Rendering types for V2 Syntax Highlighting System
 * 
 * Defines the theme, configuration, and interfaces needed for rendering
 * V2 tokens with syntax highlighting and error decorations.
 */

import { RenderingCategory } from './token-mapping.js';

/**
 * Color theme for syntax highlighting
 * Maps rendering categories to colors
 */
export interface SyntaxTheme {
  keyword: string;
  identifier: string;
  literal: string;
  operator: string;
  punctuation: string;
  comment: string;
  string: string;
  number: string;
  placeholder: string;
  unknown: string;
  
  // Error styling configuration
  errorUnderline?: ErrorUnderlineStyle;
}

/**
 * Error underline styling configuration
 */
export interface ErrorUnderlineStyle {
  color: string;
  thickness: number;
  amplitude: number;
  frequency: number;
}

/**
 * Default syntax highlighting theme (VS Code Dark+)
 */
export const DEFAULT_SYNDRQL_THEME: SyntaxTheme = {
  keyword: '#569CD6',      // VS Code blue
  identifier: '#9CDCFE',   // Light blue
  literal: '#CE9178',      // Orange
  operator: '#D4D4D4',     // Light gray
  punctuation: '#D4D4D4',  // Light gray
  comment: '#6A9955',      // Green
  string: '#CE9178',       // Orange
  number: '#B5CEA8',       // Light green
  placeholder: '#4EC9B0',  // Cyan
  unknown: '#D4D4D4',      // Light gray
  
  // Default error underline styling (small squiggly for token errors)
  errorUnderline: {
    color: '#ff0000',      // Red
    thickness: 1,
    amplitude: 1,
    frequency: 4
  }
};

/**
 * Statement-level error underline style (larger, more prominent)
 */
export const STATEMENT_ERROR_STYLE: ErrorUnderlineStyle = {
  color: '#ff0000',       // Red
  thickness: 2,           // Thicker line
  amplitude: 2,           // Larger waves
  frequency: 6            // Wider waves
};

/**
 * Get color from theme for a rendering category
 * @param category Rendering category
 * @param theme Syntax theme
 * @returns Color string (hex or rgb)
 */
export function getColorForCategory(category: RenderingCategory, theme: SyntaxTheme): string {
  switch (category) {
    case RenderingCategory.KEYWORD:
      return theme.keyword;
    case RenderingCategory.IDENTIFIER:
      return theme.identifier;
    case RenderingCategory.LITERAL:
      return theme.literal;
    case RenderingCategory.OPERATOR:
      return theme.operator;
    case RenderingCategory.PUNCTUATION:
      return theme.punctuation;
    case RenderingCategory.COMMENT:
      return theme.comment;
    case RenderingCategory.STRING:
      return theme.string;
    case RenderingCategory.NUMBER:
      return theme.number;
    case RenderingCategory.PLACEHOLDER:
      return theme.placeholder;
    case RenderingCategory.UNKNOWN:
      return theme.unknown;
    case RenderingCategory.WHITESPACE:
    case RenderingCategory.NEWLINE:
      return 'transparent'; // Don't render whitespace
    default:
      return theme.unknown;
  }
}
