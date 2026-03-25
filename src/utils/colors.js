/**
 * Rating color palette logic extracted from ProfessorCard.
 */

export const COLOR_PRESETS = {
  excellent: { start: '#22c55e', end: '#16a34a', text: '#ffffff' },
  good: { start: '#4ade80', end: '#22c55e', text: '#ffffff' },
  average: { start: '#facc15', end: '#eab308', text: '#ffffff' },
  poor: { start: '#fb923c', end: '#f97316', text: '#ffffff' },
  bad: { start: '#f87171', end: '#ef4444', text: '#ffffff' },
};

export function buildCardStyle(palette) {
  return palette
    ? {
        background: `linear-gradient(135deg, ${palette.start}, ${palette.end})`,
        color: palette.text,
        border: 'none',
      }
    : {};
}

export function getQualityPalette(value) {
  if (typeof value !== 'number') return null;
  if (value >= 4.5) return COLOR_PRESETS.excellent;
  if (value >= 4.0) return COLOR_PRESETS.good;
  if (value >= 3.0) return COLOR_PRESETS.average;
  if (value >= 2.0) return COLOR_PRESETS.poor;
  return COLOR_PRESETS.bad;
}

export function getDifficultyPalette(value) {
  if (typeof value !== 'number') return null;
  if (value <= 2.4) return COLOR_PRESETS.excellent;
  if (value <= 3.4) return COLOR_PRESETS.average;
  if (value <= 4.2) return COLOR_PRESETS.poor;
  return COLOR_PRESETS.bad;
}

export function getRatingColorClass(value) {
  if (typeof value !== 'number') return '';
  if (value >= 4.5) return 'text-rating-excellent';
  if (value >= 4.0) return 'text-rating-good';
  if (value >= 3.0) return 'text-rating-average';
  if (value >= 2.0) return 'text-rating-poor';
  return 'text-rating-bad';
}

export function getDifficultyColorClass(value) {
  if (typeof value !== 'number') return '';
  if (value >= 4.5) return 'text-rating-bad';
  if (value >= 4.0) return 'text-rating-poor';
  if (value >= 3.0) return 'text-rating-average';
  if (value >= 2.0) return 'text-rating-good';
  return 'text-rating-excellent';
}

export function formatDate(dateString) {
  if (!dateString) return 'Date unavailable';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Returns Tailwind classes for a rating value background.
 */
export function getRatingBgClass(value) {
  if (typeof value !== 'number') return 'bg-muted';
  if (value >= 4.5) return 'bg-rating-excellent';
  if (value >= 4.0) return 'bg-rating-good';
  if (value >= 3.0) return 'bg-rating-average';
  if (value >= 2.0) return 'bg-rating-poor';
  return 'bg-rating-bad';
}
