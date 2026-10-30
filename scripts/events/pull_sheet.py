#!/usr/bin/env python3
import hashlib
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

    # Manually reviewed weekly shortlist. Only the explicit "approved" choice
    # promotes a suggestion into the main events database and public calendar.
    suggestion_data=service().spreadsheets().values().get(
        spreadsheetId=SHEET_ID,range="'Кандидаты 2–8 ноября'!A:K"
    ).execute().get("values",[])
    promoted=0
    if suggestion_data:
        suggestion_headers=suggestion_data[0]
        for cells in suggestion_data[1:]:
            row=dict(zip(suggestion_headers,cells+[""]*(len(suggestion_headers)-len(cells))))
            if str(row.get("status","")).strip().lower() != "approved":
                continue
            title=str(row.get("title","")).strip()
            day=str(row.get("date","")).strip()
            url=str(row.get("url","")).strip()
            if not title or not url.startswith("https://"):
                continue
            try:
                date.fromisoformat(day)
            except ValueError:
                continue
            existing=next((e for e in byid.values() if
                           str(e.get("title","")).casefold()==title.casefold()
                           and str(e.get("date",""))==day),None)
            if existing:
                if existing.get("status")!="approved":
                    existing.setdefault("editor_overrides",{})["status"]="approved"
                    existing["reviewed_at"]=date.today().isoformat()
                    apply_editor_overrides(existing)
                    promoted+=1
                continue
            city=str(row.get("city") or "russia").strip()
            kind=str(row.get("kind") or "event").strip()
            price_text=str(row.get("price") or "").strip()
            cats=(["выставка"] if kind=="exhibition" else
                  ["лекция"] if "лекция" in title.lower() else
                  ["мастер-класс"] if "мастер-класс" in title.lower() else
                  ["конференция"] if "конференция" in title.lower() else
                  ["презентация"] if "презентация" in title.lower() else [])
            event_id="manual-"+city+"-"+day+"-"+hashlib.sha1(
                (title+"|"+day+"|"+url).encode("utf-8")
            ).hexdigest()[:10]
            new_event={
                "id":event_id,"title":title,"status":"approved","date":day,
                "time":str(row.get("time") or "").strip(),
                "venue":str(row.get("venue") or "").strip(),
                "city":city,"kind":kind,"categories":cats,
                "description":str(row.get("description") or "").strip(),
                "url":url,"source":str(row.get("source") or "Ручная подборка").strip(),
                "price_type":"free" if "бесплатно" in price_text.lower() else
                             "paid" if "₽" in price_text else "unknown",
                "price_text":price_text,"availability":"unknown",
                "discovered_at":date.today().isoformat(),
                "reviewed_at":date.today().isoformat(),
                "editor_note":"Одобрено в листе «Кандидаты 2–8 ноября»",
                "editor_overrides":{"status":"approved"}
            }
            byid[event_id]=new_event
            promoted+=1

    db["events"]=sorted(
        byid.values(),
        key=lambda e:(e.get("date",""),e.get("time",""),e.get("title",""))
    )
    DB.write_text(json.dumps(db,ensure_ascii=False,indent=2)+"\n","utf-8")
    print(f"Pulled {changed_fields} manual field overrides from {len(rows)} rows; promoted {promoted} weekly candidates")

if __name__=="__main__":
    main()
