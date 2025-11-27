# UCSC Rate My Professors Chrome Extension

A Chrome extension that automatically displays Rate My Professors ratings for UCSC courses on MyUCSC enrollment pages.

Built with **React** and **Webpack** for a modern, maintainable codebase.

## Features

- **Automatic Detection**: Finds course rows and extracts instructor names
- **Real-time Ratings**: Shows RMP ratings directly on the course selection page
- **Smart Caching**: Caches results for 30 days to reduce API calls
- **Clean UI**: Modern, minimalist design that fits with the page
- **Error Handling**: Graceful handling of missing profiles and network issues
- **React Components**: Built with modern React functional components and hooks

## Tech Stack

- React 18
- Webpack 5
- Babel
- Chrome Extension Manifest V3

## Installation

### Development Mode

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the extension:
   ```bash
   npm run build
   ```
4. Open Chrome and go to `chrome://extensions/`
5. Enable "Developer mode" in the top right
6. Click "Load unpacked" and select the `dist` folder
7. The extension will now be active on MyUCSC pages

### Development with Auto-rebuild

For development with automatic rebuilding on file changes:
```bash
npm run dev
```
This will watch for changes and rebuild automatically. You'll need to refresh the extension in Chrome after each build.

### Production Installation

*Coming soon - will be available on Chrome Web Store*

### Zip File Creation for Distribution
```bash
npm run build
cd dist
zip -r ../ucsc-rmp-extension.zip . -x "*.DS_Store"
```

## Usage

1. Navigate to the UCSC course enrollment page:
   ```
   https://my.ucsc.edu/psc/csprd/EMPLOYEE/SA/c/NUI_FRAMEWORK.PT_AGSTARTPAGE_NUI.GBL?CONTEXTIDPARAMS=TEMPLATE_ID%3aPTPPNAVCOL&scname=ADMN_ENROLLMENT&PTPPB_GROUPLET_ID=SCX_ENROLLMENT&CRefName=ADMN_NAVCOLL_4&PanelCollapsible=Y&AJAXTransfer=Y
   ```

2. The extension will automatically:
   - Find course rows with instructor information
   - Extract instructor names (e.g., "Simons,J.", "Movshovitz,N.")
   - Display a RMP rating card below each course row
   - Show loading states while fetching data
   - Cache results for future visits

## Rating Information Displayed

- **Overall Rating**: Professor's overall rating out of 5
- **Difficulty**: Course difficulty rating out of 5
- **Would Take Again**: Percentage of students who would take the course again
- **Number of Ratings**: Total number of ratings submitted
- **RMP Profile Link**: Direct link to the professor's RMP page

## Privacy

- **Local Storage Only**: All cached data is stored locally in your browser
- **No Analytics**: The extension doesn't collect or send any user data
- **Minimal Permissions**: Only requests access to MyUCSC and RMP domains

## Technical Details

- **Manifest Version**: 3 (latest Chrome extension standard)
- **Architecture**: Content script + Background service worker
- **API**: Uses RMP's GraphQL endpoint with UCSC school ID (1078)
- **Caching**: 30 day TTL with chrome.storage.local
- **Error Handling**: Graceful fallbacks for network issues and missing data

## Troubleshooting

### No ratings appear
- Check that you're on the correct MyUCSC enrollment page
- Verify the instructor name format matches expected patterns
- Check browser console for any error messages

### Extension not loading
- Ensure Developer mode is enabled in Chrome extensions
- Try reloading the extension from chrome://extensions/
- Check that all files are present in the extension folder

### Network errors
- Verify internet connection
- Check if RMP website is accessible
- Extension will show error states for network issues

## Development

### File Structure
```
├── src/
│   ├── components/          # React components
│   │   ├── RatingCard.jsx   # Main rating card component
│   │   └── SlugRating.jsx   # Slug rating visualization
│   ├── content/             # Content script
│   │   ├── index.js         # Entry point
│   │   └── contentScript.js # DOM manipulation & logic
│   └── background/          # Background service worker
│       └── background.js    # API calls & caching
├── icons/                   # Extension icons
├── manifest.json            # Extension configuration
├── styles.css               # Extension styling
├── webpack.config.js        # Webpack configuration
├── package.json             # Dependencies & scripts
└── README.md                # This file
```

### Building

Build the extension:
```bash
npm run build
```

Development mode with watch:
```bash
npm run dev
```

Clean build artifacts:
```bash
npm run clean
```

### Testing
1. Build the extension: `npm run build`
2. Load the `dist` folder in Chrome extensions (Developer mode)
3. Navigate to MyUCSC enrollment page
4. Check browser console for debug messages
5. Verify rating cards appear and function correctly

### Debug Functions

The extension provides several debug functions accessible from the browser console:
- `ucscRMPDebug()` - Manually trigger processing of course rows
- `ucscRMPCheck()` - Check if course results are detected
- `ucscRMPForceSearch()` - Force search for course elements
- `ucscRMPRefresh(instructorName)` - Refresh cache for specific instructor
- `ucscRMPTestMapping(name)` - Test name mapping for an instructor
- `ucscRMPClearCache()` - Clear all cached ratings
- `ucscRMPCacheStats()` - Display cache statistics
- `ucscRMPInspectCache()` - Inspect Chrome storage contents

## Contributing

This is a personal project, but feel free to contribute!
