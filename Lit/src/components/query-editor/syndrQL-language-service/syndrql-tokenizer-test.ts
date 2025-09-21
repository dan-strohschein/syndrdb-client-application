/**
 * Unit Tests for SyndrQL Tokenizer
 * 
 * This file serves as the foundation for our testing suite.
 * Future enhancements can include:
 * - Integration with testing frameworks (Jest, Vitest, etc.)
 * - Assertion-based testing with expected results
 * - Performance benchmarks
 * - Edge case validation
 * - Error handling tests
 */

import { SyndrQLTokenizer, TokenType, Token } from './syndrql-tokenizer';

/**
 * Test case interface for structured testing
 */
interface TestCase {
  name: string;
  input: string;
  description: string;
  expectedTokenCount?: number;
  expectedFirstToken?: { type: TokenType; value: string };
  expectedLastToken?: { type: TokenType; value: string };
}

/**
 * Test suite for SyndrQL Tokenizer
 */
class SyndrQLTokenizerTestSuite {
  private tokenizer: SyndrQLTokenizer;
  private testResults: { passed: number; failed: number; total: number } = {
    passed: 0,
    failed: 0,
    total: 0
  };

  constructor() {
    this.tokenizer = new SyndrQLTokenizer();
  }

  /**
   * Run all tokenizer tests
   */
  runAllTests(): void {
    console.log("🧪 SyndrQL Tokenizer Unit Tests");
    console.log("================================\n");

    // Basic statement tests
    this.testBasicStatements();
    
    // Comment tests
    this.testComments();
    
    // String literal tests
    this.testStringLiterals();
    
    // Operator and punctuation tests
    this.testOperatorsAndPunctuation();
    
    // Number literal tests
    this.testNumberLiterals();
    
    // Edge case tests
    this.testEdgeCases();

    // Print summary
    this.printTestSummary();
  }

  private testBasicStatements(): void {
    console.log("📋 Basic Statement Tests");
    console.log("-".repeat(30));

    const testCases: TestCase[] = [
      {
        name: "Simple SELECT",
        input: "SELECT * FROM users WHERE id = 42;",
        description: "Basic SELECT statement with WHERE clause",
        expectedTokenCount: 9,
        expectedFirstToken: { type: TokenType.KEYWORD, value: "SELECT" },
        expectedLastToken: { type: TokenType.PUNCTUATION, value: ";" }
      },
      {
        name: "CREATE DATABASE",
        input: "CREATE DATABASE test_db;",
        description: "Database creation statement",
        expectedTokenCount: 4,
        expectedFirstToken: { type: TokenType.KEYWORD, value: "CREATE" },
        expectedLastToken: { type: TokenType.PUNCTUATION, value: ";" }
      },
      {
        name: "INSERT DOCUMENT",
        input: "INSERT DOCUMENT {'name': 'John', 'age': 30} TO users;",
        description: "Document insertion with JSON-like syntax",
        expectedTokenCount: 14  // Fixed: INSERT, DOCUMENT, {, 'name', :, 'John', ,, 'age', :, 30, }, TO, users, ;
      }
    ];

    testCases.forEach(testCase => this.runTestCase(testCase));
    console.log();
  }

  private testComments(): void {
    console.log("💬 Comment Tests");
    console.log("-".repeat(20));

    const testCases: TestCase[] = [
      {
        name: "Single-line comment (--)",
        input: "-- This is a comment\nSELECT name FROM users;",
        description: "SQL-style single-line comment",
        expectedFirstToken: { type: TokenType.COMMENT, value: "-- This is a comment" }
      },
      {
        name: "Single-line comment (//)",
        input: "// C-style comment\nSELECT * FROM bundles;",
        description: "C-style single-line comment"
      },
      {
        name: "Multi-line comment",
        input: "/* Multi-line\n   comment */ DROP BUNDLE old_data;",
        description: "Multi-line comment spanning multiple lines",
        expectedFirstToken: { type: TokenType.COMMENT, value: "/* Multi-line\n   comment */" }
      }
    ];

    testCases.forEach(testCase => this.runTestCase(testCase));
    console.log();
  }

  private testStringLiterals(): void {
    console.log("🔤 String Literal Tests");
    console.log("-".repeat(25));

    const testCases: TestCase[] = [
      {
        name: "Double quotes",
        input: 'SELECT "column name" FROM table;',
        description: "String literal with double quotes"
      },
      {
        name: "Single quotes", 
        input: "INSERT 'Hello World' INTO messages;",
        description: "String literal with single quotes"
      },
      {
        name: "Escaped characters",
        input: "SELECT 'It\\'s a test' FROM data;",
        description: "String with escaped quote character"
      }
    ];

    testCases.forEach(testCase => this.runTestCase(testCase));
    console.log();
  }

  private testOperatorsAndPunctuation(): void {
    console.log("🔢 Operator & Punctuation Tests");
    console.log("-".repeat(35));

    const testCases: TestCase[] = [
      {
        name: "Comparison operators",
        input: "WHERE age >= 18 AND score <= 100 AND status != 'inactive';",
        description: "Multi-character comparison operators"
      },
      {
        name: "JSON-like syntax",
        input: "{'key': 'value', 'number': 42}",
        description: "Braces, colons, and commas for JSON structures"
      },
      {
        name: "Mathematical operators",
        input: "SELECT price * quantity + tax - discount;",
        description: "Arithmetic operators"
      }
    ];

    testCases.forEach(testCase => this.runTestCase(testCase));
    console.log();
  }

  private testNumberLiterals(): void {
    console.log("🔢 Number Literal Tests");
    console.log("-".repeat(25));

    const testCases: TestCase[] = [
      {
        name: "Integer",
        input: "SELECT * FROM users WHERE age = 25;",
        description: "Integer literal"
      },
      {
        name: "Decimal",
        input: "SELECT price FROM products WHERE cost = 19.99;",
        description: "Decimal number literal"
      },
      {
        name: "Multiple numbers",
        input: "INSERT VALUES (1, 2.5, 100, 0.001);",
        description: "Multiple numeric literals"
      }
    ];

    testCases.forEach(testCase => this.runTestCase(testCase));
    console.log();
  }

  private testEdgeCases(): void {
    console.log("⚠️  Edge Case Tests");
    console.log("-".repeat(20));

    const testCases: TestCase[] = [
      {
        name: "Empty string",
        input: "",
        description: "Empty input string",
        expectedTokenCount: 0
      },
      {
        name: "Whitespace only",
        input: "   \n\t  \n  ",
        description: "Only whitespace characters",
        expectedTokenCount: 0
      },
      {
        name: "Unknown characters",
        input: "SELECT @ FROM #table WHERE $ = ?;",
        description: "Mix of valid and unknown characters"
      }
    ];

    testCases.forEach(testCase => this.runTestCase(testCase));
    console.log();
  }

  private runTestCase(testCase: TestCase): void {
    this.testResults.total++;
    
    try {
      console.log(`🔍 ${testCase.name}`);
      console.log(`   Input: "${testCase.input.replace(/\n/g, '\\n')}"`);
      console.log(`   ${testCase.description}`);
      
      const tokens = this.tokenizer.tokenize(testCase.input);
      
      // Validate expected token count
      if (testCase.expectedTokenCount !== undefined) {
        if (tokens.length !== testCase.expectedTokenCount) {
          console.log(`   ❌ Expected ${testCase.expectedTokenCount} tokens, got ${tokens.length}`);
          this.testResults.failed++;
          return;
        }
      }
      
      // Validate first token
      if (testCase.expectedFirstToken && tokens.length > 0) {
        const firstToken = tokens[0];
        if (firstToken.type !== testCase.expectedFirstToken.type || 
            firstToken.value !== testCase.expectedFirstToken.value) {
          console.log(`   ❌ First token mismatch. Expected [${testCase.expectedFirstToken.type}] "${testCase.expectedFirstToken.value}", got [${firstToken.type}] "${firstToken.value}"`);
          this.testResults.failed++;
          return;
        }
      }
      
      // Validate last token
      if (testCase.expectedLastToken && tokens.length > 0) {
        const lastToken = tokens[tokens.length - 1];
        if (lastToken.type !== testCase.expectedLastToken.type || 
            lastToken.value !== testCase.expectedLastToken.value) {
          console.log(`   ❌ Last token mismatch. Expected [${testCase.expectedLastToken.type}] "${testCase.expectedLastToken.value}", got [${lastToken.type}] "${lastToken.value}"`);
          this.testResults.failed++;
          return;
        }
      }
      
      console.log(`   ✅ Passed (${tokens.length} tokens)`);
      
      // Show tokens for debugging
      if (tokens.length > 0 && tokens.length <= 15) {
        console.log(`   Tokens: ${this.tokenizer.getTokensAsString(tokens).replace(/\n/g, ' | ')}`);
      }
      
      this.testResults.passed++;
      
    } catch (error) {
      console.log(`   ❌ Error: ${error}`);
      this.testResults.failed++;
    }
    
    console.log();
  }

  private printTestSummary(): void {
    console.log("📊 Test Summary");
    console.log("===============");
    console.log(`Total Tests: ${this.testResults.total}`);
    console.log(`✅ Passed: ${this.testResults.passed}`);
    console.log(`❌ Failed: ${this.testResults.failed}`);
    
    const successRate = this.testResults.total > 0 
      ? Math.round((this.testResults.passed / this.testResults.total) * 100) 
      : 0;
    
    console.log(`📈 Success Rate: ${successRate}%\n`);
    
    if (this.testResults.failed === 0) {
      console.log("🎉 All tests passed! The tokenizer is working correctly.");
    } else {
      console.log(`⚠️  ${this.testResults.failed} test(s) need attention.`);
    }
  }
}

// Run the test suite when this file is executed directly
const testSuite = new SyndrQLTokenizerTestSuite();
testSuite.runAllTests();

// Export for future integration with testing frameworks
export { SyndrQLTokenizerTestSuite, TestCase };