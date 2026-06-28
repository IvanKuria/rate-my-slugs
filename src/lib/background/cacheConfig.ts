/**
 * Shared cache freshness configuration for the background caches.
 */

import { getSettings } from '@/lib/storage/settings';

export const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const DEFAULT_CACHE_DURATION_DAYS = 7;

/**
 * Resolves the cache freshness window (in ms) from the user's cacheDurationDays
 * setting, falling back to 7 days if missing/invalid.
 */
export async function getCacheDurationMs(): Promise<number> {
  let days = DEFAULT_CACHE_DURATION_DAYS;
  try {
    const settings = await getSettings();
    const candidate = Number(settings?.cacheDurationDays);
    if (Number.isFinite(candidate) && candidate > 0) {
      days = candidate;
    }
  } catch {
    // Fall back to default on any settings read failure.
  }
  return days * MS_PER_DAY;
}
