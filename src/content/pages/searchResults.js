import { getUIDFromJson, fetchProfessorData, fetchLocalResearchData, fetchLocalClassesData } from '../shared/professorResolver';
import { createMountPoint, renderComponent } from '../shared/mountHelper';
import { getFirst } from '../../utils/utils';
import ProfessorCard from '../../components/ProfessorCard';

export const PAGE_CONFIG = {
  panelSelector: ".panel.panel-default",
  processedClass: "rms-processed",
};

/**
 * Extracts professor name from a search results panel.
 */
export function extractProfName(panel) {
  // Try structured divs first
  const profDivs = panel.querySelectorAll("div.col-xs-6.col-sm-3 div");
  for (const div of profDivs) {
    const text = div.textContent.trim();
    if (text.includes("Instructor:")) {
      const name = text.replace("Instructor:", "").trim();
      if (name) return name;
    }
  }

  // Fallback: regex on full panel text
  const re = /Instructor[s]?:\s*([\w,.'-]+)/i;
  const text = panel.innerText;
  const res = text.match(re);
  if (res && res[1]) return res[1];

  return null;
}

/**
 * Extracts course code (e.g., "CSE 101") from a panel.
 */
function extractCourseCode(panel) {
  const titleElements = panel.querySelectorAll("h3, h2, .course-title, [class*='title']");
  for (const el of titleElements) {
    const match = el.textContent.trim().match(/([A-Z]{2,5})\s+(\d+[A-Z]?)/);
    if (match) return `${match[1]} ${match[2]}`;
  }
  const rowMatch = panel.textContent.match(/([A-Z]{2,5})\s+(\d+[A-Z]?)/);
  if (rowMatch) return `${rowMatch[1]} ${rowMatch[2]}`;
  return null;
}

/**
 * Returns the DOM element to mount the component into.
 */
export function getMountTarget(panel) {
  return panel;
}

/**
 * Full render pipeline for the search results page.
 */
export async function renderPage() {
  const panels = document.querySelectorAll(PAGE_CONFIG.panelSelector);
  if (!panels.length) return;

  const researchTopics = await fetchLocalResearchData();
  const classesTaught = await fetchLocalClassesData();

  for (const panel of panels) {
    if (panel.querySelector(".rms-professor-root")) continue;

    const name = extractProfName(panel);
    if (!name) continue;

    const course = extractCourseCode(panel);
    const uID = getUIDFromJson(name);

    // Always fetch — background handles UID-less professors via RMP name search
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

    // Only mount if we got at least some data (campus or RMP)
    if (!profData && !rateMyProfessorData) continue;

    const target = getMountTarget(panel);
    target.classList.add("prof-panel-relative");
    const mount = createMountPoint(target);

    renderComponent(mount, ProfessorCard, {
      apiData: profData,
      rateMyProfessor: rateMyProfessorData,
      reviews,
      localResearchTopic: researchTopicText,
      localClassesTaught: classesTaughtList,
      instructorName: name,
      course,
    });
  }
}
