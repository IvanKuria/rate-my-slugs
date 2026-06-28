/**
 * The professor "bundle" objects that cross process boundaries.
 *
 * - ProfessorBundle: assembled by the background service worker.
 * - ProfessorData: the component props bundle (adds the locally-resolved
 *   research/classes fields and the scraped instructor name / course).
 *
 * Both key the campus-directory profile under `campusProfile`.
 */

import type { CampusProfile } from './campus';
import type { RmpTeacherNode, RmpReview } from './rmp';

export interface ProfessorBundle {
  campusProfile: CampusProfile | null;
  campusSuccess: boolean;
  rateMyProfessor: RmpTeacherNode | null;
  reviews: RmpReview[];
}

export interface ProfessorData {
  campusProfile: CampusProfile | null;
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
