/**
 * @file background.js
 * WXT background service worker entrypoint.
 * Thin message router for the extension.
 * Delegates to lib modules for all data fetching.
 */

import { fetchCachedCampusDirectoryProfile } from '@/lib/background/ampCache';
import {
  fetchCachedRateMyProfessorData,
  selectBestRmpMatch,
  fetchProfessorReviews,
} from '@/lib/background/rmpCache';

export default defineBackground(() => {
  // Handle extension install and updates
  chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
      // First time install - open welcome page
      chrome.tabs.create({
        url: chrome.runtime.getURL('/welcome.html'),
      });
    } else if (details.reason === 'update') {
      // Extension was updated - open what's new page
      const previousVersion = details.previousVersion;
      const currentVersion = chrome.runtime.getManifest().version;

      // Only show for major/minor updates, not patches (optional)
      // You can remove this check to show for all updates
      chrome.tabs.create({
        url: chrome.runtime.getURL(`/whats-new.html?from=${previousVersion}&to=${currentVersion}`),
      });
    }
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Route 1: Main action — fetch campus + RMP data in parallel
    if (message?.action === 'fetchProfessorData') {
      (async () => {
        try {
          // When ID is provided, fetch both campus + RMP; otherwise RMP-only
          const hasUID = message.ID && message.ID !== 'jdoe';
          const rmpCacheKey = hasUID ? message.ID : `name_${message.name}`;

          const [campusResponse, rmpEdges] = await Promise.all([
            hasUID
              ? fetchCachedCampusDirectoryProfile(message.ID)
              : Promise.resolve({ data: null, success: false }),
            fetchCachedRateMyProfessorData(
              rmpCacheKey,
              message.name,
              message.rateMyProfSchoolId
            ),
          ]);

          const campusData = campusResponse?.data ?? null;
          const campusSuccess =
            typeof campusResponse?.success === 'boolean'
              ? campusResponse.success
              : Boolean(campusData);

          const rateMyProfessorNode = selectBestRmpMatch(rmpEdges, message.name);

          // Fetch reviews if we found an RMP match
          let reviews = [];
          if (rateMyProfessorNode?.legacyId && rateMyProfessorNode?.numRatings > 0) {
            try {
              const reviewLimit = Math.min(rateMyProfessorNode.numRatings, 50);
              reviews = await fetchProfessorReviews(
                rateMyProfessorNode.legacyId,
                reviewLimit
              );
            } catch (err) {
              console.error('Error fetching reviews:', err);
            }
          }

          sendResponse({
            data: campusData,
            campusSuccess,
            rateMyProfessor: rateMyProfessorNode,
            reviews,
          });
        } catch (error) {
          console.error('Error fetching professor data', error);
          sendResponse({ error: error.message });
        }
      })();

      return true;
    }

    // Route 2: Legacy — campus data only
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

    // Route 3: Clear cache
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
