import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import Draggable from "react-draggable";
import { getFirst, roundToWhole, roundToOneDecimal, formatNumber, StarRating } from "@/utils/utils";
import SlugRating from "@/components/SlugRating";
import GradeDistribution from "@/components/GradeDistribution";

// ─── Color presets for gradient summary cards ────────────────────────────────

const COLOR_PRESETS = {
  excellent: { start: '#22c55e', end: '#16a34a', text: '#ffffff' },
  good: { start: '#4ade80', end: '#22c55e', text: '#ffffff' },
  average: { start: '#facc15', end: '#eab308', text: '#1f2937' },
  poor: { start: '#fb923c', end: '#f97316', text: '#ffffff' },
  bad: { start: '#f87171', end: '#ef4444', text: '#ffffff' },
};

const buildCardStyle = (palette) =>
  palette
    ? {
        background: `linear-gradient(135deg, ${palette.start}, ${palette.end})`,
        color: palette.text,
        border: 'none',
      }
    : {};

const getQualityPalette = (value) => {
  if (typeof value !== 'number') return null;
  if (value >= 4.5) return COLOR_PRESETS.excellent;
  if (value >= 4.0) return COLOR_PRESETS.good;
  if (value >= 3.0) return COLOR_PRESETS.average;
  if (value >= 2.0) return COLOR_PRESETS.poor;
  return COLOR_PRESETS.bad;
};

const getDifficultyPalette = (value) => {
  if (typeof value !== 'number') return null;
  if (value <= 2.4) return COLOR_PRESETS.excellent;
  if (value <= 3.4) return COLOR_PRESETS.average;
  if (value <= 4.2) return COLOR_PRESETS.poor;
  return COLOR_PRESETS.bad;
};

const getRatingColorClass = (value) => {
  if (typeof value !== 'number') return '';
  if (value >= 4.5) return 'rmp-rating-excellent';
  if (value >= 4.0) return 'rmp-rating-good';
  if (value >= 3.0) return 'rmp-rating-average';
  if (value >= 2.0) return 'rmp-rating-poor';
  return 'rmp-rating-bad';
};

const getDifficultyColorClass = (value) => {
  if (typeof value !== 'number') return '';
  if (value >= 4.5) return 'rmp-difficulty-very-hard';
  if (value >= 4.0) return 'rmp-difficulty-hard';
  if (value >= 3.0) return 'rmp-difficulty-average';
  if (value >= 2.0) return 'rmp-difficulty-moderate';
  return 'rmp-difficulty-easy';
};

const formatDate = (dateString) => {
  if (!dateString) return 'Date unavailable';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

// ─── Global z-index and active card tracking ─────────────────────────────────

if (typeof window !== 'undefined') {
  if (window.RMS_Z_INDEX == null) window.RMS_Z_INDEX = 10000;
  if (window.RMS_ACTIVE_CARDS == null) window.RMS_ACTIVE_CARDS = new Set();
}

const nextZIndex = () => {
  window.RMS_Z_INDEX = (window.RMS_Z_INDEX || 10000) + 1;
  return window.RMS_Z_INDEX;
};

// ─── Smart positioning helper ────────────────────────────────────────────────

function computePopupPosition(buttonEl) {
  if (!buttonEl) return { top: 100, left: 100 };
  const rect = buttonEl.getBoundingClientRect();
  const popupWidth = 420;
  const popupHeight = 520;
  const margin = 12;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // Narrow screen: center
  if (viewportWidth < 600) {
    return {
      top: Math.max(10, (viewportHeight - popupHeight) / 2),
      left: Math.max(10, (viewportWidth - popupWidth) / 2),
    };
  }

  // Try right of button
  const rightLeft = rect.right + margin;
  if (rightLeft + popupWidth < viewportWidth) {
    return {
      top: Math.max(10, Math.min(rect.top, viewportHeight - popupHeight - 10)),
      left: rightLeft,
    };
  }

  // Fall back to left of button
  const leftLeft = rect.left - margin - popupWidth;
  if (leftLeft > 0) {
    return {
      top: Math.max(10, Math.min(rect.top, viewportHeight - popupHeight - 10)),
      left: leftLeft,
    };
  }

  // Default: center
  return {
    top: Math.max(10, (viewportHeight - popupHeight) / 2),
    left: Math.max(10, (viewportWidth - popupWidth) / 2),
  };
}

// ─── ProfessorCard Component ─────────────────────────────────────────────────

const ProfessorCard = ({
  apiData,
  rateMyProfessor,
  reviews: reviewsProp,
  localResearchTopic,
  localClassesTaught,
  instructorName,
  course,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [zIndex, setZIndex] = useState(10000);
  const [isLocked, setIsLocked] = useState(false);
  const [showMoreInfo, setShowMoreInfo] = useState(false);
  const [selectedClassFilter, setSelectedClassFilter] = useState('ALL');
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);

  const buttonRef = useRef(null);
  const nodeRef = useRef(null);
  const cardId = useRef(`prof-card-${instructorName || 'unknown'}-${Date.now()}`);

  // ── Bail out if no data at all ───────────────────────────────────────────
  if (!apiData && !rateMyProfessor) return null;

  // ── Derived data ─────────────────────────────────────────────────────────

  // Campus directory uses LDAP-style attribute names
  const name = getFirst(apiData?.cn) || instructorName || 'Unknown Professor';
  const department = getFirst(apiData?.ucscpersonpubdepartmentnumber);
  const divisionValue = getFirst(apiData?.ucscpersonpubdivision);
  const email = getFirst(apiData?.mail);
  const phone = getFirst(apiData?.telephonenumber);
  const officeHours = getFirst(apiData?.ucscpersonpubofficehours);
  const researchInterest = getFirst(apiData?.ucscpersonpubresearchinterest);
  const courses = localClassesTaught || apiData?.ucscpersonpubfacultycourses;

  // Photo: campus directory provides a URL with "uid" in it
  const photoURL = apiData?.jpegphoto;
  const photoSrc = (photoURL && photoURL.includes("uid"))
    ? photoURL
    : (typeof chrome !== 'undefined' && chrome.runtime?.getURL
      ? chrome.runtime.getURL('images/default_pfp.png')
      : null);

  // Website extraction
  let website = null;
  const websiteField = apiData?.ucscpersonpubwebsite;
  if (Array.isArray(websiteField) && websiteField.length > 0) {
    const raw = websiteField[0];
    if (typeof raw === 'string' && raw.trim()) website = raw.split(' ')[0].trim();
  } else if (typeof websiteField === 'string' && websiteField.trim()) {
    website = websiteField.split(' ')[0].trim();
  }

  // Publications extraction
  let publicationLinks = [];
  const pubField = apiData?.ucscpersonpubselectedpublication;
  const extractLinks = (html) => {
    if (typeof html !== 'string') return [];
    const links = [];
    const regex = /href="([^"]+)"/g;
    let m;
    while ((m = regex.exec(html)) !== null) links.push(m[1]);
    return links;
  };
  if (Array.isArray(pubField) && pubField.length > 0) {
    publicationLinks = extractLinks(pubField[0]);
  } else if (typeof pubField === 'string') {
    publicationLinks = extractLinks(pubField);
  }

  const researchInterests = localResearchTopic;
  // Only show division if different from department
  const showDivision = divisionValue && department &&
    divisionValue.trim().toLowerCase() !== department.trim().toLowerCase();

  // RMP data — background returns the raw node from selectBestRmpMatch
  const rmpNode = rateMyProfessor;
  const overallRating = rmpNode?.avgRatingRounded ?? null;
  const difficulty = rmpNode?.avgDifficultyRounded ?? null;
  // RMP returns -1 for unknown would-take-again; treat any negative as no data.
  const rawTakeAgain = rmpNode?.wouldTakeAgainPercentRounded ?? rmpNode?.wouldTakeAgainPercent ?? null;
  const takeAgainPercent = (typeof rawTakeAgain === 'number' && rawTakeAgain >= 0) ? rawTakeAgain : null;
  const numRatings = rmpNode?.numRatings ?? 0;
  const ratingTags = Array.isArray(rmpNode?.teacherRatingTags)
    ? rmpNode.teacherRatingTags.filter((t) => t?.tagName)
    : [];
  const topTags = ratingTags.slice(0, 5);
  const legacyId = rmpNode?.legacyId;
  const rmpUrl = legacyId
    ? `https://www.ratemyprofessors.com/professor/${legacyId}`
    : null;

  // Reviews (from prop, NOT from rateMyProfessor)
  const reviews = Array.isArray(reviewsProp) ? reviewsProp : [];
  const uniqueClasses = Array.from(
    new Set(
      reviews
        .map((r) => r.className)
        .filter((c) => c && c.trim().length > 0)
    )
  );
  const filteredReviews =
    selectedClassFilter === 'ALL'
      ? reviews
      : reviews.filter((r) => r.className === selectedClassFilter);
  const maxShownDefault = reviews.length < 10 ? reviews.length : 10;
  const reviewsToDisplay =
    selectedClassFilter === 'ALL'
      ? filteredReviews.slice(0, maxShownDefault)
      : filteredReviews;

  // Palettes
  const qualityPalette = getQualityPalette(overallRating);
  const difficultyPalette = getDifficultyPalette(difficulty);
  const overallClass = getRatingColorClass(overallRating);
  const difficultyClass = getDifficultyColorClass(difficulty);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleOpen = () => {
    if (window.RMS_ACTIVE_CARDS?.has(cardId.current)) return;
    window.RMS_ACTIVE_CARDS?.add(cardId.current);
    setZIndex(nextZIndex());
    setSelectedClassFilter('ALL');
    setCurrentReviewIndex(0);
    setShowMoreInfo(false);
    setIsOpen(true);
  };

  const handleClose = () => {
    window.RMS_ACTIVE_CARDS?.delete(cardId.current);
    setIsOpen(false);
  };

  const bringToFront = () => {
    setZIndex(nextZIndex());
  };

  // ── Render: review item ──────────────────────────────────────────────────

  const renderReview = (review) => (
    <div className="rmp-review-item" key={review.id || `${review.createdAt}-${review.className}`}>
      <div className="rmp-review-meta">
        {review.className && <span className="rmp-review-class">{review.className}</span>}
        {review.createdAt && <span className="rmp-review-date">{formatDate(review.createdAt)}</span>}
      </div>
      <p className="rmp-review-comment">
        {review.comment ? review.comment : 'No written review provided.'}
      </p>
      <div className="rmp-review-stats">
        {typeof review.helpfulRating === 'number' && (
          <span className="rmp-review-stat" data-type="helpful">
            Helpful: {review.helpfulRating.toFixed(1)}
          </span>
        )}
        {typeof review.clarityRating === 'number' && (
          <span className="rmp-review-stat" data-type="clarity">
            Clarity: {review.clarityRating.toFixed(1)}
          </span>
        )}
        {typeof review.difficultyRating === 'number' && (
          <span className="rmp-review-stat" data-type="difficulty">
            Difficulty: {review.difficultyRating.toFixed(1)}
          </span>
        )}
        {typeof review.wouldTakeAgain === 'boolean' && (
          <span className="rmp-review-stat" data-type="take-again">
            Would take again: {review.wouldTakeAgain ? 'Yes' : 'No'}
          </span>
        )}
      </div>
    </div>
  );

  // ── Render: popup card ───────────────────────────────────────────────────

  const renderPopup = () => {
    if (!isOpen) return null;

    const pos = computePopupPosition(buttonRef.current);

    return createPortal(
      <Draggable
        nodeRef={nodeRef}
        handle=".prof-card-drag-handle"
        disabled={isLocked}
        defaultPosition={{ x: 0, y: 0 }}
        onStart={bringToFront}
      >
        <div
          ref={nodeRef}
          className="prof-card-popup"
          style={{ zIndex, position: 'fixed', top: pos.top, left: pos.left }}
          onMouseDown={bringToFront}
        >
          {/* ── Header / Drag Handle ── */}
          <header className="prof-card-popup-header prof-card-drag-handle">
            <span className="prof-card-popup-title">{name}</span>
            <div className="prof-card-popup-controls">
              <button
                className="prof-card-lock-btn"
                onClick={() => setIsLocked((prev) => !prev)}
                title={isLocked ? 'Unlock dragging' : 'Lock position'}
                aria-label={isLocked ? 'Unlock dragging' : 'Lock position'}
              >
                {isLocked ? (
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                    <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                    <path d="M12 17c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-9h-1V6c0-2.76-2.24-5-5-5-1.13 0-2.17.37-3.01 1.01l1.46 1.46C10.89 3.17 11.43 3 12 3c1.65 0 3 1.35 3 3v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2z" />
                  </svg>
                )}
              </button>
              <button
                className="prof-card-close-btn"
                onClick={handleClose}
                aria-label="Close professor card"
              >
                &times;
              </button>
            </div>
          </header>

          <div className="prof-card-popup-body">
            {/* ════════════════════════════════════════════════════════════
                Section 1: Campus Directory - About the Professor
               ════════════════════════════════════════════════════════════ */}
            {apiData && (
              <section className="prof-card-section prof-card-directory">
                <h4 className="prof-card-section-title">About the Professor</h4>

                <div className="prof-card-identity">
                  {photoSrc && (
                    <img
                      className="prof-card-photo"
                      src={photoSrc}
                      alt={`Photo of ${name}`}
                    />
                  )}
                  <div className="prof-card-identity-text">
                    <span className="prof-card-name">{name}</span>
                    <div className="prof-card-chips">
                      {department && <span className="prof-card-chip prof-card-chip-dept">{department}</span>}
                      {showDivision && <span className="prof-card-chip prof-card-chip-div">{divisionValue}</span>}
                    </div>
                  </div>
                </div>

                {/* Contact */}
                <div className="prof-card-contact">
                  {email && (
                    <div className="prof-card-contact-row">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
                        <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                      </svg>
                      <a href={`mailto:${email}`} className="prof-card-link">{email}</a>
                    </div>
                  )}
                  {phone && (
                    <div className="prof-card-contact-row">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
                        <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.57.57a1 1 0 011 1v3.5a1 1 0 01-1 1C10.07 21.01 3 13.93 3 5a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.45.57 3.57a1 1 0 01-.24 1.02l-2.2 2.2z" />
                      </svg>
                      <span>{phone}</span>
                    </div>
                  )}
                </div>

                {/* More Info toggle */}
                <button
                  className="prof-card-more-toggle"
                  onClick={() => setShowMoreInfo((prev) => !prev)}
                >
                  {showMoreInfo ? 'Hide Details' : 'More Info'}
                  <svg
                    viewBox="0 0 24 24"
                    width="14"
                    height="14"
                    fill="currentColor"
                    style={{
                      transform: showMoreInfo ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s',
                    }}
                  >
                    <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
                  </svg>
                </button>

                {showMoreInfo && (
                  <div className="prof-card-more-info">
                    {officeHours && (
                      <div className="prof-card-info-block">
                        <span className="prof-card-info-label">Office Hours</span>
                        <span className="prof-card-info-value">{officeHours}</span>
                      </div>
                    )}
                    {Array.isArray(courses) && courses.length > 0 && (
                      <div className="prof-card-info-block">
                        <span className="prof-card-info-label">Courses Taught</span>
                        <ul className="prof-card-list">
                          {courses.map((c, i) => <li key={i}>{c}</li>)}
                        </ul>
                      </div>
                    )}
                    {(researchInterests || researchInterest) && (
                      <div className="prof-card-info-block">
                        <span className="prof-card-info-label">Research</span>
                        {researchInterest && (
                          <span className="prof-card-info-value">{researchInterest}</span>
                        )}
                        {researchInterests && (
                          <span className="prof-card-info-value">{researchInterests}</span>
                        )}
                      </div>
                    )}
                    {website && (
                      <div className="prof-card-info-block">
                        <span className="prof-card-info-label">Website</span>
                        <a
                          href={website.startsWith('http') ? website : `https://${website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="prof-card-link"
                        >
                          {website}
                        </a>
                      </div>
                    )}
                    {publicationLinks.length > 0 && (
                      <div className="prof-card-info-block">
                        <span className="prof-card-info-label">Publications</span>
                        <ul className="prof-card-list">
                          {publicationLinks.map((link, i) => (
                            <li key={i}>
                              <a href={link} target="_blank" rel="noopener noreferrer" className="prof-card-link">
                                {link.length > 40 ? link.slice(0, 40) + '...' : link}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}

            {/* Fallback identity header when no campus data */}
            {!apiData && (
              <div className="prof-card-identity prof-card-identity-fallback">
                {photoSrc && (
                  <img
                    className="prof-card-photo"
                    src={photoSrc}
                    alt={`Photo of ${name}`}
                  />
                )}
                <div className="prof-card-identity-text">
                  <span className="prof-card-name">{name}</span>
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════
                Section 2: Rate My Professor Summary
               ════════════════════════════════════════════════════════════ */}
            {rmpNode && (
              <section className="prof-card-section prof-card-rmp">
                <h4 className="prof-card-section-title">Rate My Professor</h4>

                {numRatings === 0 ? (
                  <div className="rmp-no-ratings">
                    <p>Profile exists but no ratings yet.</p>
                    {rmpUrl && (
                      <a
                        className="rmp-leave-rating-btn"
                        href={rmpUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Leave a rating
                      </a>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Star rating header */}
                    <div className="prof-card-star-row">
                      <StarRating rating={roundToWhole(overallRating)} numRatings={numRatings} />
                      <span className="prof-card-num-ratings">({numRatings} ratings)</span>
                    </div>

                    {/* Summary cards */}
                    <div className="rmp-modal-summary">
                      <div
                        className={`rmp-summary-card rmp-quality ${overallClass}`}
                        style={{ ...buildCardStyle(qualityPalette), color: '#ffffff' }}
                      >
                        <span className="rmp-summary-label">Quality</span>
                        <div className="rmp-summary-value">
                          <SlugRating rating={overallRating || 0} />
                          {overallRating != null ? `${formatNumber(overallRating)}/5` : 'N/A'}
                        </div>
                      </div>
                      <div
                        className={`rmp-summary-card rmp-difficulty ${difficultyClass}`}
                        style={buildCardStyle(difficultyPalette)}
                      >
                        <span className="rmp-summary-label">Difficulty</span>
                        <span className="rmp-summary-value">
                          {difficulty != null ? `${formatNumber(difficulty)}/5` : 'N/A'}
                        </span>
                      </div>
                      <div className="rmp-summary-card rmp-take-again">
                        <span className="rmp-summary-label">Would take again</span>
                        <span className="rmp-summary-value rmp-take-again-text">
                          {takeAgainPercent != null ? `${roundToOneDecimal(takeAgainPercent)}%` : 'N/A'}
                        </span>
                      </div>
                      <div className="rmp-summary-card rmp-total-reviews">
                        <span className="rmp-summary-label">Total reviews</span>
                        <span className="rmp-summary-value">{numRatings}</span>
                      </div>
                    </div>

                    {/* Top tags */}
                    {Array.isArray(topTags) && topTags.length > 0 && (
                      <div className="prof-card-tags">
                        {topTags.map((tag, i) => {
                          const label = typeof tag === 'string' ? tag : tag?.tagName || tag?.name;
                          const count = typeof tag === 'object' ? tag?.tagCount : null;
                          if (!label) return null;
                          return (
                            <span className="prof-card-tag" key={i}>
                              {label}{count != null ? ` (${count})` : ''}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Profile link */}
                    {rmpUrl && (
                      <a
                        className="rmp-view-profile-btn"
                        href={rmpUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View full profile on RateMyProfessors
                      </a>
                    )}
                  </>
                )}
              </section>
            )}

            {/* ════════════════════════════════════════════════════════════
                Section 3: Grade Distribution
               ════════════════════════════════════════════════════════════ */}
            {instructorName && (
              <section className="prof-card-section prof-card-grades">
                <GradeDistribution instructorName={instructorName} course={course} />
              </section>
            )}

            {/* ════════════════════════════════════════════════════════════
                Section 4: Reviews Carousel
               ════════════════════════════════════════════════════════════ */}
            {reviews.length > 0 && (
              <section className="prof-card-section prof-card-reviews">
                <header className="rmp-reviews-header">
                  <h4 className="prof-card-section-title">Reviews</h4>
                  {reviewsToDisplay.length > 0 && (
                    <span className="prof-card-review-counter">
                      {currentReviewIndex + 1} of {reviewsToDisplay.length}
                    </span>
                  )}
                </header>

                {/* Class filter */}
                {uniqueClasses.length > 0 && (
                  <div className="rmp-reviews-filter">
                    <label htmlFor="prof-card-class-filter">Filter by class</label>
                    <select
                      id="prof-card-class-filter"
                      value={selectedClassFilter}
                      onChange={(e) => {
                        setSelectedClassFilter(e.target.value);
                        setCurrentReviewIndex(0);
                      }}
                    >
                      <option value="ALL">All classes</option>
                      {uniqueClasses.map((cls) => (
                        <option key={cls} value={cls}>{cls}</option>
                      ))}
                    </select>
                  </div>
                )}

                {reviewsToDisplay.length === 0 ? (
                  <div className="rmp-review-empty">No reviews match the selected filter.</div>
                ) : (
                  <div className="rmp-review-carousel">
                    {renderReview(reviewsToDisplay[currentReviewIndex])}
                    <div className="rmp-carousel-nav">
                      <button
                        className="rmp-carousel-btn"
                        onClick={() => setCurrentReviewIndex((i) => Math.max(0, i - 1))}
                        disabled={currentReviewIndex === 0}
                      >
                        Prev
                      </button>
                      <button
                        className="rmp-carousel-btn"
                        onClick={() =>
                          setCurrentReviewIndex((i) => Math.min(reviewsToDisplay.length - 1, i + 1))
                        }
                        disabled={currentReviewIndex === reviewsToDisplay.length - 1}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* ── Feedback ── */}
            <div className="rmp-feedback">
              <a href="mailto:ikuria@ucsc.edu?subject=Rate My Slugs Feedback" className="rmp-feedback-link">
                Have feedback? Let me know
              </a>
            </div>
          </div>
        </div>
      </Draggable>,
      document.body
    );
  };

  // ── Render: trigger button ───────────────────────────────────────────────

  return (
    <>
      <button
        ref={buttonRef}
        className="prof-card-info-btn"
        onClick={handleOpen}
        title={`View details for ${name}`}
        aria-label={`Open professor info card for ${name}`}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="#ffffff">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
        </svg>
      </button>
      {renderPopup()}
    </>
  );
};

export default ProfessorCard;
