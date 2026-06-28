import {
  getUIDFromJson,
  fetchProfessorData,
  fetchLocalResearchData,
  fetchLocalClassesData,
} from '@/lib/content/shared/professorResolver';
import {
  createMountPoint,
  renderComponent,
  unmountComponent,
  isPlaceholderName,
} from '@/lib/content/shared/mountHelper';
import { getFirst } from '@/lib/format';
import RatingBar from '@/components/RatingBar';
import type {
  PageConfig,
  ProfessorData,
  ProfessorBundle,
  FetchProfessorDataResponse,
  CampusProfile,
  RmpTeacherNode,
  RmpReview,
} from '@/types';

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

/**
 * Full render pipeline for class detail pages.
 * Phase 1: Immediately render loading skeletons for all panels.
 * Phase 2: Fetch data and update with actual ratings.
 */
export async function renderPage(): Promise<void> {
  const panels = document.querySelectorAll(PAGE_CONFIG.panelSelector);
  if (!panels.length) return;

  // Phase 1: Immediately render loading skeletons
  const mounts: {
    mount: HTMLSpanElement;
    name: string;
    panel: Element;
    course: string | null;
  }[] = [];
  for (const panel of panels) {
    if (panel.classList.contains(PAGE_CONFIG.processedClass)) continue;
    if (panel.querySelector('.rms-rating-bar-root')) continue;

    const name = extractProfName(panel);
    if (!name) continue;

    const course = extractCourseCode(panel);
    const target = getMountTarget(panel);
    // Mark the panel processed regardless of fetch outcome, so a not-found
    // professor (whose rating bar is removed below) is never reprocessed.
    panel.classList.add(PAGE_CONFIG.processedClass);
    const mount = createMountPoint(target, 'rms-rating-bar-root');
    renderComponent(mount, RatingBar, { professorData: null, loading: true });
    mounts.push({ mount, name, panel, course });
  }

  if (!mounts.length) return;

  // Phase 2: Fetch data and update
  const [researchTopics, classesTaught] = await Promise.all([
    fetchLocalResearchData(),
    fetchLocalClassesData(),
  ]);

  await Promise.allSettled(
    mounts.map(async ({ mount, name, course }) => {
      const uID = await getUIDFromJson(name);

      let profileDict: FetchProfessorDataResponse | null = null;
      try {
        profileDict = await fetchProfessorData(uID, name);
      } catch (error) {
        // silently continue — error is non-critical
      }

      // Drop the { error } variant; only a successful bundle carries data.
      const bundle: ProfessorBundle | null =
        profileDict && !('error' in profileDict) ? profileDict : null;
      // Some campus payloads nest a { success, data } wrapper under `data`; when
      // the lookup failed, discard it. (Loose shape predating the typed bundle;
      // cast is reconciled in a later phase.)
      if (
        bundle &&
        (bundle.data as { success?: unknown } | null)?.success === false
      ) {
        bundle.data = null;
      }

      let profData: CampusProfile | null = null;
      let rateMyProfessorData: RmpTeacherNode | null = null;
      let reviews: RmpReview[] = [];
      let researchTopicText: string | null = null;
      let classesTaughtList: string[] | null = null;
      let fullName: string | null = null;

      if (bundle) {
        profData = bundle.data;
        rateMyProfessorData = bundle.rateMyProfessor;
        reviews = bundle.reviews || [];
        fullName = getFirst(profData?.cn);
        if (fullName) {
          researchTopicText = researchTopics[fullName];
          classesTaughtList = classesTaught[fullName];
        }
      }

      if (
        !profData &&
        !rateMyProfessorData &&
        !researchTopicText &&
        !classesTaughtList
      ) {
        unmountComponent(mount);
        mount.remove();
        return;
      }

      const professorData: ProfessorData = {
        apiData: profData,
        rateMyProfessor: rateMyProfessorData,
        reviews,
        localResearchTopic: researchTopicText,
        localClassesTaught: classesTaughtList,
        instructorName: name,
        course,
      };
      renderComponent(mount, RatingBar, { professorData, loading: false });
    })
  );
}
