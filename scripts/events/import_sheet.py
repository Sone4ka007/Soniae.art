#!/usr/bin/env python3
import csv, io, json, os, urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]; DB=ROOT/"content/events.json"
URL=os.environ.get("EVENTS_SHEET_CSV_URL","").strip()
if not URL: raise SystemExit("EVENTS_SHEET_CSV_URL is not configured")
with urllib.request.urlopen(URL,timeout=30) as r: raw=r.read().decode("utf-8-sig")
rows=list(csv.DictReader(io.StringIO(raw)))
db=json.loads(DB.read_text("utf-8")); byid={e["id"]:e for e in db.get("events",[]) if e.get("id")}
for r in rows:
    if not r.get("id"): continue
    base=byid.get(r["id"],{})
    for k,v in r.items():
        if v is not None and v!="": base[k]=v
    for b in ("registration",):
        if b in base and isinstance(base[b],str): base[b]=base[b].lower() in ("1","true","yes","да")
    if "price" in base:
        try: base["price"]=float(base["price"]); base["price"]=int(base["price"]) if base["price"].is_integer() else base["price"]
        except: pass
    if isinstance(base.get("categories"),str): base["categories"]=[x.strip() for x in base["categories"].split(",") if x.strip()]
    byid[r["id"]]=base
db["events"]=sorted(byid.values(),key=lambda e:(e.get("date",""),e.get("time",""),e.get("title","")))
DB.write_text(json.dumps(db,ensure_ascii=False,indent=2)+"\n","utf-8")
print(f"Imported {len(rows)} sheet rows")
