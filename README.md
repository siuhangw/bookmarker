# Bookmarker

A curated collection of tools, resources, and links — managed in Obsidian, synced to GitHub, and displayed via [Markly Showcase](https://siuhangw.github.io/bookmarker/).

## How it works

```
Obsidian Web Clipper   →   bookmarks-inbox/*.md
                               │
                               │  scripts/clip-sync.sh
                               ▼
                         data/bookmarks.yaml   →   GitHub Pages
                               ▲
                               │  processed notes move to
                         bookmarks-processed/
```

All bookmarks live in a single YAML file (`data/bookmarks.yaml`). The static site fetches it from `raw.githubusercontent.com` at page load and renders everything client-side. No build step, no backend.

## Repository layout

```
index.html               HTML shell
assets/
  css/                   base.css, main.css, sidebar.css, modal.css
  js/                    config.js, helpers.js, data.js, render.js, actions.js
data/
  bookmarks.yaml         Single source of truth: site meta, collections, bookmarks
bookmarks-inbox/         Drop Obsidian Web Clipper notes here
bookmarks-processed/     Notes move here after a successful sync (audit trail)
scripts/
  sync_bookmarks.py      Converts inbox .md notes → bookmarks.yaml entries
  clip-sync.sh           Runs sync, then git pull/commit/push
.github/workflows/
  validate.yml           CI: validates bookmarks.yaml on every push
```

## Schema (`data/bookmarks.yaml`)

```yaml
meta:
  title: Markly
  tagline: Showcase
  description: Curated tools…
  theme:
    default: light           # "light" | "dark"
    accent: "#E8453C"

collectionList:
  - id: dev                  # Unique id, referenced by bookmarks
    name: Dev Tools
    color: "#3B82F6"
    order: 1
    collectionItem:          # Optional nested groups
      - { id: dev-editors, name: Editors & IDEs, order: 1 }
      - { id: dev-references, name: References & Docs, order: 2 }

bookmarkList:
  - domain: github.com       # Grouped by host for faster lookup
    bookmarkItem:
      - id: 1
        title: GitHub
        url: https://github.com
        desc: Code hosting
        collection: dev
        tags: [code, git]
        featured: true
        collectionItem: dev-editors   # Optional; must match a nested id
        added: 2025-12-01
```

## Workflow

### Automated (Obsidian Web Clipper → live site)

Install the Obsidian Web Clipper extension, point it at the `bookmarks-inbox/`
folder in this repo, then clip pages as usual. A cron or launchd job runs
`scripts/clip-sync.sh` every 15 minutes to:

1. Parse the frontmatter of each new `.md` note
2. Validate and deduplicate against existing `bookmarks.yaml` entries
3. Append valid entries atomically to `data/bookmarks.yaml`
4. Move the note to `bookmarks-processed/`
5. `git pull --rebase`, commit, and push to `main`

GitHub Pages redeploys automatically on push.

### Manual

```bash
./scripts/clip-sync.sh              # sync + push
./scripts/clip-sync.sh --dry-run    # preview without writing
```

### Validate the YAML locally

```bash
python3 scripts/sync_bookmarks.py --validate-only
```

CI runs the same check on every push touching `data/bookmarks.yaml`.

## Development

```bash
pip install -r requirements-dev.txt       # PyYAML + pytest + ruff
pytest                                    # run the test suite
ruff check scripts/ tests/                # lint Python
shellcheck scripts/*.sh                   # lint shell
```

CI (`.github/workflows/validate.yml`) runs all four — YAML validation,
ruff, pytest, and shellcheck — on every push and PR.

### Enable the pre-commit hook

```bash
git config core.hooksPath .githooks
```

With that set, each `git commit` runs `sync_bookmarks.py --validate-only`
against `data/bookmarks.yaml`, plus ruff, pytest, and shellcheck on any
staged files of matching types. Use `git commit --no-verify` to skip.

## Further docs

- [`CLAUDE.md`](./CLAUDE.md) — full architecture notes, Obsidian template
  setup, cron/launchd examples, and collection/subcollection id reference.
