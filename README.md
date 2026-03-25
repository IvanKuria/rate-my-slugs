# Rate My Slugs

A Chrome extension that shows professor ratings, grade distributions, and detailed profiles while browsing UCSC courses on MyUCSC.

## Features

- **Inline Ratings** — See professor ratings at a glance on search results, shopping cart, and enrolled classes pages
- **Grade Distributions** — View historical grade breakdowns for each course
- **Professor Profiles** — Click "Details" to open a side panel with full professor info: contact details, department, research interests, RMP reviews, and more
- **Smart Search** — Multi-strategy name matching with fallback searches to find professors even with abbreviated or unusual name formats
- **Fast** — Lazy-loaded modules, concurrent data preloading, and 1-week caching for instant repeat visits
- **Privacy-First** — All data stored locally. No analytics, no tracking, no data collection

## Install

**Chrome Web Store** — [Rate My Slugs](https://chromewebstore.google.com/) *(link coming soon)*

**Manual install:**

1. Download the [latest release](https://github.com/IvanKuria/RateMy-UCSC/releases)
2. Unzip the file
3. Open `chrome://extensions/`, enable **Developer mode**
4. Click **Load unpacked** and select the unzipped folder

## How It Works

Navigate to any MyUCSC enrollment page. The extension automatically detects professor names and shows:

```
★ 4.4 (33)    85% would retake    Details →
```

Click **Details** to open the side panel with the full professor profile, including RMP reviews, campus directory info, and grade distributions.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [WXT](https://wxt.dev) (Vite-based extension framework) |
| UI | React 18, Tailwind CSS, [shadcn/ui](https://ui.shadcn.com) |
| Charts | [Recharts](https://recharts.org) |
| Animation | [Framer Motion](https://motion.dev) |
| Search | [Fuse.js](https://fusejs.io) (fuzzy name matching) |
| APIs | RateMyProfessors GraphQL, UCSC Campus Directory |
| Extension | Chrome Manifest V3, Side Panel API |

## Development

```bash
git clone https://github.com/IvanKuria/RateMy-UCSC.git
cd RateMy-UCSC
npm install
npm run dev
```

Then load `.output/chrome-mv3-dev` as an unpacked extension in Chrome.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide, project structure, and how to make changes.

## Architecture

```
Content Script          Background SW              Side Panel
─────────────          ──────────────              ──────────
Detect page type  ──►  Fetch RMP (GraphQL)    ──►  Professor profile
Extract names     ──►  Fetch Campus Directory ──►  Grade distribution
Render rating bar ──►  Cache in storage       ──►  Reviews carousel
                       Match best professor        Settings
```

- **Content script** runs on `my.ucsc.edu` and `pisa.ucsc.edu` — detects pages, extracts professor names, renders the inline rating bar
- **Background service worker** handles all API calls, caching, and professor name matching
- **Side panel** displays the full professor profile when "Details" is clicked

## Privacy

- All cached data is stored locally in `chrome.storage.local`
- No analytics or telemetry
- Network requests go only to: `ratemyprofessors.com`, `campusdirectory.ucsc.edu`, and `rate-my-slugs-server.onrender.com` (grade data)
- Permissions are scoped to UCSC domains only

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, project structure, and guidelines.

## License

MIT. See [LICENSE](LICENSE) for details.
