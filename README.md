# Bookmarker

A curated collection of tools, resources, and links — managed in Obsidian, stored on GitHub, displayed via [Markly Showcase](https://github.com/siuhangw/bookmarker).

## Structure

```
_meta.yaml          # Site config + collection registry
dev.yaml            # Dev Tools bookmarks
design.yaml         # Design bookmarks
productivity.yaml   # Productivity bookmarks
learning.yaml       # Learning bookmarks
ai.yaml             # AI & ML bookmarks
media.yaml          # Media & Fun bookmarks
```

## Schema

### `_meta.yaml`

```yaml
site:
  name: Markly
  tagline: Your tagline here

collections:
  - id: dev           # Unique ID (used in filenames)
    name: Dev Tools   # Display name
    color: "#3B82F6"  # Hex color for the UI
    file: dev.yaml    # Corresponding bookmark file
```

### Bookmark files (`*.yaml`)

```yaml
- url: https://example.com        # Required — must start with https://
  title: Example Site              # Required — display name
  desc: A short description        # Optional — one-liner
  tags: [tool, web, free]          # Optional — lowercase, kebab-case
  featured: true                   # Optional — defaults to false
  added: 2025-12-01                # Optional — YYYY-MM-DD
```

## Adding bookmarks

1. Open the YAML file for the target collection in Obsidian
2. Add a new entry following the schema above
3. Commit and push to GitHub
4. The showcase fetches from `raw.githubusercontent.com` — changes appear on next page load

## Adding a new collection

1. Add an entry to `collections` in `_meta.yaml`
2. Create the corresponding `.yaml` file
3. Push both files

## Future: Sub-collections

The schema supports nested collections via a `children` array in `_meta.yaml`:

```yaml
collections:
  - id: dev
    name: Dev Tools
    color: "#3B82F6"
    file: dev.yaml
    children:
      - id: dev-frontend
        name: Frontend
        file: dev-frontend.yaml
```
