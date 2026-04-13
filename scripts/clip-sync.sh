#!/usr/bin/env bash
# clip-sync.sh — Run the bookmark sync and push changes to GitHub.
#
# Usage:
#   ./scripts/clip-sync.sh           # normal run
#   ./scripts/clip-sync.sh --dry-run # preview without writing files
#
# Automation (cron, every 15 min):
#   */15 * * * * /path/to/bookmarker/scripts/clip-sync.sh >> /tmp/bookmarker-sync.log 2>&1
#
# macOS (launchd, ~/Library/LaunchAgents/com.bookmarker.clipsync.plist):
#   Set StartInterval=900, ProgramArguments=["/path/to/scripts/clip-sync.sh"]

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

DRY_RUN=""
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN="--dry-run"
fi

# ---------------------------------------------------------------------------
# Run the Python sync script
# ---------------------------------------------------------------------------
SYNC_OUTPUT=$(python3 scripts/sync_bookmarks.py --quiet ${DRY_RUN} 2>&1) || {
  echo "[clip-sync] ERROR: sync_bookmarks.py failed:"
  echo "$SYNC_OUTPUT"
  exit 1
}

# Parse machine-readable summary line: "Added: N"
ADDED_COUNT=$(echo "$SYNC_OUTPUT" | grep -oP '(?<=Added: )\d+' || true)
ADDED_COUNT="${ADDED_COUNT:-0}"

if [[ "$ADDED_COUNT" -eq 0 ]]; then
  echo "[clip-sync] Nothing new to sync."
  exit 0
fi

# ---------------------------------------------------------------------------
# Dry-run: report and exit without git operations
# ---------------------------------------------------------------------------
if [[ -n "$DRY_RUN" ]]; then
  echo "[clip-sync] Dry-run: would add ${ADDED_COUNT} bookmark(s)."
  exit 0
fi

echo "[clip-sync] ${ADDED_COUNT} new bookmark(s) — committing and pushing..."

# Pull latest to avoid diverged history
git pull --rebase origin main

git add data/bookmarks.yaml bookmarks-processed/
git commit -m "sync: add ${ADDED_COUNT} bookmark(s) from inbox"

# Push with exponential backoff (up to 4 retries: 2s, 4s, 8s, 16s)
DELAYS=(2 4 8 16)
for delay in "${DELAYS[@]}"; do
  if git push -u origin main; then
    echo "[clip-sync] Pushed ${ADDED_COUNT} bookmark(s) to GitHub."
    exit 0
  fi
  echo "[clip-sync] Push failed, retrying in ${delay}s..."
  sleep "$delay"
done

echo "[clip-sync] ERROR: All push attempts failed." >&2
exit 1
