#!/usr/bin/env bash
# Fast-forward a local events.json edit onto the latest main and push it.
#
# Editorial overrides captured from the Sheet are applied onto the newer
# database. Events that exist only on that newer main are kept. Events that
# exist only in the stale snapshot are not resurrected. The push is never
# forced; a rejected update retries against the new tip.
set -euo pipefail
MESSAGE="${1:-Preserve event moderation edits}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="${EVENTS_REPO_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
cd "$ROOT"
PY="${PYTHON:-python3}"
if command -v python >/dev/null 2>&1 && [[ -z "${PYTHON:-}" ]]; then
  PY=python
fi

git config user.name "sonyae-events-bot"
git config user.email "actions@users.noreply.github.com"
branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$branch" != "main" ]]; then
  echo "persist_events_json.sh only runs on main (current: ${branch})" >&2
  exit 1
fi

fetch_main() {
  git fetch --depth=1 origin +refs/heads/main:refs/remotes/origin/main
}

for attempt in 1 2 3 4; do
  fetch_main
  if [[ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]]; then
    echo "origin/main moved; rebasing sheet edits onto it (attempt ${attempt})"
    edited="$(mktemp)"
    remote="$(mktemp)"
    cp content/events.json "$edited"
    git show origin/main:content/events.json > "$remote"
    git reset --hard origin/main
    "$PY" "$SCRIPT_DIR/rebase_editor_edits.py" "$edited" "$remote" content/events.json
    rm -f "$edited" "$remote"
    if [[ -n "${EVENTS_SHEET_ID:-}" && -n "${GOOGLE_SERVICE_ACCOUNT_JSON:-}" ]]; then
      echo "Republishing the merged database so the Sheet cannot keep a stale snapshot"
      "$PY" "$SCRIPT_DIR/push_sheet.py"
    else
      echo "Google credentials are not set; Sheet republish skipped"
    fi
  fi
  if git diff --quiet -- content/events.json; then
    echo "No event database changes to persist"
    exit 0
  fi
  git add content/events.json
  git commit -m "$MESSAGE"
  if git push origin HEAD:main; then
    echo "Pushed events database"
    exit 0
  fi
  echo "Push was not a fast-forward (attempt ${attempt}); retrying"
done
echo "Could not persist events.json without overwriting newer commits" >&2
exit 1
