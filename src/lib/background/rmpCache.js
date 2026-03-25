/**
 * @file rmpCache.js
 * Handles all data fetching, caching, and matching for
 * Rate My Professors (RMP).
 */

import Fuse from "fuse.js";

// --- Constants ---
const RATE_MY_PROFESSORS_ENDPOINT = "https://www.ratemyprofessors.com/graphql";
const UCSC_SCHOOL_ID = "U2Nob29sLTEwNzg="; // Base64 encoded "School-1078"
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000 * 7; // 1 week

// Fuse.js thresholds (0 = perfect match, 1 = match anything)
const MATCH_THRESHOLD = 0.25;
const STRICT_THRESHOLD = 0.15; // used when didFallback is true

// GraphQL query for searching professors
const RATE_MY_PROFESSORS_QUERY = `query NewSearchTeachersQuery($text: String!, $schoolID: ID) {
  newSearch {
    teachers(query: { text: $text, schoolID: $schoolID }, first: 8) {
      didFallback
      edges {
        cursor
        node {
          id
          legacyId
          firstName
          lastName
          avgRatingRounded
          numRatings
          wouldTakeAgainPercentRounded
          wouldTakeAgainCount
          teacherRatingTags {
            id
            legacyId
            tagCount
            tagName
          }
          avgDifficultyRounded
          school {
            name
            id
          }
          department
        }
      }
    }
  }
}`;

// GraphQL query for fetching reviews
const TEACHER_RATINGS_QUERY = `query TeacherRatingsQuery($id: ID!, $first: Int!) {
  node(id: $id) {
    ... on Teacher {
      ratings(first: $first) {
        edges {
          node {
            id
            comment
            date
            helpfulRating
            clarityRating
            difficultyRating
            wouldTakeAgain
            class
          }
        }
      }
    }
  }
}`;

// --- Name Normalization ---

/**
 * Generates an ordered list of search variants from a professor name.
 * Handles formats like "Last,First", "Last,F.", "Last,F.M.", "First Last".
 */
function generateSearchVariants(name) {
  if (!name) return [];
  const trimmed = name.trim();
  if (!trimmed) return [];

  const variants = [];

  // Clean periods and extra whitespace
  const clean = (s) => s.replace(/\./g, "").replace(/\s+/g, " ").trim();

  if (trimmed.includes(",")) {
    const [lastRaw, firstRaw] = trimmed.split(",", 2).map((p) => p.trim());
    const last = clean(lastRaw);
    const first = clean(firstRaw);

    if (!last) return [];

    // Check if first part is just initials (1-2 single letters)
    const isInitialsOnly = first && /^[A-Z](\s?[A-Z])?$/i.test(clean(first));

    if (first && !isInitialsOnly) {
      // Full first name: "John Smith" is the best query
      variants.push(`${first} ${last}`);
    }

    if (first) {
      // First-initial + last: "J Smith"
      const initial = first.charAt(0);
      variants.push(`${initial} ${last}`);
    }

    // Last name only — catches many cases initials miss
    variants.push(last);

    // If hyphenated last name, also try without hyphen
    if (last.includes("-")) {
      variants.push(last.replace(/-/g, " "));
    }
  } else {
    // Already in "First Last" or similar format
    variants.push(clean(trimmed));

    // Also try last name only (last word)
    const parts = clean(trimmed).split(" ");
    if (parts.length > 1) {
      const lastName = parts[parts.length - 1];
      variants.push(lastName);
    }
  }

  // Deduplicate while preserving order
  return [...new Set(variants.filter(Boolean))];
}

/**
 * Normalize a string for comparison: lowercase, letters only.
 */
function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

// --- Matching ---

/**
 * Creates name-only search tokens from a professor's RMP data.
 * Excludes rating tags to avoid polluting name matching.
 */
function createNameTokens(node) {
  const first = node?.firstName ? String(node.firstName).trim() : "";
  const last = node?.lastName ? String(node.lastName).trim() : "";
  const tokens = [];

  if (first || last) {
    const fullName = [first, last].filter(Boolean).join(" ");
    const reversedName = [last, first].filter(Boolean).join(", ");
    const initial = first ? first[0] : "";

    if (fullName) tokens.push(fullName);
    if (reversedName) tokens.push(reversedName);
    if (initial && last) {
      tokens.push(`${last}, ${initial}`);
      tokens.push(`${initial} ${last}`);
    }

    // Compact (no punctuation) versions
    if (fullName) tokens.push(normalize(fullName));
    if (initial && last) tokens.push(normalize(`${last}${initial}`));
  }

  return Array.from(new Set(tokens.filter(Boolean)));
}

/**
 * Uses Fuse.js fuzzy search to find the best RMP match for a given name.
 * Respects didFallback to avoid cross-school false positives.
 *
 * @param {Array} edges - GraphQL teacher edges
 * @param {string} name - The professor name to match against
 * @param {Object} [options]
 * @param {boolean} [options.didFallback=false] - Whether RMP widened search beyond the target school
 * @param {string} [options.schoolId] - Expected school ID to validate against
 * @returns {Object|null} The best matching professor node, or null
 */
export function selectBestRmpMatch(edges, name, options = {}) {
  const { didFallback = false, schoolId = UCSC_SCHOOL_ID } = options;

  if (!Array.isArray(edges) || edges.length === 0) return null;

  const candidates = edges
    .map((edge) => edge?.node)
    .filter(Boolean)
    .map((node) => ({
      ...node,
      nameTokens: createNameTokens(node),
    }));

  if (candidates.length === 0) return null;
  if (!name) return null; // Don't return a random candidate without a name to match

  // Use stricter threshold when RMP fell back to cross-school results
  const threshold = didFallback ? STRICT_THRESHOLD : MATCH_THRESHOLD;

  const fuse = new Fuse(candidates, {
    includeScore: true,
    shouldSort: true,
    threshold,
    ignoreLocation: true,
    keys: [
      { name: "firstName", weight: 2 },
      { name: "lastName", weight: 2 },
      { name: "nameTokens", weight: 1 },
    ],
  });

  // Generate search terms from the input name
  const searchTerms = generateSearchVariants(name);
  if (searchTerms.length === 0) searchTerms.push(name.trim());

  let bestResult = null;
  let bestScore = 1; // lower is better in Fuse.js

  for (const term of searchTerms) {
    const results = fuse.search(term);
    if (results.length > 0 && results[0].score < bestScore) {
      bestResult = results[0];
      bestScore = results[0].score;
    }
  }

  if (bestResult?.item) {
    // When didFallback is true, require school match
    if (didFallback && bestResult.item.school?.id !== schoolId) {
      return null;
    }
    return bestResult.item;
  }

  // Fallback: exact normalized comparison
  const targetVariants = searchTerms.map(normalize);
  const fallbackMatch = candidates.find((candidate) => {
    const tokens = (candidate.nameTokens || []).map(normalize);
    return targetVariants.some((t) => tokens.includes(t));
  });

  if (fallbackMatch) {
    // Still check school for didFallback
    if (didFallback && fallbackMatch.school?.id !== schoolId) {
      return null;
    }
    return fallbackMatch;
  }

  // No confident match — return null instead of a random candidate
  return null;
}

// --- API Fetching ---

/**
 * Fetches raw RMP data for a specific search text.
 * Returns { edges, didFallback }.
 */
async function fetchRmpSearchResults(searchText, schoolId) {
  const response = await fetch(RATE_MY_PROFESSORS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: "Basic dGVzdDp0ZXN0",
    },
    body: JSON.stringify({
      query: RATE_MY_PROFESSORS_QUERY,
      variables: {
        text: searchText,
        schoolID: schoolId || UCSC_SCHOOL_ID,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(
      `RateMyProfessors request failed with status ${response.status}`,
    );
  }

  const payload = await response.json();
  if (payload?.errors?.length) {
    console.error(
      "RateMyProfessors GraphQL errors:",
      payload.errors.map((err) => err.message).join(", "),
    );
    return { edges: null, didFallback: false };
  }

  const teachers = payload?.data?.newSearch?.teachers;
  return {
    edges: teachers?.edges ?? null,
    didFallback: teachers?.didFallback ?? false,
  };
}

/**
 * Searches RMP with cascading fallback strategies.
 * Tries multiple name variants, stopping at the first confident match.
 *
 * @param {string} name - Professor name (any format)
 * @param {string} [schoolId] - RMP school ID
 * @returns {{ edges: Array|null, didFallback: boolean }}
 */
async function searchWithFallback(name, schoolId) {
  if (!name) return { edges: null, didFallback: false };

  const variants = generateSearchVariants(name);
  if (variants.length === 0) return { edges: null, didFallback: false };

  let allEdges = [];
  let anyDidFallback = false;

  for (const variant of variants) {
    try {
      const { edges, didFallback } = await fetchRmpSearchResults(
        variant,
        schoolId,
      );

      if (!edges || edges.length === 0) continue;

      anyDidFallback = didFallback;

      // Try matching with this batch of results
      const match = selectBestRmpMatch(edges, name, {
        didFallback,
        schoolId: schoolId || UCSC_SCHOOL_ID,
      });

      if (match) {
        // Found a good match — return these edges so the caller can use them
        return { edges, didFallback };
      }

      // Accumulate edges for a final attempt
      allEdges = allEdges.concat(edges);
    } catch (err) {
      console.error(`RMP search failed for variant "${variant}":`, err);
    }
  }

  // Return all accumulated edges if no single batch produced a confident match
  if (allEdges.length > 0) {
    return { edges: allEdges, didFallback: anyDidFallback };
  }

  return { edges: null, didFallback: false };
}

/**
 * Fetches raw RMP data for a professor name using fallback strategies.
 * Exported for backward compatibility.
 */
export async function fetchRateMyProfessorData(name, schoolId) {
  if (!name) return null;
  const { edges } = await searchWithFallback(name, schoolId);
  return edges;
}

/**
 * Cached wrapper for the RateMyProfessors search API.
 * Uses fallback search strategies for better accuracy.
 */
export async function fetchCachedRateMyProfessorData(uID, name, schoolId) {
  if (!uID) {
    return null;
  }

  const storageKey = `rmp_${uID}`;

  try {
    const cache = await chrome.storage.local.get([storageKey]);
    const cachedEntry = cache[storageKey];
    const now = Date.now();

    if (cachedEntry && now - cachedEntry.timestamp < CACHE_DURATION_MS) {
      return cachedEntry.data;
    }

    const { edges, didFallback } = await searchWithFallback(name, schoolId);

    await chrome.storage.local.set({
      [storageKey]: {
        data: { edges, didFallback },
        timestamp: Date.now(),
      },
    });

    return { edges, didFallback };
  } catch (error) {
    console.error(`Failed to fetch RMP data for ${name}`, error);
    await chrome.storage.local.remove(storageKey).catch(() => {});
    return null;
  }
}

/**
 * Fetches professor reviews from RMP.
 */
export async function fetchProfessorReviews(legacyId, limit = 10) {
  const teacherNodeId = typeof btoa === "function"
    ? btoa(`Teacher-${legacyId}`)
    : Buffer.from(`Teacher-${legacyId}`).toString("base64");

  const response = await fetch(RATE_MY_PROFESSORS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: "Basic dGVzdDp0ZXN0",
    },
    body: JSON.stringify({
      query: TEACHER_RATINGS_QUERY,
      variables: {
        id: teacherNodeId,
        first: limit,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();

  if (data.errors) {
    throw new Error(
      `GraphQL errors: ${data.errors.map((e) => e.message).join(", ")}`,
    );
  }

  const ratings =
    data?.data?.node?.ratings?.edges?.map((edge) => edge.node) || [];

  return ratings.map((rating) => ({
    id: rating.id,
    comment: rating.comment || "",
    createdAt: rating.date || null,
    helpfulRating: rating.helpfulRating ?? null,
    clarityRating: rating.clarityRating ?? null,
    difficultyRating: rating.difficultyRating ?? null,
    wouldTakeAgain: rating.wouldTakeAgain ?? null,
    className: rating.class || null,
  }));
}
