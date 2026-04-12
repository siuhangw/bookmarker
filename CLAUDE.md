# Markly — Bookmark Showcase

## What is this?

A personal bookmark showcase website. I manage bookmarks as a single YAML file in Obsidian, push to this GitHub repo, and the site fetches and renders them live.

**Live site:** `https://siuhangw.github.io/bookmarker/` (GitHub Pages)
**Repo:** `https://github.com/siuhangw/bookmarker`

## Architecture

```
index.html          ← HTML shell (no inline CSS or JS)
assets/
  styles.css        ← All styles
  app.js            ← All application logic
data/
  bookmarks.yaml    ← All data: site meta, collections, and bookmarks
README.md           ← Schema docs
CLAUDE.md           ← This file
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

1. Edit `data/bookmarks.yaml` in Obsidian
2. `git add . && git commit -m "update bookmarks" && git push`
3. Site auto-reflects changes on next page load

## Future Plans

- Expecting 500+ bookmarks over time
- May add sorting (by date, alphabetical)
- May add "recently added" section
