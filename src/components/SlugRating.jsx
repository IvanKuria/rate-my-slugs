const slugStyle = { width: 20, height: 20, objectFit: 'contain', display: 'block' };
const wrapperStyle = { position: 'relative', display: 'inline-block', width: 20, height: 20 };
const fillStyle = { position: 'absolute', top: 0, left: 0 };

const SlugRating = ({ rating }) => {
  const slugCount = Math.floor(rating);
  const fraction = rating - slugCount;
  const slugUrl = chrome.runtime.getURL('icons/sammy/slug.png');

  const renderSlugs = () => {
    const slugs = [];

    for (let i = 0; i < 5; i++) {
      if (i < slugCount) {
        // Full slug
        slugs.push(
          <span key={i} style={wrapperStyle}>
            <img src={slugUrl} style={{ ...slugStyle, opacity: 0.3 }} alt="slug empty" />
            <img
              src={slugUrl}
              style={{ ...slugStyle, ...fillStyle, clipPath: 'inset(0 0 0 0)' }}
              alt="slug full"
            />
          </span>
        );
      } else if (i === slugCount && fraction > 0) {
        // Fractional slug
        const percent = Math.round(fraction * 100);
        slugs.push(
          <span key={i} style={wrapperStyle}>
            <img src={slugUrl} style={{ ...slugStyle, opacity: 0.3 }} alt="slug empty" />
            <img
              src={slugUrl}
              style={{ ...slugStyle, ...fillStyle, clipPath: `inset(0 ${100 - percent}% 0 0)` }}
              alt="slug partial"
            />
          </span>
        );
      } else {
        // Empty slug
        slugs.push(
          <span key={i} style={wrapperStyle}>
            <img src={slugUrl} style={{ ...slugStyle, opacity: 0.3 }} alt="slug empty" />
          </span>
        );
      }
    }

    return slugs;
  };

  return (
    <span style={{ display: 'inline-flex', gap: 2, alignItems: 'center' }}>
      {renderSlugs()}
    </span>
  );
};

export default SlugRating;
