/**
 * Quick test of the suggestion system
 */

import { SyndrQLTokenizer } from './syndrql-tokenizer';

const tokenizer = new SyndrQLTokenizer();

console.log('🧪 Testing Suggestion System:');
console.log('============================\n');

const testCases = [
  'SELECT ',
  'SELECT * ',
  'INSERT ',
  'CREATE '
];

testCases.forEach(input => {
  const suggestions = tokenizer.getSuggestions(input);
  console.log(`Input: "${input}"`);
  console.log(`Suggestions (${suggestions.length}):`);
  suggestions.slice(0, 3).forEach((s, i) => 
    console.log(`  ${i + 1}. ${s.value} - ${s.description}`)
  );
  console.log();
});