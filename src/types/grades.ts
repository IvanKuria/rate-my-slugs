/**
 * Grade distribution data served by the Rate-My-Slugs grade server.
 * Source of truth: src/components/GradeDistribution.
 */

export type LetterGrade =
  | 'A+'
  | 'A'
  | 'A-'
  | 'B+'
  | 'B'
  | 'B-'
  | 'C+'
  | 'C'
  | 'C-'
  | 'D+'
  | 'D'
  | 'D-'
  | 'F';

export type OtherGrade = 'P' | 'NP' | 'S' | 'U' | 'I' | 'W';

export interface GradeAggregate {
  letterGrades: Partial<Record<LetterGrade, number>>;
  otherGrades: Partial<Record<OtherGrade, number>>;
  totalStudents: number;
  gpa: number | null;
}

export interface GradeDistributionEntry extends GradeAggregate {
  quarter: string;
  year: number;
}

export interface GradeApiResponse {
  success: boolean;
  error?: string;
  course?: string;
  matchedInstructor?: string;
  distributions: GradeDistributionEntry[];
  aggregated: GradeAggregate;
}

/** chrome.storage.local cache entry, key `cache_grades_<instructor>_<course>`. */
export interface GradeCacheEntry {
  timestamp: number;
  data: GradeApiResponse;
}
