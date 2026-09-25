#!/usr/bin/env python3
import json
from collections import Counter, defaultdict
from datetime import date, timedelta
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
DB=ROOT/"content/events.json"
SOURCES=ROOT/"events/sources.json"

def main():
    today=date.today()
    end=today+timedelta(days=14)
    db=json.loads(DB.read_text("utf-8"))
    cfg=json.loads(SOURCES.read_text("utf-8"))
    events=[
        e for e in db.get("events",[])
        if today.isoformat() <= str(e.get("date","")) <= end.isoformat()
    ]
    counts=Counter(str(e.get("source") or "") for e in events)
    by_city=defaultdict(Counter)
    for e in events:
        by_city[str(e.get("city") or "")][str(e.get("status") or "")]+=1

    print(f"SOURCE COVERAGE {today.isoformat()}..{end.isoformat()}")
    for city,c in sorted(by_city.items()):
        print(city, dict(c))

    print("\nConfigured sources with zero records in the next 14 days:")
    zero=[]
    for src in cfg.get("sources",[]):
        name=src.get("name","")
        # Source names may differ slightly from emitted source labels, so accept
        # exact name or venue match before flagging as zero-yield.
        venue=str(src.get("venue") or "")
        n=sum(v for k,v in counts.items() if k==name or (venue and k==venue))
        if n==0:
            zero.append((src.get("city",""),name,src.get("url","")))
    for city,name,url in zero:
        print(f"- {city}: {name} :: {url}")
    print(f"\nZero-yield configured sources: {len(zero)}/{len(cfg.get('sources',[]))}")

if __name__=="__main__":
    main()
