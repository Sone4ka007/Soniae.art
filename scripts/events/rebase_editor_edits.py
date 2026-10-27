#!/usr/bin/env python3
"""Overlay Sheet editor overrides onto a newer events database.

Push-triggered sheet sync checks out the commit that started the run. That
commit can be twenty minutes behind main by the time the shared
events-data-sync queue lets the job start. Publishing that snapshot would
drop events added while the job waited. This rebase keeps the newer database
as the base and copies only editorial overrides captured from the Sheet.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from sheet_editorial import apply_editor_overrides


def overlay(remote_event, captured_event):
    item = dict(remote_event)
    captured_overrides = dict(captured_event.get("editor_overrides") or {})
    if not captured_overrides:
        return item, False
    overrides = dict(item.get("editor_overrides") or {})
    overrides.update(captured_overrides)
    item["editor_overrides"] = overrides
    apply_editor_overrides(item)
    # pull_sheet/push_sheet stamp reviewed_at when status changes and the
    # editor did not type reviewed_at themselves.
    if (
        "status" in captured_overrides
        and "reviewed_at" not in captured_overrides
        and captured_event.get("status") != remote_event.get("status")
    ):
        item["reviewed_at"] = captured_event.get("reviewed_at", "")
    return item, True


def rebase(captured, remote):
    captured_by_id = {
        event.get("id"): event
        for event in captured.get("events", [])
        if event.get("id")
    }
    merged = []
    seen = set()
    applied = 0
    for event in remote.get("events", []):
        rid = event.get("id")
        captured_event = captured_by_id.get(rid) if rid else None
        if captured_event:
            item, changed = overlay(event, captured_event)
            if changed:
                applied += 1
        else:
            item = dict(event)
        merged.append(item)
        if rid:
            seen.add(rid)
    skipped = [
        event.get("id")
        for event in captured.get("events", [])
        if event.get("id") and event.get("id") not in seen
    ]
    out = dict(remote)
    out["events"] = sorted(
        merged,
        key=lambda event: (
            event.get("date", ""),
            event.get("time", ""),
            event.get("title", ""),
        ),
    )
    return out, applied, skipped


def main():
    captured_path, remote_path, out_path = (Path(arg) for arg in sys.argv[1:4])
    captured = json.loads(captured_path.read_text("utf-8"))
    remote = json.loads(remote_path.read_text("utf-8"))
    merged, applied, skipped = rebase(captured, remote)
    out_path.write_text(
        json.dumps(merged, ensure_ascii=False, indent=2) + "\n",
        "utf-8",
    )
    print(
        f"Rebased editor edits onto {len(merged.get('events', []))} remote events; "
        f"overrides_applied={applied}; skipped_stale_only={len(skipped)}"
    )
    if skipped:
        preview = ", ".join(skipped[:20])
        print(f"Skipped events that exist only in the stale snapshot: {preview}")


if __name__ == "__main__":
    main()
