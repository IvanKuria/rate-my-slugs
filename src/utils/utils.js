/**
 * @file utils.js
 * Contains shared helper functions used across multiple modules.
 */

/**
 * Safely extracts and cleans the first string value from an array or string.
 * This handles the inconsistent array/string format returned by the campus directory API.
 * @param {*} value - The value to parse (e.g., [" Jon Doe "] or " Jon Doe ")
 * @returns {string|null} The trimmed string or null if the value is invalid or empty.
 */
export const getFirst = (value) => {
  // Handle null or undefined immediately
  if (value == null) return null;

  // Extract the target value
  // If it's an array, take the first element. If it's empty [], target becomes undefined.
  // If it's a value (string/number), use it directly.
  const target = Array.isArray(value) ? value[0] : value;

  // Safety check for the target (e.g., if array was empty)
  if (target == null) return null;

  // Coerce to String and Trim
  // This ensures that Numbers (e.g. 101) or Boolean values don't crash the app
  // and are treated as displayable text.
  const cleaned = String(target).trim();

  // Return null if the result is an empty string (""), otherwise return the string
  return cleaned.length > 0 ? cleaned : null;
};

/**
 * Safely converts an input value (string or number) into a finite Number.
 * Useful for handling API data that might return "N/A", null, or numeric strings.
 * @param {string|number} value - The value to parse.
 * @returns {number|null} The valid number, or null if the input is invalid/infinite.
 */
export const toNumber = (value) => {
  const num = typeof value === "number" ? value : parseFloat(value);
  return Number.isFinite(num) ? num : null;
};

/**
 * Rounds a value to the nearest whole integer.
 * Handles string inputs by parsing them first.
 * @param {string|number} value - The value to round.
 * @returns {number|null} The rounded integer, or null if input was invalid.
 */
export const roundToWhole = (value) => {
  const num = toNumber(value);
  return num != null ? Math.round(num) : null;
};

/**
 * Rounds a value to exactly one decimal place.
 * Example: 3.45 -> 3.5, 3.44 -> 3.4
 * @param {string|number} value - The value to round.
 * @returns {number|null} The rounded number, or null if input was invalid.
 */
export const roundToOneDecimal = (value) => {
  const num = toNumber(value);
  return num != null ? Math.round(num * 10) / 10 : null;
};

/**
 * Formats a number as a string with exactly one decimal place for UI display.
 * Returns "N/A" if the value is falsy (0, null, undefined).
 * Example: 3.5 -> "3.5", 3 -> "3.0"
 * @param {string|number} num - The value to format.
 * @returns {string} The formatted string or "N/A".
 */
export const formatNumber = (num) => {
  return num ? Number(num).toFixed(1) : "N/A";
};

/**
 * A new component to render a 5-star rating.
 * @param {object} props - Component props.
 * @param {number} props.rating - The rating number (0-5).
 * @param {number} props.numRatings - The total number of ratings.
 */
export function StarRating({ rating, numRatings }) {
  // If rating is null or there are no ratings, display "N/A"
  if (rating == null || numRatings === 0) {
    return <span className="metric-value">N/A</span>;
  }

  // rating is already rounded in ProfInfoButton (roundedRating)
  const safeRating = Math.max(0, Math.min(5, Number(rating) || 0));
  const totalStars = 5;

  // Decide color bucket
  let colorClass = "";
  if (safeRating <= 2) {
    colorClass = "star-rating-low"; // red
  } else if (safeRating === 3) {
    colorClass = "star-rating-mid"; // yellow
  } else if (safeRating >= 4) {
    colorClass = "star-rating-high"; // green
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
            className={filled ? "star-filled" : "star-empty"}
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M12 17.27L18.18 21 16.54 13.97 22 9.24 14.81 8.63 12 2 9.19 8.63 2 9.24 7.46 13.97 5.82 21 12 17.27z" />
          </svg>
        );
      })}
    </div>
  );
}
