/**
 * @file content.ts
 * WXT content script entrypoint.
 * Injects into UCSC enrollment pages and renders professor rating UI.
 *
 * Runs at document_start for earlier rendering. CSS is injected via manifest
 * into the host page (all classes are rms- prefixed to avoid collisions).
 */

import '@/assets/rating-bar.css';
import { detectPageType } from '@/lib/content/shared/pageDetector';
import { setupObserver } from '@/lib/content/shared/mountHelper';
import { preloadData } from '@/lib/content/shared/professorResolver';
import type { PageType, PageModule } from '@/types';

/**
 * Lazy-load only the page module that matches the current page type.
 * Reduces initial parse/eval cost since unused modules are never loaded.
 */
const PAGE_LOADERS: Partial<Record<PageType, () => Promise<PageModule>>> = {
  search: () => import('@/lib/content/pages/searchResults'),
  'cart-shopping': () => import('@/lib/content/pages/shoppingCart'),
  'cart-enrolled': () => import('@/lib/content/pages/enrolledClasses'),
  'class-detail': () => import('@/lib/content/pages/classDetail'),
  'enrollment-confirm': () => import('@/lib/content/pages/classDetail'),
  waitlist: () => import('@/lib/content/pages/shoppingCart'),
  'generic-instructor': () => import('@/lib/content/pages/genericInstructor'),
};

export default defineContentScript({
  matches: ['https://my.ucsc.edu/*', 'https://pisa.ucsc.edu/*'],
  runAt: 'document_start',
  allFrames: true,
  cssInjectionMode: 'manifest',

  async main() {
    /**
     * Activates the correct page module: renders immediately,
     * then sets up a MutationObserver for dynamically added panels.
     */
    async function activate(pageType: PageType) {
      const loader = PAGE_LOADERS[pageType];
      if (!loader) return;

      // Start preloading JSON data concurrently with module load
      preloadData();

      const mod = await loader();
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
      if (pageType && PAGE_LOADERS[pageType]) {
        activate(pageType);
        return true;
      }
      return false;
    }

    /**
     * Watches for panels to appear in the DOM.
     * Once any known panel selector is found, activate and disconnect.
     */
    function waitForPanels() {
      const observer = new MutationObserver(() => {
        const pageType = detectPageType();
        if (pageType && PAGE_LOADERS[pageType]) {
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

    /**
     * Waits for document.body to exist (necessary since we run at document_start).
     */
    function waitForBody(): Promise<void> {
      return new Promise((resolve) => {
        if (document.body) {
          resolve();
          return;
        }

        const observer = new MutationObserver(() => {
          if (document.body) {
            observer.disconnect();
            resolve();
          }
        });

        observer.observe(document.documentElement, {
          childList: true,
        });

        const interval = setInterval(() => {
          if (document.body) {
            clearInterval(interval);
            observer.disconnect();
            resolve();
          }
        }, 10);

        setTimeout(() => {
          clearInterval(interval);
          observer.disconnect();
          resolve();
        }, 10000);
      });
    }

    // ── Entry point ──
    await waitForBody();

    if (!tryInit()) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          if (!tryInit()) waitForPanels();
        });
      } else {
        waitForPanels();
      }
    }
  },
});
