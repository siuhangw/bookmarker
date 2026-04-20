#!/usr/bin/env python3
"""
check_links.py — Probe every bookmark URL and write a dead-link report.

Loads data/bookmarks.yaml, issues a HEAD (falling back to GET for servers that
reject HEAD) to each URL concurrently, and writes data/dead-links.json with a
stable, sorted list of URLs that returned 4xx/5xx or failed outright. The
frontend reads this file and marks flagged bookmarks in the UI.

Usage:
  python3 scripts/check_links.py [options]

Options:
  --yaml PATH        bookmarks.yaml path (default: data/bookmarks.yaml)
  --output PATH      report path (default: data/dead-links.json)
  --timeout SECONDS  per-request timeout (default: 15)
  --workers N        concurrent checkers (default: 8)
  --verbose          print per-URL status
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent

# User-Agent: some sites (e.g. Cloudflare-protected) 403 the default Python UA.
USER_AGENT = (
    "Mozilla/5.0 (compatible; bookmarker-linkcheck/1.0; "
    "+https://github.com/siuhangw/bookmarker)"
)

# Status codes we treat as "link works". 401/403/429/405 aren't dead — they
# just refuse to confirm via an unauthenticated HEAD. We keep them out of the
# report to avoid false positives.
OK_STATUSES = frozenset({200, 201, 202, 203, 204, 206, 301, 302, 303, 307, 308})
AMBIGUOUS_STATUSES = frozenset({401, 403, 405, 429})


def load_bookmarks(yaml_path: Path) -> list[dict]:
    with yaml_path.open(encoding="utf-8") as fh:
        data = yaml.safe_load(fh) or {}
    out = []
    for group in data.get("bookmarkList", []) or []:
        for bm in group.get("bookmarkItem", []) or []:
            if bm.get("url"):
                out.append({"id": str(bm["id"]), "url": bm["url"], "title": bm.get("title", "")})
    return out


def probe(url: str, timeout: float) -> tuple[int | None, str]:
    """
    Return (status_code, reason). status_code is None for network errors.
    Tries HEAD first, falls back to GET for ambiguous statuses.
    """
    headers = {"User-Agent": USER_AGENT, "Accept": "*/*"}

    def _request(method: str) -> tuple[int | None, str]:
        req = urllib.request.Request(url, method=method, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.status, resp.reason or ""
        except urllib.error.HTTPError as e:
            return e.code, e.reason or ""
        except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as e:
            return None, str(e.reason if hasattr(e, "reason") else e)

    status, reason = _request("HEAD")
    if status in AMBIGUOUS_STATUSES:
        status, reason = _request("GET")
    return status, reason


def is_dead(status: int | None) -> bool:
    if status is None:
        return True
    if status in OK_STATUSES or status in AMBIGUOUS_STATUSES:
        return False
    return 400 <= status < 600


def check_all(bookmarks: list[dict], timeout: float, workers: int, verbose: bool) -> list[dict]:
    dead: list[dict] = []
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(probe, bm["url"], timeout): bm for bm in bookmarks}
        for fut in as_completed(futures):
            bm = futures[fut]
            status, reason = fut.result()
            if verbose:
                tag = "DEAD" if is_dead(status) else "OK  "
                print(f"[{tag}] {status or '---':>4} {bm['url']}", file=sys.stderr)
            if is_dead(status):
                dead.append({
                    "id": bm["id"],
                    "url": bm["url"],
                    "title": bm["title"],
                    "status": status,
                    "reason": reason[:200],
                })
    # Sort by id so the JSON is stable in git.
    dead.sort(key=lambda d: (int(d["id"]) if d["id"].isdigit() else 0, d["url"]))
    return dead


def write_report(output_path: Path, dead: list[dict], total: int) -> None:
    report = {
        "checked_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "total": total,
        "dead_count": len(dead),
        "dead": dead,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Check bookmark URLs and write a dead-link report.")
    parser.add_argument("--yaml", default=str(REPO_ROOT / "data" / "bookmarks.yaml"))
    parser.add_argument("--output", default=str(REPO_ROOT / "data" / "dead-links.json"))
    parser.add_argument("--timeout", type=float, default=15.0)
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args(argv)

    bookmarks = load_bookmarks(Path(args.yaml))
    if not bookmarks:
        print("No bookmarks found — nothing to check.", file=sys.stderr)
        write_report(Path(args.output), [], 0)
        return 0

    print(f"Checking {len(bookmarks)} URLs with {args.workers} workers...", file=sys.stderr)
    dead = check_all(bookmarks, args.timeout, args.workers, args.verbose)
    write_report(Path(args.output), dead, len(bookmarks))
    print(f"Done. {len(dead)}/{len(bookmarks)} flagged as dead.", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
