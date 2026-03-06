// Caches for bundled JSON data (loaded on first use)
let profUidsCache = null;
let researchCache = null;
let classesCache = null;

/**
 * Loads professor UIDs from the bundled JSON file.
 */
async function loadProfUids() {
  if (profUidsCache) return profUidsCache;

  const url = chrome.runtime.getURL('data/prof_uids.json');
  try {
    const response = await fetch(url);
    if (!response.ok) return {};
    profUidsCache = await response.json();
    return profUidsCache;
  } catch (e) {
    console.error('Error loading prof_uids.json:', e);
    return {};
  }
}

/**
 * Resolves a professor's UID from the JSON dataset.
 * Strategy: exact match, then fuzzy match on "Last,F." pattern.
 * Returns "jdoe" (sentinel) if not found.
 */
export async function getUIDFromJson(name) {
  const data = await loadProfUids();
  let uID = "jdoe";
  let value = data[name];

  if (!value) {
    try {
      const nameParts = name.split(",");
      if (nameParts.length >= 2) {
        const targetLast = nameParts[0].trim().toLowerCase();
        const targetFirstInitial = nameParts[1].trim().charAt(0).toLowerCase();

        const matchKey = Object.keys(data).find((key) => {
          const keyParts = key.split(",");
          if (keyParts.length < 2) return false;
          const keyLast = keyParts[0].trim().toLowerCase();
          const keyFirstInitial = keyParts[1].trim().charAt(0).toLowerCase();
          return targetLast === keyLast && targetFirstInitial === keyFirstInitial;
        });

        if (matchKey) {
          value = data[matchKey];
        }
      }
    } catch (err) {
      console.error("Error during fuzzy matching:", err);
    }
  }

  if (value) {
    const stringValue = String(value);
    const uidMatch = stringValue.match(/uid=([\w-]+)/);
    if (uidMatch && uidMatch[1]) {
      uID = uidMatch[1];
    } else if (!stringValue.includes("http")) {
      uID = stringValue;
    }
  }

  return uID;
}

/**
 * Sends a message to the background script to fetch all professor data.
 */
export async function fetchProfessorData(uID, name) {
  return chrome.runtime.sendMessage({
    action: "fetchProfessorData",
    ID: uID,
    name,
  });
}

/**
 * Fetches research topics from the local JSON file.
 */
export async function fetchLocalResearchData() {
  if (researchCache) return researchCache;
  const url = chrome.runtime.getURL("data/prof_research_topics.json");
  try {
    const response = await fetch(url);
    if (!response.ok) return {};
    researchCache = await response.json();
    return researchCache;
  } catch (e) {
    console.error("Error loading research JSON:", e);
    return {};
  }
}

/**
 * Fetches classes taught from the local JSON file.
 */
export async function fetchLocalClassesData() {
  if (classesCache) return classesCache;
  const url = chrome.runtime.getURL("data/prof_classes.json");
  try {
    const response = await fetch(url);
    if (!response.ok) return {};
    classesCache = await response.json();
    return classesCache;
  } catch (e) {
    console.error("Error loading classes JSON:", e);
    return {};
  }
}
