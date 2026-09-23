#!/usr/bin/env python3
import json, os
from pathlib import Path
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

ROOT=Path(__file__).resolve().parents[2]
DB=ROOT/"content/events.json"
SHEET_ID=os.environ["EVENTS_SHEET_ID"]
CREDS=json.loads(os.environ["GOOGLE_SERVICE_ACCOUNT_JSON"])
RANGE="Events!A:AH"
HEADERS=["id","status","title","start_date","end_date","time","venue","city","kind","price_type","price_text","registration","availability","availability_checked_at","categories","description","url","source","review_reason","editor_note","discovered_at","reviewed_at","address","price","checked_at","days_ahead","attended","recap_status","recap_title","recap_notes","recap_press_release_url","recap_links","recap_photo_urls","recap_updated_at"]

def service():
    scopes=["https://www.googleapis.com/auth/spreadsheets"]
    creds=Credentials.from_service_account_info(CREDS,scopes=scopes)
    return build("sheets","v4",credentials=creds,cache_discovery=False)

def parse_bool(v):
    if isinstance(v,bool): return v
    s=str(v).strip().lower()
    if not s: return None
    if s in ("true","1","yes","да"): return True
    if s in ("false","0","no","нет"): return False
    return None

def preserve_editor_fields(api, db):
    # Merge the live Sheet back into the DB immediately before overwriting it.
    # This makes editor decisions durable even if they are made during a pipeline run.
    current=api.get(spreadsheetId=SHEET_ID,range=RANGE).execute().get("values",[])
    if not current:
        return 0
    headers=current[0]
    byid={e.get("id"):e for e in db.get("events",[]) if e.get("id")}
    editable={"editor_note","checked_at","review_reason","price_text","registration","categories","attended","recap_status","recap_title","recap_notes","recap_press_release_url","recap_links","recap_photo_urls","recap_updated_at"}
    merged=0
    for row in current[1:]:
        obj=dict(zip(headers,row+[""]*(len(headers)-len(row))))
        rid=str(obj.get("id","")).strip()
        if not rid or rid not in byid:
            continue
        e=byid[rid]
        old_status=e.get("status","")
        live_status=str(obj.get("status","")).strip()
        if live_status in ("approved","rejected"):
            e["status"]=live_status
        for k in editable:
            if k not in obj:
                continue
            v=obj[k]
            if k in ("registration","attended"):
                v=parse_bool(v)
            elif k=="categories":
                v=[x.strip() for x in str(v).split(",") if x.strip()]
            if v not in ("",None) or k in {"registration","editor_note","review_reason"}:
                e[k]=v
        if e.get("status","") != old_status:
            if e.get("status") in ("approved","rejected"):
                import datetime as _dt
                e["reviewed_at"]=_dt.date.today().isoformat()
            elif e.get("status") in ("new","check"):
                e["reviewed_at"]=""
        merged+=1
    return merged

def main():
    db=json.loads(DB.read_text("utf-8"))
    svc=service()
    api=svc.spreadsheets().values()
    merged=preserve_editor_fields(api,db)
    db["events"]=sorted(db.get("events",[]),key=lambda e:(e.get("date",""),e.get("time",""),e.get("title","")))
    DB.write_text(json.dumps(db,ensure_ascii=False,indent=2)+"\n","utf-8")

    rows=[HEADERS]
    import datetime as _dt
    priority={"new":0,"check":1,"approved":2,"rejected":3}
    sheet_events=sorted(
        db.get("events",[]),
        key=lambda e:(
            priority.get(e.get("status","new"),9),
            -(int(str(e.get("discovered_at","1900-01-01")).replace("-","")) if str(e.get("discovered_at","")).replace("-","").isdigit() else 0),
            e.get("date",""),
            e.get("time",""),
            e.get("title","")
        )
    )
    for e in sheet_events:
        try:
            days=(_dt.date.fromisoformat(e.get("date",""))-_dt.date.today()).days
        except Exception:
            days=""
        rows.append([
            e.get("id",""),e.get("status","new"),e.get("title",""),
            (e.get("start_date","") if e.get("kind")=="exhibition" else e.get("date","")),
            e.get("end_date",""),e.get("time",""),
            e.get("venue",""),e.get("city",""),e.get("kind","event"),e.get("price_type","unknown"),
            e.get("price_text",""),
            bool(e.get("registration")) if e.get("registration") is not None else "",
            e.get("availability","unknown"),e.get("availability_checked_at",""),
            ",".join(e.get("categories",[])) if isinstance(e.get("categories"),list) else e.get("categories",""),
            e.get("description",""),e.get("url",""),e.get("source",""),e.get("review_reason",""),
            e.get("editor_note",""),e.get("discovered_at",""),e.get("reviewed_at",""),
            e.get("address",""),e.get("price",""),e.get("checked_at",""),days,
            bool(e.get("attended")) if e.get("attended") is not None else "",
            e.get("recap_status",""),e.get("recap_title",""),e.get("recap_notes",""),
            e.get("recap_press_release_url",""),e.get("recap_links",""),e.get("recap_photo_urls",""),e.get("recap_updated_at","")
        ])

    api.clear(spreadsheetId=SHEET_ID,range=RANGE,body={}).execute()
    api.update(spreadsheetId=SHEET_ID,range="Events!A1",valueInputOption="RAW",body={"values":rows}).execute()

    meta=svc.spreadsheets().get(spreadsheetId=SHEET_ID,fields="sheets(properties(sheetId,title))").execute()
    sheet_id=next(s["properties"]["sheetId"] for s in meta["sheets"] if s["properties"]["title"]=="Events")
    requests=[
      {"setBasicFilter":{"filter":{"range":{"sheetId":sheet_id,"startRowIndex":0,"startColumnIndex":0,"endColumnIndex":34}}}},
      {"setDataValidation":{"range":{"sheetId":sheet_id,"startRowIndex":1,"startColumnIndex":1,"endColumnIndex":2},
        "rule":{"condition":{"type":"ONE_OF_LIST","values":[{"userEnteredValue":x} for x in ["new","check","approved","rejected"]]},"strict":True,"showCustomUi":True}}},
      {"setDataValidation":{"range":{"sheetId":sheet_id,"startRowIndex":1,"startColumnIndex":7,"endColumnIndex":8},
        "rule":{"condition":{"type":"ONE_OF_LIST","values":[{"userEnteredValue":x} for x in ["moscow","spb","russia","international"]]},"strict":True,"showCustomUi":True}}},
      {"setDataValidation":{"range":{"sheetId":sheet_id,"startRowIndex":1,"startColumnIndex":8,"endColumnIndex":9},
        "rule":{"condition":{"type":"ONE_OF_LIST","values":[{"userEnteredValue":x} for x in ["event","exhibition","open_call"]]},"strict":True,"showCustomUi":True}}},
      {"setDataValidation":{"range":{"sheetId":sheet_id,"startRowIndex":1,"startColumnIndex":9,"endColumnIndex":10},
        "rule":{"condition":{"type":"ONE_OF_LIST","values":[{"userEnteredValue":x} for x in ["free","paid","unknown"]]},"strict":True,"showCustomUi":True}}},
      {"setDataValidation":{"range":{"sheetId":sheet_id,"startRowIndex":1,"startColumnIndex":11,"endColumnIndex":12},
        "rule":{"condition":{"type":"BOOLEAN"},"strict":True,"showCustomUi":True}}},
      {"setDataValidation":{"range":{"sheetId":sheet_id,"startRowIndex":1,"startColumnIndex":12,"endColumnIndex":13},
        "rule":{"condition":{"type":"ONE_OF_LIST","values":[{"userEnteredValue":x} for x in ["available","sold_out","unknown"]]},"strict":True,"showCustomUi":True}}},
      {"setDataValidation":{"range":{"sheetId":sheet_id,"startRowIndex":1,"startColumnIndex":26,"endColumnIndex":27},
        "rule":{"condition":{"type":"BOOLEAN"},"strict":True,"showCustomUi":True}}},
      {"setDataValidation":{"range":{"sheetId":sheet_id,"startRowIndex":1,"startColumnIndex":27,"endColumnIndex":28},
        "rule":{"condition":{"type":"ONE_OF_LIST","values":[{"userEnteredValue":x} for x in ["draft","published"]]},"strict":True,"showCustomUi":True}}}
    ]
    svc.spreadsheets().batchUpdate(spreadsheetId=SHEET_ID,body={"requests":requests}).execute()
    print(f"Preserved editor fields for {merged} rows; pushed {len(rows)-1} events to Google Sheet")

if __name__=="__main__": main()
