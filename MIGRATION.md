# Migration Guide - React & Webpack Rewrite

This document explains the migration from vanilla JavaScript to React + Webpack.

## What Changed

### Architecture
- **Old**: Vanilla JavaScript with direct DOM manipulation
- **New**: React components with functional approach and hooks

### Build System
- **Old**: No build system - direct file loading
- **New**: Webpack bundling with Babel transpilation

### File Structure

#### Old Structure (Archived)
```
content/content.js      → Moved to old_src/
background/background.js → Moved to old_src/
```

#### New Structure
```
src/
├── components/
│   ├── RatingCard.jsx     # React component for rating display
│   └── SlugRating.jsx     # Slug rating visualization
├── content/
│   ├── index.js           # Entry point
│   └── contentScript.js   # DOM logic
└── background/
    └── background.js      # Service worker
```

## Key Improvements

1. **React Components**: Rating cards are now React components with proper state management
2. **Modern JavaScript**: Uses ES6+ features with Babel transpilation
3. **Better Maintainability**: Component-based architecture is easier to maintain and extend
4. **Type Safety Ready**: Structure supports easy addition of TypeScript
5. **Development Workflow**: Hot reloading with `npm run dev`

## Functionality Preserved

All original functionality has been preserved:
- ✅ Automatic course row detection
- ✅ Rate My Professors API integration
- ✅ Smart caching (30-day TTL)
- ✅ Name mapping for complex instructor names
- ✅ Debug functions for testing
- ✅ Slug rating visualization
- ✅ Department-based filtering
- ✅ Mutation observer for dynamic content

## How to Use

### Development
```bash
npm install    # Install dependencies
npm run dev    # Watch mode for development
```

### Production Build
```bash
npm run build  # Create production build in dist/
```

### Load Extension
1. Open Chrome → `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist` folder

## Old Files

The original vanilla JavaScript files have been moved to `old_src/` for reference:
- `old_src/content/content.js` - Original content script
- `old_src/background/background.js` - Original service worker

These files are kept for reference but are no longer used by the extension.

