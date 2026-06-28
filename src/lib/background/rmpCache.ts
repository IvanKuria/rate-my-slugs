/**
 * @file rmpCache.ts
 * Handles all data fetching, caching, and matching for
 * Rate My Professors (RMP).
 */

import Fuse from 'fuse.js';
import type { FuseResult } from 'fuse.js';
import { getSettings } from '@/lib/storage/settings';
import { logger } from '@/lib/logger';
import { RMP_CACHE_PREFIX, UCSC_SCHOOL_ID } from '@/lib/constants';
import { getCacheDurationMs } from '@/lib/background/cacheConfig';
import { parseInstructorName } from '@/lib/nameParsing';
import type {
  RmpEdge,
  RmpReview,
  RmpSearchResult,
  RmpTeacherNode,
} from '@/types';

// --- Local boundary types for dynamic GraphQL responses ---

/** Subset of {@link RmpSearchResult} returned/cached by the public API. */
type RmpData = Pick<RmpSearchResult, 'edges' | 'didFallback'>;

/** Shape of a single cached chrome.storage.local RMP entry. */
interface RmpCacheEntry {
  data: RmpData;
  timestamp: number;
}

/** Dynamic shape of the NewSearchTeachersQuery GraphQL response. */
interface RmpSearchPayload {
  data?: {
    newSearch?: {
      teachers?: {
        didFallback?: boolean;
        edges?: RmpEdge[];
      } | null;
    } | null;
  } | null;
  errors?: Array<{ message: string }>;
}

/** Raw GraphQL rating node (pre-mapping to {@link RmpReview}). */
interface RmpRatingNode {
  id: string;
  comment: string | null;
  date: string | null;
  helpfulRating: number | null;
  clarityRating: number | null;
  difficultyRating: number | null;
  wouldTakeAgain: boolean | null;
  class: string | null;
}

/** Dynamic shape of the TeacherRatingsQuery GraphQL response. */
interface RmpRatingsPayload {
  data?: {
    node?: {
      ratings?: {
        edges?: Array<{ node: RmpRatingNode }>;
      } | null;
    } | null;
  } | null;
  errors?: Array<{ message: string }>;
}

/** Options for {@link selectBestRmpMatch}. */
interface SelectBestRmpMatchOptions {
  didFallback?: boolean;
  schoolId?: string;
}

// --- Constants ---
const RATE_MY_PROFESSORS_ENDPOINT = 'https://www.ratemyprofessors.com/graphql';

// Max number of concurrent outbound RMP HTTP requests across all lookups.
const MAX_CONCURRENT_REQUESTS = 5;

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

// --- Concurrency Control ---

/**
 * A minimal, dependency-free promise semaphore used to cap the number of
 * concurrent outbound RMP HTTP requests. On a 25-row page this prevents
 * firing dozens of parallel fetches at once.
 */
let activeRequests = 0;
const requestQueue: Array<() => void> = [];

function acquireSlot(): Promise<void> {
  if (activeRequests < MAX_CONCURRENT_REQUESTS) {
    activeRequests += 1;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => requestQueue.push(resolve));
}

function releaseSlot(): void {
  const next = requestQueue.shift();
  if (next) {
    // Hand the active slot directly to the next waiter.
    next();
  } else {
    activeRequests -= 1;
  }
}

/**
 * Runs an async task while holding a concurrency slot. Guarantees the slot
 * is released even if the task throws.
 */
async function withConcurrencyLimit<T>(task: () => Promise<T>): Promise<T> {
  await acquireSlot();
  try {
    return await task();
  } finally {
    releaseSlot();
  }
}

// --- Name Normalization ---

/**
 * Generates an ordered list of search variants from a professor name.
 * Handles formats like "Last,First", "Last,F.", "Last,F.M.", "First Last".
 */
function generateSearchVariants(name: string | null | undefined): string[] {
  if (!name) return [];
  const trimmed = name.trim();
  if (!trimmed) return [];

  const variants: string[] = [];

  // Clean periods and extra whitespace
  const clean = (s: string): string =>
    s.replace(/\./g, '').replace(/\s+/g, ' ').trim();

  if (trimmed.includes(',')) {
    const [lastRaw, firstRaw] = trimmed.split(',', 2).map((p) => p.trim());
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
    if (last.includes('-')) {
      variants.push(last.replace(/-/g, ' '));
    }
  } else {
    // Already in "First Last" or similar format
    variants.push(clean(trimmed));

    // Also try last name only (last word)
    const parts = clean(trimmed).split(' ');
    if (parts.length > 1) {
      const lastName = parts[parts.length - 1];
      variants.push(lastName);
    }
  }

  // Deduplicate while preserving order
  return [...new Set(variants.filter(Boolean))];
}

/**
 * Extracts the known first initial from an input name, parsed the same way
 * generateSearchVariants derives it:
 *   - "Last,First" / "Last,F." -> first letter of the part after the comma
 *   - "First Last"             -> first letter of the first token
 * Returns a lowercase single letter, or "" if no first initial is known
 * (e.g. a bare last name with no comma and a single token).
 */
function getInputFirstInitial(name: string | null | undefined): string {
  return parseInstructorName(name).firstInitial;
}

/**
 * Normalize a string for comparison: lowercase, letters only.
 */
function normalize(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

// --- Matching ---

/**
 * Creates name-only search tokens from a professor's RMP data.
 * Excludes rating tags to avoid polluting name matching.
 */
function createNameTokens(node: RmpTeacherNode): string[] {
  const first = node?.firstName ? String(node.firstName).trim() : '';
  const last = node?.lastName ? String(node.lastName).trim() : '';
  const tokens: string[] = [];

  if (first || last) {
    const fullName = [first, last].filter(Boolean).join(' ');
    const reversedName = [last, first].filter(Boolean).join(', ');
    const initial = first ? first[0] : '';

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
 * @param edges - GraphQL teacher edges
 * @param name - The professor name to match against
 * @param options - Matching options
 * @returns The best matching professor node, or null
 */
export function selectBestRmpMatch(
  edges: RmpEdge[] | null | undefined,
  name: string | null | undefined,
  options: SelectBestRmpMatchOptions = {}
): RmpTeacherNode | null {
  const { didFallback = false, schoolId = UCSC_SCHOOL_ID } = options;

  if (!Array.isArray(edges) || edges.length === 0) return null;

  const allCandidates: RmpTeacherNode[] = edges
    .map((edge) => edge?.node)
    .filter((node): node is RmpTeacherNode => Boolean(node))
    .map((node) => ({
      ...node,
      nameTokens: createNameTokens(node),
    }));

  if (allCandidates.length === 0) return null;
  if (!name) return null; // Don't return a random candidate without a name to match

  // When the input name yields a known first initial, restrict candidates to
  // those whose firstName starts with that initial BEFORE fuzzy matching. This
  // prevents a last-name-only search variant from letting "Smith,J." match
  // "Smith,Jane" just because she is the only/first Smith. If filtering removes
  // every candidate (odd RMP data, nicknames), fall back to the full list.
  const inputInitial = getInputFirstInitial(name);
  let candidates = allCandidates;
  if (inputInitial) {
    const filtered = allCandidates.filter(
      (c) =>
        typeof c.firstName === 'string' &&
        c.firstName.trim().charAt(0).toLowerCase() === inputInitial
    );
    if (filtered.length > 0) {
      candidates = filtered;
    }
  }

  // Use stricter threshold when RMP fell back to cross-school results
  const threshold = didFallback ? STRICT_THRESHOLD : MATCH_THRESHOLD;

  const fuse = new Fuse(candidates, {
    includeScore: true,
    shouldSort: true,
    threshold,
    ignoreLocation: true,
    keys: [
      { name: 'firstName', weight: 2 },
      { name: 'lastName', weight: 2 },
      { name: 'nameTokens', weight: 1 },
    ],
  });

  // Generate search terms from the input name
  const searchTerms = generateSearchVariants(name);
  if (searchTerms.length === 0) searchTerms.push(name.trim());

  let bestResult: FuseResult<RmpTeacherNode> | null = null;
  let bestScore = 1; // lower is better in Fuse.js

  for (const term of searchTerms) {
    const results = fuse.search(term);
    if (results.length > 0 && (results[0].score ?? 1) < bestScore) {
      bestResult = results[0];
      bestScore = results[0].score ?? 1;
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
async function fetchRmpSearchResults(
  searchText: string,
  schoolId: string = UCSC_SCHOOL_ID
): Promise<{ edges: RmpEdge[] | null; didFallback: boolean }> {
  const response = await withConcurrencyLimit(() =>
    fetch(RATE_MY_PROFESSORS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: 'Basic dGVzdDp0ZXN0',
      },
      body: JSON.stringify({
        query: RATE_MY_PROFESSORS_QUERY,
        variables: {
          text: searchText,
          schoolID: schoolId || UCSC_SCHOOL_ID,
        },
      }),
    })
  );

  if (!response.ok) {
    throw new Error(
      `RateMyProfessors request failed with status ${response.status}`
    );
  }

  const payload = (await response.json()) as RmpSearchPayload;
  if (payload?.errors?.length) {
    logger.error(
      'RateMyProfessors GraphQL errors:',
      payload.errors.map((err) => err.message).join(', ')
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
 * The `ok` field reports whether AT LEAST ONE fetch actually completed
 * (resolved, even with empty edges) vs every call throwing. A genuine empty
 * result (ok=true, edges=null) is safe to cache; an all-failures result
 * (ok=false) is a transient outage and must NOT be negative-cached.
 *
 * @param name - Professor name (any format)
 * @param schoolId - RMP school ID
 */
async function searchWithFallback(
  name: string | null | undefined,
  schoolId: string = UCSC_SCHOOL_ID
): Promise<RmpSearchResult> {
  if (!name) return { edges: null, didFallback: false, ok: true };

  const variants = generateSearchVariants(name);
  if (variants.length === 0)
    return { edges: null, didFallback: false, ok: true };

  let allEdges: RmpEdge[] = [];
  let anyDidFallback = false;
  let anyCompleted = false; // at least one fetch resolved (vs all threw)

  for (const variant of variants) {
    try {
      const { edges, didFallback } = await fetchRmpSearchResults(
        variant,
        schoolId
      );

      // The fetch resolved without throwing — a genuine search ran.
      anyCompleted = true;

      if (!edges || edges.length === 0) continue;

      anyDidFallback = didFallback;

      // Try matching with this batch of results
      const match = selectBestRmpMatch(edges, name, {
        didFallback,
        schoolId: schoolId || UCSC_SCHOOL_ID,
      });

      if (match) {
        // Found a good match — return these edges so the caller can use them
        return { edges, didFallback, ok: true };
      }

      // Accumulate edges for a final attempt
      allEdges = allEdges.concat(edges);
    } catch (err) {
      logger.error(`RMP search failed for variant "${variant}":`, err);
    }
  }

  // Return all accumulated edges if no single batch produced a confident match
  if (allEdges.length > 0) {
    return { edges: allEdges, didFallback: anyDidFallback, ok: true };
  }

  // ok reflects whether any fetch completed. If every variant threw,
  // ok=false signals a transient failure that must not be cached.
  return { edges: null, didFallback: false, ok: anyCompleted };
}

// In-flight de-dup: two simultaneous identical lookups share one promise
// instead of both hitting storage + the network. Keyed by storageKey.
const inFlightLookups = new Map<string, Promise<RmpData | null>>();

/**
 * Cached wrapper for the RateMyProfessors search API.
 * Uses fallback search strategies for better accuracy.
 *
 * Returns { edges, didFallback } (backward compatible with background.js).
 * The internal `ok` flag from searchWithFallback gates caching: genuine
 * empty results are cached, but all-transient-failure results are not, so
 * a professor's rating recovers automatically once the network is back.
 */
export async function fetchCachedRateMyProfessorData(
  uID: string | null | undefined,
  name: string,
  schoolId: string = UCSC_SCHOOL_ID
): Promise<RmpData | null> {
  if (!uID) {
    return null;
  }

  const storageKey = `${RMP_CACHE_PREFIX}${uID}`;

  // Share an existing in-flight lookup for the same key.
  const existing = inFlightLookups.get(storageKey);
  if (existing) return existing;

  const lookup = (async (): Promise<RmpData | null> => {
    try {
      const cache = await chrome.storage.local.get([storageKey]);
      const cachedEntry = cache[storageKey] as RmpCacheEntry | undefined;
      const now = Date.now();
      const cacheDurationMs = await getCacheDurationMs();

      if (cachedEntry && now - cachedEntry.timestamp < cacheDurationMs) {
        return cachedEntry.data;
      }

      const { edges, didFallback, ok } = await searchWithFallback(
        name,
        schoolId
      );

      // Only cache when a real search actually ran. A genuine "not found"
      // (ok=true, edges=null) is cacheable; an all-failures transient outage
      // (ok=false) is returned without caching so it retries next time.
      if (ok) {
        await chrome.storage.local.set({
          [storageKey]: {
            data: { edges, didFallback },
            timestamp: Date.now(),
          },
        });
      }

      return { edges, didFallback };
    } catch (error) {
      logger.error(`Failed to fetch RMP data for ${name}`, error);
      await chrome.storage.local.remove(storageKey).catch(() => {});
      return null;
    } finally {
      inFlightLookups.delete(storageKey);
    }
  })();

  inFlightLookups.set(storageKey, lookup);
  return lookup;
}

/**
 * Fetches professor reviews from RMP.
 */
export async function fetchProfessorReviews(
  legacyId: number | string,
  limit = 10
): Promise<RmpReview[]> {
  const teacherNodeId =
    typeof btoa === 'function'
      ? btoa(`Teacher-${legacyId}`)
      : Buffer.from(`Teacher-${legacyId}`).toString('base64');

  const response = await withConcurrencyLimit(() =>
    fetch(RATE_MY_PROFESSORS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: 'Basic dGVzdDp0ZXN0',
      },
      body: JSON.stringify({
        query: TEACHER_RATINGS_QUERY,
        variables: {
          id: teacherNodeId,
          first: limit,
        },
      }),
    })
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = (await response.json()) as RmpRatingsPayload;

  if (data.errors) {
    throw new Error(
      `GraphQL errors: ${data.errors.map((e) => e.message).join(', ')}`
    );
  }

  const ratings: RmpRatingNode[] =
    data?.data?.node?.ratings?.edges?.map((edge) => edge.node) || [];

  return ratings.map((rating) => ({
    id: rating.id,
    comment: rating.comment || '',
    createdAt: rating.date || null,
    helpfulRating: rating.helpfulRating ?? null,
    clarityRating: rating.clarityRating ?? null,
    difficultyRating: rating.difficultyRating ?? null,
    wouldTakeAgain: rating.wouldTakeAgain ?? null,
    className: rating.class || null,
  }));
}
