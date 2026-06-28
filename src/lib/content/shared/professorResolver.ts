import { logger } from '@/lib/logger';
import type {
  ProfUidsMap,
  ResearchTopicsMap,
  ClassesMap,
  FetchProfessorDataResponse,
} from '@/types';

// Caches for bundled JSON data (loaded on first use)
let profUidsCache: ProfUidsMap | null = null;
let researchCache: ResearchTopicsMap | null = null;
let classesCache: ClassesMap | null = null;

/**
 * Kicks off all JSON fetches concurrently so data is warm
 * by the time individual professor lookups happen.
 */
export function preloadData(): void {
  loadProfUids();
  fetchLocalResearchData();
  fetchLocalClassesData();
}

/**
 * Loads professor UIDs from the bundled JSON file.
 */
async function loadProfUids(): Promise<ProfUidsMap> {
  if (profUidsCache) return profUidsCache;

  const url = chrome.runtime.getURL('data/prof_uids.json');
  try {
    const response = await fetch(url);
    if (!response.ok) return {};
    profUidsCache = await response.json();
    return profUidsCache as ProfUidsMap;
  } catch (e) {
    logger.error('Error loading prof_uids.json:', e);
    return {};
  }
}

/**
 * Resolves a professor's UID from the JSON dataset.
 * Strategy: exact match, then fuzzy match on "Last,F." pattern.
 * Returns null if not found.
 */
export async function getUIDFromJson(name: string): Promise<string | null> {
  const data = await loadProfUids();
  let uID: string | null = null;
  let value = data[name];

  if (!value) {
    try {
      // Derive the target last name + first initial from the input name.
      // Two supported formats:
      //   "Last,F." / "Last,First"  -> split on comma
      //   "First Last" (no comma)   -> last whitespace token is the last name,
      //                                 first token's first letter is the initial
      let targetLast = '';
      let targetFirstInitial = '';

      if (name.includes(',')) {
        const nameParts = name.split(',');
        if (nameParts.length >= 2) {
          targetLast = nameParts[0].trim().toLowerCase();
          targetFirstInitial = nameParts[1].trim().charAt(0).toLowerCase();
        }
      } else {
        const tokens = name.trim().split(/\s+/).filter(Boolean);
        if (tokens.length >= 2) {
          targetLast = tokens[tokens.length - 1].toLowerCase();
          targetFirstInitial = tokens[0].charAt(0).toLowerCase();
        }
      }

      if (targetLast && targetFirstInitial) {
        // The JSON keys are always in "Last,F." format.
        const matchKey = Object.keys(data).find((key) => {
          const keyParts = key.split(',');
          if (keyParts.length < 2) return false;
          const keyLast = keyParts[0].trim().toLowerCase();
          const keyFirstInitial = keyParts[1].trim().charAt(0).toLowerCase();
          return (
            targetLast === keyLast && targetFirstInitial === keyFirstInitial
          );
        });

        if (matchKey) {
          value = data[matchKey];
        }
      }
    } catch (err) {
      logger.error('Error during fuzzy matching:', err);
    }
  }

  if (value) {
    const stringValue = String(value);
    const uidMatch = stringValue.match(/uid=([\w-]+)/);
    if (uidMatch && uidMatch[1]) {
      uID = uidMatch[1];
    } else if (!stringValue.includes('http')) {
      uID = stringValue;
    }
  }

  return uID;
}

/**
 * Sends a message to the background script to fetch all professor data.
 */
export async function fetchProfessorData(
  uID: string | null,
  name: string
): Promise<FetchProfessorDataResponse> {
  return chrome.runtime.sendMessage({
    action: 'fetchProfessorData',
    ID: uID,
    name,
  });
}

/**
 * Fetches research topics from the local JSON file.
 */
export async function fetchLocalResearchData(): Promise<ResearchTopicsMap> {
  if (researchCache) return researchCache;
  const url = chrome.runtime.getURL('data/prof_research_topics.json');
  try {
    const response = await fetch(url);
    if (!response.ok) return {};
    researchCache = await response.json();
    return researchCache as ResearchTopicsMap;
  } catch (e) {
    logger.error('Error loading research JSON:', e);
    return {};
  }
}

/**
 * Fetches classes taught from the local JSON file.
 */
export async function fetchLocalClassesData(): Promise<ClassesMap> {
  if (classesCache) return classesCache;
  const url = chrome.runtime.getURL('data/prof_classes.json');
  try {
    const response = await fetch(url);
    if (!response.ok) return {};
    classesCache = await response.json();
    return classesCache as ClassesMap;
  } catch (e) {
    logger.error('Error loading classes JSON:', e);
    return {};
  }
}
