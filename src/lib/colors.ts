/**
 * Rating color palette logic (shared by the rating summary and review items).
 */

import type { CSSProperties } from 'react';

export interface Palette {
  start: string;
  end: string;
  text: string;
}

export const COLOR_PRESETS = {
  excellent: { start: '#22c55e', end: '#16a34a', text: '#ffffff' },
  good: { start: '#4ade80', end: '#22c55e', text: '#ffffff' },
  average: { start: '#facc15', end: '#eab308', text: '#ffffff' },
  poor: { start: '#fb923c', end: '#f97316', text: '#ffffff' },
  bad: { start: '#f87171', end: '#ef4444', text: '#ffffff' },
} satisfies Record<string, Palette>;

export function buildCardStyle(palette: Palette | null): CSSProperties {
  return palette
    ? {
        background: `linear-gradient(135deg, ${palette.start}, ${palette.end})`,
        color: palette.text,
        border: 'none',
      }
    : {};
}

export function getQualityPalette(
  value: number | null | undefined
): Palette | null {
  if (typeof value !== 'number') return null;
  if (value >= 4.5) return COLOR_PRESETS.excellent;
  if (value >= 4.0) return COLOR_PRESETS.good;
  if (value >= 3.0) return COLOR_PRESETS.average;
  if (value >= 2.0) return COLOR_PRESETS.poor;
  return COLOR_PRESETS.bad;
}

export function getDifficultyPalette(
  value: number | null | undefined
): Palette | null {
  if (typeof value !== 'number') return null;
  if (value <= 2.4) return COLOR_PRESETS.excellent;
  if (value <= 3.4) return COLOR_PRESETS.average;
  if (value <= 4.2) return COLOR_PRESETS.poor;
  return COLOR_PRESETS.bad;
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return 'Date unavailable';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
