/**
 * Google Calendar API integration via chrome.identity OAuth.
 */

export async function getAuthToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(token);
      }
    });
  });
}

export async function createCalendarEvent(token, eventBody) {
  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventBody),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Calendar API error ${res.status}`);
  }
  return res.json();
}

export async function createEventsForCourse(courseData) {
  const token = await getAuthToken();
  const results = [];
  for (const meeting of courseData.meetings) {
    // eventBody is already built by the content script
    const result = await createCalendarEvent(token, meeting.eventBody);
    results.push(result);
  }
  return results;
}
