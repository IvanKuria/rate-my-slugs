/**
 * Pure parsing utilities for building Google Calendar events
 * from UCSC class schedule data.
 */

const DAY_CODE_MAP = {
  Mo: "MO", Tu: "TU", We: "WE", Th: "TH", Fr: "FR", Sa: "SA", Su: "SU",
};

/**
 * "MoWeFr" → ["MO", "WE", "FR"]
 */
export function parseDayCodes(str) {
  const days = [];
  for (let i = 0; i < str.length; i += 2) {
    const code = str.slice(i, i + 2);
    if (DAY_CODE_MAP[code]) days.push(DAY_CODE_MAP[code]);
  }
  return days;
}

/**
 * "10:40AM - 11:45AM" → { start: "10:40", end: "11:45" } (24h)
 */
export function parseTimeRange(str) {
  const parts = str.split(" - ").map((s) => s.trim());
  if (parts.length !== 2) return null;
  return { start: to24h(parts[0]), end: to24h(parts[1]) };
}

function to24h(timeStr) {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return timeStr;
  let [, h, m, period] = match;
  h = parseInt(h, 10);
  if (period.toUpperCase() === "PM" && h !== 12) h += 12;
  if (period.toUpperCase() === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${m}`;
}

/**
 * "01/05/2026 - 03/13/2026" → { start: "2026-01-05", end: "2026-03-13" }
 */
export function parseDateRange(str) {
  const parts = str.split(" - ").map((s) => s.trim());
  if (parts.length !== 2) return null;
  return { start: mmddToIso(parts[0]), end: mmddToIso(parts[1]) };
}

function mmddToIso(d) {
  const [mm, dd, yyyy] = d.split("/");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Builds a Google Calendar API event body for a single meeting.
 */
export function buildCalendarEvent(courseTitle, meeting) {
  const days = parseDayCodes(meeting.days);
  const time = parseTimeRange(meeting.timeRange);
  const dates = parseDateRange(meeting.dateRange);
  if (!days.length || !time || !dates) return null;

  const untilDate = dates.end.replace(/-/g, "");

  return {
    summary: courseTitle,
    location: meeting.room || undefined,
    description: meeting.instructor ? `Instructor: ${meeting.instructor}` : undefined,
    start: {
      dateTime: `${dates.start}T${time.start}:00`,
      timeZone: "America/Los_Angeles",
    },
    end: {
      dateTime: `${dates.start}T${time.end}:00`,
      timeZone: "America/Los_Angeles",
    },
    recurrence: [
      `RRULE:FREQ=WEEKLY;BYDAY=${days.join(",")};UNTIL=${untilDate}T235959Z`,
    ],
  };
}
