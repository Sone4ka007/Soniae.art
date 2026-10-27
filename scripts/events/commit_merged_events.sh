#!/usr/bin/env bash
# Merge a collector snapshot onto the latest main and fast-forward it.
#
# The collector can run for twenty minutes. main may move before the push.
# Each attempt re-reads origin/main, re-merges, and pushes without force.
set -euo pipefail
if [[ $# -lt 2 ]]; then
  echo "usage: commit_merged_events.sh GENERATED_JSON COMMIT_MESSAGE" >&2
  exit 2
fi
GENERATED="$1"
MESSAGE="$2"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="${EVENTS_REPO_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
cd "$ROOT"
PY="${PYTHON:-python3}"
if command -v python >/dev/null 2>&1 && [[ -z "${PYTHON:-}" ]]; then
  PY=python
fi
if [[ ! -f "$GENERATED" ]]; then
  echo "missing generated database: $GENERATED" >&2
  exit 2
fi

git config user.name "sonyae-events-bot"
git config user.email "actions@users.noreply.github.com"
branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$branch" != "main" ]]; then
  echo "commit_merged_events.sh only runs on main (current: ${branch})" >&2
  exit 1
fi

for attempt in 1 2 3 4; do
  git fetch --depth=1 origin +refs/heads/main:refs/remotes/origin/main
  remote="$(mktemp)"
  git show origin/main:content/events.json > "$remote"
  git reset --hard origin/main
  "$PY" "$SCRIPT_DIR/merge_remote_db.py" "$GENERATED" "$remote" content/events.json
  "$PY" "$SCRIPT_DIR/quality_gate.py" content/events.json --fix --strict
  rm -f "$remote"
  if git diff --quiet -- content/events.json; then
    echo "No database changes to commit"
    exit 0
  fi
  git add content/events.json
  git commit -m "$MESSAGE"
  if git push origin HEAD:main; then
    echo "Pushed merged events database"
    exit 0
  fi
  echo "Push was not a fast-forward (attempt ${attempt}); merging onto the new main"
done
echo "Could not push merged events database without overwriting newer commits" >&2
exit 1
