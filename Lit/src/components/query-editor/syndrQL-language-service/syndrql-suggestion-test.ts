/**
 * Test script for SyndrQL Suggestion System
 * Demonstrates the comprehensive structured suggestion functionality
 */

import { SyndrQLTokenizer, Suggestion, SuggestionKind } from './syndrql-tokenizer';

// Create a tokenizer instance
const tokenizer = new SyndrQLTokenizer();

/**
 * Test cases for suggestion system
 */
const suggestionTestCases = [
  {
    name: "Empty input",
    input: "",
    description: "Should suggest statement starters"
  },
  {
    name: "After SELECT",
    input: "SELECT ",
    description: "Should suggest *, DISTINCT, and column names"
  },
  {
    name: "Partial SELECT",
    input: "SEL",
    description: "Should suggest SELECT completion"
  },
  {
    name: "After SELECT DOCUMENTS",
    input: "SELECT DOCUMENTS ",
    description: "Should suggest FROM clause"
  },
  {
    name: "After FROM",
    input: "SELECT DOCUMENTS FROM ",
    description: "Should suggest table/bundle names"
  },
  {
    name: "Complete SELECT with WHERE",
    input: "SELECT DOCUMENTS FROM users ",
    description: "Should suggest WHERE, ORDER BY, etc."
  },
  {
    name: "INSERT statement",
    input: "INSERT ",
    description: "Should suggest DOCUMENT"
  },
  {
    name: "CREATE statement", 
    input: "CREATE ",
    description: "Should suggest DATABASE, BUNDLE, INDEX"
  },
  {
    name: "Partial keyword",
    input: "CR",
    description: "Should suggest CREATE"
  },
  {
    name: "USE statement",
    input: "USE ",
    description: "Should suggest database names"
  }
];

/**
 * Helper function to format suggestions nicely
 */
function formatSuggestions(suggestions: Suggestion[]): string {
  if (suggestions.length === 0) {
    return "   No suggestions";
  }
  
  return suggestions.map((suggestion, index) => {
    const priority = suggestion.priority ? ` (priority: ${suggestion.priority})` : '';
    const category = suggestion.category ? ` [${suggestion.category}]` : '';
    const kind = suggestion.kind ? ` {${suggestion.kind}}` : '';
    return `   ${index + 1}. ${suggestion.value}${priority}${category}${kind}\\n      ${suggestion.description || 'No description'}`;
  }).join('\\n');
}

/**
 * Run suggestion tests
 */
function runSuggestionTests(): void {
  console.log("🤖 SyndrQL Suggestion System Tests");
  console.log("==================================\\n");
  
  suggestionTestCases.forEach((testCase, index) => {
    console.log(`📝 Test ${index + 1}: ${testCase.name}`);
    console.log(`   Input: "${testCase.input}"`);
    console.log(`   Expected: ${testCase.description}`);
    
    try {
      const suggestions = tokenizer.getSuggestions(testCase.input);
      console.log(`   Results (${suggestions.length} suggestions):`);
      console.log(formatSuggestions(suggestions));
      
      // Group suggestions by kind for analysis
      const byKind = suggestions.reduce((groups, suggestion) => {
        const kind = suggestion.kind;
        groups[kind] = (groups[kind] || 0) + 1;
        return groups;
      }, {} as Record<string, number>);
      
      if (Object.keys(byKind).length > 0) {
        const kindSummary = Object.entries(byKind)
          .map(([kind, count]) => `${kind}: ${count}`)
          .join(', ');
        console.log(`   Distribution: ${kindSummary}`);
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error}`);
    }
    
    console.log();
  });
}

/**
 * Demonstrate advanced suggestion features
 */
function demonstrateAdvancedFeatures(): void {
  console.log("🔬 Advanced Suggestion Features");
  console.log("===============================\\n");
  
  // Test partial matching
  console.log("🔍 Partial Matching Test:");
  const partialSuggestions = tokenizer.getSuggestions("SEL");
  console.log(`   Input: "SEL" → ${partialSuggestions.length} matches`);
  partialSuggestions.forEach(s => console.log(`   - ${s.value} (${s.description})`));
  console.log();
  
  // Test context awareness
  console.log("🧠 Context Awareness Test:");
  const contextTests = [
    "SELECT name ",
    "SELECT name FROM ",
    "SELECT name FROM users ",
  ];
  
  contextTests.forEach(input => {
    const suggestions = tokenizer.getSuggestions(input);
    console.log(`   "${input}" → Top suggestion: ${suggestions[0]?.value || 'None'}`);
  });
  console.log();
  
  // Test priority system
  console.log("📊 Priority System Test:");
  const prioritySuggestions = tokenizer.getSuggestions("");
  console.log("   Statement starters by priority:");
  prioritySuggestions
    .slice(0, 5)
    .forEach((s, i) => console.log(`   ${i + 1}. ${s.value} (priority: ${s.priority})`));
}

// Run the tests
runSuggestionTests();
demonstrateAdvancedFeatures();

console.log("✅ Suggestion system tests completed!");

// Export for integration testing
export { tokenizer, suggestionTestCases };