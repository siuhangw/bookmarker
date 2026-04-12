# Markly — Bookmark Showcase

## What is this?

A personal bookmark showcase website. I manage bookmarks as YAML files in Obsidian, push to this GitHub repo, and the site fetches and renders them live.

**Live site:** `https://siuhangw.github.io/bookmarker/` (GitHub Pages)
**Repo:** `https://github.com/siuhangw/bookmarker`

## Architecture

```
index.html          ← HTML shell (no inline CSS or JS)
assets/
  styles.css        ← All styles
  app.js            ← All application logic
data/
  _meta.yaml        ← Site config + collection registry
  dev.yaml          ← Dev Tools bookmarks
  design.yaml       ← Design bookmarks
  productivity.yaml ← Productivity bookmarks
  learning.yaml     ← Learning bookmarks
  ai.yaml           ← AI & ML bookmarks
  media.yaml        ← Media & Fun bookmarks
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

1. Page loads → fetches `_meta.yaml` from GitHub raw URL
2. Reads `collections` array → fetches each collection's `.yaml` file in parallel
3. Parses YAML with `js-yaml` → renders sidebar, cards, list view
4. All filtering (collection, tags, search, favorites) happens client-side in memory

## YAML Schema

### `_meta.yaml`

```yaml
site:
  name: Markly
  tagline: Your tagline here

collections:
  - id: dev           # Unique ID, matches filename
    name: Dev Tools   # Display name
    color: "#3B82F6"  # Hex color for badges
    file: dev.yaml    # Corresponding YAML file
```

### Bookmark files (`*.yaml`)

```yaml
- url: https://example.com        # Required
  title: Example Site              # Required
  desc: A short description        # Optional
  tags: [tool, web, free]          # Optional, lowercase
  featured: true                   # Optional, default false
  added: 2025-12-01                # Optional, YYYY-MM-DD
```

## Features

- **Sidebar:** collections with color dots, favorites filter, tag cloud
- **Search:** real-time across title, desc, URL, tags
- **Views:** grid cards + list rows, toggle in header
- **Theme:** dark/light toggle, CSS custom properties (`data-theme` attribute)
- **Responsive:** mobile (< 640px) slide-out drawer + single column, tablet (640-1024px) drawer + 2-col grid, desktop (1024px+) inline sidebar + multi-col grid
- **Favicons:** auto-fetched from Google's favicon service

## Config

At the top of `assets/app.js`:

```js
const REPO_BASE = "https://raw.githubusercontent.com/siuhangw/bookmarker/main";
```

## Workflow

1. Edit YAML files in Obsidian
2. `git add . && git commit -m "update bookmarks" && git push`
3. Site auto-reflects changes on next page load

## Future Plans

- Sub-collections (nested `children` in `_meta.yaml`)
- Expecting 500+ bookmarks over time
- May add sorting (by date, alphabetical)
- May add "recently added" section
