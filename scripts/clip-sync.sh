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
# Single-instance lock — prevents cron and a manual run from racing. Uses
# mkdir (atomic on all POSIX filesystems) so we don't depend on util-linux
# flock, which isn't present on stock macOS.
# ---------------------------------------------------------------------------
LOCKDIR="${TMPDIR:-/tmp}/bookmarker-clip-sync.lock"
STALE_MINUTES=30
if [[ -d "$LOCKDIR" ]]; then
  # Treat a lock older than STALE_MINUTES as stale (previous run crashed).
  if find "$LOCKDIR" -maxdepth 0 -mmin +"$STALE_MINUTES" | grep -q .; then
    echo "[clip-sync] Removing stale lock: $LOCKDIR"
    rmdir "$LOCKDIR" 2>/dev/null || true
  fi
fi
if ! mkdir "$LOCKDIR" 2>/dev/null; then
  echo "[clip-sync] Another instance is running (lock: $LOCKDIR). Exiting."
  exit 0
fi

cleanup() {
  # If a prior command left a rebase in progress, clear it so the next run
  # isn't permanently blocked by "rebase in progress" errors.
  if [[ -d .git/rebase-apply || -d .git/rebase-merge ]]; then
    echo "[clip-sync] Aborting in-progress rebase..." >&2
    git rebase --abort >/dev/null 2>&1 || true
  fi
  rmdir "$LOCKDIR" 2>/dev/null || true
}
trap cleanup EXIT

# ---------------------------------------------------------------------------
# Detect Python — Windows Git Bash uses "python", Unix uses "python3"
# ---------------------------------------------------------------------------
if command -v python3 &>/dev/null; then
  PYTHON=python3
elif command -v python &>/dev/null; then
  PYTHON=python
else
  echo "[clip-sync] ERROR: Python not found. Install Python and ensure it is on PATH." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Run the Python sync script
# In dry-run mode skip --quiet so the full per-bookmark detail is shown.
# ---------------------------------------------------------------------------
QUIET_FLAG="--quiet"
[[ -n "$DRY_RUN" ]] && QUIET_FLAG=""

SYNC_OUTPUT=$("$PYTHON" scripts/sync_bookmarks.py $QUIET_FLAG ${DRY_RUN} 2>&1) || {
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
# Dry-run: print full detail and exit without git operations
# ---------------------------------------------------------------------------
if [[ -n "$DRY_RUN" ]]; then
  echo "[clip-sync] Dry-run — no files written, no git operations performed."
  [[ -n "$SYNC_OUTPUT" ]] && echo "$SYNC_OUTPUT"
  echo "[clip-sync] Would commit and push ${ADDED_COUNT} bookmark(s)."
  exit 0
fi

echo "[clip-sync] ${ADDED_COUNT} new bookmark(s) — committing and pushing..."

DELAYS=(2 4 8 16)

# Pull latest to avoid diverged history. Retry on transient network failures;
# on persistent failure, abort any half-finished rebase (trap also handles this)
# and exit without committing so we don't build atop a broken state.
pull_ok=0
for delay in 0 "${DELAYS[@]}"; do
  [[ "$delay" -gt 0 ]] && { echo "[clip-sync] Pull failed, retrying in ${delay}s..."; sleep "$delay"; }
  if git pull --rebase origin main; then
    pull_ok=1
    break
  fi
done
if [[ "$pull_ok" -eq 0 ]]; then
  echo "[clip-sync] ERROR: git pull --rebase failed after retries." >&2
  exit 1
fi

git add data/bookmarks.yaml bookmarks-processed/
git commit -m "sync: add ${ADDED_COUNT} bookmark(s) from inbox"

# Push with exponential backoff (up to 4 retries: 2s, 4s, 8s, 16s)
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
