/**
 * Settings storage module.
 * CRUD operations for extension settings using chrome.storage.sync.
 */

import { SETTINGS_KEY } from '@/lib/constants';
import type { AppSettings } from '@/types';

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light', // "light" | "dark" | "system"
  accentColor: 'ucsc-blue', // "ucsc-blue" | "ucsc-gold" | "custom"
  viewMode: 'expanded', // "expanded" | "compact"
  sections: {
    campusInfo: true,
    rmpRatings: true,
    gradeDistribution: true,
    reviews: true,
    tags: true,
  },
  autoOpen: false,
  enabledPages: {
    search: true,
    shoppingCart: true,
    enrolledClasses: true,
  },
  cacheDurationDays: 7,
  defaultReviewFilter: 'ALL',
  maxReviews: 20,
};

/**
 * Reads settings from chrome.storage.sync, merged with defaults.
 */
export async function getSettings(): Promise<AppSettings> {
  try {
    const stored = await chrome.storage.sync.get(SETTINGS_KEY);
    return {
      ...DEFAULT_SETTINGS,
      ...(stored[SETTINGS_KEY] as Partial<AppSettings> | undefined),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Shallow-merge update of settings.
 */
export async function updateSettings(
  partial: Partial<AppSettings>
): Promise<AppSettings> {
  const current = await getSettings();
  const updated: AppSettings = { ...current, ...partial };
  // Deep merge sections and enabledPages
  if (partial.sections) {
    updated.sections = { ...current.sections, ...partial.sections };
  }
  if (partial.enabledPages) {
    updated.enabledPages = { ...current.enabledPages, ...partial.enabledPages };
  }
  await chrome.storage.sync.set({ [SETTINGS_KEY]: updated });
  return updated;
}

/**
 * Listen for settings changes.
 */
export function onSettingsChange(
  callback: (settings: AppSettings) => void
): () => void {
  const listener = (
    changes: { [key: string]: chrome.storage.StorageChange },
    area: chrome.storage.AreaName
  ): void => {
    if (area === 'sync' && changes[SETTINGS_KEY]) {
      const newSettings: AppSettings = {
        ...DEFAULT_SETTINGS,
        ...(changes[SETTINGS_KEY].newValue as Partial<AppSettings> | undefined),
      };
      callback(newSettings);
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
