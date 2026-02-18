/**
 * SyndrQL Compiler — IR → SyndrQL text (client-side).
 * Full Phase 1 implements exhaustive switch on statementType; this stub allows the pipeline to run.
 */

import type { AIAssistantResponse } from './ai-ir-schema.js';

/**
 * Compile AI response (IR) to SyndrQL string. Stub: if a statement has .text or .syndrql use it, else placeholder.
 */
export function compileAIResponse(response: AIAssistantResponse): string {
  if (!response?.statements || !Array.isArray(response.statements)) {
    return '-- No statements in response';
  }
  const lines = response.statements.map((stmt: Record<string, unknown>, i: number) => {
    const text = (stmt.text ?? stmt.syndrql) as string | undefined;
    if (typeof text === 'string' && text.trim()) {
      return text.trim().endsWith(';') ? text.trim() : `${text.trim()};`;
    }
    return `-- Statement ${i + 1} (IR compilation not yet implemented)`;
  });
  return lines.join('\n');
}
