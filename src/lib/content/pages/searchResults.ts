import { isPlaceholderName } from '@/lib/content/shared/mountHelper';
import { runRenderPipeline } from '@/lib/content/shared/renderPipeline';
import type { PageConfig } from '@/types';

export const PAGE_CONFIG: PageConfig = {
  panelSelector: '.panel.panel-default',
  processedClass: 'rms-processed',
};

/**
 * Extracts professor name from a search results panel.
 */
export function extractProfName(panel: Element): string | null {
  // Try structured divs first
  const profDivs = panel.querySelectorAll('div.col-xs-6.col-sm-3 div');
  for (const div of profDivs) {
    const text = div.textContent?.trim() ?? '';
    if (text.includes('Instructor:')) {
      const name = text.replace('Instructor:', '').trim();
      if (name && !isPlaceholderName(name)) return name;
    }
  }

  // Fallback: regex on full panel text
  const re = /Instructor[s]?:\s*([\w,.'-]+)/i;
  const text = (panel as HTMLElement).innerText;
  const res = text.match(re);
  if (res && res[1] && !isPlaceholderName(res[1])) return res[1];

  return null;
}

/**
 * Extracts course code (e.g., "CSE 101") from a panel.
 */
function extractCourseCode(panel: Element): string | null {
  const titleElements = panel.querySelectorAll(
    "h3, h2, .course-title, [class*='title']"
  );
  for (const el of titleElements) {
    const match = el.textContent?.trim().match(/([A-Z]{2,5})\s+(\d+[A-Z]?)/);
    if (match) return `${match[1]} ${match[2]}`;
  }
  const rowMatch = panel.textContent?.match(/([A-Z]{2,5})\s+(\d+[A-Z]?)/);
  if (rowMatch) return `${rowMatch[1]} ${rowMatch[2]}`;
  return null;
}

/**
 * Returns the DOM element to mount the component into.
 */
export function getMountTarget(panel: Element): Element {
  return panel;
}

export function renderPage(): Promise<void> {
  return runRenderPipeline({
    config: PAGE_CONFIG,
    extractProfName,
    getMountTarget,
    extractCourseCode,
    panelClass: 'prof-panel-relative',
  });
}
