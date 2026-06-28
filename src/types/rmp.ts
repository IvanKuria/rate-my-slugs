/**
 * Rate My Professors data shapes. Source of truth: the GraphQL query and the
 * mapping in src/lib/background/rmpCache.
 */

export interface RmpTeacherRatingTag {
  id: string;
  legacyId: number;
  tagCount: number;
  tagName: string;
}

export interface RmpSchool {
  name: string;
  id: string;
}

export interface RmpTeacherNode {
  id: string;
  legacyId: number;
  firstName: string;
  lastName: string;
  avgRatingRounded: number;
  numRatings: number;
  /** RMP returns -1 when unknown; normalized to null at the source. */
  wouldTakeAgainPercentRounded: number | null;
  wouldTakeAgainCount: number;
  teacherRatingTags: RmpTeacherRatingTag[];
  avgDifficultyRounded: number;
  school: RmpSchool;
  department: string;
  /** Internal: search tokens added during matching, not part of the wire shape. */
  nameTokens?: string[];
  /** Legacy field some displays defensively read; not in the GraphQL query. */
  wouldTakeAgainPercent?: number | null;
}

export interface RmpEdge {
  cursor?: string;
  node: RmpTeacherNode;
}

/** Mapped review shape returned by fetchProfessorReviews (renamed from GraphQL). */
export interface RmpReview {
  id: string;
  comment: string;
  /** From GraphQL `date`. */
  createdAt: string | null;
  helpfulRating: number | null;
  clarityRating: number | null;
  difficultyRating: number | null;
  wouldTakeAgain: boolean | null;
  /** From GraphQL `class`. */
  className: string | null;
}

/** Internal result of the cascading RMP search. */
export interface RmpSearchResult {
  edges: RmpEdge[] | null;
  didFallback: boolean;
  /** True if at least one fetch completed; false only if every fetch threw. */
  ok: boolean;
}
