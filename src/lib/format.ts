/**
 * Shared formatting/parsing helpers used across modules.
 */

/**
 * Safely extracts and cleans the first string value from an array or string.
 * Handles the inconsistent array/string format the campus directory returns.
 */
export function getFirst(value: unknown): string | null {
  if (value == null) return null;
  const target = Array.isArray(value) ? value[0] : value;
  if (target == null) return null;
  const cleaned = String(target).trim();
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Safely converts an input value (string or number) into a finite Number.
 * Returns null for "N/A", null, or non-numeric input.
 */
export function toNumber(value: unknown): number | null {
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isFinite(num) ? num : null;
}

/** Rounds a value to the nearest whole integer, or null if invalid. */
export function roundToWhole(value: unknown): number | null {
  const num = toNumber(value);
  return num != null ? Math.round(num) : null;
}

/** Rounds a value to exactly one decimal place, or null if invalid. */
export function roundToOneDecimal(value: unknown): number | null {
  const num = toNumber(value);
  return num != null ? Math.round(num * 10) / 10 : null;
}

/**
 * Formats a number as a string with one decimal place for UI display.
 * Returns "N/A" for falsy values.
 */
export function formatNumber(num: number | null | undefined): string {
  return num ? Number(num).toFixed(1) : 'N/A';
}
