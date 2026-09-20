#!/usr/bin/env python3
import json, re, sys, urllib.request, hashlib
from datetime import datetime, timezone, date
from pathlib import Path
from urllib.parse import urljoin
from bs4 import BeautifulSoup

ROOT=Path(__file__).resolve().parents[2]
SOURCES=ROOT/"events/sources.json"
DB=ROOT/"content/events.json"
UA="Mozilla/5.0 SonyaeEventsBot/1.1 (+https://sonyae.art/events/)"

MONTHS={
    "января":1,"февраля":2,"марта":3,"апреля":4,"мая":5,"июня":6,
    "июля":7,"августа":8,"сентября":9,"октября":10,"ноября":11,"декабря":12
}

def load_json(p, default):
    try: return json.loads(p.read_text("utf-8"))
    except FileNotFoundError: return default

def clean(v):
    if v is None: return ""
    if not isinstance(v,str): v=str(v)
    return re.sub(r"\s+"," ",re.sub(r"<[^>]+>"," ",v)).strip()

def stable_id(city, dt, title):
    return f"{city}-{dt}-{hashlib.sha1(title.encode('utf-8')).hexdigest()[:10]}"

def fetch(url):
    req=urllib.request.Request(url,headers={"User-Agent":UA})
    with urllib.request.urlopen(req,timeout=30) as r:
        return r.read().decode("utf-8","replace")

def flatten(x):
    if isinstance(x,list):
        for i in x: yield from flatten(i)
    elif isinstance(x,dict):
        t=x.get("@type")
        if t=="Event" or (isinstance(t,list) and "Event" in t):
            yield x
        if "@graph" in x: yield from flatten(x["@graph"])

def extract_jsonld(html):
    out=[]
    for raw in re.findall(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',html,re.I|re.S):
        try: out.extend(list(flatten(json.loads(raw.strip()))))
        except Exception: pass
    return out

def iso_date(v):
    m=re.match(r"(\d{4}-\d{2}-\d{2})", str(v or ""))
    return m.group(1) if m else ""

def hhmm(v):
    m=re.search(r"T(\d{2}:\d{2})", str(v or ""))
    return m.group(1) if m else ""

def normalize_jsonld(ev, src):
    start=ev.get("startDate","")
    dt=iso_date(start); title=clean(ev.get("name"))
    if not dt or not title: return None
    loc=ev.get("location") or {}
    if isinstance(loc,list): loc=loc[0] if loc else {}
    address=loc.get("address","") if isinstance(loc,dict) else ""
    if isinstance(address,dict):
        address=", ".join(clean(address.get(k,"")) for k in ("streetAddress","addressLocality") if address.get(k))
    offers=ev.get("offers") or {}
    if isinstance(offers,list): offers=offers[0] if offers else {}
    price=None
    try:
        if isinstance(offers,dict) and offers.get("price") not in (None,""):
            price=float(offers["price"]); price=int(price) if price.is_integer() else price
    except Exception: pass
    url=ev.get("url") or src["url"]
    return make_event(src,dt,hhmm(start),title,
        clean(loc.get("name")) if isinstance(loc,dict) else src.get("venue",""),
        clean(address),price,"",None,[],clean(ev.get("description")),
        urljoin(src["url"],url),"new","")

def parse_ru_date(text, require_year=True, default_year=None):
    text=clean(text).lower().replace("ё","е")
    month_pat="|".join(MONTHS.keys())
    if require_year:
        m=re.search(rf"(?<!\d)(\d{{1,2}})\s+({month_pat})\s+(20\d{{2}})",text)
        if not m: return None
        y=int(m.group(3))
    else:
        m=re.search(rf"(?<!\d)(\d{{1,2}})\s+({month_pat})(?:\s+(20\d{{2}}))?",text)
        if not m: return None
        y=int(m.group(3)) if m.group(3) else int(default_year or date.today().year)
    try: return date(y,MONTHS[m.group(2)],int(m.group(1)))
    except ValueError: return None

def parse_time(text):
    m=re.search(r"(?<!\d)([01]?\d|2[0-3])[:.](\d{2})(?!\d)",clean(text))
    return f"{int(m.group(1)):02d}:{m.group(2)}" if m else ""

def make_event(src,dt,tm,title,venue,address,price,price_text,registration,categories,description,url,status,reason):
    return {
      "id":stable_id(src["city"],dt,title),"status":status,"city":src["city"],
      "date":dt,"time":tm,"title":clean(title),"venue":clean(venue or src.get("venue","")),
      "address":clean(address),"price":price,"price_text":clean(price_text),
      "registration":registration,"categories":categories,"description":clean(description),
      "url":url,"source":src["name"],"checked_at":"","review_reason":reason,
      "discovered_at":datetime.now(timezone.utc).date().isoformat()
    }

def nearest_block_with_date(anchor, require_year):
    node=anchor
    best=None
    for _ in range(7):
        node=getattr(node,"parent",None)
        if node is None: break
        txt=clean(node.get_text(" ",strip=True))
        if len(txt)>2500: break
        if parse_ru_date(txt,require_year=require_year):
            best=node
            break
    return best

def extract_hse(html, src):
    soup=BeautifulSoup(html,"html.parser")
    out=[]; seen=set(); today=date.today()
    for a in soup.find_all("a",href=True):
        title=clean(a.get_text(" ",strip=True))
        href=a.get("href","")
        if len(title)<8 or title.lower() in {"подробнее","регистрация","читать далее","все события"}:
            continue
        block=nearest_block_with_date(a,True)
        if block is None: continue
        txt=clean(block.get_text(" ",strip=True))
        dt=parse_ru_date(txt,True)
        if not dt or dt<today: continue
        url=urljoin(src["url"],href)
        key=(dt.isoformat(),url,title)
        if key in seen: continue
        seen.add(key)
        tm=parse_time(txt)
        desc=txt.replace(title,"",1).strip()
        if len(desc)>650: desc=desc[:647].rstrip()+"..."
        registration=bool(re.search(r"регистрац",txt,re.I)) or None
        price_text="Бесплатно" if re.search(r"вход\s+свобод|бесплат",txt,re.I) else ""
        out.append(make_event(src,dt.isoformat(),tm,title,src.get("venue",""),"",0 if price_text else None,
                              price_text,registration,[],desc,url,"new",""))
    return out

def extract_rusimp(html, src):
    soup=BeautifulSoup(html,"html.parser")
    out=[]; seen=set(); today=date.today()
    for h in soup.find_all(["h2","h3","h4"]):
        title=clean(h.get_text(" ",strip=True))
        if len(title)<6: continue
        node=h
        block=None
        for _ in range(6):
            node=getattr(node,"parent",None)
            if node is None: break
            txt=clean(node.get_text(" ",strip=True))
            if len(txt)>2200: break
            if parse_ru_date(txt,False,default_year=today.year):
                block=node; break
        if block is None: continue
        txt=clean(block.get_text(" ",strip=True))
        # Rusimp calendar cards often omit the year. Keep these as CHECK, never auto-approve.
        explicit_year=bool(re.search(r"\b20\d{2}\b",txt))
        dt=parse_ru_date(txt,False,default_year=today.year)
        if not dt or dt<today: continue
        links=[urljoin(src["url"],a.get("href")) for a in block.find_all("a",href=True)
               if "/events/" in urljoin(src["url"],a.get("href"))]
        if not links: continue
        url=links[0]
        key=(dt.isoformat(),url,title)
        if key in seen: continue
        seen.add(key)
        tm=parse_time(txt)
        desc=""
        for p in block.find_all(["p","div"]):
            t=clean(p.get_text(" ",strip=True))
            if 20<len(t)<500 and title not in t and not re.fullmatch(r".*\d{1,2}\s+[а-я]+.*",t.lower()):
                desc=t; break
        status="new" if explicit_year else "check"
        reason="" if explicit_year else "year_not_explicit_on_primary_listing"
        out.append(make_event(src,dt.isoformat(),tm,title,src.get("venue",""),"",None,"",None,[],desc,url,status,reason))
    return out

def main():
    cfg=load_json(SOURCES,{"sources":[]})
    db=load_json(DB,{"schema_version":1,"events":[]})
    existing={e.get("id"):e for e in db.get("events",[])}
    found=0
    for src in cfg.get("sources",[]):
        try: html=fetch(src["url"])
        except Exception as e:
            print(f"WARN {src['name']}: {e}",file=sys.stderr); continue

        candidates=[]
        for ev in extract_jsonld(html):
            n=normalize_jsonld(ev,src)
            if n: candidates.append(n)

        adapter=src.get("adapter","")
        if adapter=="hse":
            candidates.extend(extract_hse(html,src))
        elif adapter=="rusimp":
            candidates.extend(extract_rusimp(html,src))

        for n in candidates:
            if n["id"] not in existing:
                existing[n["id"]]=n; found+=1

    db["updated_at"]=datetime.now(timezone.utc).date().isoformat()
    db["events"]=sorted(existing.values(),key=lambda e:(e.get("date",""),e.get("time",""),e.get("title","")))
    DB.write_text(json.dumps(db,ensure_ascii=False,indent=2)+"\n","utf-8")
    print(f"Added {found} new events; total {len(db['events'])}")

if __name__=="__main__":
    main()
