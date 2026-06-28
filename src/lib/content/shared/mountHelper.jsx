import React from 'react';
import { createRoot } from 'react-dom/client';

/**
 * Creates a mount point element inside a parent and adds positioning class.
 */
export function createMountPoint(parent, className = "rms-professor-root") {
  const mount = document.createElement("span");
  mount.className = className;
  parent.appendChild(mount);
  return mount;
}

/**
 * Placeholder / non-resolvable instructor names that should never be resolved
 * or fetched. Matched case-insensitively against the trimmed name.
 */
const PLACEHOLDER_NAMES = new Set([
  "staff",
  "tba",
  "to be announced",
  "to be determined",
  "instructor tbd",
]);

/**
 * Returns true when a name is empty/whitespace or a known placeholder
 * (e.g. "Staff", "TBA", "To Be Determined"). Such names must not be fetched.
 */
export function isPlaceholderName(name) {
  if (!name) return true;
  const normalized = String(name).trim().toLowerCase();
  if (!normalized) return true;
  return PLACEHOLDER_NAMES.has(normalized);
}

/**
 * Renders a React component into a mount point.
 *
 * Reuses a single React root per mount element (stashed on `mount.__rmsRoot`).
 * Page modules call this twice on the same mount — once for the loading
 * skeleton and once with real data — so creating a fresh root each time would
 * trigger React 18's "container already passed to createRoot" warning and leak
 * the first root. Reusing the stashed root avoids both.
 */
export function renderComponent(mount, Component, props) {
  let root = mount.__rmsRoot;
  if (!root) {
    root = createRoot(mount);
    mount.__rmsRoot = root;
  }
  root.render(
    <React.StrictMode>
      <Component {...props} />
    </React.StrictMode>
  );
  return root;
}

/**
 * Unmounts the React root associated with a mount element (if any) and clears
 * the stash, so the element can be removed without leaking its root. Call this
 * instead of bare `mount.remove()` whenever a mount is torn down.
 */
export function unmountComponent(mount) {
  const root = mount && mount.__rmsRoot;
  if (root) {
    root.unmount();
    delete mount.__rmsRoot;
  }
}

/**
 * Sets up a MutationObserver with debounce that calls callback
 * when new elements matching the selector appear.
 */
export function setupObserver(selector, callback, debounceMs = 150) {
  let timer = null;

  const observer = new MutationObserver((mutations) => {
    let shouldRun = false;
    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        for (const node of mutation.addedNodes) {
          if (
            node.nodeType === Node.ELEMENT_NODE &&
            ((node.matches && node.matches(selector)) ||
              (node.querySelector && node.querySelector(selector)))
          ) {
            shouldRun = true;
            break;
          }
        }
      }
      if (shouldRun) break;
    }

    if (shouldRun) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(callback, debounceMs);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  return observer;
}
