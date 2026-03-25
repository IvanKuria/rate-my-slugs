/**
 * @file background.js
 * WXT background service worker entrypoint.
 * Thin message router for the extension.
 * Delegates to lib modules for all data fetching.
 * Supports side panel architecture for professor detail views.
 */

import { fetchCachedCampusDirectoryProfile } from '@/lib/background/ampCache';
import {
  fetchCachedRateMyProfessorData,
  selectBestRmpMatch,
  fetchProfessorReviews,
} from '@/lib/background/rmpCache';
import { getSettings } from '@/lib/storage/settings';

/**
 * Core professor data fetch logic shared by single and batch routes.
 * Returns { data, campusSuccess, rateMyProfessor, reviews }.
 */
async function fetchProfessorBundle(name, ID, rateMyProfSchoolId) {
  const hasUID = ID && ID !== 'jdoe';
  const rmpCacheKey = hasUID ? ID : `name_${name}`;

  const [campusResponse, rmpResult] = await Promise.all([
    hasUID
      ? fetchCachedCampusDirectoryProfile(ID)
      : Promise.resolve({ data: null, success: false }),
    fetchCachedRateMyProfessorData(rmpCacheKey, name, rateMyProfSchoolId),
  ]);

  const campusData = campusResponse?.data ?? null;
  const campusSuccess =
    typeof campusResponse?.success === 'boolean'
      ? campusResponse.success
      : Boolean(campusData);

  // rmpResult is now { edges, didFallback } or legacy array format
  const rmpEdges = Array.isArray(rmpResult) ? rmpResult : rmpResult?.edges ?? null;
  const didFallback = Array.isArray(rmpResult) ? false : rmpResult?.didFallback ?? false;

  const rateMyProfessorNode = selectBestRmpMatch(rmpEdges, name, {
    didFallback,
    schoolId: rateMyProfSchoolId,
  });

  // Fetch reviews if we found an RMP match
  let reviews = [];
  if (rateMyProfessorNode?.legacyId && rateMyProfessorNode?.numRatings > 0) {
    try {
      const settings = await getSettings();
      const reviewLimit = Math.min(
        rateMyProfessorNode.numRatings,
        settings.maxReviews ?? 50
      );
      reviews = await fetchProfessorReviews(
        rateMyProfessorNode.legacyId,
        reviewLimit
      );
    } catch (err) {
      console.error('Error fetching reviews:', err);
    }
  }

  return {
    data: campusData,
    campusSuccess,
    rateMyProfessor: rateMyProfessorNode,
    reviews,
  };
}

export default defineBackground(() => {
  // Open the side panel when the extension icon is clicked
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Route 1: Main action — fetch campus + RMP data in parallel
    if (message?.action === 'fetchProfessorData') {
      (async () => {
        try {
          const result = await fetchProfessorBundle(
            message.name,
            message.ID,
            message.rateMyProfSchoolId
          );
          sendResponse(result);
        } catch (error) {
          console.error('Error fetching professor data', error);
          sendResponse({ error: error.message });
        }
      })();

      return true;
    }

    // Route 2: Show professor in the side panel
    if (message?.action === 'showProfessor') {
      (async () => {
        try {
          // Open the side panel for the sender's tab
          await chrome.sidePanel.open({ tabId: sender.tab.id });

          // Retry sending until the side panel is listening
          let sent = false;
          for (let i = 0; i < 10 && !sent; i++) {
            try {
              await chrome.runtime.sendMessage({
                action: 'displayProfessor',
                data: message.data,
              });
              sent = true;
            } catch {
              await new Promise((r) => setTimeout(r, 50));
            }
          }

          sendResponse({ status: sent ? 'success' : 'timeout' });
        } catch (error) {
          console.error('Error opening side panel:', error);
          sendResponse({ status: 'error', error: error.message });
        }
      })();

      return true;
    }

    // Route 3: Batch fetch multiple professors in parallel
    if (message?.action === 'batchFetchProfessors') {
      (async () => {
        try {
          const professors = message.professors ?? [];
          const settings = await getSettings();
          const rateMyProfSchoolId = message.rateMyProfSchoolId;

          const results = await Promise.all(
            professors.map(async (prof) => {
              try {
                const result = await fetchProfessorBundle(
                  prof.name,
                  prof.uID,
                  rateMyProfSchoolId
                );
                return { name: prof.name, ...result };
              } catch (err) {
                console.error(`Error fetching data for ${prof.name}:`, err);
                return {
                  name: prof.name,
                  data: null,
                  campusSuccess: false,
                  rateMyProfessor: null,
                  reviews: [],
                  error: err.message,
                };
              }
            })
          );

          // Key the results by professor name
          const resultsByName = {};
          for (const result of results) {
            resultsByName[result.name] = result;
          }

          sendResponse({ status: 'success', professors: resultsByName });
        } catch (error) {
          console.error('Error in batch fetch:', error);
          sendResponse({ status: 'error', error: error.message });
        }
      })();

      return true;
    }

    // Route 4: Legacy — campus data only
    if (message?.ID && !message?.action) {
      (async () => {
        try {
          const campusResponse = await fetchCachedCampusDirectoryProfile(message.ID);
          sendResponse(campusResponse);
        } catch (error) {
          console.error(`Failed to fetch profile for ${message.ID}`, error);
          sendResponse({ data: null, success: false });
        }
      })();

      return true;
    }

    // Route 5: Clear cache
    if (message?.action === 'clearCache') {
      (async () => {
        try {
          const allData = await chrome.storage.local.get();
          const cacheKeys = Object.keys(allData).filter(
            (key) =>
              key.startsWith('rmp_') ||
              key.startsWith('amp_') ||
              key.startsWith('cache_')
          );
          if (cacheKeys.length > 0) {
            await chrome.storage.local.remove(cacheKeys);
          }
          sendResponse({ status: 'success', cleared: cacheKeys.length });
        } catch (error) {
          sendResponse({ status: 'error', error: error.message });
        }
      })();

      return true;
    }

    return false;
  });
});
