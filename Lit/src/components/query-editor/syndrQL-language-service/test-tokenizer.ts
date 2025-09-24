/**
 * Simple test to verify the enhanced tokenizer works correctly
 */

import { tokenizeAndClassify, generateSyntaxHighlighting } from './syndrql-tokenizer';

// Test the tokenization process
console.log('=== Testing Enhanced Tokenizer ===');

const testQueries = [
  'CREATE DATABASE test',
  'SELECT * FROM users',
  'CREATE BUNDLE products WITH FIELDS name, price'
];

testQueries.forEach((query, index) => {
  console.log(`\n--- Test ${index + 1}: "${query}" ---`);
  
  try {
    // Test tokenization
    const tokens = tokenizeAndClassify(query);
    console.log('Tokens:', tokens.map(t => ({ 
      type: t.type, 
      value: t.value, 
      category: t.category 
    })));
    
    // Test HTML generation
    const html = generateSyntaxHighlighting(tokens, {
      preserveWhitespace: true,
      cssClassPrefix: 'syndrql'
    });
    console.log('Generated HTML:', html);
    console.log('Has highlighting:', html.includes('<span'));
    
  } catch (error) {
    console.error('Error:', error);
  }
});