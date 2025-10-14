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
          <span key={i} className="slug-wrapper">
            <img src={slugUrl} className="slug-icon slug-empty" alt="slug empty" />
            <img 
              src={slugUrl} 
              className="slug-icon slug-fill" 
              style={{ clipPath: 'inset(0 0 0 0)' }} 
              alt="slug full" 
            />
          </span>
        );
      } else if (i === slugCount && fraction > 0) {
        // Fractional slug
        const percent = Math.round(fraction * 100);
        slugs.push(
          <span key={i} className="slug-wrapper">
            <img src={slugUrl} className="slug-icon slug-empty" alt="slug empty" />
            <img 
              src={slugUrl} 
              className="slug-icon slug-fill" 
              style={{ clipPath: `inset(0 ${100 - percent}% 0 0)` }} 
              alt="slug partial" 
            />
          </span>
        );
      } else {
        // Empty slug
        slugs.push(
          <span key={i} className="slug-wrapper">
            <img src={slugUrl} className="slug-icon slug-empty" alt="slug empty" />
          </span>
        );
      }
    }
    
    return slugs;
  };

  return (
    <span className="rmp-slugs">
      {renderSlugs()}
    </span>
  );
};

export default SlugRating;

