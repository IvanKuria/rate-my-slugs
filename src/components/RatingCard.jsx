import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import SlugRating from './SlugRating';
import GradeDistribution from './GradeDistribution';

const COLOR_PRESETS = {
  excellent: {
    start: '#22c55e',
    end: '#16a34a',
    text: '#ffffff'
  },
  good: {
    start: '#4ade80',
    end: '#22c55e',
    text: '#ffffff'
  },
  average: {
    start: '#facc15',
    end: '#eab308',
    text: '#1f2937'
  },
  poor: {
    start: '#fb923c',
    end: '#f97316',
    text: '#ffffff'
  },
  bad: {
    start: '#f87171',
    end: '#ef4444',
    text: '#ffffff'
  }
};

const buildCardStyle = (palette) =>
  palette
    ? {
        background: `linear-gradient(135deg, ${palette.start}, ${palette.end})`,
        color: palette.text,
        border: 'none'
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

const RatingCard = ({ instructorName, course }) => {
  const [status, setStatus] = useState('loading');
  const [ratingData, setRatingData] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedClassFilter, setSelectedClassFilter] = useState('ALL');
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await chrome.runtime.sendMessage({
          action: 'getProfessorRating',
          instructorName: instructorName,
          department: course ? course.split(' ')[0] : null
        });

        setRatingData(response);
        setStatus(response?.status || 'error');
      } catch (error) {
        console.error('Error fetching RMP rating:', error);
        setStatus('error');
      }
    };

    fetchData();
  }, [instructorName, course]);

  const openModal = () => {
    setSelectedClassFilter('ALL');
    setCurrentReviewIndex(0);
    setIsModalOpen(true);
  };
  const closeModal = () => setIsModalOpen(false);

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

  const renderStatusContent = () => {
    switch (status) {
      case 'loading':
        return <span className="rmp-loading">Loading professor ratings…</span>;
      case 'success':
        if (!ratingData?.rating) {
          return <span className="rmp-error">Rate My Professors: Unable to load ratings</span>;
        }
        return (
          <div className="rmp-callout-wrapper">
            <button className="rmp-modal-trigger" onClick={openModal}>
              <span>View Professor Details</span>
              <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                <path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4 4a.75.75 0 0 1 0 1.06l-4 4a.75.75 0 1 1-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z" />
              </svg>
            </button>
          </div>
        );
      case 'no-profile':
        return <span className="rmp-no-profile">Rate My Professors: No ratings found</span>;
      case 'error':
      default:
        return <span className="rmp-error">Rate My Professors: Unable to load ratings</span>;
    }
  };

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
        {typeof review.ratingValue === 'number' && (
          <span className="rmp-review-stat" data-type="overall">
            Overall: {review.ratingValue.toFixed(1)}
          </span>
        )}
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

  const renderModal = () => {
    if (!isModalOpen || status !== 'success' || !ratingData?.rating) {
      return null;
    }

    const { rating } = ratingData;
    const overallClass = getRatingColorClass(rating.overallRating);
    const difficultyClass = getDifficultyColorClass(rating.difficulty);
    const reviews = Array.isArray(rating.reviews) ? rating.reviews : [];
    const overallRatingNumber = typeof rating.overallRating === 'number' ? rating.overallRating : 0;
    const difficultyScore = typeof rating.difficulty === 'number' ? rating.difficulty : null;
    const takeAgainPercent =
      typeof rating.wouldTakeAgainPercent === 'number' ? rating.wouldTakeAgainPercent : null;

    const qualityPalette = getQualityPalette(overallRatingNumber);
    const difficultyPalette = getDifficultyPalette(difficultyScore);

    const qualityCardStyle = {
      ...buildCardStyle(qualityPalette),
      color: '#ffffff'
    };
    const difficultyCardStyle = buildCardStyle(difficultyPalette);
    const uniqueClasses = Array.from(
      new Set(
        reviews
          .map((review) => review.className)
          .filter((className) => className && className.trim().length > 0)
      )
    );

    const filteredReviews =
      selectedClassFilter === 'ALL'
        ? reviews
        : reviews.filter((review) => review.className === selectedClassFilter);

    const maxShownDefault = reviews.length < 10 ? reviews.length : 10;
    const reviewsToDisplay =
      selectedClassFilter === 'ALL'
        ? filteredReviews.slice(0, maxShownDefault)
        : filteredReviews;
    const reviewsShown = reviewsToDisplay.length;
    const totalAvailable =
      selectedClassFilter === 'ALL'
        ? rating.numRatings ?? reviews.length
        : filteredReviews.length;

    return createPortal(
      <div className="rmp-modal-overlay" onClick={closeModal}>
        <div className="rmp-modal rmp-modal-top-right" onClick={(event) => event.stopPropagation()}>
          <header className="rmp-modal-header">
            <div className="rmp-modal-header-left">
              <h3 className="rmp-modal-title">
                {ratingData.matchedName || instructorName}
              </h3>
              <a
                className="rmp-view-profile-btn"
                href={rating.rmpUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                View profile
              </a>
            </div>
            <button className="rmp-modal-close" onClick={closeModal} aria-label="Close ratings modal">
              ×
            </button>
          </header>

          {rating.numRatings === 0 ? (
            <div className="rmp-no-ratings">
              <p>Profile exists but no ratings yet.</p>
              <a
                className="rmp-leave-rating-btn"
                href={rating.rmpUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Leave a rating
              </a>
            </div>
          ) : (
            <>
              <div className="rmp-modal-summary">
                <div className={`rmp-summary-card rmp-quality ${overallClass}`} style={qualityCardStyle}>
                  <span className="rmp-summary-label">Quality</span>
                  <div className="rmp-summary-value">
                    <SlugRating rating={overallRatingNumber} />
                    {typeof rating.overallRating === 'number' ? `${rating.overallRating}/5` : 'N/A'}
                  </div>
                </div>
                <div className={`rmp-summary-card rmp-difficulty ${difficultyClass}`} style={difficultyCardStyle}>
                  <span className="rmp-summary-label">Difficulty</span>
                  <span className="rmp-summary-value">
                    {difficultyScore !== null ? `${difficultyScore.toFixed(1)}/5` : 'N/A'}
                  </span>
                </div>
                <div className="rmp-summary-card rmp-take-again">
                  <span className="rmp-summary-label">Would take again</span>
                  <span className="rmp-summary-value rmp-take-again-text">
                    {takeAgainPercent !== null ? `${takeAgainPercent}%` : 'N/A'}
                  </span>
                </div>
                <div className="rmp-summary-card rmp-total-reviews">
                  <span className="rmp-summary-label">Total reviews</span>
                  <span className="rmp-summary-value">{rating.numRatings ?? 'N/A'}</span>
                </div>
              </div>

              <div className="rmp-feedback">
                <a href="mailto:ikuria@ucsc.edu?subject=Rate My Slugs Feedback" className="rmp-feedback-link">
                  Have feedback? Let me know →
                </a>
              </div>

              <GradeDistribution instructorName={instructorName} course={course} />
            </>
          )}

          {rating.numRatings > 0 && (
            <section className="rmp-reviews-section">
              <header className="rmp-reviews-header">
                <h4>Reviews</h4>
                {reviewsToDisplay.length > 0 && (
                  <span>{currentReviewIndex + 1} of {reviewsToDisplay.length}</span>
                )}
              </header>
              {uniqueClasses.length > 0 && (
                <div className="rmp-reviews-filter">
                  <label htmlFor="rmp-class-filter">Filter by class</label>
                  <select
                    id="rmp-class-filter"
                    value={selectedClassFilter}
                    onChange={(event) => {
                      setSelectedClassFilter(event.target.value);
                      setCurrentReviewIndex(0);
                    }}
                  >
                    <option value="ALL">All classes</option>
                    {uniqueClasses.map((className) => (
                      <option key={className} value={className}>
                        {className}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {reviewsToDisplay.length === 0 ? (
                <div className="rmp-review-empty">
                  No written reviews available yet.
                </div>
              ) : (
                <div className="rmp-review-carousel">
                  {renderReview(reviewsToDisplay[currentReviewIndex])}
                  <div className="rmp-carousel-nav">
                    <button
                      className="rmp-carousel-btn"
                      onClick={() => setCurrentReviewIndex(i => Math.max(0, i - 1))}
                      disabled={currentReviewIndex === 0}
                    >
                      ← Prev
                    </button>
                    <button
                      className="rmp-carousel-btn"
                      onClick={() => setCurrentReviewIndex(i => Math.min(reviewsToDisplay.length - 1, i + 1))}
                      disabled={currentReviewIndex === reviewsToDisplay.length - 1}
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </div>,
      document.body
    );
  };

  return (
    <div className="rmp-rating-card" data-instructor={instructorName} data-status={status}>
      <div className="rmp-content">
        {renderStatusContent()}
      </div>
      {renderModal()}
    </div>
  );
};

export default RatingCard;