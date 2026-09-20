#!/usr/bin/env python3
import hashlib, json, re, sys, urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[2]
SOURCES = ROOT / "events/sources.json"
DB = ROOT / "content/events.json"
UA = "Mozilla/5.0 SonyaeEventsBot/1.2 (+https://sonyae.art/events/)"

MONTHS = {
    "января":1,"янв":1,"февраля":2,"фев":2,"марта":3,"мар":3,
    "апреля":4,"апр":4,"мая":5,"май":5,"июня":6,"июн":6,
    "июля":7,"июл":7,"августа":8,"авг":8,"сентября":9,"сен":9,"сент":9,
    "октября":10,"окт":10,"ноября":11,"ноя":11,"декабря":12,"дек":12
}
EVENT_TYPES = [
    "лекция","диалог","мастер-класс","воркшоп","концерт","перформанс","экскурсия",
    "кинопоказ","спецпоказ","фестиваль","конференция","презентация","встреча",
    "публичная программа","медиаторский тур","игра","лаборатория","семинар",
    "творческое занятие","событие","программа","опен-колл","выставка"
]
SKIP_TITLES = {
    "купить билет","купить билеты","зарегистрироваться","регистрация","подать заявку",
    "подробнее","все события","смотреть все","архив","читать далее","показать ещё",
    "показать еще","единый билет","следующий день","предыдущий день"
}

def load_json(path, default):
    try:
        return json.loads(path.read_text("utf-8"))
    except FileNotFoundError:
        return default

def clean(value):
    if value is None:
        return ""
    if not isinstance(value, str):
        value = str(value)
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", value)).strip()

def stable_id(city, dt, title):
    digest = hashlib.sha1(title.encode("utf-8")).hexdigest()[:10]
    return f"{city}-{dt}-{digest}"

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", "replace")

def parse_date(text, require_year=True, default_year=None):
    t = clean(text).lower().replace("ё","е")
    m = re.search(r"(?<!\d)(\d{1,2})[./](\d{1,2})[./](\d{2,4})(?!\d)", t)
    if m:
        y = int(m.group(3))
        if y < 100: y += 2000
        try:
            return date(y, int(m.group(2)), int(m.group(1)))
        except ValueError:
            return None
    month_pat = "|".join(sorted(MONTHS, key=len, reverse=True))
    if require_year:
        m = re.search(rf"(?<!\d)(\d{{1,2}})\s+({month_pat})\.?\s+(20\d{{2}})", t)
        if not m:
            return None
        y = int(m.group(3))
    else:
        m = re.search(rf"(?<!\d)(\d{{1,2}})\s+({month_pat})\.?(?:\s+(20\d{{2}}))?", t)
        if not m:
            return None
        y = int(m.group(3)) if m.group(3) else int(default_year or date.today().year)
    try:
        return date(y, MONTHS[m.group(2)], int(m.group(1)))
    except ValueError:
        return None

def parse_time(text):
    m = re.search(r"(?<!\d)([01]?\d|2[0-3])[:.](\d{2})(?!\d)", clean(text))
    return f"{int(m.group(1)):02d}:{m.group(2)}" if m else ""

def parse_price(text):
    t = clean(text)
    if re.search(r"бесплат|вход\s+свобод", t, re.I):
        return 0, "Бесплатно"
    m = re.search(r"(?<!\d)(\d[\d\s\u00a0]{0,7})\s*₽", t)
    if m:
        try:
            return int(re.sub(r"\D","",m.group(1))), ""
        except Exception:
            pass
    return None, ""

def make_event(src, dt, tm, title, url, description="", venue="", address="", price=None,
               price_text="", registration=None, categories=None, status="new", reason=""):
    return {
        "id": stable_id(src["city"], dt, title),
        "status": status,
        "city": src["city"],
        "date": dt,
        "time": tm,
        "title": clean(title),
        "venue": clean(venue or src.get("venue","")),
        "address": clean(address),
        "price": price,
        "price_text": clean(price_text),
        "registration": registration,
        "categories": categories or [],
        "description": clean(description),
        "url": url,
        "source": src["name"],
        "checked_at": "",
        "review_reason": reason,
        "discovered_at": datetime.now(timezone.utc).date().isoformat()
    }

def flatten_jsonld(x):
    if isinstance(x, list):
        for i in x:
            yield from flatten_jsonld(i)
    elif isinstance(x, dict):
        typ = x.get("@type")
        if typ == "Event" or (isinstance(typ, list) and "Event" in typ):
            yield x
        if "@graph" in x:
            yield from flatten_jsonld(x["@graph"])

def extract_jsonld(html, src):
    out = []
    for raw in re.findall(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', html, re.I|re.S):
        try:
            data = json.loads(raw.strip())
        except Exception:
            continue
        for ev in flatten_jsonld(data):
            dt = str(ev.get("startDate",""))[:10]
            title = clean(ev.get("name"))
            if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", dt) or not title:
                continue
            loc = ev.get("location") or {}
            if isinstance(loc, list):
                loc = loc[0] if loc else {}
            address = loc.get("address","") if isinstance(loc, dict) else ""
            if isinstance(address, dict):
                address = ", ".join(clean(address.get(k,"")) for k in ("streetAddress","addressLocality") if address.get(k))
            offers = ev.get("offers") or {}
            if isinstance(offers, list):
                offers = offers[0] if offers else {}
            price = None
            try:
                if isinstance(offers, dict) and offers.get("price") not in (None,""):
                    price = float(offers["price"])
                    if price.is_integer(): price = int(price)
            except Exception:
                pass
            url = urljoin(src["url"], ev.get("url") or src["url"])
            out.append(make_event(
                src, dt, parse_time(ev.get("startDate","")), title, url,
                clean(ev.get("description")),
                clean(loc.get("name")) if isinstance(loc,dict) else src.get("venue",""),
                clean(address), price
            ))
    return out

def nearest_dated_block(anchor, require_year=True, limit=2400):
    node = anchor
    for _ in range(8):
        node = getattr(node, "parent", None)
        if node is None:
            break
        txt = clean(node.get_text(" ", strip=True))
        if len(txt) > limit:
            break
        dt = parse_date(txt, require_year=require_year)
        if dt:
            return node, txt, dt
    return None, "", None

def event_category(text):
    low = clean(text).lower()
    for typ in EVENT_TYPES:
        if typ in low:
            return typ
    return ""

def normalize_anchor_title(a, block_text=""):
    title = clean(a.get_text(" ", strip=True))
    heading = a.find(["h1","h2","h3","h4","h5"])
    if heading:
        title = clean(heading.get_text(" ", strip=True))
    if not title:
        return ""
    # Whole-card links sometimes contain date/metadata. Trim obvious metadata.
    title = re.sub(r"^\.?\d{1,2}[./]\d{1,2}[./]\d{2,4}[,\s]*\d{0,2}:?\d{0,2}\s*", "", title)
    title = re.sub(r"^\d{1,2}\s+[а-яё]{3,10}\s+20\d{2}\s*", "", title, flags=re.I)
    # Remove a trailing category if the card places it after the title.
    for typ in sorted(EVENT_TYPES, key=len, reverse=True):
        title = re.sub(rf"\s+{re.escape(typ)}\s*$", "", title, flags=re.I)
    return clean(title)

def extract_event_links(html, src):
    soup = BeautifulSoup(html, "html.parser")
    out, seen = [], set()
    today = date.today()
    patterns = src.get("href_contains") or ["/events/"]
    for a in soup.find_all("a", href=True):
        href = a.get("href","")
        full = urljoin(src["url"], href)
        if not any(p in full for p in patterns):
            continue
        title = normalize_anchor_title(a)
        block, txt, dt = nearest_dated_block(a, require_year=True, limit=2800)
        if block is not None and (title.startswith("#") or title.lower() in EVENT_TYPES):
            # Some cards link the category tag to the event URL. Recover the real title
            # from the same card instead of storing "#концерт" / "Экскурсия".
            candidates=[]
            for el in block.find_all(["h2","h3","h4","h5","a","span","p"]):
                t=clean(el.get_text(" ",strip=True))
                if len(t)<8 or t.startswith("#") or t.lower() in SKIP_TITLES or t.lower() in EVENT_TYPES:
                    continue
                if parse_date(t,True) or re.fullmatch(r"\\d{1,2}:\\d{2}(?:\\s*[–-]\\s*\\d{1,2}:\\d{2})?",t):
                    continue
                if t in {src.get("venue",""),"Корпус на Кадашёвской набережной","Инженерный корпус","Новая Третьяковка"}:
                    continue
                candidates.append(t)
            if candidates:
                title=max(candidates,key=len)
        if len(title) < 8 or title.lower() in SKIP_TITLES or title.startswith("#"):
            continue
        if not dt or dt < today:
            continue
        key = (dt.isoformat(), full, title)
        if key in seen:
            continue
        seen.add(key)
        price, price_text = parse_price(txt)
        reg = bool(re.search(r"регистрац|зарегистр", txt, re.I)) or None
        cat = event_category(txt)
        desc = txt.replace(title, "", 1).strip()
        if len(desc) > 650:
            desc = desc[:647].rstrip() + "..."
        out.append(make_event(src, dt.isoformat(), parse_time(txt), title, full, desc,
                              price=price, price_text=price_text, registration=reg,
                              categories=[cat] if cat else []))
    return out

def extract_hse(html, src):
    soup = BeautifulSoup(html, "html.parser")
    out, seen = [], set()
    today = date.today()
    for a in soup.find_all("a", href=True):
        title = clean(a.get_text(" ", strip=True))
        if len(title) < 8 or title.lower() in SKIP_TITLES:
            continue
        block, txt, dt = nearest_dated_block(a, require_year=True)
        if not dt or dt < today:
            continue
        full = urljoin(src["url"], a.get("href",""))
        key=(dt.isoformat(),full,title)
        if key in seen:
            continue
        seen.add(key)
        price, price_text = parse_price(txt)
        reg = bool(re.search(r"регистрац",txt,re.I)) or None
        desc = txt.replace(title,"",1).strip()
        if len(desc)>650: desc=desc[:647].rstrip()+"..."
        out.append(make_event(src,dt.isoformat(),parse_time(txt),title,full,desc,
                              price=price,price_text=price_text,registration=reg))
    return out

def extract_rusimp(html, src):
    soup = BeautifulSoup(html, "html.parser")
    out, seen = [], set()
    today = date.today()
    for h in soup.find_all(["h2","h3","h4"]):
        title = clean(h.get_text(" ",strip=True))
        if len(title)<6:
            continue
        node=h; block=None; txt=""
        for _ in range(6):
            node=getattr(node,"parent",None)
            if node is None: break
            txt=clean(node.get_text(" ",strip=True))
            if len(txt)>2200: break
            if parse_date(txt,require_year=False,default_year=today.year):
                block=node; break
        if block is None:
            continue
        explicit_year=bool(re.search(r"\b20\d{2}\b",txt))
        dt=parse_date(txt,require_year=False,default_year=today.year)
        if not dt or dt<today:
            continue
        links=[urljoin(src["url"],a.get("href")) for a in block.find_all("a",href=True)
               if "/events/" in urljoin(src["url"],a.get("href"))]
        if not links:
            continue
        full=links[0]
        key=(dt.isoformat(),full,title)
        if key in seen:
            continue
        seen.add(key)
        price,price_text=parse_price(txt)
        status="new" if explicit_year else "check"
        reason="" if explicit_year else "year_not_explicit_on_primary_listing"
        out.append(make_event(src,dt.isoformat(),parse_time(txt),title,full,"",
                              price=price,price_text=price_text,
                              registration=bool(re.search(r"регистрац",txt,re.I)) or None,
                              status=status,reason=reason))
    return out

def extract_zotov(html, src):
    soup = BeautifulSoup(html, "html.parser")
    out, seen = [], set()
    today = date.today()
    date_re = re.compile(r"(?<!\d)(\d{1,2})[.](\d{1,2})[.](\d{2})\s*/\s*(\d{1,2}:\d{2})")
    for node in soup.find_all(string=date_re):
        cur = node.parent
        chosen = None
        for _ in range(5):
            if cur is None: break
            txt = clean(cur.get_text(" ",strip=True))
            if len(txt) <= 700 and date_re.search(txt):
                chosen = cur
            cur = cur.parent
        if chosen is None:
            continue
        txt = clean(chosen.get_text(" ",strip=True))
        m = date_re.search(txt)
        if not m:
            continue
        dt = parse_date(m.group(0),True)
        if not dt or dt < today:
            continue
        rest = txt[m.end():].strip()
        rest = re.sub(r"^(?:Купить билет|Зарегистрироваться|Регистрация)\s*", "", rest, flags=re.I)
        cat = ""
        for typ in sorted(EVENT_TYPES,key=len,reverse=True):
            if rest.lower().startswith(typ):
                cat=typ; rest=rest[len(typ):].strip(); break
        title = re.split(r"\s+(?:Купить билет|Зарегистрироваться|Регистрация)\b",rest,maxsplit=1,flags=re.I)[0].strip()
        if len(title)<8 or title.lower() in SKIP_TITLES:
            continue
        key=(dt.isoformat(),title)
        if key in seen: continue
        seen.add(key)
        link=src["url"]
        # Prefer a specific internal event link from the same card when available.
        for a in chosen.find_all("a",href=True):
            href=urljoin(src["url"],a.get("href",""))
            if urlparse(href).netloc.endswith("centrezotov.ru") and href!=src["url"]:
                label=clean(a.get_text(" ",strip=True))
                if title[:18].lower() in label.lower() or label.lower() not in SKIP_TITLES:
                    link=href; break
        price,price_text=parse_price(txt)
        out.append(make_event(src,dt.isoformat(),m.group(4),title,link,"",
                              price=price,price_text=price_text,
                              registration=bool(re.search(r"регистрац",txt,re.I)) or None,
                              categories=[cat] if cat else []))
    return out

def extract_ges2(src, days=14):
    out, seen = [], set()
    today = date.today()
    for offset in range(days):
        dt = today + timedelta(days=offset)
        url = src["url"] + ("&" if "?" in src["url"] else "?") + f"date={dt.isoformat()}"
        try:
            html = fetch(url)
        except Exception as e:
            print(f"WARN {src['name']} {dt}: {e}", file=sys.stderr)
            continue
        soup = BeautifulSoup(html,"html.parser")
        bodytxt = clean(soup.get_text(" ",strip=True))
        # Do not trust a date query if the page did not render the requested day/month/year.
        month_names = [k for k,v in MONTHS.items() if v==dt.month and len(k)>3]
        if str(dt.year) not in bodytxt or not any(re.search(rf"\b{dt.day}\s+{re.escape(m)}\b",bodytxt,re.I) for m in month_names):
            continue
        for a in soup.find_all("a",href=True):
            title = normalize_anchor_title(a)
            if len(title)<8 or title.lower() in SKIP_TITLES:
                continue
            full=urljoin(src["url"],a.get("href",""))
            parsed=urlparse(full)
            if parsed.netloc not in {"ges-2.org","www.ges-2.org"}:
                continue
            if "/calendar" in parsed.path or parsed.path in {"/",""}:
                continue
            li=a.find_parent("li")
            txt=clean(li.get_text(" ",strip=True)) if li else title
            if len(txt)>1200:
                continue
            if not (event_category(txt) or parse_time(txt)):
                continue
            # Remove duplicated event type around titles used by this site.
            for typ in sorted(EVENT_TYPES,key=len,reverse=True):
                title=re.sub(rf"^{re.escape(typ)}\s*", "", title, flags=re.I)
                title=re.sub(rf"\s*{re.escape(typ)}$", "", title, flags=re.I)
            title=clean(title)
            if len(title)<8:
                continue
            key=(dt.isoformat(),full,title)
            if key in seen: continue
            seen.add(key)
            price,price_text=parse_price(txt)
            reg=bool(re.search(r"регистрац",txt,re.I)) or None
            cat=event_category(txt)
            out.append(make_event(src,dt.isoformat(),parse_time(txt),title,full,"",
                                  price=price,price_text=price_text,registration=reg,
                                  categories=[cat] if cat else []))
    return out

def main():
    cfg=load_json(SOURCES,{"sources":[]})
    db=load_json(DB,{"schema_version":1,"events":[]})
    existing={e.get("id"):e for e in db.get("events",[])}
    found=0
    for src in cfg.get("sources",[]):
        adapter=src.get("adapter","")
        candidates=[]
        if adapter=="ges2":
            candidates=extract_ges2(src)
        else:
            try:
                html=fetch(src["url"])
            except Exception as e:
                print(f"WARN {src['name']}: {e}",file=sys.stderr)
                continue
            candidates.extend(extract_jsonld(html,src))
            if adapter=="hse":
                candidates.extend(extract_hse(html,src))
            elif adapter=="rusimp":
                candidates.extend(extract_rusimp(html,src))
            elif adapter=="event_links":
                candidates.extend(extract_event_links(html,src))
            elif adapter=="zotov":
                candidates.extend(extract_zotov(html,src))

        for n in candidates:
            if n["id"] not in existing:
                existing[n["id"]]=n
                found+=1

    db["updated_at"]=datetime.now(timezone.utc).date().isoformat()
    db["events"]=sorted(existing.values(),key=lambda e:(e.get("date",""),e.get("time",""),e.get("title","")))
    DB.write_text(json.dumps(db,ensure_ascii=False,indent=2)+"\n","utf-8")
    print(f"Added {found} new events; total {len(db['events'])}")

if __name__=="__main__":
    main()
