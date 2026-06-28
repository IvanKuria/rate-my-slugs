/**
 * @file campusDirectoryCache.ts
 * Handles all data fetching and caching for the UCSC Campus Directory.
 */

import { getCacheDurationMs } from '@/lib/background/cacheConfig';
import { CAMPUS_CACHE_PREFIX } from '@/lib/constants';
import { logger } from '@/lib/logger';
import type { CampusDirectoryResponse, CampusProfile } from '@/types';

const CAMPUS_DIRECTORY_BASE_URL = 'https://campusdirectory.ucsc.edu/api/uid/';

interface CampusCacheEntry {
  data: CampusDirectoryResponse;
  timestamp: number;
}

/**
 * Fetches profile data directly from the campus directory API.
 */
async function fetchProfileFromAPI(uID: string): Promise<CampusProfile> {
  const response = await fetch(`${CAMPUS_DIRECTORY_BASE_URL}${uID}`);

  if (!response.ok) {
    throw new Error(
      `Campus directory request failed with status ${response.status}`
    );
  }

  const data = (await response.json()) as CampusProfile | null;
  if (!data) {
    throw new Error('Campus directory returned empty payload');
  }

  return data;
}

/**
 * A cached wrapper for the campus directory API.
 * Checks local storage for fresh data before fetching.
 */
export async function fetchCachedCampusDirectoryProfile(
  uID: string | null | undefined
): Promise<CampusDirectoryResponse> {
  if (!uID) {
    return { data: null, success: false };
  }

  const storageKey = `${CAMPUS_CACHE_PREFIX}${uID}`;
  try {
    const cache = await chrome.storage.local.get([storageKey]);
    const cachedEntry = cache[storageKey] as CampusCacheEntry | undefined;
    const now = Date.now();
    const cacheDurationMs = await getCacheDurationMs();

    if (cachedEntry && now - cachedEntry.timestamp < cacheDurationMs) {
      return cachedEntry.data;
    }

    const apiData = await fetchProfileFromAPI(uID);
    const apiResponse: CampusDirectoryResponse = {
      data: apiData,
      success: true,
    };

    await chrome.storage.local.set({
      [storageKey]: {
        data: apiResponse,
        timestamp: Date.now(),
      } satisfies CampusCacheEntry,
    });

    return apiResponse;
  } catch (error) {
    logger.error(
      `Failed to fetch campus directory profile for ${uID}:`,
      error instanceof Error ? error.message : error
    );
    await chrome.storage.local.remove(storageKey).catch(() => {});
    return { data: null, success: false };
  }
}
