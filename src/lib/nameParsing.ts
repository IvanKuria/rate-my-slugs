/**
 * Shared instructor-name parsing.
 *
 * Both the UID resolver (matching scraped names against the "Last,F." JSON
 * keys) and the RMP matcher (deriving the expected first initial) need to pull
 * a last name + first initial out of the two name formats MyUCSC produces:
 *   - "Last,First" / "Last,F." / "Last,F.M."  (comma-separated)
 *   - "First Last"                            (space-separated)
 *
 * This replicates the exact logic both call sites used previously (lowercase,
 * no period-stripping) so the consolidation is behavior-preserving.
 */

export interface ParsedName {
  /** Lowercased last name, or '' if it cannot be determined. */
  last: string;
  /** Lowercased single first initial, or '' if unknown. */
  firstInitial: string;
}

export function parseInstructorName(
  name: string | null | undefined
): ParsedName {
  if (!name) return { last: '', firstInitial: '' };
  const trimmed = name.trim();
  if (!trimmed) return { last: '', firstInitial: '' };

  if (trimmed.includes(',')) {
    const parts = trimmed.split(',');
    if (parts.length >= 2) {
      return {
        last: parts[0].trim().toLowerCase(),
        firstInitial: parts[1].trim().charAt(0).toLowerCase(),
      };
    }
    return { last: '', firstInitial: '' };
  }

  // "First Last": last whitespace token is the last name, the first token's
  // first letter is the initial. A single bare token has no known first initial.
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length >= 2) {
    return {
      last: tokens[tokens.length - 1].toLowerCase(),
      firstInitial: tokens[0].charAt(0).toLowerCase(),
    };
  }
  return { last: '', firstInitial: '' };
}
