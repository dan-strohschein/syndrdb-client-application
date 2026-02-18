/**
 * Suggestion Controller - Owns suggestion list, visibility, position, selected index, and debounced update.
 * Follows Single Responsibility Principle: only handles suggestion UI state and keyboard/selection.
 * Used by CodeEditor to delegate suggestion logic; host provides apply callback and requestUpdate.
 */

import type { Position, KeyCommand } from './types.js';
import type { ILanguageServiceSuggestion } from './language-service-interface.js';

/** Local alias — controllers and components use Suggestion throughout. */
export type Suggestion = ILanguageServiceSuggestion;

export interface SuggestionControllerDeps {
  getDocumentLines: () => readonly string[];
  getCursorPosition: () => Position;
  getSuggestionsFromService: (fullText: string, charPosition: number) => Promise<Suggestion[]>;
  getCoordinateSystem: () => { positionToScreen: (pos: Position) => { x: number; y: number }; getFontMetrics: () => { lineHeight: number } };
  requestUpdate: () => void;
  onApplySuggestion: (suggestion: Suggestion) => void;
}

const SUGGESTION_UPDATE_DELAY_MS = 150;

export class SuggestionController {
  private suggestions: Suggestion[] = [];
  private showSuggestions = false;
  private suggestionPosition: { x: number; y: number } = { x: 0, y: 0 };
  private selectedSuggestionIndex = 0;
  private suggestionUpdateTimeout: number | null = null;

  constructor(private readonly deps: SuggestionControllerDeps) {}

  getSuggestions(): Suggestion[] {
    return this.suggestions;
  }

  getShowSuggestions(): boolean {
    return this.showSuggestions;
  }

  getSuggestionPosition(): { x: number; y: number } {
    return { ...this.suggestionPosition };
  }

  getSelectedIndex(): number {
    return this.selectedSuggestionIndex;
  }

  setSelectedIndex(index: number): void {
    this.selectedSuggestionIndex = index;
    this.deps.requestUpdate();
  }

  /** Debounced: schedule fetching suggestions and updating state. */
  scheduleUpdate(): void {
    if (this.suggestionUpdateTimeout) {
      clearTimeout(this.suggestionUpdateTimeout);
    }
    this.suggestionUpdateTimeout = window.setTimeout(() => {
      this.updateSuggestions();
      this.suggestionUpdateTimeout = null;
    }, SUGGESTION_UPDATE_DELAY_MS);
  }

  hideSuggestions(): void {
    this.showSuggestions = false;
    this.suggestions = [];
    this.selectedSuggestionIndex = 0;
    this.deps.requestUpdate();
  }

  /** Handle key command when suggestions are visible. Returns true if handled. */
  handleKeyCommand(command: KeyCommand): boolean {
    if (!this.showSuggestions || this.suggestions.length === 0) return false;
    switch (command.key) {
      case 'ArrowUp':
        this.selectedSuggestionIndex = Math.max(0, this.selectedSuggestionIndex - 1);
        this.deps.requestUpdate();
        return true;
      case 'ArrowDown':
        this.selectedSuggestionIndex = Math.min(
          this.suggestions.length - 1,
          this.selectedSuggestionIndex + 1
        );
        this.deps.requestUpdate();
        return true;
      case 'Enter':
      case 'Tab':
        return this.acceptSelectedSuggestion();
      case 'Escape':
        this.hideSuggestions();
        return true;
      default:
        return false;
    }
  }

  acceptSelectedSuggestion(): boolean {
    if (!this.showSuggestions || this.suggestions.length === 0) return false;
    const selected = this.suggestions[this.selectedSuggestionIndex];
    if (selected) {
      this.deps.onApplySuggestion(selected);
      this.hideSuggestions();
      return true;
    }
    return false;
  }

  /** Called when user selects a suggestion from the dropdown (e.g. click). */
  selectSuggestion(suggestion: Suggestion): void {
    this.deps.onApplySuggestion(suggestion);
    this.hideSuggestions();
  }

  private async updateSuggestions(): Promise<void> {
    try {
      const cursorPosition = this.deps.getCursorPosition();
      const lines = this.deps.getDocumentLines();
      const fullText = lines.join('\n');
      let charPosition = 0;
      for (let i = 0; i < cursorPosition.line; i++) {
        charPosition += lines[i].length + 1;
      }
      charPosition += cursorPosition.column;

      const suggestions = await this.deps.getSuggestionsFromService(fullText, charPosition);
      if (suggestions.length > 0) {
        this.suggestions = suggestions;
        this.selectedSuggestionIndex = 0;
        this.suggestionPosition = this.calculateSuggestionPosition(cursorPosition);
        this.showSuggestions = true;
      } else {
        this.hideSuggestions();
      }
      this.deps.requestUpdate();
    } catch (error) {
      console.error('Error updating suggestions:', error);
      this.hideSuggestions();
    }
  }

  private calculateSuggestionPosition(cursorPosition: Position): { x: number; y: number } {
    try {
      const coord = this.deps.getCoordinateSystem();
      const screenPos = coord.positionToScreen(cursorPosition);
      const fontMetrics = coord.getFontMetrics();
      return {
        x: Math.max(0, screenPos.x),
        y: Math.max(0, screenPos.y + fontMetrics.lineHeight),
      };
    } catch {
      return { x: 0, y: 0 };
    }
  }
}
