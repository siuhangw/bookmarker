"""Tests for scripts/sync_bookmarks.py — covers the invariants the Obsidian
inbox → bookmarks.yaml pipeline relies on (dedup, id allocation, validation,
atomic writes, frontmatter parsing)."""

from pathlib import Path

import pytest
import sync_bookmarks as sb
import yaml

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
SAMPLE_YAML = """\
meta:
  title: Markly
  theme:
    default: light

collectionList:
  - id: dev
    name: Dev
    order: 1
    collectionItem:
      - id: editors
        name: Editors
        order: 1
  - id: ai
    name: AI
    order: 2

bookmarkList:
  - domain: github.com
    bookmarkItem:
      - id: 1
        title: GitHub
        url: https://github.com
        collection: dev
        tags: [code]
        added: 2025-01-01
      - id: 2
        title: GitHub Docs
        url: https://docs.github.com/
        collection: dev
        tags: []
        added: 2025-01-02
"""


@pytest.fixture
def yaml_path(tmp_path: Path) -> Path:
    p = tmp_path / "bookmarks.yaml"
    p.write_text(SAMPLE_YAML, encoding="utf-8")
    return p


# ---------------------------------------------------------------------------
# URL normalization
# ---------------------------------------------------------------------------
class TestNormalizeUrl:
    def test_lowercases(self):
        assert sb.normalize_url("https://Example.com") == "https://example.com"

    def test_strips_trailing_slash(self):
        assert sb.normalize_url("https://example.com/") == "https://example.com"

    def test_strips_fragment(self):
        assert sb.normalize_url("https://example.com/page#section") == "https://example.com/page"

    def test_combined(self):
        assert sb.normalize_url("HTTPS://Example.COM/Path/#top") == "https://example.com/path"


# ---------------------------------------------------------------------------
# ID allocation + dedup (read-side)
# ---------------------------------------------------------------------------
class TestLoadHelpers:
    def test_next_id_picks_max_plus_one(self, yaml_path: Path):
        assert sb.next_id(yaml_path) == 3

    def test_load_existing_urls_is_normalized(self, yaml_path: Path):
        urls = sb.load_existing_urls(yaml_path)
        assert "https://github.com" in urls
        # trailing slash was stripped during normalization
        assert "https://docs.github.com" in urls
        assert len(urls) == 2

    def test_load_valid_collections_reads_subcollections(self, yaml_path: Path):
        vc = sb.load_valid_collections(yaml_path)
        assert vc == {"dev": {"editors"}, "ai": set()}


# ---------------------------------------------------------------------------
# Entry validation
# ---------------------------------------------------------------------------
class TestValidateEntry:
    def setup_method(self):
        self.vc = {"dev": {"editors"}, "ai": set()}

    def test_missing_title(self):
        errors = sb.validate_entry({"url": "https://x.com", "collection": "dev"}, self.vc)
        assert any("title" in e for e in errors)

    def test_blank_title(self):
        errors = sb.validate_entry({"title": "   ", "url": "https://x.com", "collection": "dev"}, self.vc)
        assert any("title" in e for e in errors)

    def test_invalid_url_scheme(self):
        errors = sb.validate_entry({"title": "X", "url": "ftp://x.com", "collection": "dev"}, self.vc)
        assert any("url" in e for e in errors)

    def test_unknown_collection(self):
        errors = sb.validate_entry({"title": "X", "url": "https://x.com", "collection": "nope"}, self.vc)
        assert any("collection" in e for e in errors)

    def test_unknown_subcollection(self):
        errors = sb.validate_entry(
            {"title": "X", "url": "https://x.com", "collection": "dev", "collectionItem": "nope"},
            self.vc,
        )
        assert any("collectionItem" in e for e in errors)

    def test_subcollection_alias_accepted(self):
        """Obsidian Web Clipper template uses 'subcollection', schema uses 'collectionItem'."""
        errors = sb.validate_entry(
            {"title": "X", "url": "https://x.com", "collection": "dev", "subcollection": "editors"},
            self.vc,
        )
        assert errors == []

    def test_subcollection_rejected_when_collection_has_none(self):
        errors = sb.validate_entry(
            {"title": "X", "url": "https://x.com", "collection": "ai", "collectionItem": "anything"},
            self.vc,
        )
        assert any("collectionItem" in e for e in errors)

    def test_happy_path(self):
        errors = sb.validate_entry(
            {"title": "X", "url": "https://x.com", "collection": "dev", "collectionItem": "editors"},
            self.vc,
        )
        assert errors == []


# ---------------------------------------------------------------------------
# Frontmatter parsing (malformed YAML)
# ---------------------------------------------------------------------------
class TestParseFrontmatter:
    def test_valid_frontmatter(self, tmp_path: Path):
        note = tmp_path / "note.md"
        note.write_text("---\ntitle: Hello\nurl: https://x.com\n---\nbody", encoding="utf-8")
        fm = sb.parse_frontmatter(note)
        assert fm == {"title": "Hello", "url": "https://x.com"}

    def test_missing_frontmatter_returns_none(self, tmp_path: Path):
        note = tmp_path / "no-fm.md"
        note.write_text("no frontmatter here", encoding="utf-8")
        assert sb.parse_frontmatter(note) is None

    def test_malformed_yaml_returns_none(self, tmp_path: Path, capsys):
        note = tmp_path / "bad.md"
        note.write_text("---\ntitle: [oops\n---\n", encoding="utf-8")
        assert sb.parse_frontmatter(note) is None
        err = capsys.readouterr().err
        assert "Invalid YAML" in err

    def test_non_dict_frontmatter_returns_none(self, tmp_path: Path):
        note = tmp_path / "list.md"
        note.write_text("---\n- one\n- two\n---\n", encoding="utf-8")
        assert sb.parse_frontmatter(note) is None


# ---------------------------------------------------------------------------
# frontmatter_to_bookmark — field coercion
# ---------------------------------------------------------------------------
class TestFrontmatterToBookmark:
    def test_minimal_entry(self):
        bm = sb.frontmatter_to_bookmark(
            {"title": "X", "url": "https://x.com", "collection": "dev"},
            new_id=42,
        )
        assert bm["id"] == 42
        assert bm["title"] == "X"
        assert bm["url"] == "https://x.com"
        assert bm["collection"] == "dev"
        assert bm["tags"] == []
        assert bm["featured"] is False
        assert "collectionItem" not in bm  # omitted when None

    def test_tags_as_csv_string(self):
        bm = sb.frontmatter_to_bookmark(
            {"title": "X", "url": "https://x.com", "collection": "dev", "tags": "AI, Python, "},
            new_id=1,
        )
        # lowercased, trimmed, empty entries dropped
        assert bm["tags"] == ["ai", "python"]

    def test_description_aliased_to_desc(self):
        bm = sb.frontmatter_to_bookmark(
            {"title": "X", "url": "https://x.com", "collection": "dev", "description": "hi"},
            new_id=1,
        )
        assert bm["desc"] == "hi"

    def test_subcollection_alias_kept_as_collectionItem(self):
        bm = sb.frontmatter_to_bookmark(
            {"title": "X", "url": "https://x.com", "collection": "dev", "subcollection": "editors"},
            new_id=1,
        )
        assert bm["collectionItem"] == "editors"


# ---------------------------------------------------------------------------
# append_to_yaml — atomic write + domain grouping
# ---------------------------------------------------------------------------
class TestAppendToYaml:
    def test_appends_to_existing_domain_group(self, yaml_path: Path):
        entry = {"id": 3, "title": "Issues", "url": "https://github.com/issues", "collection": "dev"}
        sb.append_to_yaml(yaml_path, entry)

        data = yaml.safe_load(yaml_path.read_text())
        groups = {g["domain"]: g for g in data["bookmarkList"]}
        assert "github.com" in groups
        github_items = groups["github.com"]["bookmarkItem"]
        assert github_items[-1]["url"] == "https://github.com/issues"
        assert len(github_items) == 3

    def test_creates_new_domain_group(self, yaml_path: Path):
        entry = {"id": 3, "title": "Anthropic", "url": "https://anthropic.com", "collection": "ai"}
        sb.append_to_yaml(yaml_path, entry)

        data = yaml.safe_load(yaml_path.read_text())
        domains = [g["domain"] for g in data["bookmarkList"]]
        assert "anthropic.com" in domains

    def test_write_is_atomic_no_temp_leftover(self, yaml_path: Path, tmp_path: Path):
        entry = {"id": 3, "title": "X", "url": "https://x.com", "collection": "dev"}
        sb.append_to_yaml(yaml_path, entry)

        leftovers = list(tmp_path.glob("bookmarks.yaml.*.tmp"))
        assert leftovers == []


# ---------------------------------------------------------------------------
# Full-file validator
# ---------------------------------------------------------------------------
class TestValidateYamlFile:
    def test_clean_file(self, yaml_path: Path):
        errors, warnings = sb.validate_yaml_file(yaml_path)
        assert errors == []
        assert warnings == []

    def test_duplicate_id(self, tmp_path: Path):
        bad = SAMPLE_YAML.replace("id: 2", "id: 1")
        p = tmp_path / "bad.yaml"
        p.write_text(bad, encoding="utf-8")
        errors, _ = sb.validate_yaml_file(p)
        assert any("duplicate id" in e for e in errors)

    def test_duplicate_url_is_warning(self, tmp_path: Path):
        # Replace the second bookmark's URL with the first's so they collide.
        bad = SAMPLE_YAML.replace("https://docs.github.com/", "https://github.com/")
        p = tmp_path / "dup.yaml"
        p.write_text(bad, encoding="utf-8")
        errors, warnings = sb.validate_yaml_file(p)
        assert errors == []
        assert any("duplicate url" in w for w in warnings)

    def test_unknown_collection_is_error(self, tmp_path: Path):
        bad = SAMPLE_YAML.replace("collection: dev\n        tags: [code]", "collection: nope\n        tags: [code]")
        p = tmp_path / "bad.yaml"
        p.write_text(bad, encoding="utf-8")
        errors, _ = sb.validate_yaml_file(p)
        assert any("collection" in e for e in errors)


# ---------------------------------------------------------------------------
# End-to-end inbox processing
# ---------------------------------------------------------------------------
class TestProcessInbox:
    def _make_note(self, dir: Path, name: str, **fm) -> Path:
        note = dir / f"{name}.md"
        body = "---\n" + yaml.safe_dump(fm) + "---\nbody\n"
        note.write_text(body, encoding="utf-8")
        return note

    def test_adds_new_bookmark(self, yaml_path: Path, tmp_path: Path):
        inbox = tmp_path / "inbox"
        inbox.mkdir()
        processed = tmp_path / "processed"
        processed.mkdir()

        self._make_note(inbox, "new", title="New", url="https://new.com", collection="dev")

        result = sb.process_inbox(inbox, yaml_path, processed)
        assert result.added == ["New"]
        assert not list(inbox.glob("*.md"))
        assert list(processed.glob("*.md"))

        ids = [b["id"] for b in sb._flat_bookmarks(sb.load_yaml_data(yaml_path))]
        assert 3 in ids  # allocated from max(1,2)+1

    def test_skips_duplicate_url(self, yaml_path: Path, tmp_path: Path):
        inbox = tmp_path / "inbox"
        inbox.mkdir()
        processed = tmp_path / "processed"
        processed.mkdir()

        self._make_note(inbox, "dup", title="Dup", url="https://github.com", collection="dev")

        result = sb.process_inbox(inbox, yaml_path, processed)
        assert result.added == []
        assert result.skipped_dupes == ["Dup"]
        # Duplicate is still moved out of the inbox so it doesn't re-process every run.
        assert not list(inbox.glob("*.md"))

    def test_dry_run_no_side_effects(self, yaml_path: Path, tmp_path: Path):
        inbox = tmp_path / "inbox"
        inbox.mkdir()
        processed = tmp_path / "processed"
        processed.mkdir()

        self._make_note(inbox, "new", title="New", url="https://new.com", collection="dev")
        original = yaml_path.read_text()

        result = sb.process_inbox(inbox, yaml_path, processed, dry_run=True)
        assert result.added == ["New"]
        # Source YAML unchanged, inbox untouched, processed empty.
        assert yaml_path.read_text() == original
        assert list(inbox.glob("*.md"))
        assert not list(processed.glob("*.md"))

    def test_invalid_frontmatter_surfaces_error(self, yaml_path: Path, tmp_path: Path):
        inbox = tmp_path / "inbox"
        inbox.mkdir()
        processed = tmp_path / "processed"
        processed.mkdir()

        # Missing collection
        self._make_note(inbox, "bad", title="Bad", url="https://bad.com")

        result = sb.process_inbox(inbox, yaml_path, processed)
        assert result.added == []
        assert len(result.skipped_errors) == 1
        assert list(inbox.glob("*.md"))  # bad notes stay in inbox for manual fix
