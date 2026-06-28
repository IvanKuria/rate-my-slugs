import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import '@/assets/tailwind.css';
import '@/assets/styles.css';
import { useTheme } from '@/lib/hooks/useTheme';
import ProfessorPanel from '@/components/professor/ProfessorPanel';
import { Settings } from 'lucide-react';

/**
 * chrome.storage.session keys used for MV3-resilient handoff/hydration.
 * - lastDisplayedProfessor: last professor the panel actually rendered, so it
 *   reappears after a worker eviction or panel reopen instead of empty state.
 */
const LAST_DISPLAYED_KEY = 'lastDisplayedProfessor';

/**
 * Best-effort lookup of the active tab id so the panel can request a
 * tab-scoped pending payload. Returns undefined if unavailable — the worker
 * falls back to the generic `pendingProfessor_latest` key in that case.
 * @returns {Promise<number|undefined>}
 */
async function getActiveTabId() {
  try {
    const [activeTab] = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });
    return activeTab?.id;
  } catch {
    return undefined;
  }
}

function SidePanel() {
  const [professorData, setProfessorData] = useState(null);
  useTheme();

  /**
   * Display a professor and persist it for cross-eviction recovery.
   * Centralizes state + storage so every code path stays consistent.
   */
  const displayProfessor = useCallback((data) => {
    if (!data) return;
    setProfessorData(data);
    try {
      chrome.storage.session.set({ [LAST_DISPLAYED_KEY]: data });
    } catch {
      // storage.session unavailable — non-fatal, UX state only.
    }
  }, []);

  useEffect(() => {
    // (a) Fast-path push from the background worker.
    const listener = (message) => {
      if (message?.action === 'displayProfessor') {
        displayProfessor(message.data);
      }
    };
    chrome.runtime.onMessage.addListener(listener);

    // (b) Durable pull on mount: the push above is often missed on a cold
    // panel load (listener not yet registered) or after a worker restart.
    let cancelled = false;

    const hydrate = async () => {
      // 1) Ask the worker for any pending professor (and let it clear it).
      try {
        const tab = await getActiveTabId();
        const res = await chrome.runtime.sendMessage({
          action: 'panelReady',
          tabId: tab,
        });
        if (cancelled) return;
        if (res?.data) {
          displayProfessor(res.data);
          return;
        }
      } catch {
        // Worker may be spinning up; fall through to storage reads.
      }

      // 2) Direct read of the pending payload as a backup path.
      try {
        const stored = await chrome.storage.session.get('pendingProfessor_latest');
        const pending = stored?.pendingProfessor_latest?.data ?? null;
        if (cancelled) return;
        if (pending) {
          await chrome.storage.session.remove('pendingProfessor_latest');
          displayProfessor(pending);
          return;
        }
      } catch {
        // ignore
      }

      // 3) Nothing pending — hydrate the last-viewed professor so the panel
      // recovers from an eviction/reopen instead of showing empty state.
      try {
        const stored = await chrome.storage.session.get(LAST_DISPLAYED_KEY);
        const last = stored?.[LAST_DISPLAYED_KEY] ?? null;
        if (cancelled) return;
        if (last) setProfessorData(last);
      } catch {
        // ignore
      }
    };

    hydrate();

    return () => {
      cancelled = true;
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, [displayProfessor]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {professorData ? (
        <ProfessorPanel {...professorData} />
      ) : (
        <EmptyState />
      )}
    </div>
  );
}

function EmptyState() {
  const slugUrl = typeof chrome !== 'undefined' && chrome.runtime?.getURL
    ? chrome.runtime.getURL('icons/sammy/sammy-128.jpg')
    : null;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
      {slugUrl && (
        <img
          src={slugUrl}
          alt="Sammy the Slug"
          className="w-20 h-20 rounded-full mb-6 opacity-60"
        />
      )}
      <h2 className="text-lg font-semibold text-foreground mb-2">
        Rate My Slugs
      </h2>
      <p className="text-sm text-muted-foreground max-w-[240px]">
        Click a professor's rating bar on your enrollment page to view their details here.
      </p>
      <button
        onClick={() => chrome.runtime.openOptionsPage()}
        className="mt-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Settings className="h-3.5 w-3.5" />
        Settings
      </button>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SidePanel />
  </React.StrictMode>
);
