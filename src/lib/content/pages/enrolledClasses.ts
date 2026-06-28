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
  panelSelector: '[id^="trSTDNT_ENRL_SSVW$0_row"]',
  processedClass: 'rms-processed',
};

/**
 * Extracts professor name from an enrolled class row.
 * Similar to shopping cart but may have different element IDs.
 */
export function extractProfName(panel: Element): string | null {
  // Try the instructor long name element
  const nameBox =
    panel.querySelector('[id^="win0divDERIVED_REGFRM1_SSR_INSTR_LONG$"]') ||
    panel.querySelector('[id*="INSTR_LONG"]');
  if (!nameBox) return null;

  const name = (nameBox as HTMLElement).outerText?.trim();
  if (!name || isPlaceholderName(name)) return null;

  // Reformat "J. Doe" -> "Doe,J."
  const reFI = /^([^\s]+)/i;
  const res = name.match(reFI);
  if (!res || !res[1]) return null;

  const firstInitial = res[1];
  const lastName = name.slice(firstInitial.length + 1).trim();
  if (!lastName) return null;

  return `${lastName},${firstInitial}`;
}

export function getMountTarget(panel: Element): Element {
  return panel.querySelector('[id*="INSTR_LONG"]') || panel;
}

/**
 * Full render pipeline for the enrolled classes page.
 * Phase 1: Immediately render loading skeletons for all panels.
 * Phase 2: Fetch data and update with actual ratings.
 */
export async function renderPage(): Promise<void> {
  const panels = document.querySelectorAll(PAGE_CONFIG.panelSelector);
  if (!panels.length) return;

  // Phase 1: Immediately render loading skeletons for all panels
  const mounts: { mount: HTMLSpanElement; name: string; panel: Element }[] = [];
  for (const panel of panels) {
    if (panel.classList.contains(PAGE_CONFIG.processedClass)) continue;
    if (panel.querySelector('.rms-rating-bar-root')) continue;

    const name = extractProfName(panel);
    if (!name) continue;

    const target = getMountTarget(panel);
    panel.classList.add('prof-cart-panel');
    // Mark processed regardless of fetch outcome so a not-found professor is
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
