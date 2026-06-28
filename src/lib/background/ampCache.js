/**
 * @file ampCache.js
 * Handles all data fetching and caching for the
 * UCSC Campus Directory.
 */

import { getSettings } from "@/lib/storage/settings";

// --- Constants ---
const CAMPUS_DIRECTORY_BASE_URL = "https://campusdirectory.ucsc.edu/api/uid/";
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_CACHE_DURATION_DAYS = 7;

/**
 * Resolves the cache freshness window (in ms) from the user's
 * cacheDurationDays setting, falling back to 7 days if missing/invalid.
 */
async function getCacheDurationMs() {
  let days = DEFAULT_CACHE_DURATION_DAYS;
  try {
    const settings = await getSettings();
    const candidate = Number(settings?.cacheDurationDays);
    if (Number.isFinite(candidate) && candidate > 0) {
      days = candidate;
    }
  } catch {
    // Fall back to default on any settings read failure
  }
  return days * MS_PER_DAY;
}

/**
 * Fetches profile data directly from the campus directory API.
 */
async function fetchProfileFromAPI(uID) {
  const response = await fetch(`${CAMPUS_DIRECTORY_BASE_URL}${uID}`);

  if (!response.ok) {
    throw new Error(
      `Campus directory request failed with status ${response.status}`,
    );
  }

  const data = await response.json();
  if (!data) {
    throw new Error("Campus directory returned empty payload");
  }

  return data;
}

/**
 * A cached wrapper for the campus directory API.
 * Checks local storage for fresh data before fetching.
 */
export async function fetchCachedCampusDirectoryProfile(uID) {
  if (!uID) {
    return { data: null, success: false };
  }

  const storageKey = `amp_${uID}`;
  try {
    const cache = await chrome.storage.local.get([storageKey]);
    const cachedEntry = cache[storageKey];
    const now = Date.now();
    const cacheDurationMs = await getCacheDurationMs();

    if (cachedEntry && now - cachedEntry.timestamp < cacheDurationMs) {
      return cachedEntry.data;
    }

    const apiData = await fetchProfileFromAPI(uID);

    const apiResponse = { data: apiData, success: true };

    await chrome.storage.local.set({
      [storageKey]: {
        data: apiResponse,
        timestamp: Date.now(),
      },
    });

    return apiResponse;
  } catch (error) {
    console.error(
      `Failed to fetch campus directory profile for ${uID}:`,
      error.message,
    );
    await chrome.storage.local.remove(storageKey).catch(() => {});
    return { data: null, success: false };
  }
}
