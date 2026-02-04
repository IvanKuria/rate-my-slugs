import { createMountPoint, renderComponent } from '../shared/mountHelper';
import { buildCalendarEvent } from '../../utils/calendarUtils';
import CalendarButton from '../../components/CalendarButton';

export const PAGE_CONFIG = {
  panelSelector: 'table.PSGROUPBOXWBO',
};

/**
 * Extracts course data from a single course block on the class schedule page.
 */
function extractCourseData(panel) {
  const titleEl = panel.querySelector('td.PAGROUPDIVIDER');
  if (!titleEl) return null;

  const title = titleEl.textContent.trim();
  const meetings = [];

  // Each meeting row has spans with IDs like MTG_SCHED$0, MTG_LOC$0, etc.
  const schedSpans = panel.querySelectorAll('span[id^="MTG_SCHED"]');

  for (let i = 0; i < schedSpans.length; i++) {
    const schedText = schedSpans[i].textContent.trim();
    if (!schedText || schedText === "TBA") continue;

    // Schedule format: "MoWeFr 10:40AM - 11:45AM"
    const spaceIdx = schedText.search(/\s/);
    if (spaceIdx === -1) continue;

    const days = schedText.slice(0, spaceIdx);
    const timeRange = schedText.slice(spaceIdx + 1).trim();

    const roomEl = panel.querySelector(`span[id^="MTG_LOC"]${i > 0 ? `[id$="${i}"]` : ''}`);
    const dateEl = panel.querySelector(`span[id^="MTG_DATES"]${i > 0 ? `[id$="${i}"]` : ''}`);
    const instrEl = panel.querySelector(`span[id^="DERIVED_CLS_DTL_SSR_INSTR_LONG"]${i > 0 ? `[id$="${i}"]` : ''}`);

    const room = roomEl?.textContent.trim() || "";
    const dateRange = dateEl?.textContent.trim() || "";
    const instructor = instrEl?.textContent.trim() || "";

    if (!dateRange) continue;

    const meeting = { days, timeRange, dateRange, room, instructor };
    const eventBody = buildCalendarEvent(title, meeting);
    if (eventBody) {
      meetings.push({ ...meeting, eventBody });
    }
  }

  return meetings.length > 0 ? { title, meetings } : null;
}

/**
 * Renders calendar buttons on the class schedule page.
 */
export function renderPage() {
  const panels = document.querySelectorAll(PAGE_CONFIG.panelSelector);
  if (!panels.length) return;

  const allCourses = [];

  for (const panel of panels) {
    if (panel.querySelector('.gcal-btn-root')) continue;

    const courseData = extractCourseData(panel);
    if (!courseData) continue;

    allCourses.push(courseData);

    const titleEl = panel.querySelector('td.PAGROUPDIVIDER');
    if (!titleEl) continue;

    const mount = createMountPoint(titleEl, 'gcal-btn-root');
    mount.style.display = 'inline-block';
    mount.style.marginLeft = '10px';
    mount.style.verticalAlign = 'middle';
    renderComponent(mount, CalendarButton, { courseData });
  }

  // Add "Add All" button at the top if there are multiple courses
  if (allCourses.length > 1) {
    const firstPanel = panels[0];
    const parent = firstPanel.parentElement;
    if (parent && !parent.querySelector('.gcal-add-all-root')) {
      const mount = document.createElement('div');
      mount.className = 'gcal-add-all-root';
      mount.style.marginBottom = '10px';
      parent.insertBefore(mount, firstPanel);
      renderComponent(mount, CalendarButton, { allCourses });
    }
  }
}
