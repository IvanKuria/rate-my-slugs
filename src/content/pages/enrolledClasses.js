import { getUIDFromJson, fetchProfessorData, fetchLocalResearchData, fetchLocalClassesData } from '../shared/professorResolver';
import { createMountPoint, renderComponent } from '../shared/mountHelper';
import { getFirst } from '../../utils/utils';
import ProfessorCard from '../../components/ProfessorCard';

export const PAGE_CONFIG = {
  panelSelector: '[id^="trSTDNT_ENRL_SSVW$0_row"]',
  processedClass: "rms-processed",
};

/**
 * Extracts professor name from an enrolled class row.
 * Similar to shopping cart but may have different element IDs.
 */
export function extractProfName(panel) {
  // Try the instructor long name element
  const nameBox = panel.querySelector('[id^="win0divDERIVED_REGFRM1_SSR_INSTR_LONG$"]') ||
                  panel.querySelector('[id*="INSTR_LONG"]');
  if (!nameBox) return null;

  const name = nameBox.outerText?.trim();
  if (!name) return null;

  // Reformat "J. Doe" → "Doe,J."
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

export async function renderPage() {
  const panels = document.querySelectorAll(PAGE_CONFIG.panelSelector);
  if (!panels.length) return;

  const researchTopics = await fetchLocalResearchData();
  const classesTaught = await fetchLocalClassesData();

  for (const panel of panels) {
    if (panel.querySelector(".rms-professor-root")) continue;

    const name = extractProfName(panel);
    if (!name) continue;

    const uID = getUIDFromJson(name);

    let profileDict = null;
    try {
      profileDict = await fetchProfessorData(uID, name);
    } catch (error) {
      console.error("Error fetching professor data", error);
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

    if (!profData && !rateMyProfessorData) continue;

    const target = getMountTarget(panel);
    panel.classList.add("prof-cart-panel");
    const mount = createMountPoint(target, "rms-professor-root");

    renderComponent(mount, ProfessorCard, {
      apiData: profData,
      rateMyProfessor: rateMyProfessorData,
      reviews,
      localResearchTopic: researchTopicText,
      localClassesTaught: classesTaughtList,
      instructorName: name,
      course: null,
    });
  }
}
