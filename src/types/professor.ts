/**
 * The professor "bundle" objects that cross process boundaries.
 *
 * Two related shapes exist because the page modules re-key the background
 * bundle before passing it to components:
 *   - ProfessorBundle: assembled by the background (campus field keyed `data`).
 *   - ProfessorData: the component props bundle (campus field keyed `apiData`).
 *
 * These two campus-field names will be unified to `campusProfile` in a later,
 * typecheck-enforced rename phase; for now the types match the current code.
 */

import type { CampusProfile } from './campus';
import type { RmpTeacherNode, RmpReview } from './rmp';

export interface ProfessorBundle {
  data: CampusProfile | null;
  campusSuccess: boolean;
  rateMyProfessor: RmpTeacherNode | null;
  reviews: RmpReview[];
}

export interface ProfessorData {
  apiData: CampusProfile | null;
  rateMyProfessor: RmpTeacherNode | null;
  reviews: RmpReview[];
  localResearchTopic: string | null;
  localClassesTaught: string[] | null;
  instructorName: string;
  course: string | null;
}

/** chrome.storage.session payload for the side-panel handoff. */
export interface PendingProfessor {
  data: ProfessorData;
  savedAt: number;
}
