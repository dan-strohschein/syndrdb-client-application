/**
 * SyndrQL Parser - Comment stripping and validation utilities
 */

/**
 * Strips comments from SyndrQL code
 * 
 * Handles three types of comments:
 * 1. Single-line comments starting with two forward slashes
 * 2. Multi-line comments enclosed in forward-slash-asterisk pairs  
 * 3. Single-line comments starting with two hyphens
 * 
 * @param input - The raw SyndrQL code string
 * @returns The code string with all comments removed
 */
export function stripComments(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  let result = '';
  let i = 0;
  const length = input.length;

  while (i < length) {
    const currentChar = input[i];
    const nextChar = i + 1 < length ? input[i + 1] : '';

    // Check for single-line comment starting with //
    if (currentChar === '/' && nextChar === '/') {
      // Skip to end of line
      i += 2;
      while (i < length && input[i] !== '\n') {
        i++;
      }
      // Include the newline character if we found one
      if (i < length && input[i] === '\n') {
        result += '\n';
        i++;
      }
      continue;
    }

    // Check for single-line comment starting with --
    if (currentChar === '-' && nextChar === '-') {
      // Skip to end of line
      i += 2;
      while (i < length && input[i] !== '\n') {
        i++;
      }
      // Include the newline character if we found one
      if (i < length && input[i] === '\n') {
        result += '\n';
        i++;
      }
      continue;
    }

    // Check for multi-line comment starting with /*
    if (currentChar === '/' && nextChar === '*') {
      // Skip the /* opening
      i += 2;
      
      // Look for the closing */
      let foundClosing = false;
      while (i < length - 1) {
        if (input[i] === '*' && input[i + 1] === '/') {
          // Skip the */ closing
          i += 2;
          foundClosing = true;
          break;
        }
        // Preserve newlines within multi-line comments to maintain line structure
        if (input[i] === '\n') {
          result += '\n';
        }
        i++;
      }
      
      // If we didn't find a closing */, we've consumed the rest of the string
      if (!foundClosing) {
        break;
      }
      continue;
    }

    // Regular character - add to result
    result += currentChar;
    i++;
  }

  return result;
}

/**
 * Utility function to check if a line is entirely whitespace after comment removal
 * This can be useful for further processing
 */
export function isEmptyLine(line: string): boolean {
  return line.trim().length === 0;
}

/**
 * Removes empty lines from the stripped code while preserving structure
 * @param strippedCode - Code with comments already removed
 * @returns Code with empty lines collapsed but structure preserved
 */
export function removeEmptyLines(strippedCode: string): string {
  return strippedCode
    .split('\n')
    .filter(line => !isEmptyLine(line))
    .join('\n');
}

/**
 * Complete preprocessing function that strips comments and optionally removes empty lines
 * @param input - Raw SyndrQL code
 * @param removeEmpty - Whether to also remove empty lines (default: false)
 * @returns Processed code string
 */
export function preprocessSyndrQL(input: string, removeEmpty: boolean = false): string {
  const stripped = stripComments(input);
  return removeEmpty ? removeEmptyLines(stripped) : stripped;
}

/**
 * Splits SyndrQL code into complete statements
 * 
 * A statement is considered complete when it ends with a semicolon that is not
 * inside quoted strings. Whitespace, line breaks, and carriage returns are ignored
 * for statement boundaries.
 * 
 * Handles:
 * - Single quotes: 'SELECT * FROM "table;name";'
 * - Double quotes: "SELECT * FROM 'table;name';"
 * - Escaped quotes: 'Don\'t break on this;'
 * - Mixed quotes: "She said 'Hello;' to me";
 * - Multi-line statements with whitespace normalization
 * 
 * @param input - The SyndrQL code string (should be comment-cleaned)
 * @returns Array of complete statement strings
 */
export function splitIntoStatements(input: string): string[] {
  if (!input || typeof input !== 'string') {
    return [];
  }

  const statements: string[] = [];
  let currentStatement = '';
  let i = 0;
  const length = input.length;
  let inSingleQuotes = false;
  let inDoubleQuotes = false;

  while (i < length) {
    const currentChar = input[i];
    const nextChar = i + 1 < length ? input[i + 1] : '';

    // Handle escape sequences in strings
    if ((inSingleQuotes || inDoubleQuotes) && currentChar === '\\' && nextChar) {
      // Add both the escape character and the escaped character
      currentStatement += currentChar + nextChar;
      i += 2;
      continue;
    }

    // Handle single quotes
    if (currentChar === "'" && !inDoubleQuotes) {
      inSingleQuotes = !inSingleQuotes;
      currentStatement += currentChar;
      i++;
      continue;
    }

    // Handle double quotes
    if (currentChar === '"' && !inSingleQuotes) {
      inDoubleQuotes = !inDoubleQuotes;
      currentStatement += currentChar;
      i++;
      continue;
    }

    // Check for statement-terminating semicolon
    if (currentChar === ';' && !inSingleQuotes && !inDoubleQuotes) {
      // End of statement - add semicolon and finalize
      currentStatement += currentChar;
      
      // Trim whitespace but preserve the structure
      const trimmedStatement = currentStatement.trim();
      if (trimmedStatement.length > 0) {
        statements.push(trimmedStatement);
      }
      
      // Reset for next statement
      currentStatement = '';
      i++;
      continue;
    }

    // Regular character - add to current statement
    currentStatement += currentChar;
    i++;
  }

  // Handle any remaining statement (without semicolon)
  const finalStatement = currentStatement.trim();
  if (finalStatement.length > 0) {
    statements.push(finalStatement);
  }

  return statements;
}

/**
 * Complete parsing pipeline: strips comments and splits into statements
 * @param input - Raw SyndrQL code from editor
 * @returns Array of clean, complete statement strings
 */
export function parseSyndrQLStatements(input: string): string[] {
  const cleanedCode = stripComments(input);
  return splitIntoStatements(cleanedCode);
}

/**
 * Utility function to check if a statement appears to be complete
 * (i.e., ends with a semicolon)
 * @param statement - A statement string
 * @returns True if the statement ends with a semicolon
 */
export function isCompleteStatement(statement: string): boolean {
  return statement.trim().endsWith(';');
}
