import { useState, useEffect } from 'react';
import SlugRating from './SlugRating';

const RatingCard = ({ instructorName, department, onFetchRating }) => {
  const [status, setStatus] = useState('loading');
  const [ratingData, setRatingData] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await chrome.runtime.sendMessage({
          action: 'getProfessorRating',
          instructorName: instructorName,
          department: department
        });
        
        setRatingData(response);
        setStatus(response?.status || 'error');
      } catch (error) {
        console.error('Error fetching RMP rating:', error);
        setStatus('error');
      }
    };

    fetchData();
  }, [instructorName, department]);

  const getRatingColorClass = (value) => {
    if (value >= 4.5) return 'rmp-rating-excellent';
    if (value >= 4.0) return 'rmp-rating-good';
    if (value >= 3.0) return 'rmp-rating-average';
    if (value >= 2.0) return 'rmp-rating-poor';
    return 'rmp-rating-bad';
  };

  const getDifficultyColorClass = (value) => {
    if (value >= 4.5) return 'rmp-difficulty-very-hard';
    if (value >= 4.0) return 'rmp-difficulty-hard';
    if (value >= 3.0) return 'rmp-difficulty-average';
    if (value >= 2.0) return 'rmp-difficulty-moderate';
    return 'rmp-difficulty-easy';
  };

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <span className="rmp-loading">
            Rate My Professor: Loading...
          </span>
        );

      case 'success':
        if (!ratingData?.rating) {
          return (
            <span className="rmp-error">
              Rate My Professor: Unable to load ratings
            </span>
          );
        }

        const { rating } = ratingData;
        const ratingClass = getRatingColorClass(rating.overallRating);
        const difficultyClass = getDifficultyColorClass(rating.difficulty);

        return (
          <span className="rmp-inline">
            <span className="rmp-label">Quality Rating:</span>
            <span className={`rmp-rating-value ${ratingClass}`}>
              <SlugRating rating={rating.overallRating} />
              {rating.overallRating}/5
            </span>
            <span className="rmp-rating-value">
              Difficulty: <span className={difficultyClass}>{rating.difficulty}/5</span>
            </span>
            <span className="rmp-take-again">{rating.wouldTakeAgainPercent}%</span>
            <span className="rmp-rating-value">would take again</span>
            <span className="rmp-review-value">({rating.numRatings} reviews)</span>
            <a href={rating.rmpUrl} target="_blank" rel="noopener noreferrer" className="rmp-link">
              👤 View Profile
            </a>
          </span>
        );

      case 'no-profile':
        return (
          <span className="rmp-no-profile">
            Rate My Professors: No ratings found
          </span>
        );

      case 'error':
      default:
        return (
          <span className="rmp-error">
            Rate My Professors: Unable to load ratings
          </span>
        );
    }
  };

  return (
    <div className="rmp-rating-card" data-instructor={instructorName} data-status={status}>
      <div className="rmp-content">
        {renderContent()}
      </div>
    </div>
  );
};

export default RatingCard;

