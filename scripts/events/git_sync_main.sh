#!/usr/bin/env bash
# Check out the current origin/main tip.
#
# Push and schedule runs start from the SHA captured when the workflow was
# queued. The shared events-data-sync group can hold them for 15–20 minutes.
# actions/checkout also points origin/main at that triggering SHA, so a later
# push of events.json is not a fast-forward and, if it succeeded, would replace
# newer events with the stale database. Call this immediately before reading
# or publishing content/events.json.
set -euo pipefail
branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$branch" != "main" ]]; then
  echo "git_sync_main.sh only runs on main (current: ${branch})" >&2
  exit 1
fi
git fetch --depth=1 origin +refs/heads/main:refs/remotes/origin/main
git reset --hard origin/main
echo "events sync base is $(git rev-parse HEAD)"
