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

// GraphQL query for searching professors
const RATE_MY_PROFESSORS_QUERY = `query NewSearchTeachersQuery($text: String!, $schoolID: ID) {
  newSearch {
    teachers(query: { text: $text, schoolID: $schoolID }, first: 5) {
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

/**
 * Builds the variables object for the RMP GraphQL query.
 * Converts "Last,First" to "First Last" for better search results.
 */
function buildRmpQueryVariables(name, schoolId) {
  const trimmed = name ? name.trim() : "";
  let text = trimmed;

  if (trimmed.includes(",")) {
    const [last, first] = trimmed.split(",").map((part) => part.trim());
    if (first && last) {
      text = `${first} ${last}`;
    }
  }

  return {
    text,
    schoolID: schoolId || UCSC_SCHOOL_ID,
  };
}

/**
 * Creates a list of searchable "tokens" from a professor's RMP data.
 */
function createSearchTokens(node) {
  const first = node?.firstName ? String(node.firstName).trim() : "";
  const last = node?.lastName ? String(node.lastName).trim() : "";
  const tokens = [];

  if (first || last) {
    const fullName = [first, last].filter(Boolean).join(" ");
    const reversedName = [last, first].filter(Boolean).join(", ");
    const initials = first ? `${first[0]}.` : "";

    if (fullName) tokens.push(fullName);
    if (reversedName) tokens.push(reversedName);
    if (initials && last) {
      tokens.push(`${last}, ${initials}`);
      tokens.push(`${initials} ${last}`);
    }

    const compact = (value) => value.replace(/[^a-zA-Z]/g, "").toLowerCase();
    if (fullName) tokens.push(compact(fullName));
    if (reversedName) tokens.push(compact(reversedName));
    if (initials && last) tokens.push(compact(`${last}${initials}`));
  }

  if (Array.isArray(node?.teacherRatingTags)) {
    node.teacherRatingTags.forEach((tag) => {
      if (tag?.tagName) {
        tokens.push(String(tag.tagName).trim());
      }
    });
  }

  return Array.from(new Set(tokens.filter(Boolean)));
}

/**
 * Uses Fuse.js fuzzy search to find the best RMP match for a given name.
 */
export function selectBestRmpMatch(edges, name) {
  if (!Array.isArray(edges) || edges.length === 0) return null;

  const candidates = edges
    .map((edge) => edge?.node)
    .filter(Boolean)
    .map((node) => ({
      ...node,
      searchTokens: createSearchTokens(node),
    }));

  if (candidates.length === 0) return null;
  if (!name) return candidates[0];

  const fuse = new Fuse(candidates, {
    includeScore: true,
    shouldSort: true,
    threshold: 0.35,
    keys: ["searchTokens"],
  });

  const formattedName = buildRmpQueryVariables(name)?.text || "";
  const searchTerms = [formattedName, name]
    .map((term) => term && term.trim())
    .filter(Boolean);

  const normalizeForFallback = (value) =>
    String(value || "")
      .toLowerCase()
      .replace(/[^a-z]/g, "");

  for (const term of searchTerms) {
    const results = fuse.search(term);
    if (results.length > 0) {
      const [best] = results;
      if (best?.item) {
        return best.item;
      }
    }
  }

  // fallback to direct normalized comparison
  const target = normalizeForFallback(searchTerms[0] || name);
  const fallbackMatch = candidates.find((candidate) => {
    const comparisonValues = (candidate.searchTokens || []).map((token) =>
      normalizeForFallback(token),
    );
    return comparisonValues.includes(target);
  });
  if (fallbackMatch) return fallbackMatch;

  return candidates[0];
}

/**
 * Fetches raw RMP data for a professor name (no caching).
 */
export async function fetchRateMyProfessorData(name, schoolId) {
  if (!name) return null;

  const variables = buildRmpQueryVariables(name, schoolId);
  const response = await fetch(RATE_MY_PROFESSORS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: "Basic dGVzdDp0ZXN0",
    },
    body: JSON.stringify({
      query: RATE_MY_PROFESSORS_QUERY,
      variables,
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
    return null;
  }

  return payload?.data?.newSearch?.teachers?.edges ?? null;
}

/**
 * Cached wrapper for the RateMyProfessors search API.
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

    const apiResponse = await fetchRateMyProfessorData(name, schoolId);

    await chrome.storage.local.set({
      [storageKey]: {
        data: apiResponse,
        timestamp: Date.now(),
      },
    });

    return apiResponse;
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
