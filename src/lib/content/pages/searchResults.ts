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

/**
 * Full render pipeline for the search results page.
 * Phase 1: Immediately render loading skeletons for all panels.
 * Phase 2: Fetch data and update with actual ratings.
 */
export async function renderPage(): Promise<void> {
  const panels = document.querySelectorAll(PAGE_CONFIG.panelSelector);
  if (!panels.length) return;

  // Phase 1: Immediately render loading skeletons for all panels
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
    target.classList.add('prof-panel-relative');
    // Mark processed regardless of fetch outcome so a not-found professor is
    // never reprocessed on the next partial postback.
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

      // Only remove if ALL data sources returned nothing
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

      // Re-render with actual data
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
