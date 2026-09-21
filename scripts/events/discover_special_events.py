#!/usr/bin/env python3
import hashlib
import json
import re
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[2]
SOURCES = ROOT / "events/discovery_sources.json"
DB = ROOT / "content/events.json"
UA = "Mozilla/5.0 SonyaeEventsBot/1.4 (+https://sonyae.art/events/)"

MONTHS = {
    "января":1,"январь":1,"янв":1,
    "февраля":2,"февраль":2,"фев":2,
    "марта":3,"март":3,"мар":3,
    "апреля":4,"апрель":4,"апр":4,
    "мая":5,"май":5,
    "июня":6,"июнь":6,"июн":6,
    "июля":7,"июль":7,"июл":7,
    "августа":8,"август":8,"авг":8,
    "сентября":9,"сентябрь":9,"сен":9,"сент":9,
    "октября":10,"октябрь":10,"окт":10,
    "ноября":11,"ноябрь":11,"ноя":11,
    "декабря":12,"декабрь":12,"дек":12,
}
CATEGORY_LABELS = {
    "festival":"фестиваль",
    "design":"дизайн",
    "fair":"ярмарка",
    "media_art":"медиаискусство",
    "restoration":"реставрация",
    "architecture":"архитектура",
}

def clean(v):
    return re.sub(r"\s+"," ",str(v or "")).strip()

def fetch(url):
    req=urllib.request.Request(url,headers={"User-Agent":UA})
    with urllib.request.urlopen(req,timeout=30) as r:
        return r.read().decode("utf-8","replace")

def stable_id(src, start):
    token=f"{src['name']}|{src['city']}|{start.isoformat()}".encode("utf-8")
    return "discovery-"+hashlib.sha1(token).hexdigest()[:14]

def mkdate(day, month, year):
    try:
        return date(int(year),int(month),int(day))
    except Exception:
        return None

def candidate_ranges(text, today):
    t=clean(text).lower().replace("ё","е")
    month_pat="|".join(sorted((re.escape(x) for x in MONTHS),key=len,reverse=True))
    out=[]

    # 23–25 сентября 2026 / 23-25 сентября
    for m in re.finditer(rf"(?<!\d)(\d{{1,2}})\s*[-–—]\s*(\d{{1,2}})\s+({month_pat})\.?\s*(20\d{{2}})?",t,re.I):
        y=int(m.group(4) or today.year)
        start=mkdate(m.group(1),MONTHS[m.group(3)],y)
        end=mkdate(m.group(2),MONTHS[m.group(3)],y)
        if start and end and end>=start:
            out.append((start,end,m.start()))

    # 28 сентября — 1 октября 2026
    for m in re.finditer(rf"(?<!\d)(\d{{1,2}})\s+({month_pat})\.?\s*[-–—]\s*(\d{{1,2}})\s+({month_pat})\.?\s*(20\d{{2}})?",t,re.I):
        y=int(m.group(5) or today.year)
        start=mkdate(m.group(1),MONTHS[m.group(2)],y)
        end=mkdate(m.group(3),MONTHS[m.group(4)],y)
        if start and end:
            if end < start and not m.group(5):
                end=mkdate(m.group(3),MONTHS[m.group(4)],y+1)
            if end and end>=start:
                out.append((start,end,m.start()))

    # 23.09.2026–25.09.2026
    for m in re.finditer(r"(?<!\d)(\d{1,2})[./](\d{1,2})[./](20\d{2})\s*[-–—]\s*(\d{1,2})[./](\d{1,2})[./](20\d{2})(?!\d)",t):
        start=mkdate(m.group(1),m.group(2),m.group(3))
        end=mkdate(m.group(4),m.group(5),m.group(6))
        if start and end and end>=start:
            out.append((start,end,m.start()))

    # single explicit dates are a fallback only.
    for m in re.finditer(rf"(?<!\d)(\d{{1,2}})\s+({month_pat})\.?\s+(20\d{{2}})",t,re.I):
        d=mkdate(m.group(1),MONTHS[m.group(2)],m.group(3))
        if d: out.append((d,d,m.start()))
    for m in re.finditer(r"(?<!\d)(\d{1,2})[./](\d{1,2})[./](20\d{2})(?!\d)",t):
        d=mkdate(m.group(1),m.group(2),m.group(3))
        if d: out.append((d,d,m.start()))

    # De-duplicate exact ranges.
    uniq={}
    for start,end,pos in out:
        uniq[(start,end)]=min(pos,uniq.get((start,end),pos))
    return [(a,b,p) for (a,b),p in uniq.items()]

def choose_range(text, src, today):
    candidates=candidate_ranges(text,today)
    if not candidates:
        return None

    # Monitor the near future. Allow an event already in progress to remain discoverable.
    lo=today-timedelta(days=7)
    hi=today+timedelta(days=int(src.get("lookahead_days",180)))
    candidates=[x for x in candidates if x[1]>=lo and x[0]<=hi and (x[1]-x[0]).days<=31]
    if not candidates:
        return None

    low=clean(text).lower()
    hint_positions=[]
    for hint in src.get("title_hints",[]):
        i=low.find(str(hint).lower())
        if i>=0: hint_positions.append(i)

    def score(item):
        start,end,pos=item
        future_penalty=0 if start>=today else 20
        distance_days=abs((start-today).days)
        hint_distance=min((abs(pos-h) for h in hint_positions),default=20000)
        # Dates near the series name win over unrelated dates in nav/footer/archive links.
        return (future_penalty, min(hint_distance,20000), distance_days, -(end-start).days)

    return min(candidates,key=score)[:2]

def existing_match(events, src, start):
    name=clean(src["name"]).lower()
    url=clean(src["url"]).rstrip("/").lower()
    for e in events:
        eu=clean(e.get("url")).rstrip("/").lower()
        title=clean(e.get("title")).lower()
        same_series=(url and eu==url) or (name and name in title)
        if not same_series:
            continue
        try:
            d=date.fromisoformat(e.get("start_date") or e.get("date") or "")
        except Exception:
            continue
        if abs((d-start).days)<=14:
            return e
    return None

def make_event(src,start,end):
    category=CATEGORY_LABELS.get(src.get("category"),src.get("category","фестиваль"))
    cats=["фестиваль"]
    if category and category not in cats:
        cats.append(category)
    return {
        "id":stable_id(src,start),
        "status":"check",
        "kind":"event",
        "city":src["city"],
        "date":start.isoformat(),
        "start_date":start.isoformat(),
        "end_date":end.isoformat() if end!=start else "",
        "time":"",
        "title":src["name"],
        "venue":"",
        "address":"",
        "price":None,
        "price_text":"",
        "price_type":"unknown",
        "registration":None,
        "availability":"unknown",
        "availability_checked_at":"",
        "categories":cats,
        "description":"",
        "url":src["url"],
        "source":src["name"]+" — официальный сайт",
        "checked_at":"",
        "review_reason":"special_event_discovery",
        "editor_note":"Обнаружено мониторингом ежегодных фестивалей/дизайн-событий; требуется редакторская проверка.",
        "discovered_at":datetime.now(timezone.utc).date().isoformat(),
        "reviewed_at":"",
    }

def main():
    cfg=json.loads(SOURCES.read_text("utf-8"))
    db=json.loads(DB.read_text("utf-8"))
    events=db.get("events",[])
    today=date.today()
    added=0
    seen=0
    for src in cfg.get("sources",[]):
        try:
            html=fetch(src["url"])
        except Exception as exc:
            print(f"WARN {src['name']}: {exc}")
            continue
        soup=BeautifulSoup(html,"html.parser")
        text=clean(soup.get_text(" ",strip=True))
        picked=choose_range(text,src,today)
        if not picked:
            print(f"NO DATE {src['name']}")
            continue
        start,end=picked
        seen+=1
        old=existing_match(events,src,start)
        if old:
            print(f"KNOWN {src['name']}: {start}..{end} -> {old.get('id')}")
            continue
        events.append(make_event(src,start,end))
        added+=1
        print(f"NEW {src['name']}: {start}..{end}")

    db["events"]=sorted(events,key=lambda e:(e.get("date",""),e.get("time",""),e.get("title","")))
    db["updated_at"]=datetime.now(timezone.utc).date().isoformat()
    DB.write_text(json.dumps(db,ensure_ascii=False,indent=2)+"\n","utf-8")
    print(f"Special discovery: dated={seen}; added={added}; total={len(events)}")

if __name__=="__main__":
    main()
