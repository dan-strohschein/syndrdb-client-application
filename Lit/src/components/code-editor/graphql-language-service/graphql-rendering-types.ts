/**
 * Default GraphQL syntax theme.
 *
 * Uses the same SyntaxTheme interface shared with SyndrQL,
 * with colors tuned for GraphQL readability.
 */

import type { SyntaxTheme } from '../syndrQL-language-serviceV2/rendering-types.js';

export const DEFAULT_GRAPHQL_THEME: SyntaxTheme = {
  keyword: '#C586C0',       // Purple — query, mutation, fragment, on
  identifier: '#9CDCFE',    // Light blue — field names
  literal: '#CE9178',       // Orange
  operator: '#D4D4D4',      // Light gray — !, $, @, ...
  punctuation: '#D4D4D4',   // Light gray — { } ( ) : ,
  comment: '#6A9955',       // Green
  string: '#CE9178',        // Orange
  number: '#B5CEA8',        // Light green
  placeholder: '#4EC9B0',   // Cyan
  unknown: '#D4D4D4',       // Light gray

  errorUnderline: {
    color: '#ff0000',
    thickness: 1,
    amplitude: 1,
    frequency: 4,
  },
};
