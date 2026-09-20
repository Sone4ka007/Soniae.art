#!/usr/bin/env python3
import json, os
from pathlib import Path
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

ROOT=Path(__file__).resolve().parents[2]
DB=ROOT/"content/events.json"
SHEET_ID=os.environ["EVENTS_SHEET_ID"]
CREDS=json.loads(os.environ["GOOGLE_SERVICE_ACCOUNT_JSON"])
RANGE="Events!A:V"
HEADERS=["id","status","city","date","time","title","venue","address","price","price_text","price_type","registration","availability","availability_checked_at","categories","description","url","source","checked_at","review_reason","editor_note","days_ahead"]

def service():
    scopes=["https://www.googleapis.com/auth/spreadsheets"]
    creds=Credentials.from_service_account_info(CREDS,scopes=scopes)
    return build("sheets","v4",credentials=creds,cache_discovery=False)

def main():
    db=json.loads(DB.read_text("utf-8"))
    rows=[HEADERS]
    for e in db.get("events",[]):
        rows.append([
            e.get("id",""),e.get("status","new"),e.get("city",""),e.get("date",""),e.get("time",""),
            e.get("title",""),e.get("venue",""),e.get("address",""),e.get("price",""),
            e.get("price_text",""),e.get("price_type","unknown"),
            bool(e.get("registration")) if e.get("registration") is not None else "",
            e.get("availability","unknown"),e.get("availability_checked_at",""),
            ",".join(e.get("categories",[])) if isinstance(e.get("categories"),list) else e.get("categories",""),
            e.get("description",""),e.get("url",""),e.get("source",""),e.get("checked_at",""),
            e.get("review_reason",""),e.get("editor_note",""),
            ( __import__("datetime").date.fromisoformat(e.get("date","")) - __import__("datetime").date.today() ).days if e.get("date") else ""
        ])
    api=service().spreadsheets().values()
    api.clear(spreadsheetId=SHEET_ID,range=RANGE,body={}).execute()
    api.update(spreadsheetId=SHEET_ID,range="Events!A1",valueInputOption="RAW",body={"values":rows}).execute()

    meta=service().spreadsheets().get(spreadsheetId=SHEET_ID,fields="sheets(properties(sheetId,title))").execute()
    sheet_id=next(s["properties"]["sheetId"] for s in meta["sheets"] if s["properties"]["title"]=="Events")
    requests=[
      {"setBasicFilter":{"filter":{"range":{"sheetId":sheet_id,"startRowIndex":0,"startColumnIndex":0,"endColumnIndex":22}}}},
      {"setDataValidation":{"range":{"sheetId":sheet_id,"startRowIndex":1,"startColumnIndex":1,"endColumnIndex":2},
        "rule":{"condition":{"type":"ONE_OF_LIST","values":[{"userEnteredValue":x} for x in ["new","check","approved","rejected"]]},"strict":True,"showCustomUi":True}}},
      {"setDataValidation":{"range":{"sheetId":sheet_id,"startRowIndex":1,"startColumnIndex":2,"endColumnIndex":3},
        "rule":{"condition":{"type":"ONE_OF_LIST","values":[{"userEnteredValue":x} for x in ["moscow","spb"]]},"strict":True,"showCustomUi":True}}},
      {"setDataValidation":{"range":{"sheetId":sheet_id,"startRowIndex":1,"startColumnIndex":10,"endColumnIndex":11},
        "rule":{"condition":{"type":"ONE_OF_LIST","values":[{"userEnteredValue":x} for x in ["free","paid","unknown"]]},"strict":True,"showCustomUi":True}}},
      {"setDataValidation":{"range":{"sheetId":sheet_id,"startRowIndex":1,"startColumnIndex":11,"endColumnIndex":12},
        "rule":{"condition":{"type":"BOOLEAN"},"strict":True,"showCustomUi":True}}},
      {"setDataValidation":{"range":{"sheetId":sheet_id,"startRowIndex":1,"startColumnIndex":12,"endColumnIndex":13},
        "rule":{"condition":{"type":"ONE_OF_LIST","values":[{"userEnteredValue":x} for x in ["available","sold_out","unknown"]]},"strict":True,"showCustomUi":True}}}
    ]
    service().spreadsheets().batchUpdate(spreadsheetId=SHEET_ID,body={"requests":requests}).execute()
    print(f"Pushed {len(rows)-1} events to Google Sheet")

if __name__=="__main__": main()
