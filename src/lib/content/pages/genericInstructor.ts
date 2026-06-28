import { isPlaceholderName } from '@/lib/content/shared/mountHelper';
import { runRenderPipeline } from '@/lib/content/shared/renderPipeline';
import type { PageConfig } from '@/types';

export const PAGE_CONFIG: PageConfig = {
  panelSelector: '[id*="INSTR_LONG"], [id*="MTG_INSTR"]',
  processedClass: 'rms-processed',
};

/**
 * Extracts professor name directly from the instructor element.
 * This is a catch-all module for pages with instructor elements
 * that don't match the more specific page modules.
 */
export function extractProfName(panel: Element): string | null {
  const name = panel.textContent?.trim();
  if (!name || isPlaceholderName(name) || name.length < 2) return null;
  return name;
}

/**
 * Returns the DOM element to mount the component into.
 * Since the panel IS the instructor element, mount directly on it.
 */
export function getMountTarget(panel: Element): Element {
  return panel;
}

export function renderPage(): Promise<void> {
  return runRenderPipeline({
    config: PAGE_CONFIG,
    extractProfName,
    getMountTarget,
  });
}
