/**
 * Simple Suggestion Test for SyndrQL Tokenizer
 * Demonstrates how to extend the tokenizer with basic suggestion functionality
 */

import { SyndrQLTokenizer, TokenType } from './syndrQL-language-service/syndrql-tokenizer';

// Simple suggestion interface
interface SimpleSuggestion {
  value: string;
  description: string;
  priority: number;
}

/**
 * Enhanced tokenizer with basic suggestion capability
 */
class SyndrQLTokenizerWithSuggestions extends SyndrQLTokenizer {

    /**
     * Get simple suggestions based on input
     */
    getSimpleSuggestions(input: string): SimpleSuggestion[] {
      const trimmedInput = input.trim().toLowerCase();

      // If empty, suggest statement starters
      if (!trimmedInput) {
        return [
        { value: 'SELECT', description: 'Retrieve data from bundles', priority: 10 },
        { value: 'INSERT', description: 'Insert new data', priority: 9 },
        { value: 'CREATE', description: 'Create database objects', priority: 8 },
        { value: 'DROP', description: 'Drop database objects', priority: 7 },
        { value: 'USE', description: 'Set database context', priority: 6 },
        { value: 'SHOW', description: 'Show database objects', priority: 5 }
      ];
    }
    
    // Get all keywords and filter by partial match
    const allKeywords = this.getAllKeywordSuggestions();
    return allKeywords
      .filter(s => s.value.toLowerCase().startsWith(trimmedInput))
      .sort((a, b) => b.priority - a.priority);
  }
  
  private getAllKeywordSuggestions(): SimpleSuggestion[] {
    return [
      { value: 'SELECT', description: 'Retrieve data from bundles', priority: 10 },
      { value: 'INSERT', description: 'Insert new data', priority: 9 },
      { value: 'CREATE', description: 'Create database objects', priority: 8 },
      { value: 'FROM', description: 'Specify source bundle', priority: 8 },
      { value: 'WHERE', description: 'Add filter conditions', priority: 7 },
      { value: 'DOCUMENT', description: 'Insert a document', priority: 7 },
      { value: 'DROP', description: 'Drop database objects', priority: 7 },
      { value: 'DATABASE', description: 'Database object', priority: 6 },
      { value: 'BUNDLE', description: 'Bundle object', priority: 6 },
      { value: 'USE', description: 'Set database context', priority: 6 },
      { value: 'SHOW', description: 'Show database objects', priority: 5 },
      { value: 'USERS', description: 'System users', priority: 4 },
      { value: 'DATABASES', description: 'List all databases', priority: 4 },
      { value: 'BUNDLES', description: 'List all bundles', priority: 4 }
    ];
  }
  
  /**
   * Get contextual suggestions based on current tokens
   */
  getContextualSuggestions(input: string): SimpleSuggestion[] {
    const tokens = this.tokenize(input);
    const suggestions: SimpleSuggestion[] = [];
    
    if (tokens.length === 0) {
      return this.getSimpleSuggestions('');
    }
    
    const firstToken = tokens[0];
    if (firstToken.type === TokenType.KEYWORD) {
      const keyword = firstToken.value.toUpperCase();
      
      switch (keyword) {
        case 'SELECT':
          if (tokens.length === 1) {
            suggestions.push(
              { value: '*', description: 'Select all columns', priority: 10 },
              { value: 'DISTINCT', description: 'Select distinct values', priority: 8 }
            );
          }
          // Check if FROM is missing
          if (!tokens.some(t => t.value.toUpperCase() === 'FROM')) {
            suggestions.push({ value: 'FROM', description: 'Specify source bundle', priority: 9 });
          }
          break;
          
        case 'INSERT':
          if (tokens.length === 1) {
            suggestions.push({ value: 'DOCUMENT', description: 'Insert a document', priority: 10 });
          }
          break;
          
        case 'CREATE':
          if (tokens.length === 1) {
            suggestions.push(
              { value: 'DATABASE', description: 'Create a new database', priority: 10 },
              { value: 'BUNDLE', description: 'Create a new bundle', priority: 9 },
              { value: 'INDEX', description: 'Create an index', priority: 8 }
            );
          }
          break;
          
        case 'SHOW':
          if (tokens.length === 1) {
            suggestions.push(
              { value: 'DATABASES', description: 'Show all databases', priority: 10 },
              { value: 'BUNDLES', description: 'Show all bundles', priority: 9 },
              { value: 'USERS', description: 'Show system users', priority: 8 }
            );
          }
          break;
      }
    }
    
    return suggestions.sort((a, b) => b.priority - a.priority);
  }
}

// Test the suggestion system
const enhancedTokenizer = new SyndrQLTokenizerWithSuggestions();

console.log('🤖 SyndrQL Suggestion System Demo');
console.log('=================================\\n');

const testCases = [
  { input: '', description: 'Empty input - should show statement starters' },
  { input: 'SEL', description: 'Partial SELECT - should complete to SELECT' },
  { input: 'SELECT ', description: 'After SELECT - should suggest * and DISTINCT' },
  { input: 'INSERT ', description: 'After INSERT - should suggest DOCUMENT' },
  { input: 'CREATE ', description: 'After CREATE - should suggest DATABASE, BUNDLE, INDEX' },
  { input: 'CR', description: 'Partial CREATE - should complete to CREATE' },
  { input: 'SHOW ', description: 'After SHOW - should suggest DATABASES, BUNDLES, USERS' }
];

testCases.forEach((testCase, index) => {
  console.log(`Test ${index + 1}: ${testCase.description}`);
  console.log(`Input: "${testCase.input}"`);
  
  const suggestions = enhancedTokenizer.getSimpleSuggestions(testCase.input);
  const contextualSuggestions = enhancedTokenizer.getContextualSuggestions(testCase.input);
  
  console.log(`Basic suggestions (${suggestions.length}):`);
  suggestions.slice(0, 5).forEach((s, i) => 
    console.log(`  ${i + 1}. ${s.value} - ${s.description} (priority: ${s.priority})`)
  );
  
  console.log(`Contextual suggestions (${contextualSuggestions.length}):`);
  contextualSuggestions.slice(0, 5).forEach((s, i) => 
    console.log(`  ${i + 1}. ${s.value} - ${s.description} (priority: ${s.priority})`)
  );
  
  console.log();
});

console.log('✅ Suggestion system demo completed!\\n');
console.log('💡 The suggestion system is now ready for integration into the query editor UI.');

export { SyndrQLTokenizerWithSuggestions, SimpleSuggestion };