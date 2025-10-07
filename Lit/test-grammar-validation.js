/**
 * Test script to validate that grammar validation is working for incomplete statements
 */

import { ComprehensiveSyndrQLGrammarValidator } from './src/components/code-editor/syndrQL-language-service/comprehensive-grammar-validator.js';
import { SyndrQLTokenizer } from './src/components/code-editor/syndrQL-language-service/tokenizer.js';

// Test cases for incomplete statements
const testCases = [
  'SELECT',
  'SELECT DOCUMENTS',
  'SELECT DOCUMENTS FROM WHERE',
  'CREATE DATABASE',
  'INVALID COMMAND'
];

const validator = new ComprehensiveSyndrQLGrammarValidator();
const tokenizer = new SyndrQLTokenizer();

console.log('Testing grammar validation for incomplete statements:\n');

testCases.forEach((testCase, index) => {
  console.log(`Test ${index + 1}: "${testCase}"`);
  
  // Tokenize the test case
  const tokens = tokenizer.tokenize(testCase);
  console.log('Tokens:', tokens.map(t => `${t.type}:${t.value}`).join(', '));
  
  // Validate with grammar
  const result = validator.validate(tokens);
  
  console.log('Valid:', result.isValid);
  console.log('Invalid Lines:', Array.from(result.invalidLines));
  console.log('Invalid Tokens:', Array.from(result.invalidTokens));
  console.log('Error Message:', result.errorMessage || 'None');
  console.log('Incomplete Statements:', result.incompleteStatements);
  console.log('---\n');
});