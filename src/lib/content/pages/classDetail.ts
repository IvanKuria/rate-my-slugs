import { isPlaceholderName } from '@/lib/content/shared/mountHelper';
import { runRenderPipeline } from '@/lib/content/shared/renderPipeline';
import type { PageConfig } from '@/types';

export const PAGE_CONFIG: PageConfig = {
  // `.PSGROUPBOXWBO` alone is too generic and makes the observer fire on nearly
  // every MyUCSC partial postback. Narrow it to group boxes that actually hold
  // an instructor/meeting field this module scrapes (MTG_INSTR / INSTR_LONG),
  // which is also all we can render against. The SSR_CLSRCH_F_WK class-search
  // container still matches on its own.
  // ASSUMPTION (needs live verification): class-detail group boxes contain an
  // MTG_INSTR or INSTR_LONG descendant. Uses :has(), supported in modern Chrome.
  panelSelector:
    '[id*="SSR_CLSRCH_F_WK"], .PSGROUPBOXWBO:has([id*="MTG_INSTR"]), .PSGROUPBOXWBO:has([id*="INSTR_LONG"])',
  processedClass: 'rms-processed',
};

/**
 * Extracts professor name from a class detail panel.
 * Looks for MTG_INSTR elements or text matching "Instructor(s):".
 */
export function extractProfName(panel: Element): string | null {
  // Try MTG_INSTR elements first (common in class detail views)
  const instrEl = panel.querySelector('[id*="MTG_INSTR"]');
  if (instrEl) {
    const name = instrEl.textContent?.trim();
    if (name && !isPlaceholderName(name)) return name;
  }

  // Try looking for "Instructor(s):" label pattern
  const allText = (panel as HTMLElement).innerText || '';
  const instructorMatch = allText.match(/Instructor[s]?:\s*([^\n\r]+)/i);
  if (instructorMatch && instructorMatch[1]) {
    const name = instructorMatch[1].trim();
    if (name && !isPlaceholderName(name)) return name;
  }

  // Try INSTR_LONG elements
  const instrLong = panel.querySelector('[id*="INSTR_LONG"]');
  if (instrLong) {
    const name = instrLong.textContent?.trim();
    if (name && !isPlaceholderName(name)) return name;
  }

  return null;
}

/**
 * Extracts course code from a class detail panel.
 */
function extractCourseCode(panel: Element): string | null {
  // Try common class detail title patterns
  const titleEl =
    panel.querySelector('[id*="DERIVED_CLSRCH_DESCR200"]') ||
    panel.querySelector('.PAGROUPDIVIDER') ||
    panel.querySelector('h2, h3');
  if (titleEl) {
    const match = titleEl.textContent
      ?.trim()
      .match(/([A-Z]{2,5})\s+(\d+[A-Z]?)/);
    if (match) return `${match[1]} ${match[2]}`;
  }

  // Fallback: scan panel text
  const rowMatch = panel.textContent?.match(/([A-Z]{2,5})\s+(\d+[A-Z]?)/);
  if (rowMatch) return `${rowMatch[1]} ${rowMatch[2]}`;

  return null;
}

/**
 * Returns the DOM element to mount the component into.
 * Mounts near the instructor element when possible.
 */
export function getMountTarget(panel: Element): Element {
  return (
    panel.querySelector('[id*="MTG_INSTR"]') ||
    panel.querySelector('[id*="INSTR_LONG"]') ||
    panel
  );
}

export function renderPage(): Promise<void> {
  return runRenderPipeline({
    config: PAGE_CONFIG,
    extractProfName,
    getMountTarget,
    extractCourseCode,
  });
}
