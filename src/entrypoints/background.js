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
  const rmpEdges = Array.isArray(rmpResult)
    ? rmpResult
    : (rmpResult?.edges ?? null);
  const didFallback = Array.isArray(rmpResult)
    ? false
    : (rmpResult?.didFallback ?? false);

  const rateMyProfessorNode = selectBestRmpMatch(rmpEdges, name, {
    didFallback,
    schoolId: rateMyProfSchoolId,
  });

  // Normalize "would take again" at the source. RMP returns -1 when unknown;
  // treat any negative value as "no data" so all downstream displays agree.
  if (
    rateMyProfessorNode &&
    typeof rateMyProfessorNode.wouldTakeAgainPercentRounded === 'number' &&
    rateMyProfessorNode.wouldTakeAgainPercentRounded < 0
  ) {
    rateMyProfessorNode.wouldTakeAgainPercentRounded = null;
  }

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

    // Route 2: Show professor in the side panel.
    //
    // Inverted, durable handshake: the payload is persisted to
    // chrome.storage.session BEFORE opening the panel, so it survives a cold
    // panel load or an evicted worker. The push below is only a fast path —
    // storage is the source of truth, and the panel pulls it on mount via the
    // 'panelReady' route (Route 4) and/or by reading storage directly.
    if (message?.action === 'showProfessor') {
      const tabId = sender?.tab?.id;

      // CRITICAL: chrome.sidePanel.open() may only be called in response to a
      // user gesture. The content-script "Details" click propagates that
      // gesture through this message, but ONLY if open() is invoked
      // synchronously here — any preceding `await` consumes the gesture and the
      // call throws. So open FIRST, then persist + push (the durable handshake
      // still works: the panel pulls from storage / via 'panelReady' on mount).
      let openPromise;
      if (typeof tabId === 'number') {
        openPromise = chrome.sidePanel.open({ tabId });
      } else {
        // No tab on the sender (non-content-script caller). Best-effort; this
        // path has no user-gesture guarantee and may be rejected by Chrome.
        openPromise = chrome.windows
          .getCurrent()
          .then((win) => chrome.sidePanel.open({ windowId: win?.id }));
      }

      (async () => {
        try {
          await openPromise;

          // Persist the pending payload: a tab-scoped key plus a generic
          // fallback the panel can always read even without a tab id.
          const pending = { data: message.data, savedAt: Date.now() };
          const toStore = { pendingProfessor_latest: pending };
          if (typeof tabId === 'number') {
            toStore[`pendingProfessor_${tabId}`] = pending;
          }
          await chrome.storage.session.set(toStore);

          // Fast-path push — no longer the source of truth. A single attempt
          // is enough; the panel recovers from storage if this misses.
          let sent = false;
          try {
            await chrome.runtime.sendMessage({
              action: 'displayProfessor',
              data: message.data,
            });
            sent = true;
          } catch {
            // Panel not listening yet; it will pull from storage on mount.
          }

          sendResponse({ status: 'success', pushed: sent });
        } catch (error) {
          console.error('Error opening side panel:', error);
          sendResponse({ status: 'error', error: error.message });
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

    // Route 4: Panel handshake — the side panel announces it has mounted and
    // asks for any pending professor payload. The panel has no tab id of its
    // own, so we serve the generic `pendingProfessor_latest` key (or a
    // tab-scoped key if the panel was able to supply one). After delivering,
    // the pending keys are cleared so a future cold open does not replay a
    // stale professor.
    if (message?.action === 'panelReady') {
      (async () => {
        try {
          const tabId = message?.tabId;
          const keys =
            typeof tabId === 'number'
              ? [`pendingProfessor_${tabId}`, 'pendingProfessor_latest']
              : ['pendingProfessor_latest'];

          const stored = await chrome.storage.session.get(keys);
          const pending =
            (typeof tabId === 'number' &&
              stored[`pendingProfessor_${tabId}`]) ||
            stored.pendingProfessor_latest ||
            null;

          // Clear delivered pending payloads so they are not replayed later.
          const clearKeys = ['pendingProfessor_latest'];
          if (typeof tabId === 'number') {
            clearKeys.push(`pendingProfessor_${tabId}`);
          }
          await chrome.storage.session.remove(clearKeys);

          sendResponse({ status: 'success', data: pending?.data ?? null });
        } catch (error) {
          console.error('Error handling panelReady:', error);
          sendResponse({ status: 'error', error: error.message, data: null });
        }
      })();

      return true;
    }

    return false;
  });
});
