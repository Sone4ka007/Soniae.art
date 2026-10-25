#!/usr/bin/env python3
import datetime as _dt
import json, os
from pathlib import Path
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from sheet_editorial import capture_editor_overrides, apply_editor_overrides, snapshot_from_event

ROOT=Path(__file__).resolve().parents[2]
DB=ROOT/"content/events.json"
SHEET_ID=os.environ["EVENTS_SHEET_ID"]
CREDS=json.loads(os.environ["GOOGLE_SERVICE_ACCOUNT_JSON"])
RANGE="Events!A:AJ"
HEADERS=[
    "title","status","date","time","venue","city","kind","categories","description","url","source",
    "address","price_type","price_text","registration","availability","availability_checked_at",
    "review_reason","editor_note","discovered_at","reviewed_at","price","checked_at","days_ahead",
    "id","synced_status","synced_url","synced_source","social_priority","social_title",
    "social_description","telegram_include","instagram_include","instagram_image","synced_title",
    "synced_row_json"
]

def service():
    scopes=["https://www.googleapis.com/auth/spreadsheets"]
    creds=Credentials.from_service_account_info(CREDS,scopes=scopes)
    return build("sheets","v4",credentials=creds,cache_discovery=False)

def preserve_editor_fields(api, db):
    current=api.get(spreadsheetId=SHEET_ID,range=RANGE).execute().get("values",[])
    if not current:
        return 0, {}, 0
    headers=current[0]
    byid={e.get("id"):e for e in db.get("events",[]) if e.get("id")}
    current_order={}
    merged=0
    changed_fields=0

    for idx,row in enumerate(current[1:],start=1):
        obj=dict(zip(headers,row+[""]*(len(headers)-len(row))))
        rid=str(obj.get("id","")).strip()
        if rid and rid not in current_order:
            current_order[rid]=idx
        if not rid or rid not in byid:
            continue
        e=byid[rid]
        apply_editor_overrides(e)
        old_status=str(e.get("status",""))
        changed=capture_editor_overrides(e,obj)
        changed_fields += len(changed)
        new_status=str(e.get("status",""))
        if new_status != old_status and "reviewed_at" not in (e.get("editor_overrides") or {}):
            if new_status in ("approved","rejected"):
                e["reviewed_at"]=_dt.date.today().isoformat()
            elif new_status in ("new","check"):
                e["reviewed_at"]=""
        apply_editor_overrides(e)
        merged+=1
    return merged, current_order, changed_fields

def row_for_event(e):
    apply_editor_overrides(e)
    try:
        days=(_dt.date.fromisoformat(str(e.get("date","")))-_dt.date.today()).days
    except Exception:
        days=""
    categories=e.get("categories",[])
    categories_text=",".join(categories) if isinstance(categories,list) else str(categories or "")
    registration=e.get("registration")
    telegram=e.get("telegram_include")
    instagram=e.get("instagram_include")
    snapshot=json.dumps(snapshot_from_event(e),ensure_ascii=False,separators=(",",":"))
    return [
        e.get("title",""),e.get("status","new"),e.get("date",""),e.get("time",""),e.get("venue",""),
        e.get("city",""),e.get("kind","event"),categories_text,e.get("description",""),e.get("url",""),
        e.get("source",""),e.get("address",""),e.get("price_type","unknown"),e.get("price_text",""),
        bool(registration) if registration is not None else "",e.get("availability","unknown"),
        e.get("availability_checked_at",""),e.get("review_reason",""),e.get("editor_note",""),
        e.get("discovered_at",""),e.get("reviewed_at",""),e.get("price",""),e.get("checked_at",""),
        days,e.get("id",""),e.get("status","new"),e.get("url",""),e.get("source",""),
        e.get("social_priority",""),e.get("social_title",""),e.get("social_description",""),
        telegram if telegram is not None else "",instagram if instagram is not None else "",
        e.get("instagram_image",""),e.get("title",""),snapshot
    ]

def main():
    db=json.loads(DB.read_text("utf-8"))
    for e in db.get("events",[]):
        apply_editor_overrides(e)

    svc=service()
    api=svc.spreadsheets().values()
    merged,current_order,changed_fields=preserve_editor_fields(api,db)

    db["events"]=sorted(
        db.get("events",[]),
        key=lambda e:(e.get("date",""),e.get("time",""),e.get("title",""))
    )

    priority={"new":0,"check":1,"approved":2,"rejected":3}
    existing=[]
    fresh=[]
    for e in db.get("events",[]):
        apply_editor_overrides(e)
        rid=e.get("id","")
        (existing if rid in current_order else fresh).append(e)

    existing.sort(key=lambda e:current_order.get(e.get("id",""),10**9))
    fresh.sort(key=lambda e:(
        priority.get(e.get("status","new"),9),
        -(int(str(e.get("discovered_at","1900-01-01")).replace("-",""))
          if str(e.get("discovered_at","")).replace("-","").isdigit() else 0),
        e.get("date",""),e.get("time",""),e.get("title","")
    ))
    sheet_events=existing+fresh
    rows=[HEADERS]+[row_for_event(e) for e in sheet_events]

    DB.write_text(json.dumps(db,ensure_ascii=False,indent=2)+"\n","utf-8")

    api.clear(spreadsheetId=SHEET_ID,range=RANGE,body={}).execute()
    api.update(
        spreadsheetId=SHEET_ID,range="Events!A1",valueInputOption="RAW",body={"values":rows}
    ).execute()

    meta=svc.spreadsheets().get(
        spreadsheetId=SHEET_ID,
        fields="sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)))"
    ).execute()
    sheet_id=next(
        s["properties"]["sheetId"] for s in meta["sheets"]
        if s["properties"]["title"]=="Events"
    )

    requests=[
      {"updateDimensionProperties":{"range":{"sheetId":sheet_id,"dimension":"ROWS","startIndex":1,"endIndex":max(2,len(rows))},
        "properties":{"pixelSize":96},"fields":"pixelSize"}},
      {"repeatCell":{"range":{"sheetId":sheet_id,"startRowIndex":1,"endRowIndex":max(2,len(rows)),"startColumnIndex":0,"endColumnIndex":36},
        "cell":{"userEnteredFormat":{"verticalAlignment":"TOP","wrapStrategy":"CLIP"}},"fields":"userEnteredFormat.verticalAlignment,userEnteredFormat.wrapStrategy"}},
      {"setDataValidation":{"range":{"sheetId":sheet_id,"startRowIndex":1,"startColumnIndex":0,"endColumnIndex":36}}},
      {"setBasicFilter":{"filter":{"range":{"sheetId":sheet_id,"startRowIndex":0,"startColumnIndex":0,"endColumnIndex":36}}}},
      {"setDataValidation":{"range":{"sheetId":sheet_id,"startRowIndex":1,"startColumnIndex":1,"endColumnIndex":2},
        "rule":{"condition":{"type":"ONE_OF_LIST","values":[{"userEnteredValue":x} for x in ["new","check","approved","rejected"]]},"strict":True,"showCustomUi":True}}},
      {"setDataValidation":{"range":{"sheetId":sheet_id,"startRowIndex":1,"startColumnIndex":5,"endColumnIndex":6},
        "rule":{"condition":{"type":"ONE_OF_LIST","values":[{"userEnteredValue":x} for x in ["moscow","spb","russia","international"]]},"strict":True,"showCustomUi":True}}},
      {"setDataValidation":{"range":{"sheetId":sheet_id,"startRowIndex":1,"startColumnIndex":6,"endColumnIndex":7},
        "rule":{"condition":{"type":"ONE_OF_LIST","values":[{"userEnteredValue":x} for x in ["event","exhibition","open_call"]]},"strict":True,"showCustomUi":True}}},
      {"setDataValidation":{"range":{"sheetId":sheet_id,"startRowIndex":1,"startColumnIndex":12,"endColumnIndex":13},
        "rule":{"condition":{"type":"ONE_OF_LIST","values":[{"userEnteredValue":x} for x in ["free","paid","unknown"]]},"strict":True,"showCustomUi":True}}},
      {"setDataValidation":{"range":{"sheetId":sheet_id,"startRowIndex":1,"startColumnIndex":14,"endColumnIndex":15},
        "rule":{"condition":{"type":"BOOLEAN"},"strict":True,"showCustomUi":True}}},
      {"setDataValidation":{"range":{"sheetId":sheet_id,"startRowIndex":1,"startColumnIndex":15,"endColumnIndex":16},
        "rule":{"condition":{"type":"ONE_OF_LIST","values":[{"userEnteredValue":x} for x in ["available","sold_out","postponed","cancelled","unknown"]]},"strict":True,"showCustomUi":True}}},
      {"setDataValidation":{"range":{"sheetId":sheet_id,"startRowIndex":1,"startColumnIndex":31,"endColumnIndex":33},
        "rule":{"condition":{"type":"BOOLEAN"},"strict":True,"showCustomUi":True}}},
      {"setDataValidation":{"range":{"sheetId":sheet_id,"startRowIndex":1,"startColumnIndex":28,"endColumnIndex":29},
        "rule":{"condition":{"type":"NUMBER_BETWEEN","values":[{"userEnteredValue":"0"},{"userEnteredValue":"5"}]},"strict":True,"showCustomUi":True}}},
      {"updateDimensionProperties":{"range":{"sheetId":sheet_id,"dimension":"COLUMNS","startIndex":24,"endIndex":28},
        "properties":{"hiddenByUser":True},"fields":"hiddenByUser"}},
      {"updateDimensionProperties":{"range":{"sheetId":sheet_id,"dimension":"COLUMNS","startIndex":34,"endIndex":36},
        "properties":{"hiddenByUser":True},"fields":"hiddenByUser"}}
    ]
    svc.spreadsheets().batchUpdate(spreadsheetId=SHEET_ID,body={"requests":requests}).execute()
    print(
        f"Preserved editor fields for {merged} rows; detected {changed_fields} manual field edits; "
        f"pushed {len(rows)-1} events to Google Sheet"
    )

if __name__=="__main__":
    main()
