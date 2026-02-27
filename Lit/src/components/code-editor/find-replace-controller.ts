/**
 * Find and Replace Controller — owns all search/replace state and logic.
 * Follows the same dependency-injection pattern as SuggestionController et al.
 */

import type { Position } from './types.js';

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface FindReplaceControllerDeps {
  getDocumentLines: () => readonly string[];
  getCursorPosition: () => Position;
  getSelectedText: () => string;
  hasSelection: () => boolean;
  replaceTextRange: (startLine: number, startCol: number, endLine: number, endCol: number, newText: string) => void;
  setCursorPosition: (line: number, column: number) => void;
  setSelection: (start: Position, end: Position) => void;
  scrollToLine: (line: number) => void;
  requestUpdate: () => void;
}

export interface FindMatch {
  line: number;        // 0-based line index
  startColumn: number; // 0-based column
  endColumn: number;   // 0-based column (exclusive)
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

export class FindReplaceController {
  // State
  private _searchTerm = '';
  private _replaceTerm = '';
  private _matches: FindMatch[] = [];
  private _currentMatchIndex = -1;
  private _isVisible = false;
  private _showReplace = false;
  private _caseSensitive = false;
  private _isRegex = false;

  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private documentChangedDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private deps: FindReplaceControllerDeps) {}

  // -----------------------------------------------------------------------
  // Visibility
  // -----------------------------------------------------------------------

  isOpen(): boolean {
    return this._isVisible;
  }

  get showReplace(): boolean {
    return this._showReplace;
  }

  open(showReplace: boolean): void {
    this._isVisible = true;
    this._showReplace = showReplace;

    // Pre-populate with selected text (VS Code behavior)
    if (this.deps.hasSelection()) {
      const selected = this.deps.getSelectedText();
      // Only use single-line selections for search term
      if (selected && !selected.includes('\n')) {
        this._searchTerm = selected;
      }
    }

    // Run initial search if there's a term
    if (this._searchTerm) {
      this.executeSearch();
    }

    this.deps.requestUpdate();
  }

  close(): void {
    this._isVisible = false;
    this._matches = [];
    this._currentMatchIndex = -1;
    this.deps.requestUpdate();
  }

  toggleReplace(): void {
    this._showReplace = !this._showReplace;
    this.deps.requestUpdate();
  }

  // -----------------------------------------------------------------------
  // Search
  // -----------------------------------------------------------------------

  get searchTerm(): string {
    return this._searchTerm;
  }

  get replaceTerm(): string {
    return this._replaceTerm;
  }

  setSearchTerm(term: string): void {
    this._searchTerm = term;
    this.debouncedSearch();
  }

  setReplaceTerm(term: string): void {
    this._replaceTerm = term;
  }

  /** Debounced entry point (150 ms) — used when user is typing in the search box. */
  private debouncedSearch(): void {
    if (this.searchDebounceTimer !== null) {
      clearTimeout(this.searchDebounceTimer);
    }
    this.searchDebounceTimer = setTimeout(() => {
      this.executeSearch();
      this.searchDebounceTimer = null;
    }, 150);
  }

  /** Run the actual search. */
  private executeSearch(): void {
    this._matches = [];
    this._currentMatchIndex = -1;

    if (!this._searchTerm) {
      this.deps.requestUpdate();
      return;
    }

    const lines = this.deps.getDocumentLines();

    if (this._isRegex) {
      this.searchRegex(lines);
    } else {
      this.searchLiteral(lines);
    }

    // Jump to the first match at or after the cursor
    if (this._matches.length > 0) {
      const cursor = this.deps.getCursorPosition();
      let idx = this._matches.findIndex(
        (m) => m.line > cursor.line || (m.line === cursor.line && m.startColumn >= cursor.column),
      );
      if (idx === -1) idx = 0;
      this._currentMatchIndex = idx;
      this.goToCurrentMatch();
    }

    this.deps.requestUpdate();
  }

  private searchLiteral(lines: readonly string[]): void {
    const needle = this._caseSensitive ? this._searchTerm : this._searchTerm.toLowerCase();

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const haystack = this._caseSensitive ? lines[lineIdx] : lines[lineIdx].toLowerCase();
      let offset = 0;
      while (true) {
        const found = haystack.indexOf(needle, offset);
        if (found === -1) break;
        this._matches.push({
          line: lineIdx,
          startColumn: found,
          endColumn: found + this._searchTerm.length,
        });
        offset = found + 1; // allow overlapping matches
      }
    }
  }

  private searchRegex(lines: readonly string[]): void {
    let regex: RegExp;
    try {
      regex = new RegExp(this._searchTerm, this._caseSensitive ? 'g' : 'gi');
    } catch {
      // Invalid regex — don't crash, just no matches
      return;
    }

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      regex.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = regex.exec(lines[lineIdx])) !== null) {
        if (m[0].length === 0) {
          // Avoid infinite loop on zero-length matches
          regex.lastIndex++;
          continue;
        }
        this._matches.push({
          line: lineIdx,
          startColumn: m.index,
          endColumn: m.index + m[0].length,
        });
      }
    }
  }

  // -----------------------------------------------------------------------
  // Navigation
  // -----------------------------------------------------------------------

  nextMatch(): void {
    if (this._matches.length === 0) return;
    this._currentMatchIndex = (this._currentMatchIndex + 1) % this._matches.length;
    this.goToCurrentMatch();
    this.deps.requestUpdate();
  }

  previousMatch(): void {
    if (this._matches.length === 0) return;
    this._currentMatchIndex =
      (this._currentMatchIndex - 1 + this._matches.length) % this._matches.length;
    this.goToCurrentMatch();
    this.deps.requestUpdate();
  }

  private goToCurrentMatch(): void {
    const match = this._matches[this._currentMatchIndex];
    if (!match) return;

    this.deps.setCursorPosition(match.line, match.endColumn);
    this.deps.setSelection(
      { line: match.line, column: match.startColumn },
      { line: match.line, column: match.endColumn },
    );
    this.deps.scrollToLine(match.line);
  }

  // -----------------------------------------------------------------------
  // Replace
  // -----------------------------------------------------------------------

  replaceCurrent(): void {
    if (this._matches.length === 0 || this._currentMatchIndex < 0) return;

    const match = this._matches[this._currentMatchIndex];
    this.deps.replaceTextRange(
      match.line,
      match.startColumn,
      match.line,
      match.endColumn,
      this._replaceTerm,
    );

    // Re-search and advance
    this.executeSearch();
  }

  replaceAll(): void {
    if (this._matches.length === 0) return;

    // Replace bottom-to-top to avoid index shifting
    const sorted = [...this._matches].sort((a, b) => {
      if (a.line !== b.line) return b.line - a.line;
      return b.startColumn - a.startColumn;
    });

    for (const match of sorted) {
      this.deps.replaceTextRange(
        match.line,
        match.startColumn,
        match.line,
        match.endColumn,
        this._replaceTerm,
      );
    }

    // Re-search (should yield 0 matches now unless replace term contains search term)
    this.executeSearch();
  }

  // -----------------------------------------------------------------------
  // Toggles
  // -----------------------------------------------------------------------

  get caseSensitive(): boolean {
    return this._caseSensitive;
  }

  toggleCaseSensitive(): void {
    this._caseSensitive = !this._caseSensitive;
    this.executeSearch();
  }

  get isRegex(): boolean {
    return this._isRegex;
  }

  toggleRegex(): void {
    this._isRegex = !this._isRegex;
    this.executeSearch();
  }

  // -----------------------------------------------------------------------
  // Match query helpers (used by canvas rendering)
  // -----------------------------------------------------------------------

  getMatchesForLine(lineIndex: number): FindMatch[] {
    return this._matches.filter((m) => m.line === lineIndex);
  }

  isCurrentMatch(match: FindMatch): boolean {
    if (this._currentMatchIndex < 0 || this._currentMatchIndex >= this._matches.length) {
      return false;
    }
    const current = this._matches[this._currentMatchIndex];
    return (
      current.line === match.line &&
      current.startColumn === match.startColumn &&
      current.endColumn === match.endColumn
    );
  }

  getMatchCount(): number {
    return this._matches.length;
  }

  getCurrentMatchIndex(): number {
    return this._currentMatchIndex;
  }

  // -----------------------------------------------------------------------
  // Document change notification
  // -----------------------------------------------------------------------

  /** Call this whenever the document text changes while the panel is open. */
  documentChanged(): void {
    if (!this._isVisible || !this._searchTerm) return;

    if (this.documentChangedDebounceTimer !== null) {
      clearTimeout(this.documentChangedDebounceTimer);
    }
    this.documentChangedDebounceTimer = setTimeout(() => {
      this.executeSearch();
      this.documentChangedDebounceTimer = null;
    }, 150);
  }

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------

  dispose(): void {
    if (this.searchDebounceTimer !== null) clearTimeout(this.searchDebounceTimer);
    if (this.documentChangedDebounceTimer !== null) clearTimeout(this.documentChangedDebounceTimer);
  }
}
