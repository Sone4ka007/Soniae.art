#!/usr/bin/env python3
import json, os
from datetime import date
from pathlib import Path
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

ROOT=Path(__file__).resolve().parents[2]
DB=ROOT/"content/events.json"
SHEET_ID=os.environ["EVENTS_SHEET_ID"]
CREDS=json.loads(os.environ["GOOGLE_SERVICE_ACCOUNT_JSON"])
RANGE="Events!A:Y"

def service():
    scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"]
    creds=Credentials.from_service_account_info(CREDS,scopes=scopes)
    return build("sheets","v4",credentials=creds,cache_discovery=False)

def parse_bool(v):
    if isinstance(v,bool): return v
    s=str(v).strip().lower()
    if not s: return None
    return s in ("true","1","yes","да")

def main():
    data=service().spreadsheets().values().get(spreadsheetId=SHEET_ID,range=RANGE).execute().get("values",[])
    if not data: raise SystemExit("Sheet is empty")
    headers=data[0]
    rows=[dict(zip(headers,row+[""]*(len(headers)-len(row)))) for row in data[1:]]
    db=json.loads(DB.read_text("utf-8"))
    byid={e.get("id"):e for e in db.get("events",[]) if e.get("id")}
    editable={"status","editor_note","checked_at","review_reason","price_text","price_type","registration","availability","categories","kind","description","url","source","venue","address","price"}
    for row in rows:
        rid=row.get("id","").strip()
        if not rid or rid not in byid: continue
        e=byid[rid]
        old_status=e.get("status","")
        for k in editable:
            if k not in row: continue
            v=row[k]
            if k in ("kind","categories","description","url","source","venue","address","price","price_type","availability") and str(v).strip()=="":
                continue
            if k=="registration": v=parse_bool(v)
            elif k=="categories": v=[x.strip() for x in str(v).split(",") if x.strip()]
            e[k]=v
        new_status=e.get("status","")
        if new_status != old_status:
            if new_status in ("approved","rejected"):
                e["reviewed_at"]=date.today().isoformat()
            elif new_status in ("new","check"):
                e["reviewed_at"]=""
    db["events"]=sorted(byid.values(),key=lambda e:(e.get("date",""),e.get("time",""),e.get("title","")))
    DB.write_text(json.dumps(db,ensure_ascii=False,indent=2)+"\n","utf-8")
    print(f"Pulled editor fields for {len(rows)} rows")

if __name__=="__main__": main()
