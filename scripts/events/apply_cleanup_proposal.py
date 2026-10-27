#!/usr/bin/env python3
"""Apply events/cleanup-proposal.md exactly, and nothing else.

Duplicates listed as «повторяет» become rejected with review_reason
duplicate_record. The «оставить» row is not touched, and no row is deleted.
Junk lines are rejected only while their status is still new or check; approved
and rejected rows stay as they are, which is what the proposal says.

The 18 inferred times, the dangling title, and the 578 rejected rows without a
reason are not part of this pass.

Without Google credentials this updates content/events.json only. With
--sheet and EVENTS_SHEET_ID plus GOOGLE_SERVICE_ACCOUNT_JSON it also writes
status and review_reason for those same ids into the Sheet.
"""
import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DB = ROOT / "content" / "events.json"
PROPOSAL = ROOT / "events" / "cleanup-proposal.md"
DUPLICATE_REASON = "duplicate_record"


def listed_duplicates(text):
    return re.findall(r"повторяет `([^`]+)`", text)


def listed_junk(text):
    found = []
    for line in text.splitlines():
        match = re.match(r"- (\d{4}-\d{2}-\d{2}) (.+) → (\S+)$", line)
        if match:
            found.append(match.groups())
    return found


def _lock(event, status, reason):
    overrides = dict(event.get("editor_overrides") or {})
    overrides["status"] = status
    overrides["review_reason"] = reason
    event["editor_overrides"] = overrides
    event["status"] = status
    event["review_reason"] = reason


def apply_database(db, proposal_text):
    by_id = {event.get("id"): event for event in db.get("events") or [] if event.get("id")}
    changed = []
    missing = []
    for event_id in listed_duplicates(proposal_text):
        event = by_id.get(event_id)
        if event is None:
            missing.append(event_id)
            continue
        if event.get("status") == "rejected" and event.get("review_reason") == DUPLICATE_REASON:
            overrides = event.get("editor_overrides") or {}
            if overrides.get("status") == "rejected" and overrides.get("review_reason") == DUPLICATE_REASON:
                continue
        _lock(event, "rejected", DUPLICATE_REASON)
        changed.append(event_id)
    junk_skipped = []
    junk_changed = []
    for date, title, reason in listed_junk(proposal_text):
        matches = [
            event for event in db.get("events") or []
            if event.get("date") == date and event.get("title") == title
        ]
        if len(matches) != 1:
            raise SystemExit(f"Junk row is not unique: {date} {title} ({len(matches)})")
        event = matches[0]
        if event.get("status") in ("approved", "rejected"):
            junk_skipped.append(event.get("id"))
            continue
        _lock(event, "rejected", reason)
        junk_changed.append(event.get("id"))
    if missing:
        raise SystemExit("Missing duplicate ids: " + ", ".join(missing))
    return changed, junk_changed, junk_skipped


def _column_letter(index):
    number = index + 1
    letters = ""
    while number:
        number, remainder = divmod(number - 1, 26)
        letters = chr(65 + remainder) + letters
    return letters


def push_sheet_cells(events_by_id, event_ids):
    sheet_id = os.environ.get("EVENTS_SHEET_ID")
    raw_creds = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON")
    if not sheet_id or not raw_creds:
        raise SystemExit(
            "Sheet update needs EVENTS_SHEET_ID and GOOGLE_SERVICE_ACCOUNT_JSON. "
            "content/events.json is already updated."
        )
    from google.oauth2.service_account import Credentials
    from googleapiclient.discovery import build

    creds = Credentials.from_service_account_info(
        json.loads(raw_creds),
        scopes=["https://www.googleapis.com/auth/spreadsheets"],
    )
    service = build("sheets", "v4", credentials=creds, cache_discovery=False)
    values = service.spreadsheets().values()
    rows = values.get(spreadsheetId=sheet_id, range="Events!A:AK").execute().get("values", [])
    if not rows:
        raise SystemExit("Sheet is empty")
    headers = rows[0]
    id_at = headers.index("id")
    status_at = headers.index("status")
    reason_at = headers.index("review_reason")
    synced_status_at = headers.index("synced_status") if "synced_status" in headers else None
    snapshot_at = headers.index("synced_row_json") if "synced_row_json" in headers else None
    data = []
    found = set()
    for row_number, row in enumerate(rows[1:], start=2):
        padded = row + [""] * (len(headers) - len(row))
        event_id = str(padded[id_at]).strip()
        if event_id not in event_ids:
            continue
        found.add(event_id)
        event = events_by_id[event_id]
        data.append({
            "range": f"Events!{_column_letter(status_at)}{row_number}",
            "values": [[event["status"]]],
        })
        data.append({
            "range": f"Events!{_column_letter(reason_at)}{row_number}",
            "values": [[event["review_reason"]]],
        })
        if synced_status_at is not None:
            data.append({
                "range": f"Events!{_column_letter(synced_status_at)}{row_number}",
                "values": [[event["status"]]],
            })
        if snapshot_at is not None and str(padded[snapshot_at]).strip():
            try:
                snapshot = json.loads(padded[snapshot_at])
            except json.JSONDecodeError:
                snapshot = None
            if isinstance(snapshot, dict):
                snapshot["status"] = event["status"]
                snapshot["review_reason"] = event["review_reason"]
                data.append({
                    "range": f"Events!{_column_letter(snapshot_at)}{row_number}",
                    "values": [[json.dumps(snapshot, ensure_ascii=False, separators=(",", ":"))]],
                })
    absent = sorted(set(event_ids) - found)
    if absent:
        raise SystemExit("Ids not on the Sheet: " + ", ".join(absent))
    if data:
        values.batchUpdate(
            spreadsheetId=sheet_id,
            body={"valueInputOption": "RAW", "data": data},
        ).execute()
    return len(found)


def main():
    proposal_text = PROPOSAL.read_text("utf-8")
    original = DB.read_bytes()
    db = json.loads(original)
    changed, junk_changed, junk_skipped = apply_database(db, proposal_text)
    if changed or junk_changed:
        DB.write_text(json.dumps(db, ensure_ascii=False, indent=2) + "\n", "utf-8")
    print(f"duplicates marked rejected: {len(changed)}")
    for event_id in changed:
        print(f"  {event_id}")
    print(f"junk newly rejected: {len(junk_changed)}")
    print(f"junk left untouched because already approved or rejected: {len(junk_skipped)}")
    if "--sheet" in sys.argv:
        by_id = {event.get("id"): event for event in db["events"]}
        ids = listed_duplicates(proposal_text) + junk_changed
        updated = push_sheet_cells(by_id, ids)
        print(f"sheet rows updated: {updated}")


if __name__ == "__main__":
    main()
