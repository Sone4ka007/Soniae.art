#!/usr/bin/env python3
import json, re, sys, urllib.request
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin

ROOT=Path(__file__).resolve().parents[2]
SOURCES=ROOT/"events/sources.json"
DB=ROOT/"content/events.json"
UA="Mozilla/5.0 SonyaeEventsBot/1.0 (+https://sonyae.art/events/)"

def load_json(p, default):
    try: return json.loads(p.read_text("utf-8"))
    except FileNotFoundError: return default

def flatten(x):
    if isinstance(x,list):
        for i in x: yield from flatten(i)
    elif isinstance(x,dict):
        if x.get("@type")=="Event" or (isinstance(x.get("@type"),list) and "Event" in x["@type"]):
            yield x
        if "@graph" in x: yield from flatten(x["@graph"])

def text(v):
    if isinstance(v,str): return re.sub(r"<[^>]+>"," ",v).strip()
    return ""

def iso_date(v):
    m=re.match(r"(\d{4}-\d{2}-\d{2})", str(v or ""))
    return m.group(1) if m else ""

def hhmm(v):
    m=re.search(r"T(\d{2}:\d{2})", str(v or ""))
    return m.group(1) if m else ""

def stable_id(city,date,title):
    slug=re.sub(r"[^a-z0-9]+","-",title.lower().encode("translit","ignore").decode() if False else "")
    # Cyrillic-safe deterministic numeric suffix
    import hashlib
    return f"{city}-{date}-{hashlib.sha1(title.encode('utf-8')).hexdigest()[:10]}"

def fetch(url):
    req=urllib.request.Request(url,headers={"User-Agent":UA})
    with urllib.request.urlopen(req,timeout=25) as r:
        return r.read().decode("utf-8","replace")

def extract_jsonld(html):
    out=[]
    for raw in re.findall(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',html,re.I|re.S):
        try: out.extend(list(flatten(json.loads(raw.strip()))))
        except Exception: pass
    return out

def normalize(ev, src):
    start=ev.get("startDate","")
    date=iso_date(start)
    title=text(ev.get("name"))
    if not date or not title: return None
    loc=ev.get("location") or {}
    if isinstance(loc,list): loc=loc[0] if loc else {}
    address=loc.get("address","") if isinstance(loc,dict) else ""
    if isinstance(address,dict):
        address=", ".join(str(address.get(k,"")).strip() for k in ("streetAddress","addressLocality") if address.get(k))
    offers=ev.get("offers") or {}
    if isinstance(offers,list): offers=offers[0] if offers else {}
    price=None
    try:
        if isinstance(offers,dict) and offers.get("price") not in (None,""):
            price=float(offers["price"])
            if price.is_integer(): price=int(price)
    except Exception: pass
    url=ev.get("url") or src["url"]
    return {
      "id":stable_id(src["city"],date,title),"status":"new","city":src["city"],
      "date":date,"time":hhmm(start),"title":title,
      "venue": text(loc.get("name")) if isinstance(loc,dict) else src.get("venue",""),
      "address": text(address),"price":price,"price_text":"",
      "registration":None,"categories":[],"description":text(ev.get("description")),
      "url":urljoin(src["url"],url),"source":src["name"],
      "checked_at":"","discovered_at":datetime.now(timezone.utc).date().isoformat()
    }

def main():
    cfg=load_json(SOURCES,{"sources":[]}); db=load_json(DB,{"schema_version":1,"events":[]})
    existing={e.get("id"):e for e in db.get("events",[])}
    found=0
    for src in cfg.get("sources",[]):
        try: html=fetch(src["url"])
        except Exception as e:
            print(f"WARN {src['name']}: {e}",file=sys.stderr); continue
        for ev in extract_jsonld(html):
            n=normalize(ev,src)
            if n and n["id"] not in existing:
                existing[n["id"]]=n; found+=1
    db["updated_at"]=datetime.now(timezone.utc).date().isoformat()
    db["events"]=sorted(existing.values(),key=lambda e:(e.get("date",""),e.get("time",""),e.get("title","")))
    DB.write_text(json.dumps(db,ensure_ascii=False,indent=2)+"\n","utf-8")
    print(f"Added {found} new events; total {len(db['events'])}")

if __name__=="__main__": main()
