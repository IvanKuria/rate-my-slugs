/**
 * Derives the display view-model for the professor panel from the raw
 * campus-directory (LDAP) and Rate My Professors data. Pure and unit-testable;
 * chrome-dependent bits (photo fallback, slug logo) and settings-driven section
 * visibility stay in the component.
 */

import { getFirst } from '@/lib/format';
import type { CampusField, ProfessorData, RmpTeacherRatingTag } from '@/types';

export interface ProfessorViewModel {
  name: string;
  department: string | null;
  division: string | null;
  email: string | null;
  phone: string | null;
  officeHours: string | null;
  researchInterest: string | null;
  courses: string[] | CampusField | null;
  /** The directory photo, if it is a real uid-backed photo; null otherwise. */
  directoryPhoto: CampusField | null;
  website: string | null;
  publicationLinks: string[];
  overallRating: number | null;
  difficulty: number | null;
  takeAgainPercent: number | null;
  numRatings: number;
  topTags: RmpTeacherRatingTag[];
  rmpUrl: string | null;
  /** Stable key for animated professor transitions. */
  professorKey: string;
}

function extractLinks(html: unknown): string[] {
  if (typeof html !== 'string') return [];
  const links: string[] = [];
  const hrefPattern = /href="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = hrefPattern.exec(html)) !== null) links.push(m[1]);
  return links;
}

export function deriveProfessorViewModel(
  data: ProfessorData
): ProfessorViewModel {
  const {
    campusProfile,
    rateMyProfessor: rmpNode,
    localClassesTaught,
    instructorName,
  } = data;

  const name =
    getFirst(campusProfile?.cn) || instructorName || 'Unknown Professor';
  const department = getFirst(campusProfile?.ucscpersonpubdepartmentnumber);
  const division = getFirst(campusProfile?.ucscpersonpubdivision);
  const email = getFirst(campusProfile?.mail);
  const phone = getFirst(campusProfile?.telephonenumber);
  const officeHours = getFirst(campusProfile?.ucscpersonpubofficehours);
  const researchInterest = getFirst(
    campusProfile?.ucscpersonpubresearchinterest
  );
  const courses =
    localClassesTaught || campusProfile?.ucscpersonpubfacultycourses;

  // Photo: keep only a real uid-backed directory photo; the component applies
  // the default-avatar fallback (which needs chrome.runtime.getURL).
  const photoURL = campusProfile?.jpegphoto;
  const directoryPhoto =
    photoURL && (photoURL as string).includes('uid') ? photoURL : null;

  // Website (first token of the first value).
  let website: string | null = null;
  const websiteField = campusProfile?.ucscpersonpubwebsite;
  if (Array.isArray(websiteField) && websiteField.length > 0) {
    const raw = websiteField[0];
    if (typeof raw === 'string' && raw.trim()) {
      website = raw.split(' ')[0].trim();
    }
  } else if (typeof websiteField === 'string' && websiteField.trim()) {
    website = websiteField.split(' ')[0].trim();
  }

  // Publications.
  let publicationLinks: string[] = [];
  const pubField = campusProfile?.ucscpersonpubselectedpublication;
  if (Array.isArray(pubField) && pubField.length > 0) {
    publicationLinks = extractLinks(pubField[0]);
  } else if (typeof pubField === 'string') {
    publicationLinks = extractLinks(pubField);
  }

  // RMP data.
  const overallRating = rmpNode?.avgRatingRounded ?? null;
  const difficulty = rmpNode?.avgDifficultyRounded ?? null;
  // RMP returns -1 for unknown would-take-again; treat any negative as no data.
  const rawTakeAgain =
    rmpNode?.wouldTakeAgainPercentRounded ??
    rmpNode?.wouldTakeAgainPercent ??
    null;
  const takeAgainPercent =
    typeof rawTakeAgain === 'number' && rawTakeAgain >= 0 ? rawTakeAgain : null;
  const numRatings = rmpNode?.numRatings ?? 0;
  const ratingTags = Array.isArray(rmpNode?.teacherRatingTags)
    ? rmpNode!.teacherRatingTags.filter((t) => t?.tagName)
    : [];
  const topTags = ratingTags.slice(0, 5);
  const legacyId = rmpNode?.legacyId;
  const rmpUrl = legacyId
    ? `https://www.ratemyprofessors.com/professor/${legacyId}`
    : null;

  const professorKey = rmpNode?.id || `${name}-${department || 'unknown'}`;

  return {
    name,
    department,
    division,
    email,
    phone,
    officeHours,
    researchInterest,
    courses,
    directoryPhoto,
    website,
    publicationLinks,
    overallRating,
    difficulty,
    takeAgainPercent,
    numRatings,
    topTags,
    rmpUrl,
    professorKey,
  };
}
