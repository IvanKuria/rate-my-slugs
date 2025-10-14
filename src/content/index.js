import { createRoot } from 'react-dom/client';
import RatingCard from '../components/RatingCard';
import { initializeContentScript } from './contentScript';

// Initialize the content script
initializeContentScript();

// Export for use in contentScript
export { createRoot, RatingCard };

