#!/usr/bin/env python3
"""Sync audit findings to the Data Check tab without changing event data."""
import json, os
from pathlib import Path
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

ROOT=Path(__file__).resolve().parents[2]
REPORT=ROOT/"dist/events-audit/report.json"
SHEET_ID=os.environ["EVENTS_SHEET_ID"]
CREDS=json.loads(os.environ["GOOGLE_SERVICE_ACCOUNT_JSON"])
TAB="Data Check"
HEADERS=["event_id","title","severity","check_type","current_value","suggested_value","detail","source_url","decision","checked_at"]

def service():
    creds=Credentials.from_service_account_info(CREDS,scopes=["https://www.googleapis.com/auth/spreadsheets"])
    return build("sheets","v4",credentials=creds,cache_discovery=False)

def proposal(p):
    kind=p.get("kind","")
    detail=p.get("detail","")
    current=""
    suggested=""
    if kind=="cancelled": suggested="event_status=cancelled"
    elif kind=="postponed": suggested="Проверить новую дату и применить перенос"
    elif kind=="child_or_family": suggested="Снять с публикации"
    elif kind=="missing_on_site": suggested="Восстановить APPROVED-запись на сайте"
    elif kind=="site_repo_mismatch": suggested="Синхронизировать сайт с репозиторием"
    elif kind=="unexpected_on_site": suggested="Проверить лишнюю опубликованную запись"
    elif kind=="time_not_found":
        import re
        m=re.search(r"В базе ([0-2]\d:[0-5]\d)",detail)
        current=m.group(1) if m else ""
        suggested="Сверить время с первоисточником"
    elif kind in ("source_unreachable","source_http"): suggested="Проверить/заменить ссылку"
    elif kind=="non_primary_source": suggested="Заменить на первоисточник"
    return current,suggested

def main():
    if not REPORT.exists(): raise SystemExit("Audit report not found")
    report=json.loads(REPORT.read_text("utf-8"))
    svc=service()
    meta=svc.spreadsheets().get(spreadsheetId=SHEET_ID,fields="sheets(properties(sheetId,title))").execute()
    sheets={s["properties"]["title"]:s["properties"]["sheetId"] for s in meta.get("sheets",[])}
    if TAB not in sheets:
        resp=svc.spreadsheets().batchUpdate(spreadsheetId=SHEET_ID,body={"requests":[{"addSheet":{"properties":{"title":TAB,"gridProperties":{"frozenRowCount":1}}}}]}).execute()
        sheet_id=resp["replies"][0]["addSheet"]["properties"]["sheetId"]
    else: sheet_id=sheets[TAB]

    api=svc.spreadsheets().values()
    old=api.get(spreadsheetId=SHEET_ID,range=f"'{TAB}'!A:J").execute().get("values",[])
    old_headers=old[0] if old else HEADERS
    old_rows=[dict(zip(old_headers,r+[""]*(len(old_headers)-len(r)))) for r in old[1:]]
    # Preserve human decisions by stable finding key.
    decisions={}
    for r in old_rows:
        key=(r.get("event_id",""),r.get("check_type",""),r.get("source_url",""))
        if r.get("decision") in ("approve","reject"):
            decisions[key]=r.get("decision")

    rows=[HEADERS]
    for p in report.get("issues",[]):
        key=(str(p.get("id","")),str(p.get("kind","")),str(p.get("url","")))
        cur,sug=proposal(p)
        rows.append([p.get("id",""),p.get("title",""),p.get("severity",""),p.get("kind",""),cur,sug,p.get("detail",""),p.get("url",""),decisions.get(key,"pending"),report.get("checked_at","")])

    api.clear(spreadsheetId=SHEET_ID,range=f"'{TAB}'!A:J",body={}).execute()
    api.update(spreadsheetId=SHEET_ID,range=f"'{TAB}'!A1",valueInputOption="RAW",body={"values":rows}).execute()
    requests=[
      {"setBasicFilter":{"filter":{"range":{"sheetId":sheet_id,"startRowIndex":0,"startColumnIndex":0,"endColumnIndex":10}}}},
      {"setDataValidation":{"range":{"sheetId":sheet_id,"startRowIndex":1,"startColumnIndex":8,"endColumnIndex":9},
        "rule":{"condition":{"type":"ONE_OF_LIST","values":[{"userEnteredValue":x} for x in ["pending","approve","reject"]]},"strict":True,"showCustomUi":True}}},
      {"updateSheetProperties":{"properties":{"sheetId":sheet_id,"gridProperties":{"frozenRowCount":1}},"fields":"gridProperties.frozenRowCount"}}
    ]
    svc.spreadsheets().batchUpdate(spreadsheetId=SHEET_ID,body={"requests":requests}).execute()
    print(f"Data Check synced: {len(rows)-1} findings; prior decisions preserved")

if __name__=="__main__": main()
