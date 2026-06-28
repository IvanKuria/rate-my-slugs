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

/**
 * Full render pipeline for generic instructor pages.
 * Phase 1: Immediately render loading skeletons.
 * Phase 2: Fetch data and update with actual ratings.
 */
export async function renderPage(): Promise<void> {
  const panels = document.querySelectorAll(PAGE_CONFIG.panelSelector);
  if (!panels.length) return;

  // Deduplicate: multiple selectors might match the same element
  const seen = new Set<Element>();
  const uniquePanels: Element[] = [];
  for (const panel of panels) {
    if (seen.has(panel)) continue;
    seen.add(panel);
    uniquePanels.push(panel);
  }

  // Phase 1: Immediately render loading skeletons
  const mounts: { mount: HTMLSpanElement; name: string; panel: Element }[] = [];
  for (const panel of uniquePanels) {
    if (panel.classList.contains(PAGE_CONFIG.processedClass)) continue;
    if (panel.querySelector('.rms-rating-bar-root')) continue;

    const name = extractProfName(panel);
    if (!name) continue;

    const target = getMountTarget(panel);
    // Mark processed regardless of fetch outcome so a not-found instructor is
    // never reprocessed on the next partial postback.
    panel.classList.add(PAGE_CONFIG.processedClass);
    const mount = createMountPoint(target, 'rms-rating-bar-root');
    renderComponent(mount, RatingBar, { professorData: null, loading: true });
    mounts.push({ mount, name, panel });
  }

  if (!mounts.length) return;

  // Phase 2: Fetch data and update
  const [researchTopics, classesTaught] = await Promise.all([
    fetchLocalResearchData(),
    fetchLocalClassesData(),
  ]);

  await Promise.allSettled(
    mounts.map(async ({ mount, name }) => {
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
        course: null,
      };
      renderComponent(mount, RatingBar, { professorData, loading: false });
    })
  );
}
