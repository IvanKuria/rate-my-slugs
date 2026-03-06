/**
 * @file content.js
 * WXT content script entrypoint.
 * Injects into UCSC enrollment pages and renders professor rating UI.
 */

import '@/assets/styles.css';
import { detectPageType } from '@/lib/content/shared/pageDetector';
import { setupObserver } from '@/lib/content/shared/mountHelper';
import * as searchPage from '@/lib/content/pages/searchResults';
import * as cartPage from '@/lib/content/pages/shoppingCart';
import * as enrolledPage from '@/lib/content/pages/enrolledClasses';

const PAGE_MODULES = {
  search: searchPage,
  'cart-shopping': cartPage,
  'cart-enrolled': enrolledPage,
};

export default defineContentScript({
  matches: ['https://my.ucsc.edu/*', 'https://pisa.ucsc.edu/*'],
  runAt: 'document_idle',
  allFrames: true,

  main() {
    /**
     * Activates the correct page module: renders immediately,
     * then sets up a MutationObserver for dynamically added panels.
     */
    function activate(pageType) {
      const mod = PAGE_MODULES[pageType];
      mod.renderPage();
      setupObserver(mod.PAGE_CONFIG.panelSelector, () => {
        mod.renderPage();
      });
    }

    /**
     * Try to detect the page type and activate immediately.
     * Returns true if panels were found, false otherwise.
     */
    function tryInit() {
      const pageType = detectPageType();
      if (pageType && PAGE_MODULES[pageType]) {
        activate(pageType);
        return true;
      }
      return false;
    }

    /**
     * If panels aren't in the DOM yet, watch for them to appear.
     * Once any known panel selector is found, activate and disconnect.
     */
    function waitForPanels() {
      const observer = new MutationObserver(() => {
        const pageType = detectPageType();
        if (pageType && PAGE_MODULES[pageType]) {
          observer.disconnect();
          activate(pageType);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      // Safety: stop waiting after 30s to avoid leaking observers
      setTimeout(() => observer.disconnect(), 30000);
    }

    // ── Entry point ──────────────────────────────────────────────────────────────
    // Try immediately — if the DOM already has panels, render right away.
    // Otherwise, observe until they appear.
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        if (!tryInit()) waitForPanels();
      });
    } else {
      if (!tryInit()) waitForPanels();
    }
  },
});
