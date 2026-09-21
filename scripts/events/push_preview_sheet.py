#!/usr/bin/env python3
import json, os
from pathlib import Path
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

ROOT=Path(__file__).resolve().parents[2]
DB=ROOT/"content/events.json"
SHEET_ID=os.environ["EVENTS_SHEET_ID"]
CREDS=json.loads(os.environ["GOOGLE_SERVICE_ACCOUNT_JSON"])
SHEET_TITLE="Preview v2"
HEADERS=["status","title","start","end","time","venue","kind","price","registration","availability","source","link","reason"]

def service():
    scopes=["https://www.googleapis.com/auth/spreadsheets"]
    creds=Credentials.from_service_account_info(CREDS,scopes=scopes)
    return build("sheets","v4",credentials=creds,cache_discovery=False)

def main():
    svc=service()
    sheets=svc.spreadsheets()

    # GES-2 frequently exposes the same programme page on many calendar dates.
    # If an editor has already made a final decision for that page in Events,
    # do not send the same URL back to Preview v2 for another date.
    decided_ges2_urls=set()
    live=sheets.values().get(spreadsheetId=SHEET_ID,range="Events!A:Z").execute().get("values",[])
    if live:
        headers=live[0]
        for raw in live[1:]:
            row=dict(zip(headers,raw+[""]*(len(headers)-len(raw))))
            status=str(row.get("status","")).strip().lower()
            url=str(row.get("url","")).strip().lower()
            source=str(row.get("source","")).lower()
            venue=str(row.get("venue","")).lower()
            if status in ("approved","rejected") and url and (
                "гэс-2" in source or "гэс-2" in venue or "ges-2.org" in url
            ):
                decided_ges2_urls.add(url)

    db=json.loads(DB.read_text("utf-8"))
    priority={"new":0,"check":1,"approved":2,"rejected":3}
    actionable=[]
    for e in db.get("events",[]):
        if e.get("status") not in ("new","check"):
            continue
        url=str(e.get("url","")).strip().lower()
        source=str(e.get("source","")).lower()
        venue=str(e.get("venue","")).lower()
        is_ges2=("гэс-2" in source or "гэс-2" in venue or "ges-2.org" in url)
        if is_ges2 and url in decided_ges2_urls:
            continue
        actionable.append(e)

    events=sorted(
        actionable,
        key=lambda e:(
            priority.get(e.get("status","new"),9),
            e.get("start_date") or e.get("date",""),
            e.get("time",""),
            e.get("title","")
        )
    )
    rows=[HEADERS]
    for e in events:
        rows.append([
            e.get("status",""),
            e.get("title",""),
            e.get("start_date") if e.get("kind")=="exhibition" else e.get("date",""),
            e.get("end_date","") if e.get("kind")=="exhibition" else "",
            e.get("time",""),
            e.get("venue",""),
            e.get("kind","event"),
            e.get("price_type","unknown"),
            "yes" if e.get("registration") is True else "no" if e.get("registration") is False else "unknown",
            e.get("availability","unknown"),
            e.get("source",""),
            e.get("url",""),
            e.get("review_reason",""),
        ])

    meta=sheets.get(spreadsheetId=SHEET_ID,fields="sheets(properties(sheetId,title))").execute()
    match=[s for s in meta["sheets"] if s["properties"]["title"]==SHEET_TITLE]
    if not match:
        resp=sheets.batchUpdate(spreadsheetId=SHEET_ID,body={"requests":[{"addSheet":{"properties":{"title":SHEET_TITLE,"gridProperties":{"rowCount":500,"columnCount":13,"frozenRowCount":1,"frozenColumnCount":2}}}}]}).execute()
        sheet_id=resp["replies"][0]["addSheet"]["properties"]["sheetId"]
    else:
        sheet_id=match[0]["properties"]["sheetId"]

    api=sheets.values()
    api.clear(spreadsheetId=SHEET_ID,range=f"'{SHEET_TITLE}'!A:M",body={}).execute()
    api.update(spreadsheetId=SHEET_ID,range=f"'{SHEET_TITLE}'!A1",valueInputOption="RAW",body={"values":rows}).execute()

    reqs=[
      {"setBasicFilter":{"filter":{"range":{"sheetId":sheet_id,"startRowIndex":0,"endRowIndex":len(rows),"startColumnIndex":0,"endColumnIndex":13}}}},
      {"updateSheetProperties":{"properties":{"sheetId":sheet_id,"gridProperties":{"frozenRowCount":1,"frozenColumnCount":2}},"fields":"gridProperties.frozenRowCount,gridProperties.frozenColumnCount"}},
      {"updateDimensionProperties":{"range":{"sheetId":sheet_id,"dimension":"COLUMNS","startIndex":0,"endIndex":1},"properties":{"pixelSize":90},"fields":"pixelSize"}},
      {"updateDimensionProperties":{"range":{"sheetId":sheet_id,"dimension":"COLUMNS","startIndex":1,"endIndex":2},"properties":{"pixelSize":360},"fields":"pixelSize"}},
      {"updateDimensionProperties":{"range":{"sheetId":sheet_id,"dimension":"COLUMNS","startIndex":2,"endIndex":5},"properties":{"pixelSize":95},"fields":"pixelSize"}},
      {"updateDimensionProperties":{"range":{"sheetId":sheet_id,"dimension":"COLUMNS","startIndex":5,"endIndex":6},"properties":{"pixelSize":180},"fields":"pixelSize"}},
      {"updateDimensionProperties":{"range":{"sheetId":sheet_id,"dimension":"COLUMNS","startIndex":6,"endIndex":11},"properties":{"pixelSize":120},"fields":"pixelSize"}},
      {"updateDimensionProperties":{"range":{"sheetId":sheet_id,"dimension":"COLUMNS","startIndex":11,"endIndex":12},"properties":{"pixelSize":300},"fields":"pixelSize"}},
      {"updateDimensionProperties":{"range":{"sheetId":sheet_id,"dimension":"COLUMNS","startIndex":12,"endIndex":13},"properties":{"pixelSize":220},"fields":"pixelSize"}},
    ]
    sheets.batchUpdate(spreadsheetId=SHEET_ID,body={"requests":reqs}).execute()
    print(f"Pushed {len(events)} actionable new/check records to {SHEET_TITLE}")

if __name__=="__main__":
    main()
