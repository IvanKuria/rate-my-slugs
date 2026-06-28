/**
 * User settings. Source of truth: DEFAULT_SETTINGS in src/lib/storage/settings.
 * Named AppSettings to avoid colliding with the lucide `Settings` icon.
 */

export type ThemeMode = 'light' | 'dark' | 'system';
export type AccentColor = 'ucsc-blue' | 'ucsc-gold' | 'custom';
export type ViewMode = 'expanded' | 'compact';

export interface SettingsSections {
  campusInfo: boolean;
  rmpRatings: boolean;
  gradeDistribution: boolean;
  reviews: boolean;
  tags: boolean;
}

export interface EnabledPages {
  search: boolean;
  shoppingCart: boolean;
  enrolledClasses: boolean;
}

export interface AppSettings {
  theme: ThemeMode;
  accentColor: AccentColor;
  viewMode: ViewMode;
  sections: SettingsSections;
  autoOpen: boolean;
  enabledPages: EnabledPages;
  cacheDurationDays: number;
  defaultReviewFilter: string;
  maxReviews: number;
}
