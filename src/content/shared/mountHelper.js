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
 * Renders a React component into a mount point.
 */
export function renderComponent(mount, Component, props) {
  const root = createRoot(mount);
  root.render(
    <React.StrictMode>
      <Component {...props} />
    </React.StrictMode>
  );
  return root;
}

/**
 * Sets up a MutationObserver with debounce that calls callback
 * when new elements matching the selector appear.
 */
export function setupObserver(selector, callback, debounceMs = 500) {
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
