# Contributing to Rate My Slugs

Thanks for your interest in improving Rate My Slugs! This guide will help you get set up and contributing quickly.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- Chrome browser
- A UCSC MyUCSC account (for testing)

### Setup

```bash
git clone https://github.com/IvanKuria/RateMy-UCSC.git
cd RateMy-UCSC
npm install
```

### Development

Start the dev server with hot reload:

```bash
npm run dev
```

This builds the extension and watches for changes. After the initial build:

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `.output/chrome-mv3-dev` folder
4. The extension reloads automatically on file changes

### Building for Production

```bash
npm run build
```

Output goes to `.output/chrome-mv3/`.

## Project Structure

```
src/
├── entrypoints/
│   ├── background.js          # Service worker — API routing & caching
│   ├── content.js             # Content script — page detection & rendering
│   ├── sidepanel/             # Side panel UI (React)
│   └── options/               # Settings page (React)
├── components/
│   ├── RatingBar.jsx          # Inline rating bar (injected into pages)
│   ├── SlugRating.jsx         # Slug icon rating visualization
│   ├── GradeDistribution.jsx  # Grade distribution chart
│   ├── professor/             # Side panel professor components
│   ├── settings/              # Settings page components
│   └── ui/                    # Shared UI primitives (shadcn/ui)
├── lib/
│   ├── background/            # Background service worker modules
│   │   ├── rmpCache.js        # RMP GraphQL search, matching & caching
│   │   └── ampCache.js        # Campus directory API & caching
│   ├── content/
│   │   ├── pages/             # Page-specific extraction logic
│   │   └── shared/            # Shared utilities (mounting, detection)
│   ├── hooks/                 # React hooks (settings, theme)
│   └── storage/               # Chrome storage wrappers
├── utils/                     # Shared utilities (colors, helpers)
└── assets/                    # CSS files
```

## How It Works

1. **Content script** detects which UCSC page you're on (search results, shopping cart, enrolled classes, etc.)
2. It extracts professor names from the DOM and renders loading skeletons
3. Names are sent to the **background service worker** which fetches data from:
   - Rate My Professors GraphQL API (ratings, reviews)
   - UCSC Campus Directory API (contact info, department)
   - Local JSON files (research topics, classes taught)
4. Results are cached in `chrome.storage.local` for 1 week
5. The inline **rating bar** updates with the professor's rating
6. Clicking "Details" opens the **side panel** with full professor info

## Making Changes

### Adding Support for a New Page Type

1. Create a new module in `src/lib/content/pages/`
2. Export `PAGE_CONFIG`, `extractProfName()`, `getMountTarget()`, and `renderPage()`
3. Add the page type to `pageDetector.js` and the loader map in `content.js`

### Modifying the RMP Search

All RMP logic lives in `src/lib/background/rmpCache.js`:
- `generateSearchVariants()` — produces name variants from scraped names
- `searchWithFallback()` — cascading search strategy
- `selectBestRmpMatch()` — Fuse.js matching with school validation

### Styling

- Inline rating bar: `src/assets/rating-bar.css` (plain CSS, no Tailwind — injected into host page)
- Side panel & options: Tailwind CSS via `src/assets/tailwind.css`
- Grade distribution: `src/assets/styles.css`

## Code Style

- Functional React components with hooks
- ES modules (`import`/`export`)
- No TypeScript (plain JS with JSDoc where helpful)
- Prefer small, focused functions
- Keep content script CSS prefixed with `rms-` to avoid collisions with host pages

## Submitting Changes

1. Fork the repo and create a feature branch from `main`
2. Make your changes
3. Test on at least one UCSC enrollment page
4. Run `npm run build` to verify the build passes
5. Open a pull request with a clear description of what changed and why

## Reporting Bugs

Use the [bug report template](https://github.com/IvanKuria/RateMy-UCSC/issues/new?template=bug_report.md). Include:
- What page you were on
- What you expected to happen
- What actually happened
- Screenshots if relevant

## Questions?

Open a [discussion](https://github.com/IvanKuria/RateMy-UCSC/issues) or reach out to [@IvanKuria](https://github.com/IvanKuria).
