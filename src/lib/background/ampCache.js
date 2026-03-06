/**
 * @file ampCache.js
 * Handles all data fetching and caching for the
 * UCSC Campus Directory.
 */

// --- Constants ---
const CAMPUS_DIRECTORY_BASE_URL = "https://campusdirectory.ucsc.edu/api/uid/";
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000 * 7; // 1 week

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

    if (cachedEntry && now - cachedEntry.timestamp < CACHE_DURATION_MS) {
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
