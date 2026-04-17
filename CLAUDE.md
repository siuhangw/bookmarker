# Markly — Bookmark Showcase

## What is this?

A personal bookmark showcase website. I manage bookmarks as a single YAML file in Obsidian, push to this GitHub repo, and the site fetches and renders them live.

**Live site:** `https://siuhangw.github.io/bookmarker/` (GitHub Pages)
**Repo:** `https://github.com/siuhangw/bookmarker`

## Architecture

```
index.html              ← HTML shell (no inline CSS or JS)
assets/
  css/
    base.css            ← Reset, tokens, typography
    main.css            ← Layout, cards, list view, header
    sidebar.css         ← Sidebar + mobile drawer
    modal.css           ← Bookmark detail modal
  js/
    config.js           ← REPO_BASE + shared `state` object
    helpers.js          ← esc(), getFavicon(), getDomain(), breakpoints, safeCreateIcons()
    data.js             ← fetch + parse bookmarks.yaml, filtering, theme
    render.js           ← render() entry point + card/row/modal HTML
    actions.js          ← UI handlers + init bootstrap
data/
  bookmarks.yaml        ← All data: site meta, collections, and bookmarks
bookmarks-inbox/        ← Drop Obsidian Web Clipper notes here (auto-synced)
bookmarks-processed/    ← Notes moved here after successful sync (audit trail)
scripts/
  sync_bookmarks.py     ← Converts inbox .md notes → bookmarks.yaml entries
  clip-sync.sh          ← Shell wrapper: run sync, git commit, git push
.github/workflows/
  validate.yml          ← CI: validates bookmarks.yaml schema on every push
README.md               ← Schema docs
CLAUDE.md               ← This file
```

## Tech Stack

- **Pure HTML/CSS/JS** — no React, no build tools, no Node.js
- **js-yaml** from CDN (`cdnjs.cloudflare.com`) for YAML parsing
- **Lucide icons** from CDN (`unpkg.com/lucide`)
- **DM Sans** + **JetBrains Mono** from Google Fonts
- Fetches YAML from `raw.githubusercontent.com` at runtime

## Data Flow

1. Page loads → fetches `data/bookmarks.yaml` from GitHub raw URL
2. Parses `meta`, `collections`, and `bookmarks` sections
3. Renders sidebar, cards, list view
4. All filtering (collection, subcollection, tags, search, favorites) happens client-side in memory

## YAML Schema

### `data/bookmarks.yaml`

```yaml
meta:
  title: Markly                  # Site name
  tagline: Showcase              # Short tagline (shown in sidebar brand)
  description: Curated tools…   # Subtitle shown on "All Resources" view
  theme:
    default: light               # "light" or "dark"
    accent: "#E8453C"            # Accent color (hex)

collections:
  - id: dev                      # Unique ID, used in bookmarks
    name: Dev Tools              # Display name
    color: "#3B82F6"             # Hex color for badges
    order: 1                     # Sort order in sidebar
    subcollections:              # Optional nested groups
      - { id: editors, name: Editors & IDEs, order: 1 }
      - { id: references, name: References & Docs, order: 2 }

  - id: design
    name: Design
    color: "#E8453C"
    order: 2

bookmarks:
  - id: 1                        # Unique integer ID
    title: GitHub                # Required
    url: https://github.com      # Required
    desc: Description here       # Optional
    collection: dev              # Must match a collection id
    subcollection: editors       # Optional, must match a subcollection id
    tags: [code, git]            # Optional, lowercase
    featured: true               # Optional, default false
    added: 2025-12-01            # Optional, YYYY-MM-DD
```

## Features

- **Sidebar:** collections with color dots, subcollection drill-down, favorites filter, tag cloud
- **Search:** real-time across title, desc, URL, tags
- **Views:** grid cards + list rows, toggle in header
- **Theme:** dark/light toggle; default and accent color set from `meta.theme` in YAML
- **Responsive:** mobile (< 640px) slide-out drawer + single column, tablet (640-1024px) drawer + 2-col grid, desktop (1024px+) inline sidebar + multi-col grid
- **Favicons:** auto-fetched from Google's favicon service

## Config

At the top of `assets/app.js`:

```js
const REPO_BASE = "https://raw.githubusercontent.com/siuhangw/bookmarker/main";
```

## Workflow

### Automated (Obsidian Web Clipper → GitHub → Live Site)

```
Browse web → Obsidian Web Clipper → bookmarks-inbox/note.md
                                              ↓
                                    scripts/clip-sync.sh
                                              ↓
                             sync_bookmarks.py: validate + append to bookmarks.yaml
                                              ↓
                                    git commit + push to main
                                              ↓
                                  GitHub Pages auto-redeploys
```

**Run manually:**
```bash
./scripts/clip-sync.sh          # sync and push
./scripts/clip-sync.sh --dry-run  # preview without writing
```

**Set up cron (Linux, every 15 min):**
```
*/15 * * * * /home/user/bookmarker/scripts/clip-sync.sh >> /tmp/bookmarker-sync.log 2>&1
```

**Set up launchd (macOS, every 15 min):**
Create `~/Library/LaunchAgents/com.bookmarker.clipsync.plist`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.bookmarker.clipsync</string>
  <key>ProgramArguments</key>
  <array>
    <string>/home/user/bookmarker/scripts/clip-sync.sh</string>
  </array>
  <key>StartInterval</key><integer>900</integer>
  <key>StandardOutPath</key><string>/tmp/bookmarker-sync.log</string>
  <key>StandardErrorPath</key><string>/tmp/bookmarker-sync.log</string>
</dict>
</plist>
```
Then: `launchctl load ~/Library/LaunchAgents/com.bookmarker.clipsync.plist`

### Manual (direct YAML edit)

1. Edit `data/bookmarks.yaml` in Obsidian
2. `git add . && git commit -m "update bookmarks" && git push`
3. Site auto-reflects changes on next page load

## Obsidian Web Clipper Setup

### 1. Install the extension

Install **Obsidian Web Clipper** from your browser's extension store.

### 2. Open this repo as your Obsidian vault

Set the Obsidian vault root to the `bookmarker/` repo folder. Obsidian will
create `.obsidian/` (already gitignored). The `bookmarks-inbox/` folder will
appear as a note folder inside Obsidian.

### 3. Create a template in Obsidian Web Clipper

- **Template name:** Markly Bookmark
- **Save folder:** `bookmarks-inbox`
- **File name:** `{{date:YYYYMMDD}}-{{title|truncate(60)|kebabcase}}`
- **Template body:**

```
---
title: {{title}}
url: {{url}}
description: {{description}}
collection: 
subcollection: 
tags: []
featured: false
added: {{date:YYYY-MM-DD}}
---
```

### 4. After clipping

Fill in `collection:` (required) and optionally `subcollection:` before saving.
Leave `description:`, `tags:`, `featured:` as-is or edit to taste.

### Collection / Subcollection IDs

```
ai         ai-llms-prompting-tools | ai-ai-agents-automation | ai-generative-media-image-video
           ai-ai-models-platforms  | ai-ai-coding-dev-tools

finance    finance-market-data-sentiment | finance-options-derivatives
           finance-crypto-on-chain-analytics | finance-crypto-trading-bots-apis
           finance-crypto-projects-news | finance-precious-metals | finance-real-estate
           finance-hk-china-markets | finance-macro-economic-data

dev        dev-learning-courses | dev-javascript-web-dev | dev-android-mobile
           dev-system-design | dev-open-source-apis | dev-tech-blogs
           dev-github-repos-projects | dev-development-tools
           dev-linux-infrastructure | dev-seo-web-optimization

design     design-visual-inspiration | design-design-systems-ui-kits | design-growth-marketing

news       news-tech-security | news-general-political-news | news-china-hk-news
           news-community-social

tools      tools-cloud-storage | tools-productivity-writing | tools-web-utilities-dev-tools
           tools-security-privacy | tools-maps-geo-data | tools-free-resource-collections

learning   learning-language-learning | learning-podcasts-talks | learning-reference-research

videos     videos-ai-llm-videos | videos-youtube-channels

misc       (no subcollections)
```

## Validation

Run locally before pushing:
```bash
python3 scripts/sync_bookmarks.py --validate-only
```

CI also runs this automatically on every push that touches `data/bookmarks.yaml`.

## Future Plans

- Expecting 500+ bookmarks over time
- May add sorting (by date, alphabetical)
- May add "recently added" section
