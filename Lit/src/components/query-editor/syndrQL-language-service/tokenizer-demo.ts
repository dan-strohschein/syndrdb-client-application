/**
 * Enhanced Tokenizer Demonstration
 * 
 * This file demonstrates the new classification capabilities of the SyndrQL tokenizer.
 * It shows how to use the enhanced functionality for syntax highlighting while
 * preserving all existing tokenization and suggestion features.
 */

import { 
  // Existing functionality (preserved)
  SyndrQLTokenizer, 
  TokenType,
  Suggestion,
  
  // New enhanced functionality
  ClassifiedToken,
  TokenCategory,
  classifyTokens,
  tokenizeAndClassify,
  getHighlightedText,
  generateSyntaxHighlighting,
  getTokenCategory,
  isTokenOfType,
  getSemanticTokens
} from './syndrql-tokenizer';

/**
 * Example usage of the enhanced tokenizer capabilities
 */
export class TokenizerDemo {
  
  /**
   * Demonstrates basic classification of SyndrQL tokens
   */
  static demonstrateBasicClassification(): void {
    const syndrqlStatement = `CREATE DATABASE "user_data" WITH FIELDS id, name, email;`;
    
    console.log('=== Basic Classification Demo ===');
    console.log('Input:', syndrqlStatement);
    console.log('');
    
    // Use the convenience function to tokenize and classify in one step
    const classifiedTokens = tokenizeAndClassify(syndrqlStatement);
    
    classifiedTokens.forEach((token, index) => {
      console.log(`Token ${index + 1}:`);
      console.log(`  Value: "${token.value}"`);
      console.log(`  Type: ${token.type}`);
      console.log(`  Category: ${token.category || 'N/A'}`);
      console.log(`  SubType: ${token.subType || 'N/A'}`);
      console.log(`  Position: ${token.startPosition}-${token.endPosition}`);
      if (token.metadata) {
        console.log(`  Reserved: ${token.metadata.isReserved}`);
        console.log(`  System: ${token.metadata.isSystemKeyword}`);
      }
      console.log('');
    });
  }
  
  /**
   * Demonstrates semantic token filtering by category
   */
  static demonstrateSemanticFiltering(): void {
    const complexStatement = `
      SELECT DOCUMENTS FROM "user_bundle" 
      WHERE age > 18 AND status = 'active'
      ORDER BY created_date DESC;
    `;
    
    console.log('=== Semantic Filtering Demo ===');
    console.log('Input:', complexStatement);
    console.log('');
    
    const classifiedTokens = tokenizeAndClassify(complexStatement);
    
    // Filter by different semantic categories
    const dqlKeywords = getSemanticTokens(classifiedTokens, TokenCategory.DQL);
    const operators = getSemanticTokens(classifiedTokens, TokenCategory.OPERATORS);
    const literals = getSemanticTokens(classifiedTokens, TokenCategory.LITERAL_STRING);
    
    console.log('DQL Keywords found:', dqlKeywords.map(t => t.value));
    console.log('Operators found:', operators.map(t => t.value));
    console.log('String Literals found:', literals.map(t => t.value));
    console.log('');
  }
  
  /**
   * Demonstrates syntax highlighting HTML generation
   */
  static demonstrateSyntaxHighlighting(): void {
    const statement = `CREATE BUNDLE "products" WITH FIELDS name, price, category;`;
    
    console.log('=== Syntax Highlighting Demo ===');
    console.log('Input:', statement);
    console.log('');
    
    // Generate highlighted HTML with default options
    const defaultHighlighted = getHighlightedText(statement);
    console.log('Default highlighting:');
    console.log(defaultHighlighted);
    console.log('');
    
    // Generate highlighted HTML with custom CSS prefix
    const customHighlighted = getHighlightedText(statement, {
      cssClassPrefix: 'my-custom-syndrql',
      preserveWhitespace: false
    });
    console.log('Custom prefix highlighting:');
    console.log(customHighlighted);
    console.log('');
  }
  
  /**
   * Demonstrates backward compatibility with existing tokenizer
   */
  static demonstrateBackwardCompatibility(): void {
    const statement = `SELECT * FROM users WHERE id = 1;`;
    
    console.log('=== Backward Compatibility Demo ===');
    console.log('Input:', statement);
    console.log('');
    
    // Use original tokenizer (still works exactly as before)
    const tokenizer = new SyndrQLTokenizer();
    const originalTokens = tokenizer.tokenize(statement);
    
    console.log('Original tokenizer results:');
    originalTokens.forEach(token => {
      console.log(`  ${token.type}: "${token.value}"`);
    });
    console.log('');
    
    // Get suggestions using existing functionality (unchanged)
    const suggestions = tokenizer.getSuggestions(statement);
    console.log('Available suggestions:', suggestions.slice(0, 5).map(s => s.value));
    console.log('');
    
    // Enhance with classification (new functionality)
    const enhancedTokens = classifyTokens(originalTokens);
    console.log('Enhanced tokens with classification:');
    enhancedTokens.forEach(token => {
      console.log(`  ${token.type} (${token.category || 'uncategorized'}): "${token.value}"`);
    });
  }
  
  /**
   * Demonstrates advanced token category checking
   */
  static demonstrateAdvancedCategoryChecking(): void {
    const ddlStatement = `CREATE DATABASE "analytics" WITH SECURITY LEVEL HIGH;`;
    const dmlStatement = `UPDATE DOCUMENTS IN "users" SET status = "inactive";`;
    
    console.log('=== Advanced Category Checking Demo ===');
    
    // Analyze DDL statement
    console.log('DDL Statement:', ddlStatement);
    const ddlTokens = tokenizeAndClassify(ddlStatement);
    const ddlKeywords = ddlTokens.filter(t => isTokenOfType(t, TokenCategory.DDL));
    const securityKeywords = ddlTokens.filter(t => isTokenOfType(t, TokenCategory.SECURITY));
    console.log('  DDL Keywords:', ddlKeywords.map(t => t.value));
    console.log('  Security Keywords:', securityKeywords.map(t => t.value));
    console.log('');
    
    // Analyze DML statement  
    console.log('DML Statement:', dmlStatement);
    const dmlTokens = tokenizeAndClassify(dmlStatement);
    const dmlKeywords = dmlTokens.filter(t => isTokenOfType(t, TokenCategory.DML));
    const identifiers = dmlTokens.filter(t => getTokenCategory(t)?.startsWith('IDENTIFIER'));
    console.log('  DML Keywords:', dmlKeywords.map(t => t.value));
    console.log('  Identifiers:', identifiers.map(t => `${t.value} (${t.category})`));
    console.log('');
  }
}

/**
 * CSS classes that can be used for syntax highlighting
 * These correspond to the CSS classes generated by generateSyntaxHighlighting()
 */
export const SYNTAX_HIGHLIGHTING_CSS = `
/* Base token types */
.syndrql-keyword { color: #569cd6; font-weight: bold; }
.syndrql-identifier { color: #9cdcfe; }
.syndrql-literal { color: #ce9178; }
.syndrql-operator { color: #d4d4d4; }
.syndrql-punctuation { color: #d4d4d4; }
.syndrql-comment { color: #6a9955; font-style: italic; }

/* Semantic categories for keywords */
.syndrql-ddl { color: #c586c0; }        /* Data Definition Language - purple */
.syndrql-dql { color: #4ec9b0; }        /* Data Query Language - teal */
.syndrql-dml { color: #ffcb6b; }        /* Data Manipulation Language - yellow */
.syndrql-objects { color: #82aaff; }    /* Database objects - light blue */
.syndrql-fields { color: #f78c6c; }     /* Field keywords - orange */
.syndrql-control { color: #c792ea; }    /* Control flow - light purple */
.syndrql-security { color: #ff5370; }   /* Security keywords - red */
.syndrql-system { color: #89ddff; }     /* System commands - cyan */
.syndrql-operators { color: #89ddff; }  /* Operators - cyan */

/* Special classifications */
.syndrql-reserved { text-decoration: underline; }
.syndrql-system { font-weight: bold; }

/* Literal types */
.syndrql-literal_string { color: #ce9178; }
.syndrql-literal_number { color: #b5cea8; }
.syndrql-literal_boolean { color: #569cd6; }

/* Comment types */
.syndrql-comment_single { color: #6a9955; }
.syndrql-comment_multi { color: #6a9955; opacity: 0.8; }

/* Identifier types */
.syndrql-identifier_quoted { color: #9cdcfe; font-style: italic; }
.syndrql-identifier_unquoted { color: #9cdcfe; }
`;

// Run demos if this file is executed directly
if (typeof window === 'undefined') { // Node.js environment
  console.log('Running Enhanced SyndrQL Tokenizer Demonstrations...\n');
  TokenizerDemo.demonstrateBasicClassification();
  TokenizerDemo.demonstrateSemanticFiltering();
  TokenizerDemo.demonstrateSyntaxHighlighting();
  TokenizerDemo.demonstrateBackwardCompatibility();
  TokenizerDemo.demonstrateAdvancedCategoryChecking();
}