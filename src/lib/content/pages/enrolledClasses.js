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
import { getFirst } from '@/utils/utils';
import RatingBar from '@/components/RatingBar';

export const PAGE_CONFIG = {
  panelSelector: '[id^="trSTDNT_ENRL_SSVW$0_row"]',
  processedClass: 'rms-processed',
};

/**
 * Extracts professor name from an enrolled class row.
 * Similar to shopping cart but may have different element IDs.
 */
export function extractProfName(panel) {
  // Try the instructor long name element
  const nameBox =
    panel.querySelector('[id^="win0divDERIVED_REGFRM1_SSR_INSTR_LONG$"]') ||
    panel.querySelector('[id*="INSTR_LONG"]');
  if (!nameBox) return null;

  const name = nameBox.outerText?.trim();
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

export function getMountTarget(panel) {
  return panel.querySelector('[id*="INSTR_LONG"]') || panel;
}

/**
 * Full render pipeline for the enrolled classes page.
 * Phase 1: Immediately render loading skeletons for all panels.
 * Phase 2: Fetch data and update with actual ratings.
 */
export async function renderPage() {
  const panels = document.querySelectorAll(PAGE_CONFIG.panelSelector);
  if (!panels.length) return;

  // Phase 1: Immediately render loading skeletons for all panels
  const mounts = [];
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
    mounts.map(async ({ mount, name, panel }) => {
      const uID = await getUIDFromJson(name);

      let profileDict = null;
      try {
        profileDict = await fetchProfessorData(uID, name);
      } catch (error) {
        // silently continue — error is non-critical
      }
      if (profileDict?.data?.success === false) {
        profileDict.data = null;
      }

      let profData = null,
        rateMyProfessorData = null,
        reviews = [];
      let researchTopicText = null,
        classesTaughtList = null,
        fullName = null;

      if (profileDict) {
        profData = profileDict.data;
        rateMyProfessorData = profileDict.rateMyProfessor;
        reviews = profileDict.reviews || [];
        fullName = getFirst(profData?.cn);
        researchTopicText = researchTopics[fullName];
        classesTaughtList = classesTaught[fullName];
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

      renderComponent(mount, RatingBar, {
        professorData: {
          apiData: profData,
          rateMyProfessor: rateMyProfessorData,
          reviews,
          localResearchTopic: researchTopicText,
          localClassesTaught: classesTaughtList,
          instructorName: name,
          course: null,
        },
        loading: false,
      });
    })
  );
}
