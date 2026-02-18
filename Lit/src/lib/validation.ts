/**
 * Shared validation utilities.
 * Single source of truth for identifier rules (e.g. bundle name, database name).
 */

export interface ValidationResult {
  isValid: boolean;
  message: string;
}

/** Regex for valid identifiers: alphanumeric, hyphens, underscores. No spaces or other symbols. */
const VALID_IDENTIFIER_REGEX = /^[a-zA-Z0-9_-]+$/;

/**
 * Validates an identifier (e.g. bundle name, database name).
 * Rules: non-empty after trim; only letters, numbers, hyphens (-), and underscores (_).
 *
 * @param name - The value to validate
 * @param options.entityName - Used in error messages (e.g. "Bundle name", "Database name"). Defaults to "Name".
 */
export function validateIdentifier(
  name: string,
  options?: { entityName?: string }
): ValidationResult {
  const entityName = options?.entityName ?? 'Name';

  if (!name || !name.trim()) {
    return {
      isValid: false,
      message: `${entityName} cannot be empty.`,
    };
  }

  if (!VALID_IDENTIFIER_REGEX.test(name)) {
    return {
      isValid: false,
      message: `${entityName} can only contain letters, numbers, hyphens (-), and underscores (_). No spaces or other symbols allowed.`,
    };
  }

  return { isValid: true, message: '' };
}
