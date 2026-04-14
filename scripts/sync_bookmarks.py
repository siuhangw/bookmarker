#!/usr/bin/env python3
"""
sync_bookmarks.py — Obsidian inbox → bookmarks.yaml converter

Reads YAML frontmatter from Markdown notes in bookmarks-inbox/, validates
each entry, deduplicates against existing bookmarks.yaml by URL, appends
new entries to the end of data/bookmarks.yaml, and moves processed notes
to bookmarks-processed/.

Usage:
  python3 scripts/sync_bookmarks.py [options]

Options:
  --inbox PATH        Inbox directory (default: bookmarks-inbox/)
  --yaml PATH         bookmarks.yaml path (default: data/bookmarks.yaml)
  --processed PATH    Processed notes dir (default: bookmarks-processed/)
  --dry-run           Parse and validate without writing any files
  --validate-only     Only validate bookmarks.yaml, skip inbox processing
  --quiet             Suppress informational output; emit machine-readable summary
"""

import argparse
import re
import shutil
import sys
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

import yaml


# ---------------------------------------------------------------------------
# Field ordering to match the existing bookmarks.yaml style
# ---------------------------------------------------------------------------
FIELD_ORDER = ["id", "title", "url", "desc", "collection", "tags", "featured", "subcollection", "added"]


# ---------------------------------------------------------------------------
# Custom YAML dumper — forces flow-style for list values so tags serialize
# as `tags: []` or `tags: [ai, python]` rather than block-style multi-line.
# ---------------------------------------------------------------------------
class BookmarkDumper(yaml.Dumper):
    pass


def _list_representer(dumper, data):
    # Use flow-style only for flat lists of scalars (e.g. tags: [ai, python]).
    # Block-style for lists containing dicts/lists (e.g. the top-level bookmark list).
    is_scalar_list = all(isinstance(item, (str, int, float, bool)) for item in data)
    return dumper.represent_sequence("tag:yaml.org,2002:seq", data, flow_style=is_scalar_list)


BookmarkDumper.add_representer(list, _list_representer)


# ---------------------------------------------------------------------------
# Result tracking
# ---------------------------------------------------------------------------
@dataclass
class SyncResult:
    added: list[str] = field(default_factory=list)
    skipped_dupes: list[str] = field(default_factory=list)
    skipped_errors: list[tuple[str, list[str]]] = field(default_factory=list)


# ---------------------------------------------------------------------------
# URL normalisation (dedup key)
# ---------------------------------------------------------------------------
def normalize_url(url: str) -> str:
    """Lowercase, strip trailing slash, strip URL fragment."""
    return url.lower().rstrip("/").split("#")[0]


# ---------------------------------------------------------------------------
# Frontmatter parsing
# ---------------------------------------------------------------------------
def parse_frontmatter(note_path: Path) -> dict | None:
    """
    Extract YAML frontmatter from a Markdown file.

    Returns a dict of frontmatter keys, or None if no frontmatter block found.
    """
    try:
        text = note_path.read_text(encoding="utf-8")
    except OSError as exc:
        print(f"  [error] Cannot read {note_path.name}: {exc}", file=sys.stderr)
        return None

    m = re.match(r"^---\s*\n(.*?)\n---", text, re.DOTALL)
    if not m:
        return None

    try:
        fm = yaml.safe_load(m.group(1))
    except yaml.YAMLError as exc:
        print(f"  [error] Invalid YAML frontmatter in {note_path.name}: {exc}", file=sys.stderr)
        return None

    return fm if isinstance(fm, dict) else None


# ---------------------------------------------------------------------------
# Load existing data from bookmarks.yaml
# ---------------------------------------------------------------------------
def load_yaml_data(yaml_path: Path) -> dict:
    with open(yaml_path, encoding="utf-8") as f:
        return yaml.safe_load(f)


def load_existing_urls(yaml_path: Path) -> set[str]:
    data = load_yaml_data(yaml_path)
    return {normalize_url(b["url"]) for b in data.get("bookmarks", [])}


def load_valid_collections(yaml_path: Path) -> dict[str, set[str]]:
    """Return {collection_id: {subcollection_id, ...}} for validation."""
    data = load_yaml_data(yaml_path)
    return {
        col["id"]: {sub["id"] for sub in col.get("subcollections", [])}
        for col in data.get("collections", [])
    }


def next_id(yaml_path: Path) -> int:
    data = load_yaml_data(yaml_path)
    bookmarks = data.get("bookmarks", [])
    return max((b["id"] for b in bookmarks), default=0) + 1


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------
def validate_entry(fm: dict, valid_collections: dict[str, set[str]]) -> list[str]:
    """Return a list of error strings (empty = valid)."""
    errors = []

    title = fm.get("title", "")
    if not title or not str(title).strip():
        errors.append("missing or empty 'title'")

    url = fm.get("url", "")
    if not url or not str(url).startswith(("http://", "https://")):
        errors.append(f"invalid 'url': {url!r}")

    collection = fm.get("collection", "")
    if not collection or collection not in valid_collections:
        known = ", ".join(sorted(valid_collections.keys()))
        errors.append(f"invalid 'collection': {collection!r} (known: {known})")
    else:
        subcollection = fm.get("subcollection") or ""
        if subcollection and subcollection not in valid_collections[collection]:
            known_subs = ", ".join(sorted(valid_collections[collection]))
            errors.append(
                f"invalid 'subcollection': {subcollection!r} for collection "
                f"{collection!r} (known: {known_subs or 'none'})"
            )

    return errors


# ---------------------------------------------------------------------------
# Entry construction
# ---------------------------------------------------------------------------
def _coerce_date(value) -> str | None:
    """Convert any date-like value to a YYYY-MM-DD string, or None."""
    if value is None:
        return None
    if isinstance(value, date):
        return value.strftime("%Y-%m-%d")
    s = str(value).strip()
    if re.match(r"^\d{4}-\d{2}-\d{2}$", s):
        return s
    return None


def _coerce_tags(value) -> list:
    if not value:
        return []
    if isinstance(value, list):
        return [str(t).strip().lower() for t in value if t]
    # Single string "ai, python" → ['ai', 'python']
    return [t.strip().lower() for t in str(value).split(",") if t.strip()]


def frontmatter_to_bookmark(fm: dict, new_id: int) -> dict:
    """Map Obsidian Web Clipper frontmatter fields to bookmarks.yaml schema."""
    # Obsidian Web Clipper uses 'description'; schema uses 'desc'
    desc = fm.get("description") or fm.get("desc") or ""
    desc = str(desc).strip()

    subcollection = fm.get("subcollection") or None
    if subcollection:
        subcollection = str(subcollection).strip() or None

    added_raw = fm.get("added") or date.today()
    added = _coerce_date(added_raw) or str(date.today())

    raw = {
        "id": new_id,
        "title": str(fm["title"]).strip(),
        "url": str(fm["url"]).strip(),
        "desc": desc,
        "collection": str(fm["collection"]).strip(),
        "tags": _coerce_tags(fm.get("tags")),
        "featured": bool(fm.get("featured", False)),
        "subcollection": subcollection,
        "added": added,
    }

    # Apply canonical field order; omit None values
    return {k: raw[k] for k in FIELD_ORDER if raw.get(k) is not None or k not in ("subcollection",)}


# ---------------------------------------------------------------------------
# YAML append
# ---------------------------------------------------------------------------
def append_to_yaml(yaml_path: Path, entry: dict) -> None:
    """Append a single bookmark entry to the end of bookmarks.yaml."""
    serialised = yaml.dump(
        [entry],
        Dumper=BookmarkDumper,
        default_flow_style=False,
        allow_unicode=True,
        sort_keys=False,
    )
    with open(yaml_path, "a", encoding="utf-8") as f:
        f.write(serialised)


# ---------------------------------------------------------------------------
# File movement
# ---------------------------------------------------------------------------
def move_note(note_path: Path, processed_dir: Path) -> None:
    dest = processed_dir / note_path.name
    # Avoid collision: suffix counter
    stem = dest.stem
    suffix = dest.suffix
    counter = 1
    while dest.exists():
        dest = processed_dir / f"{stem}-{counter}{suffix}"
        counter += 1
    shutil.move(str(note_path), str(dest))


# ---------------------------------------------------------------------------
# Validate-only mode
# ---------------------------------------------------------------------------
def validate_yaml_file(yaml_path: Path) -> tuple[list[str], list[str]]:
    """
    Validate the full bookmarks.yaml for structural integrity.

    Returns (errors, warnings).
      errors   — fatal problems (duplicate IDs, unknown collection refs, parse errors)
      warnings — non-fatal issues (duplicate URLs, which pre-exist in some datasets)
    """
    errors: list[str] = []
    warnings: list[str] = []

    try:
        data = load_yaml_data(yaml_path)
    except yaml.YAMLError as exc:
        return [f"YAML parse error: {exc}"], []

    valid_collections = {
        col["id"]: {sub["id"] for sub in col.get("subcollections", [])}
        for col in data.get("collections", [])
    }

    seen_ids: set[int] = set()
    seen_urls: set[str] = set()

    for i, bm in enumerate(data.get("bookmarks", []), start=1):
        prefix = f"bookmark #{i} (id={bm.get('id')})"

        bm_id = bm.get("id")
        if bm_id in seen_ids:
            errors.append(f"{prefix}: duplicate id {bm_id}")
        else:
            seen_ids.add(bm_id)

        url = bm.get("url", "")
        norm = normalize_url(url)
        if norm in seen_urls:
            # Duplicate URLs are warnings, not errors — pre-existing in the dataset
            warnings.append(f"{prefix}: duplicate url {url!r}")
        else:
            seen_urls.add(norm)

        col = bm.get("collection", "")
        if col not in valid_collections:
            errors.append(f"{prefix}: unknown collection {col!r}")
        else:
            sub = bm.get("subcollection") or ""
            if sub and sub not in valid_collections[col]:
                errors.append(
                    f"{prefix}: unknown subcollection {sub!r} for collection {col!r}"
                )

    return errors, warnings


# ---------------------------------------------------------------------------
# Main inbox processing loop
# ---------------------------------------------------------------------------
def process_inbox(
    inbox_dir: Path,
    yaml_path: Path,
    processed_dir: Path,
    dry_run: bool = False,
) -> SyncResult:
    result = SyncResult()

    notes = sorted(inbox_dir.glob("*.md"))
    if not notes:
        return result

    existing_urls = load_existing_urls(yaml_path)
    valid_collections = load_valid_collections(yaml_path)
    current_id = next_id(yaml_path)

    for note_path in notes:
        fm = parse_frontmatter(note_path)
        if fm is None:
            result.skipped_errors.append(
                (note_path.name, ["no valid YAML frontmatter found"])
            )
            continue

        errors = validate_entry(fm, valid_collections)
        if errors:
            result.skipped_errors.append((note_path.name, errors))
            continue

        norm = normalize_url(str(fm.get("url", "")))
        if norm in existing_urls:
            result.skipped_dupes.append(str(fm.get("title", note_path.name)))
            if not dry_run:
                move_note(note_path, processed_dir)
            continue

        entry = frontmatter_to_bookmark(fm, current_id)

        if not dry_run:
            append_to_yaml(yaml_path, entry)
            move_note(note_path, processed_dir)

        existing_urls.add(norm)
        current_id += 1
        result.added.append(entry["title"])

    return result


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def main() -> int:
    repo_root = Path(__file__).parent.parent

    parser = argparse.ArgumentParser(description="Sync Obsidian inbox notes to bookmarks.yaml")
    parser.add_argument("--inbox", default=str(repo_root / "bookmarks-inbox"), help="Inbox directory")
    parser.add_argument("--yaml", default=str(repo_root / "data" / "bookmarks.yaml"), help="bookmarks.yaml path")
    parser.add_argument("--processed", default=str(repo_root / "bookmarks-processed"), help="Processed notes directory")
    parser.add_argument("--dry-run", action="store_true", help="Parse and validate without writing any files")
    parser.add_argument("--validate-only", action="store_true", help="Validate bookmarks.yaml, skip inbox")
    parser.add_argument("--quiet", action="store_true", help="Suppress informational output; emit machine-readable summary line")
    args = parser.parse_args()

    yaml_path = Path(args.yaml)
    inbox_dir = Path(args.inbox)
    processed_dir = Path(args.processed)

    if not yaml_path.exists():
        print(f"Error: {yaml_path} not found", file=sys.stderr)
        return 1

    # --- Validate-only mode ---
    if args.validate_only:
        errors, warnings = validate_yaml_file(yaml_path)
        if warnings and not args.quiet:
            print(f"Warnings ({len(warnings)}):")
            for w in warnings:
                print(f"  ~ {w}")
        if errors:
            if args.quiet:
                print(f"Validation failed ({len(errors)} error(s)):", file=sys.stderr)
                for e in errors:
                    print(f"  - {e}", file=sys.stderr)
            else:
                print(f"Validation failed ({len(errors)} error(s)):")
                for e in errors:
                    print(f"  - {e}")
            return 1
        if not args.quiet:
            data = load_yaml_data(yaml_path)
            print(
                f"OK: {len(data.get('bookmarks', []))} bookmarks validated"
                + (f", {len(warnings)} warning(s)" if warnings else ", no issues")
                + "."
            )
        return 0

    # --- Inbox processing mode ---
    if not inbox_dir.exists():
        if not args.quiet:
            print(f"Inbox directory not found: {inbox_dir}")
        return 0

    processed_dir.mkdir(parents=True, exist_ok=True)

    result = process_inbox(inbox_dir, yaml_path, processed_dir, dry_run=args.dry_run)

    if not args.quiet:
        if result.added:
            print(f"Added {len(result.added)} bookmark(s):")
            for title in result.added:
                print(f"  + {title}")
        if result.skipped_dupes:
            print(f"Skipped {len(result.skipped_dupes)} duplicate(s):")
            for title in result.skipped_dupes:
                print(f"  ~ {title}")
        if result.skipped_errors:
            print(f"Skipped {len(result.skipped_errors)} note(s) with errors:")
            for fname, errs in result.skipped_errors:
                print(f"  ! {fname}:")
                for e in errs:
                    print(f"      - {e}")
        if not result.added and not result.skipped_dupes and not result.skipped_errors:
            print("No notes in inbox.")
        if args.dry_run:
            print("(dry-run: no files were written)")

    if args.quiet and result.skipped_errors:
        print(f"Skipped {len(result.skipped_errors)} note(s) with errors:", file=sys.stderr)
        for fname, errs in result.skipped_errors:
            print(f"  ! {fname}:", file=sys.stderr)
            for e in errs:
                print(f"      - {e}", file=sys.stderr)

    # Machine-readable summary line for clip-sync.sh
    if args.quiet:
        print(f"Added: {len(result.added)}")

    return 1 if result.skipped_errors else 0


if __name__ == "__main__":
    sys.exit(main())
