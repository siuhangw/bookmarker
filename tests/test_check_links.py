"""Tests for scripts/check_links.py — pure logic only (no live HTTP)."""
import json

import check_links
import yaml


def test_is_dead_classifies_correctly():
    # Working statuses
    for code in (200, 201, 204, 301, 302, 308):
        assert check_links.is_dead(code) is False, f"{code} should not be dead"

    # Ambiguous — treated as alive (anti-false-positive)
    for code in (401, 403, 405, 429):
        assert check_links.is_dead(code) is False, f"{code} should not be dead"

    # Dead
    for code in (404, 410, 500, 502, 503):
        assert check_links.is_dead(code) is True, f"{code} should be dead"

    # Network error (no status)
    assert check_links.is_dead(None) is True


def test_load_bookmarks_extracts_url_title_id(tmp_path):
    yaml_path = tmp_path / "bookmarks.yaml"
    yaml_path.write_text(yaml.safe_dump({
        "bookmarkList": [
            {"domain": "github.com", "bookmarkItem": [
                {"id": 1, "title": "GitHub", "url": "https://github.com"},
                {"id": 2, "title": "GitLab", "url": "https://gitlab.com"},
            ]},
            {"domain": "example.com", "bookmarkItem": [
                {"id": 3, "title": "Example", "url": "https://example.com"},
            ]},
        ],
    }))

    bookmarks = check_links.load_bookmarks(yaml_path)
    assert len(bookmarks) == 3
    assert bookmarks[0] == {"id": "1", "url": "https://github.com", "title": "GitHub"}
    assert all("id" in b and "url" in b for b in bookmarks)


def test_load_bookmarks_skips_entries_without_url(tmp_path):
    yaml_path = tmp_path / "bookmarks.yaml"
    yaml_path.write_text(yaml.safe_dump({
        "bookmarkList": [
            {"domain": "x", "bookmarkItem": [
                {"id": 1, "title": "Has URL", "url": "https://example.com"},
                {"id": 2, "title": "Missing URL"},
            ]},
        ],
    }))
    assert len(check_links.load_bookmarks(yaml_path)) == 1


def test_load_bookmarks_handles_empty_file(tmp_path):
    yaml_path = tmp_path / "bookmarks.yaml"
    yaml_path.write_text("")
    assert check_links.load_bookmarks(yaml_path) == []


def test_write_report_produces_valid_json(tmp_path):
    output = tmp_path / "dead.json"
    dead = [{"id": "5", "url": "https://dead.example", "title": "Dead", "status": 404, "reason": "Not Found"}]
    check_links.write_report(output, dead, total=10)

    assert output.exists()
    report = json.loads(output.read_text())
    assert report["total"] == 10
    assert report["dead_count"] == 1
    assert report["dead"] == dead
    assert "checked_at" in report
    # Trailing newline so git diffs are clean
    assert output.read_text().endswith("\n")


def test_write_report_creates_parent_dir(tmp_path):
    output = tmp_path / "nested" / "sub" / "dead.json"
    check_links.write_report(output, [], total=0)
    assert output.exists()
