/**
 * AI IR Schema — structured output from the NL→SyndrQL model.
 * Discriminated union of statement types; compiler consumes these.
 * Full Phase 1 expands this to all DDL/DML/DOL/Migration types.
 */

/** Single statement IR (discriminant: statementType). */
export type SyndrQLIR = Record<string, unknown> & { statementType?: string };

/** Model server response wrapper. */
export interface AIAssistantResponse {
  statements: SyndrQLIR[];
  explanation?: string;
  confidence?: number;
}
