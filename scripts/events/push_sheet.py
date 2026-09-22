#!/usr/bin/env python3
import json, os
from pathlib import Path
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

ROOT=Path(__file__).resolve().parents[2]
DB=ROOT/"content/events.json"
SHEET_ID=os.environ["EVENTS_SHEET_ID"]
CREDS=json.loads(os.environ["GOOGLE_SERVICE_ACCOUNT_JSON"])
RANGE="Events!A:Z"
HEADERS=["id","status","title","date","time","venue","city","kind","price_type","price_text","registration","availability","availability_checked_at","categories","description","url","source","review_reason","editor_note","discovered_at","reviewed_at","address","price","checked_at","days_ahead","synced_status"]

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
    # Also remember the live row order so a push cannot move rows while the
    # editor is actively moderating them.
    current=api.get(spreadsheetId=SHEET_ID,range=RANGE).execute().get("values",[])
    if not current:
        return 0, {}
    headers=current[0]
    byid={e.get("id"):e for e in db.get("events",[]) if e.get("id")}
    current_order={}
    # Preserve only moderation decisions made in the live Sheet.
    # Public event content is owned by the repository/curated layer.
    editable={"editor_note","checked_at","review_reason"}
    merged=0
    for idx,row in enumerate(current[1:],start=1):
        obj=dict(zip(headers,row+[""]*(len(headers)-len(row))))
        rid=str(obj.get("id","")).strip()
        if rid and rid not in current_order:
            current_order[rid]=idx
        if not rid or rid not in byid:
            continue
        e=byid[rid]
        old_status=e.get("status","")
        live_status=str(obj.get("status","")).strip()
        synced_status=str(obj.get("synced_status","")).strip()
        if synced_status and live_status!=synced_status and live_status in ("new","check","approved","rejected"):
            e["status"]=live_status
        for k in editable:
            if k not in obj:
                continue
            v=obj[k]
            if v not in ("",None) or k in {"editor_note","review_reason"}:
                e[k]=v
        if e.get("status","") != old_status:
            if e.get("status") in ("approved","rejected"):
                import datetime as _dt
                e["reviewed_at"]=_dt.date.today().isoformat()
            elif e.get("status") in ("new","check"):
                e["reviewed_at"]=""
        merged+=1
    return merged, current_order

def main():
    db=json.loads(DB.read_text("utf-8"))
    svc=service()
    api=svc.spreadsheets().values()
    merged,current_order=preserve_editor_fields(api,db)
    db["events"]=sorted(db.get("events",[]),key=lambda e:(e.get("date",""),e.get("time",""),e.get("title","")))
    DB.write_text(json.dumps(db,ensure_ascii=False,indent=2)+"\n","utf-8")

    rows=[HEADERS]
    import datetime as _dt
    priority={"new":0,"check":1,"approved":2,"rejected":3}
    existing=[]
    fresh=[]
    for e in db.get("events",[]):
        rid=e.get("id","")
        (existing if rid in current_order else fresh).append(e)

    # Existing rows keep their exact live Sheet order, regardless of status edits.
    existing.sort(key=lambda e:current_order.get(e.get("id",""),10**9))
    # Only genuinely new rows are ordered by moderation priority and recency.
    fresh.sort(key=lambda e:(
        priority.get(e.get("status","new"),9),
        -(int(str(e.get("discovered_at","1900-01-01")).replace("-","")) if str(e.get("discovered_at","")).replace("-","").isdigit() else 0),
        e.get("date",""),
        e.get("time",""),
        e.get("title","")
    ))
    sheet_events=existing+fresh
    for e in sheet_events:
        try:
            days=(_dt.date.fromisoformat(e.get("date",""))-_dt.date.today()).days
        except Exception:
            days=""
        rows.append([
            e.get("id",""),e.get("status","new"),e.get("title",""),e.get("date",""),e.get("time",""),
            e.get("venue",""),e.get("city",""),e.get("kind","event"),e.get("price_type","unknown"),
            e.get("price_text",""),
            bool(e.get("registration")) if e.get("registration") is not None else "",
            e.get("availability","unknown"),e.get("availability_checked_at",""),
            ",".join(e.get("categories",[])) if isinstance(e.get("categories"),list) else e.get("categories",""),
            e.get("description",""),e.get("url",""),e.get("source",""),e.get("review_reason",""),
            e.get("editor_note",""),e.get("discovered_at",""),e.get("reviewed_at",""),
            e.get("address",""),e.get("price",""),e.get("checked_at",""),days,e.get("status","new")
        ])

    api.clear(spreadsheetId=SHEET_ID,range=RANGE,body={}).execute()
    api.update(spreadsheetId=SHEET_ID,range="Events!A1",valueInputOption="RAW",body={"values":rows}).execute()

    meta=svc.spreadsheets().get(spreadsheetId=SHEET_ID,fields="sheets(properties(sheetId,title))").execute()
    sheet_id=next(s["properties"]["sheetId"] for s in meta["sheets"] if s["properties"]["title"]=="Events")
    requests=[
      {"setBasicFilter":{"filter":{"range":{"sheetId":sheet_id,"startRowIndex":0,"startColumnIndex":0,"endColumnIndex":25}}}},
      {"setDataValidation":{"range":{"sheetId":sheet_id,"startRowIndex":1,"startColumnIndex":1,"endColumnIndex":2},
        "rule":{"condition":{"type":"ONE_OF_LIST","values":[{"userEnteredValue":x} for x in ["new","check","approved","rejected"]]},"strict":True,"showCustomUi":True}}},
      {"setDataValidation":{"range":{"sheetId":sheet_id,"startRowIndex":1,"startColumnIndex":6,"endColumnIndex":7},
        "rule":{"condition":{"type":"ONE_OF_LIST","values":[{"userEnteredValue":x} for x in ["moscow","spb","russia","international"]]},"strict":True,"showCustomUi":True}}},
      {"setDataValidation":{"range":{"sheetId":sheet_id,"startRowIndex":1,"startColumnIndex":7,"endColumnIndex":8},
        "rule":{"condition":{"type":"ONE_OF_LIST","values":[{"userEnteredValue":x} for x in ["event","exhibition","open_call"]]},"strict":True,"showCustomUi":True}}},
      {"setDataValidation":{"range":{"sheetId":sheet_id,"startRowIndex":1,"startColumnIndex":8,"endColumnIndex":9},
        "rule":{"condition":{"type":"ONE_OF_LIST","values":[{"userEnteredValue":x} for x in ["free","paid","unknown"]]},"strict":True,"showCustomUi":True}}},
      {"setDataValidation":{"range":{"sheetId":sheet_id,"startRowIndex":1,"startColumnIndex":10,"endColumnIndex":11},
        "rule":{"condition":{"type":"BOOLEAN"},"strict":True,"showCustomUi":True}}},
      {"setDataValidation":{"range":{"sheetId":sheet_id,"startRowIndex":1,"startColumnIndex":11,"endColumnIndex":12},
        "rule":{"condition":{"type":"ONE_OF_LIST","values":[{"userEnteredValue":x} for x in ["available","sold_out","unknown"]]},"strict":True,"showCustomUi":True}}}
    ]
    svc.spreadsheets().batchUpdate(spreadsheetId=SHEET_ID,body={"requests":requests}).execute()
    print(f"Preserved editor fields for {merged} rows; pushed {len(rows)-1} events to Google Sheet")

if __name__=="__main__": main()
