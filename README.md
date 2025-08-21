# UCSC Rate My Professors Chrome Extension

A Chrome extension that automatically displays Rate My Professors ratings for UCSC courses on MyUCSC enrollment pages.

## Features

- **Automatic Detection**: Finds course rows and extracts instructor names
- **Real-time Ratings**: Shows RMP ratings directly on the course selection page
- **Smart Caching**: Caches results for 24 hours to reduce API calls
- **Clean UI**: Modern, minimalist design that fits with the page
- **Error Handling**: Graceful handling of missing profiles and network issues

## Installation

### Development Mode

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension folder
5. The extension will now be active on MyUCSC pages

### Production Installation

*Coming soon - will be available on Chrome Web Store*

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
├── manifest.json      # Extension configuration
├── content.js         # Content script for DOM manipulation
├── background.js      # Service worker for API calls
├── styles.css         # Extension styling
├── README.md          # This file
└── icons/             # Extension icons (placeholder)
```

### Building
No build process required - this is a vanilla JavaScript extension.

### Testing
1. Load the extension in development mode
2. Navigate to MyUCSC enrollment page
3. Check browser console for debug messages
4. Verify rating cards appear and function correctly

## Contributing

This is a personal project, but suggestions and improvements are welcome!

## License

MIT License - feel free to use and modify as needed.
