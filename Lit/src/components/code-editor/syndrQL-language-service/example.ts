/**
 * Example demonstrating SyndrQL Syntax Highlighting
 * Test file to validate the syntax highlighting system works correctly
 */

import { createSyndrQLHighlighter, DEFAULT_SYNDRQL_THEME } from './index.js';

/**
 * Test SyndrQL queries for syntax highlighting validation
 */
const TEST_QUERIES = [
  // Basic SELECT query
  `SELECT name, age, email
   FROM users 
   WHERE age > 25 
   ORDER BY name;`,

  // CREATE DATABASE command
  `CREATE DATABASE company_db;`,

  // INSERT with documents
  `INSERT DOCUMENT {
     "name": "John Doe",
     "age": 30,
     "department": "Engineering"
   } TO employees;`,

  // Complex query with joins
  `SELECT u.name, d.department_name
   FROM users u
   JOIN departments d ON u.dept_id = d.id
   WHERE u.active = true
   AND d.budget > 100000;`,

  // Query with comments and placeholders
  `-- Find active users in engineering
   SELECT * FROM users 
   WHERE department = @department
   AND status = 'active';`
];

/**
 * Test the tokenizer functionality
 */
export function testTokenizer(): void {
  console.log('Testing SyndrQL Tokenizer...');
  
  const highlighter = createSyndrQLHighlighter();
  
  for (let i = 0; i < TEST_QUERIES.length; i++) {
    const query = TEST_QUERIES[i];
    console.log(`\n--- Test Query ${i + 1} ---`);
    console.log(query);
    
    const tokens = highlighter.tokenize(query);
    console.log('\nTokens:');
    
    tokens.forEach(token => {
      if (token.type !== 'whitespace' && token.type !== 'newline') {
        console.log(`  ${token.type}: "${token.value}" (${token.line}:${token.column})`);
      }
    });
  }
}

/**
 * Test theme customization
 */
export function testThemeCustomization(): void {
  console.log('\nTesting Theme Customization...');
  
  const highlighter = createSyndrQLHighlighter();
  
  // Test default theme
  console.log('Default theme:', highlighter.getTheme());
  
  // Test custom theme
  highlighter.setTheme({
    keyword: '#FF6B6B',
    string: '#4ECDC4',
    number: '#45B7D1'
  });
  
  console.log('Custom theme:', highlighter.getTheme());
}

/**
 * Test cache functionality
 */
export function testCaching(): void {
  console.log('\nTesting Caching...');
  
  const highlighter = createSyndrQLHighlighter();
  const testQuery = TEST_QUERIES[0];
  
  // First tokenization (should cache)
  console.time('First tokenization');
  const tokens1 = highlighter.tokenize(testQuery);
  console.timeEnd('First tokenization');
  
  // Second tokenization (should use cache)
  console.time('Cached tokenization');
  const tokens2 = highlighter.tokenize(testQuery);
  console.timeEnd('Cached tokenization');
  
  console.log('Tokens match:', JSON.stringify(tokens1) === JSON.stringify(tokens2));
}

/**
 * Run all tests
 */
export function runAllTests(): void {
  console.log('=== SyndrQL Syntax Highlighting Tests ===');
  
  try {
    testTokenizer();
    testThemeCustomization();
    testCaching();
    
    console.log('\n✅ All tests completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// TODO: Add performance benchmarks for large documents
// TODO: Add visual rendering tests with canvas
// TODO: Add memory usage tests for cache management