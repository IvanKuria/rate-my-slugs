import { isPlaceholderName } from '@/lib/content/shared/mountHelper';
import {
  runRenderPipeline,
  reformatInitialLast,
} from '@/lib/content/shared/renderPipeline';
import type { PageConfig } from '@/types';

export const PAGE_CONFIG: PageConfig = {
  panelSelector: '[id^="trSTDNT_ENRL_SSVW$0_row"]',
  processedClass: 'rms-processed',
};

/**
 * Extracts professor name from an enrolled class row.
 * Similar to shopping cart but may have different element IDs.
 */
export function extractProfName(panel: Element): string | null {
  const nameBox =
    panel.querySelector('[id^="win0divDERIVED_REGFRM1_SSR_INSTR_LONG$"]') ||
    panel.querySelector('[id*="INSTR_LONG"]');
  if (!nameBox) return null;

  const name = (nameBox as HTMLElement).outerText?.trim();
  if (!name || isPlaceholderName(name)) return null;

  return reformatInitialLast(name);
}

export function getMountTarget(panel: Element): Element {
  return panel.querySelector('[id*="INSTR_LONG"]') || panel;
}

export function renderPage(): Promise<void> {
  return runRenderPipeline({
    config: PAGE_CONFIG,
    extractProfName,
    getMountTarget,
    panelClass: 'prof-cart-panel',
  });
}
