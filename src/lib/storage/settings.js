/**
 * Settings storage module.
 * CRUD operations for extension settings using chrome.storage.sync.
 */

export const DEFAULT_SETTINGS = {
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
export async function getSettings() {
  try {
    const stored = await chrome.storage.sync.get('rmsSettings');
    return { ...DEFAULT_SETTINGS, ...stored.rmsSettings };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Shallow-merge update of settings.
 */
export async function updateSettings(partial) {
  const current = await getSettings();
  const updated = { ...current, ...partial };
  // Deep merge sections and enabledPages
  if (partial.sections) {
    updated.sections = { ...current.sections, ...partial.sections };
  }
  if (partial.enabledPages) {
    updated.enabledPages = { ...current.enabledPages, ...partial.enabledPages };
  }
  await chrome.storage.sync.set({ rmsSettings: updated });
  return updated;
}

/**
 * Listen for settings changes.
 */
export function onSettingsChange(callback) {
  const listener = (changes, area) => {
    if (area === 'sync' && changes.rmsSettings) {
      const newSettings = {
        ...DEFAULT_SETTINGS,
        ...changes.rmsSettings.newValue,
      };
      callback(newSettings);
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
