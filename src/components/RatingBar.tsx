/**
 * @file RatingBar.tsx
 * Compact inline rating bar: star rating badge + details button.
 * Designed for injection into UCSC enrollment pages.
 */

import React from 'react';

import type { ProfessorData, ShowProfessorMessage } from '@/types';

interface Props {
  /** Full professor data bundle. */
  professorData: ProfessorData | null;
  /** Whether data is still loading. */
  loading: boolean;
}

/**
 * Opens the side panel with full professor details.
 */
function handleBarClick(professorData: ProfessorData | null): void {
  if (!professorData) return;
  const message: ShowProfessorMessage = {
    action: 'showProfessor',
    data: { ...professorData },
  };
  chrome.runtime.sendMessage(message);
}

/**
 * RatingBar component.
 */
export default function RatingBar({ professorData, loading }: Props) {
  if (loading) {
    return (
      <div
        className="rms-rating-bar-skeleton"
        aria-label="Loading professor rating..."
      />
    );
  }

  if (!professorData) {
    return null;
  }

  const { rateMyProfessor, instructorName } = professorData;

  const numRatings = rateMyProfessor?.numRatings ?? 0;
  const hasRatings = numRatings > 0;
  const overallRating = hasRatings
    ? (rateMyProfessor?.avgRatingRounded ?? null)
    : null;
  const wouldTakeAgain = hasRatings
    ? (rateMyProfessor?.wouldTakeAgainPercentRounded ?? null)
    : null;
  const ratingDisplay =
    overallRating != null ? Number(overallRating).toFixed(1) : null;
  const againDisplay =
    wouldTakeAgain != null && wouldTakeAgain >= 0
      ? `${Math.round(wouldTakeAgain)}%`
      : null;

  return (
    <div
      className="rms-rating-bar"
      aria-label={`Professor rating for ${instructorName || 'unknown'}: ${ratingDisplay ?? 'N/A'}`}
    >
      {ratingDisplay != null && (
        <span className="rms-rating">
          <span className="rms-star">★</span>
          <span className="rms-score">{ratingDisplay}</span>
          {numRatings != null && (
            <span className="rms-count">({numRatings})</span>
          )}
        </span>
      )}

      {againDisplay != null && (
        <span className="rms-again">
          <span className="rms-again-value">{againDisplay}</span>
          <span className="rms-again-label">would retake</span>
        </span>
      )}

      <button
        className="rms-details"
        onClick={() => handleBarClick(professorData)}
        type="button"
        aria-label={`View details for ${instructorName || 'professor'}`}
      >
        <span className="rms-details-text">Details</span>
        <span className="rms-details-arrow">→</span>
      </button>
    </div>
  );
}
