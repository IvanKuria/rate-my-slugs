import { getUIDFromJson, fetchProfessorData, fetchLocalResearchData, fetchLocalClassesData } from '@/lib/content/shared/professorResolver';
import { createMountPoint, renderComponent } from '@/lib/content/shared/mountHelper';
import { getFirst } from '@/utils/utils';
import RatingBar from '@/components/RatingBar';

export const PAGE_CONFIG = {
  panelSelector: '[id*="INSTR_LONG"], [id*="MTG_INSTR"]',
  processedClass: "rms-processed",
};

/**
 * Extracts professor name directly from the instructor element.
 * This is a catch-all module for pages with instructor elements
 * that don't match the more specific page modules.
 */
export function extractProfName(panel) {
  const name = panel.textContent?.trim();
  if (!name || name === 'Staff' || name === 'TBA' || name.length < 2) return null;
  return name;
}

/**
 * Returns the DOM element to mount the component into.
 * Since the panel IS the instructor element, mount directly on it.
 */
export function getMountTarget(panel) {
  return panel;
}

/**
 * Full render pipeline for generic instructor pages.
 * Phase 1: Immediately render loading skeletons.
 * Phase 2: Fetch data and update with actual ratings.
 */
export async function renderPage() {
  const panels = document.querySelectorAll(PAGE_CONFIG.panelSelector);
  if (!panels.length) return;

  // Deduplicate: multiple selectors might match the same element
  const seen = new Set();
  const uniquePanels = [];
  for (const panel of panels) {
    if (seen.has(panel)) continue;
    seen.add(panel);
    uniquePanels.push(panel);
  }

  // Phase 1: Immediately render loading skeletons
  const mounts = [];
  for (const panel of uniquePanels) {
    if (panel.querySelector('.rms-rating-bar-root')) continue;

    const name = extractProfName(panel);
    if (!name) continue;

    const target = getMountTarget(panel);
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

  await Promise.allSettled(mounts.map(async ({ mount, name, panel }) => {
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

    let profData = null, rateMyProfessorData = null, reviews = [];
    let researchTopicText = null, classesTaughtList = null, fullName = null;

    if (profileDict) {
      profData = profileDict.data;
      rateMyProfessorData = profileDict.rateMyProfessor;
      reviews = profileDict.reviews || [];
      fullName = getFirst(profData?.cn);
      researchTopicText = researchTopics[fullName];
      classesTaughtList = classesTaught[fullName];
    }

    if (!profData && !rateMyProfessorData && !researchTopicText && !classesTaughtList) {
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
  }));
}
