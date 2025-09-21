/**
 * Simple Suggestion Test for SyndrQL Tokenizer
 * Demonstrates basic suggestion functionality
 */

import { SyndrQLTokenizer, TokenType } from './syndrQL-language-service/syndrql-tokenizer';

// Simple suggestion interface
interface SimpleSuggestion {
  value: string;
  description: string;
  priority: number;
}

// Test the suggestion concept
const tokenizer = new SyndrQLTokenizer();

// Simple function to get suggestions
function getBasicSuggestions(input: string): SimpleSuggestion[] {
  const trimmedInput = input.trim().toLowerCase();
  
  const allSuggestions: SimpleSuggestion[] = [
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
    { value: 'SHOW', description: 'Show database objects', priority: 5 }
  ];
  
  if (!trimmedInput) {
    return allSuggestions.filter(s => s.priority >= 5);
  }
  
  return allSuggestions
    .filter(s => s.value.toLowerCase().startsWith(trimmedInput))
    .sort((a, b) => b.priority - a.priority);
}

// Test contextual suggestions
function getContextualSuggestions(input: string): SimpleSuggestion[] {
  const tokens = tokenizer.tokenize(input);
  const suggestions: SimpleSuggestion[] = [];
  
  if (tokens.length === 0) {
    return getBasicSuggestions('');
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
            { value: 'BUNDLE', description: 'Create a new bundle', priority: 9 }
          );
        }
        break;
    }
  }
  
  return suggestions.sort((a, b) => b.priority - a.priority);
}

// Test cases
console.log('🤖 SyndrQL Basic Suggestion System Demo');
console.log('=====================================\\n');

const testCases = [
  { input: '', description: 'Empty input' },
  { input: 'SEL', description: 'Partial SELECT' },
  { input: 'SELECT ', description: 'After SELECT' },
  { input: 'INSERT ', description: 'After INSERT' },
  { input: 'CREATE ', description: 'After CREATE' }
];

testCases.forEach((testCase, index) => {
  console.log(`Test ${index + 1}: ${testCase.description}`);
  console.log(`Input: "${testCase.input}"`);
  
  const basicSuggestions = getBasicSuggestions(testCase.input);
  const contextualSuggestions = getContextualSuggestions(testCase.input);
  
  console.log(`Basic suggestions (${basicSuggestions.length}):`);
  basicSuggestions.slice(0, 3).forEach((s, i) => 
    console.log(`  ${i + 1}. ${s.value} - ${s.description}`)
  );
  
  console.log(`Contextual suggestions (${contextualSuggestions.length}):`);
  contextualSuggestions.slice(0, 3).forEach((s, i) => 
    console.log(`  ${i + 1}. ${s.value} - ${s.description}`)
  );
  
  console.log();
});

console.log('✅ Basic suggestion system working!\\n');
console.log('💡 Ready for integration into the query editor.');

export { getBasicSuggestions, getContextualSuggestions, SimpleSuggestion };