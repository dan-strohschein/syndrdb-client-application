/**
 * Comprehensive SyndrQL Grammar Validator
 * Uses the complete grammar rules from query-editor for full validation
 */

import { SyntaxToken, TokenType } from './types.js';
import { 
  SYNDRQL_GRAMMAR_RULES, 
  GrammarRule, 
  GrammarElement,
  findMatchingGrammarRules,
  TokenType as GrammarTokenType
} from '../../query-editor/syndrQL-language-service/syndrql-grammar.js';

/**
 * Enhanced grammar validation result
 */
export interface ComprehensiveGrammarValidationResult {
  isValid: boolean;
  invalidTokens: Set<number>; // Indices of invalid tokens
  invalidLines: Set<number>;  // Line numbers with incomplete/invalid statements
  expectedTokens?: string[];   // What was expected at error point
  errorMessage?: string;
  matchedRule?: GrammarRule;   // The grammar rule that was matched (if any)
  completionSuggestions?: string[]; // Suggested completions
  incompleteStatements: { // Details about incomplete statements
    lineNumber: number;
    missingElements: string[];
    errorType: 'incomplete' | 'missing_critical' | 'invalid_sequence';
  }[];
}

/**
 * Maps code-editor TokenType to grammar TokenType
 */
function mapToGrammarTokenType(tokenType: TokenType): GrammarTokenType | null {
  switch (tokenType) {
    case TokenType.KEYWORD:
      return GrammarTokenType.KEYWORD;
    case TokenType.IDENTIFIER:
      return GrammarTokenType.IDENTIFIER;
    case TokenType.STRING:
      return GrammarTokenType.STRING_LITERAL;
    case TokenType.PLACEHOLDER:
      return GrammarTokenType.PLACEHOLDER;
    case TokenType.OPERATOR:
      return GrammarTokenType.OPERATOR;
    case TokenType.PUNCTUATION:
      return GrammarTokenType.SEPARATOR; // Default, will be refined below
    default:
      return null;
  }
}

/**
 * Maps specific punctuation values to grammar token types
 */
function mapPunctuationToGrammarType(value: string): GrammarTokenType {
  switch (value) {
    case '(':
      return GrammarTokenType.PARENTHESIS_OPEN;
    case ')':
      return GrammarTokenType.PARENTHESIS_CLOSE;
    case '{':
      return GrammarTokenType.BRACE_OPEN;
    case '}':
      return GrammarTokenType.BRACE_CLOSE;
    case '[':
      return GrammarTokenType.BRACKET_OPEN;
    case ']':
      return GrammarTokenType.BRACKET_CLOSE;
    case ';':
      return GrammarTokenType.SEMICOLON;
    case ',':
      return GrammarTokenType.COMMA;
    case '=':
      return GrammarTokenType.EQUALS;
    case '*':
      return GrammarTokenType.WILDCARD;
    default:
      return GrammarTokenType.SEPARATOR;
  }
}

/**
 * Comprehensive grammar validator using the complete SyndrQL grammar system
 */
export class ComprehensiveSyndrQLGrammarValidator {
  
  /**
   * Validate a sequence of tokens against all SyndrQL grammar rules
   */
  validate(tokens: SyntaxToken[]): ComprehensiveGrammarValidationResult {
    // Filter out whitespace, comments, and newlines for grammar analysis
    const significantTokens = tokens.filter(token => 
      token.type !== TokenType.WHITESPACE && 
      token.type !== TokenType.COMMENT && 
      token.type !== TokenType.NEWLINE
    );

    console.log('🔍 Significant tokens:', significantTokens.map(t => `${t.type}:${t.value}`).join(', '));

    if (significantTokens.length === 0) {
      return { 
        isValid: true, 
        invalidTokens: new Set(), 
        invalidLines: new Set(),
        incompleteStatements: []
      };
    }

    // Convert tokens to a statement string for initial pattern matching
    const statementText = significantTokens
      .map(token => token.value.toUpperCase())
      .join(' ');

    console.log('🔍 Statement text for grammar matching:', statementText);

    // Find potential matching grammar rules
    const potentialRules = findMatchingGrammarRules(statementText);
    
    console.log('🔍 Found', potentialRules.length, 'potential grammar rules:', potentialRules.map(r => r.statementType));
    
    if (potentialRules.length === 0) {
      // No grammar rule matches - mark all tokens as invalid
      const invalidIndices = new Set<number>();
      significantTokens.forEach((_, index) => {
        const originalIndex = tokens.indexOf(significantTokens[index]);
        invalidIndices.add(originalIndex);
      });
      
      return {
        isValid: false,
        invalidTokens: invalidIndices,
        invalidLines: new Set([1]), // Mark first line as invalid
        errorMessage: 'No matching grammar rule found for statement',
        completionSuggestions: this.getStatementStarterSuggestions(),
        incompleteStatements: [{
          lineNumber: 1,
          missingElements: ['Valid statement starter'],
          errorType: 'invalid_sequence'
        }]
      };
    }

    // Try to validate against each potential rule
    for (const rule of potentialRules) {
      console.log('🔍 Trying to validate against rule:', rule.statementType);
      const validationResult = this.validateAgainstRule(tokens, significantTokens, rule);
      console.log('🔍 Rule validation result:', { ruleName: rule.statementType, isValid: validationResult.isValid });
      
      if (validationResult.isValid) {
        return {
          ...validationResult,
          matchedRule: rule
        };
      }
    }

    // If no rule validates successfully, use the best match for error reporting
    const bestRule = potentialRules[0];
    return this.validateAgainstRule(tokens, significantTokens, bestRule);
  }

  /**
   * Validate tokens against a specific grammar rule
   */
  private validateAgainstRule(
    allTokens: SyntaxToken[], 
    significantTokens: SyntaxToken[], 
    rule: GrammarRule
  ): ComprehensiveGrammarValidationResult {
    const invalidTokens = new Set<number>();
    const invalidLines = new Set<number>();
    const incompleteStatements: { lineNumber: number; missingElements: string[]; errorType: 'incomplete' | 'missing_critical' | 'invalid_sequence' }[] = [];
    
    let patternIndex = 0;
    let tokenIndex = 0;
    let hasRequiredElements = true;
    let missingCriticalElements: string[] = [];
    
    while (tokenIndex < significantTokens.length && patternIndex < rule.pattern.length) {
      const token = significantTokens[tokenIndex];
      const patternElement = rule.pattern[patternIndex];
      
      const isMatch = this.matchesPatternElement(token, patternElement);
      
      if (isMatch) {
        // Token matches pattern element
        tokenIndex++;
        
        // Handle repeatable elements
        if (patternElement.repeatable && tokenIndex < significantTokens.length) {
          const nextToken = significantTokens[tokenIndex];
          if (this.matchesPatternElement(nextToken, patternElement)) {
            continue; // Stay on same pattern element for next iteration
          }
        }
        
        patternIndex++;
      } else if (patternElement.optional) {
        // Skip optional element that doesn't match
        patternIndex++;
      } else {
        // Required element doesn't match - mark token as invalid
        const originalIndex = allTokens.indexOf(token);
        invalidTokens.add(originalIndex);
        invalidLines.add(token.line);
        hasRequiredElements = false;
        
        // Track what was expected
        if (patternElement.value) {
          missingCriticalElements.push(patternElement.value);
        } else if (patternElement.placeholder) {
          missingCriticalElements.push(patternElement.placeholder);
        }
        
        tokenIndex++;
      }
    }
    
    // Check if we have extra tokens that don't match the pattern
    while (tokenIndex < significantTokens.length) {
      const token = significantTokens[tokenIndex];
      const originalIndex = allTokens.indexOf(token);
      invalidTokens.add(originalIndex);
      invalidLines.add(token.line);
      tokenIndex++;
    }
    
    // Check if we're missing required pattern elements (incomplete statement)
    const missingRequired: string[] = [];
    while (patternIndex < rule.pattern.length) {
      const patternElement = rule.pattern[patternIndex];
      if (!patternElement.optional) {
        hasRequiredElements = false;
        if (patternElement.value) {
          missingRequired.push(patternElement.value);
        } else if (patternElement.placeholder) {
          missingRequired.push(`<${patternElement.placeholder}>`);
        } else {
          missingRequired.push(`<${patternElement.type}>`);
        }
      }
      patternIndex++;
    }
    
    // Determine error type and mark lines as invalid if needed
    if (!hasRequiredElements || missingRequired.length > 0 || missingCriticalElements.length > 0) {
      // Mark all lines with tokens as having errors
      significantTokens.forEach(token => {
        invalidLines.add(token.line);
      });
      
      // If no tokens but we're missing required elements, mark line 1
      if (significantTokens.length === 0 && missingRequired.length > 0) {
        invalidLines.add(1);
      }
      
      const allMissingElements = [...missingCriticalElements, ...missingRequired];
      const errorType = missingRequired.length > 0 ? 'incomplete' : 
                       missingCriticalElements.length > 0 ? 'missing_critical' : 'invalid_sequence';
      
      invalidLines.forEach(lineNum => {
        incompleteStatements.push({
          lineNumber: lineNum,
          missingElements: allMissingElements,
          errorType
        });
      });
    }

    return {
      isValid: invalidTokens.size === 0 && hasRequiredElements,
      invalidTokens,
      invalidLines,
      expectedTokens: this.getExpectedTokens(rule, patternIndex),
      errorMessage: invalidTokens.size === 0 && hasRequiredElements ? undefined : 
        `Statement doesn't match ${rule.statementType} pattern`,
      completionSuggestions: this.getCompletionSuggestions(rule, patternIndex),
      incompleteStatements
    };
  }

  /**
   * Check if a token matches a pattern element
   */
  private matchesPatternElement(token: SyntaxToken, element: GrammarElement): boolean {
    // Convert token type to grammar token type
    let grammarTokenType: GrammarTokenType | null;
    
    if (token.type === TokenType.PUNCTUATION) {
      grammarTokenType = mapPunctuationToGrammarType(token.value);
    } else {
      grammarTokenType = mapToGrammarTokenType(token.type);
    }
    
    if (!grammarTokenType || grammarTokenType !== element.type) {
      return false;
    }
    
    // If element has a specific value, check for exact match
    if (element.value) {
      return token.value.toUpperCase() === element.value.toUpperCase();
    }
    
    // If element has choices, check if token matches one of them
    if (element.choices) {
      return element.choices.some(choice => 
        token.value.toUpperCase() === choice.toUpperCase()
      );
    }
    
    // For placeholder elements, any token of the correct type is valid
    if (element.placeholder) {
      return true;
    }
    
    return true;
  }

  /**
   * Get expected tokens at a given pattern position
   */
  private getExpectedTokens(rule: GrammarRule, patternIndex: number): string[] {
    if (patternIndex >= rule.pattern.length) {
      return [];
    }
    
    const element = rule.pattern[patternIndex];
    const expected: string[] = [];
    
    if (element.value) {
      expected.push(element.value);
    } else if (element.choices) {
      expected.push(...element.choices);
    } else if (element.placeholder) {
      expected.push(`<${element.placeholder}>`);
    } else {
      // Add generic type description
      expected.push(`<${element.type}>`);
    }
    
    return expected;
  }

  /**
   * Get completion suggestions at a given pattern position
   */
  private getCompletionSuggestions(rule: GrammarRule, patternIndex: number): string[] {
    const suggestions: string[] = [];
    
    // Add expected tokens from current position
    if (patternIndex < rule.pattern.length) {
      const element = rule.pattern[patternIndex];
      
      if (element.value) {
        suggestions.push(element.value);
      } else if (element.choices) {
        suggestions.push(...element.choices);
      }
      
      // If current element is optional, also suggest next elements
      if (element.optional && patternIndex + 1 < rule.pattern.length) {
        const nextSuggestions = this.getCompletionSuggestions(rule, patternIndex + 1);
        suggestions.push(...nextSuggestions);
      }
    }
    
    return suggestions;
  }

  /**
   * Get statement starter suggestions
   */
  private getStatementStarterSuggestions(): string[] {
    const starters = new Set<string>();
    
    Object.values(SYNDRQL_GRAMMAR_RULES).forEach(rule => {
      const firstElement = rule.pattern[0];
      if (firstElement && firstElement.type === GrammarTokenType.KEYWORD && firstElement.value) {
        starters.add(firstElement.value);
      }
    });
    
    return Array.from(starters).sort();
  }

  /**
   * Check if a single token is grammatically valid in context
   */
  isTokenValid(token: SyntaxToken, context: SyntaxToken[]): boolean {
    const result = this.validate([...context, token]);
    const tokenIndex = context.length;
    return !result.invalidTokens.has(tokenIndex);
  }

  /**
   * Get all supported statement types from the grammar
   */
  getSupportedStatements(): string[] {
    return Object.keys(SYNDRQL_GRAMMAR_RULES);
  }

  /**
   * Get detailed information about a specific grammar rule
   */
  getGrammarRule(statementType: string): GrammarRule | null {
    return SYNDRQL_GRAMMAR_RULES[statementType] || null;
  }

  /**
   * Get all grammar rules
   */
  getAllGrammarRules(): { [key: string]: GrammarRule } {
    return SYNDRQL_GRAMMAR_RULES;
  }

  /**
   * Get completion suggestions for a partial statement
   */
  getCompletionSuggestionsForStatement(tokens: SyntaxToken[]): string[] {
    const result = this.validate(tokens);
    return result.completionSuggestions || [];
  }
}