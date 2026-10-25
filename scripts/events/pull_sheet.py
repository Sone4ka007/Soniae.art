#!/usr/bin/env python3
import json, os
from datetime import date
from pathlib import Path
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from verified_schedule import apply_verified_schedule
from sheet_editorial import capture_editor_overrides, apply_editor_overrides

ROOT=Path(__file__).resolve().parents[2]
DB=ROOT/"content/events.json"
SHEET_ID=os.environ["EVENTS_SHEET_ID"]
CREDS=json.loads(os.environ["GOOGLE_SERVICE_ACCOUNT_JSON"])
RANGE="Events!A:AJ"

def service():
    scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"]
    creds=Credentials.from_service_account_info(CREDS,scopes=scopes)
    return build("sheets","v4",credentials=creds,cache_discovery=False)

def main():
    data=service().spreadsheets().values().get(
        spreadsheetId=SHEET_ID,range=RANGE
    ).execute().get("values",[])
    if not data:
        raise SystemExit("Sheet is empty")
    headers=data[0]
    rows=[dict(zip(headers,row+[""]*(len(headers)-len(row)))) for row in data[1:]]
    db=json.loads(DB.read_text("utf-8"))
    byid={e.get("id"):e for e in db.get("events",[]) if e.get("id")}
    changed_fields=0

    for row in rows:
        rid=str(row.get("id","")).strip()
        if not rid or rid not in byid:
            continue
        e=byid[rid]
        old_status=str(e.get("status",""))
        changed=capture_editor_overrides(e,row)
        changed_fields += len(changed)
        new_status=str(e.get("status",""))
        if new_status != old_status and "reviewed_at" not in (e.get("editor_overrides") or {}):
            if new_status in ("approved","rejected"):
                e["reviewed_at"]=date.today().isoformat()
            elif new_status in ("new","check"):
                e["reviewed_at"]=""
        apply_editor_overrides(e)
        apply_verified_schedule(e)

    db["events"]=sorted(
        byid.values(),
        key=lambda e:(e.get("date",""),e.get("time",""),e.get("title",""))
    )
    DB.write_text(json.dumps(db,ensure_ascii=False,indent=2)+"\n","utf-8")
    print(f"Pulled {changed_fields} manual field overrides from {len(rows)} rows")

if __name__=="__main__":
    main()
