/**
 * Renders a 5-star rating.
 */

interface StarRatingProps {
  /** The rating number (0-5), or null when unavailable. */
  rating: number | null;
  /** The total number of ratings. */
  numRatings: number;
}

export function StarRating({ rating, numRatings }: StarRatingProps) {
  if (rating == null || numRatings === 0) {
    return <span className="metric-value">N/A</span>;
  }

  const safeRating = Math.max(0, Math.min(5, Number(rating) || 0));
  const totalStars = 5;

  let colorClass = '';
  if (safeRating <= 2) {
    colorClass = 'star-rating-low';
  } else if (safeRating === 3) {
    colorClass = 'star-rating-mid';
  } else if (safeRating >= 4) {
    colorClass = 'star-rating-high';
  }

  return (
    <div
      className={`star-rating ${colorClass}`}
      aria-label={`Rating: ${safeRating} out of 5 based on ${numRatings} reviews`}
    >
      {Array.from({ length: totalStars }).map((_, index) => {
        const filled = index < safeRating;
        return (
          <svg
            key={index}
            viewBox="0 0 24 24"
            className={filled ? 'star-filled' : 'star-empty'}
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M12 17.27L18.18 21 16.54 13.97 22 9.24 14.81 8.63 12 2 9.19 8.63 2 9.24 7.46 13.97 5.82 21 12 17.27z" />
          </svg>
        );
      })}
    </div>
  );
}

export default StarRating;
