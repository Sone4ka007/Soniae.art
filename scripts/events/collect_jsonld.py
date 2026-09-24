#!/usr/bin/env python3
import hashlib, json, re, sys, time, urllib.request
import requests
import urllib3
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[2]
SOURCES = ROOT / "events/sources.json"
DB = ROOT / "content/events.json"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
BROWSER_HEADERS = {
    "User-Agent": UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "Upgrade-Insecure-Requests": "1",
}
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

EN_MONTHS = {
    "january":1,"jan":1,"february":2,"feb":2,"march":3,"mar":3,"april":4,"apr":4,
    "may":5,"june":6,"jun":6,"july":7,"jul":7,"august":8,"aug":8,
    "september":9,"sep":9,"sept":9,"october":10,"oct":10,"november":11,"nov":11,
    "december":12,"dec":12
}

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
GES2_NON_EVENT_PATHS = {
    "/concert-hall","/programme","/program","/calendar","/about","/contacts",
    "/visit","/building","/residencies","/shop","/cafe"
}
GES2_NON_EVENT_TITLES = {
    "концертный зал","программа","programme","program"
}

SKIP_TITLES = {
    "купить билет","купить билеты","зарегистрироваться","регистрация","подать заявку",
    "подробнее","все события","смотреть все","архив","читать далее","показать ещё",
    "показать еще","единый билет","следующий день","предыдущий день",
    "more details","see more","learn more","условия участия",
    "будущие выставки","текущие выставки","выставки"
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
    last_error = None
    host = urlparse(url).netloc.lower()
    for attempt in range(3):
        try:
            # requests/certifi is more reliable than urllib on museum sites with
            # non-standard certificate chains; browser-like headers also avoid
            # simple bot blocks such as the Museum of Moscow 403 response.
            r = requests.get(url, headers=BROWSER_HEADERS, timeout=30, allow_redirects=True)
            if r.status_code == 403:
                # Some sites key off fetch metadata as well as User-Agent.
                retry_headers = dict(BROWSER_HEADERS)
                retry_headers.update({
                    "Sec-Fetch-Dest": "document",
                    "Sec-Fetch-Mode": "navigate",
                    "Sec-Fetch-Site": "none",
                    "Sec-Fetch-User": "?1",
                })
                r = requests.get(url, headers=retry_headers, timeout=30, allow_redirects=True)
            if r.status_code >= 400:
                r.raise_for_status()
            r.encoding = r.encoding or "utf-8"
            return r.text
        except requests.exceptions.SSLError as exc:
            last_error = exc
            # Hermitage currently serves a certificate chain that fails in the
            # GitHub runner. For this public, read-only HTML source only, retry
            # without certificate verification rather than dropping the museum.
            if "hermitagemuseum.org" in host:
                try:
                    r = requests.get(url, headers=BROWSER_HEADERS, timeout=30,
                                     allow_redirects=True, verify=False)
                    r.raise_for_status()
                    r.encoding = r.encoding or "utf-8"
                    return r.text
                except Exception as fallback_exc:
                    last_error = fallback_exc
        except Exception as exc:
            last_error = exc
        if attempt < 2:
            time.sleep(1.5 * (attempt + 1))
    raise last_error

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

def parse_deadline(text):
    d=parse_date(text,require_year=True)
    if d:
        return d
    t=clean(text).lower().replace(",", " ")
    month_pat="|".join(sorted(EN_MONTHS,key=len,reverse=True))
    m=re.search(rf"(?<!\\d)(\\d{{1,2}})\\s+({month_pat})\\.?\\s+(20\\d{{2}})",t,re.I)
    if not m:
        m=re.search(rf"({month_pat})\\.?\\s+(\\d{{1,2}})\\s+(20\\d{{2}})",t,re.I)
        if m:
            try: return date(int(m.group(3)),EN_MONTHS[m.group(1).lower()],int(m.group(2)))
            except ValueError: return None
        return None
    try: return date(int(m.group(3)),EN_MONTHS[m.group(2).lower()],int(m.group(1)))
    except ValueError: return None

def parse_exhibition_range(text):
    t=clean(text).lower().replace("ё","е")
    # 24.04-04.11.2026 / 24.04 — 04.11.2026
    m=re.search(r"(?<!\d)(\d{1,2})[./](\d{1,2})\s*[-–—]\s*(\d{1,2})[./](\d{1,2})[./](20\d{2})(?!\d)",t)
    if m:
        try:
            y=int(m.group(5))
            return date(y,int(m.group(2)),int(m.group(1))), date(y,int(m.group(4)),int(m.group(3)))
        except ValueError:
            pass
    # 09.09.2026-25.10.2026
    m=re.search(r"(?<!\d)(\d{1,2})[./](\d{1,2})[./](20\d{2})\s*[-–—]\s*(\d{1,2})[./](\d{1,2})[./](20\d{2})(?!\d)",t)
    if m:
        try:
            return date(int(m.group(3)),int(m.group(2)),int(m.group(1))), date(int(m.group(6)),int(m.group(5)),int(m.group(4)))
        except ValueError:
            pass
    return None,None

def parse_time(text):
    m = re.search(r"(?<!\d)([01]?\d|2[0-3]):(\d{2})(?!\d)", clean(text))
    return f"{int(m.group(1)):02d}:{m.group(2)}" if m else ""

def parse_ru_date_range(text, default_year=None):
    t=clean(text).lower().replace("ё","е")
    month_pat="|".join(sorted(MONTHS,key=len,reverse=True))
    # 10 октября — 11 октября 2026 / 01 сентября — 11 октября 2026
    m=re.search(rf"(?<!\d)(\d{{1,2}})\s+({month_pat})\s*[-–—]\s*(\d{{1,2}})\s+({month_pat})\.?\s*(20\d{{2}})?",t,re.I)
    if m:
        end_year=int(m.group(5) or default_year or date.today().year)
        sm=MONTHS[m.group(2)]; em=MONTHS[m.group(4)]
        start_year=end_year-1 if sm>em else end_year
        try:
            return date(start_year,sm,int(m.group(1))),date(end_year,em,int(m.group(3)))
        except ValueError:
            pass
    # 10–11 октября 2026
    m=re.search(rf"(?<!\d)(\d{{1,2}})\s*[-–—]\s*(\d{{1,2}})\s+({month_pat})\.?\s*(20\d{{2}})?",t,re.I)
    if m:
        y=int(m.group(4) or default_year or date.today().year)
        try:
            return date(y,MONTHS[m.group(3)],int(m.group(1))),date(y,MONTHS[m.group(3)],int(m.group(2)))
        except ValueError:
            pass
    return None,None

def event_context(text,title,limit=1800):
    t=clean(text)
    needle=clean(title)
    if needle:
        i=t.lower().find(needle.lower())
        if i>=0:
            return t[i:i+limit]
    return t[:limit]

def parse_price(text):
    t = clean(text)
    # Explicit money always wins over generic "Бесплатные" navigation/filter
    # text that may also be present on the same page.
    m = re.search(r"(?<!\d)(\d[\d\s\u00a0]{0,7})\s*₽", t)
    if m:
        try:
            value=int(re.sub(r"\D","",m.group(1)))
            return value, f"{value} ₽"
        except Exception:
            pass
    if re.search(r"бесплат|вход\s+свобод", t, re.I):
        return 0, "Бесплатно"
    return None, ""

def make_event(src, dt, tm, title, url, description="", venue="", address="", price=None,
               price_text="", registration=None, categories=None, status="new", reason=""):
    return {
        "id": stable_id(src["city"], dt, title),
        "status": status,
        "kind": src.get("kind","event"),
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

def extract_split_program_events(dsoup, src, full, page_text, page_year):
    marker=None
    heading=clean(src.get("program_heading") or "ПРОГРАММА МЕРОПРИЯТИЙ").lower()
    for h in dsoup.find_all(["h2","h3"]):
        if heading in clean(h.get_text(" ",strip=True)).lower():
            marker=h
            break
    if not marker:
        return []

    out=[]
    for h in marker.find_all_next(["h2","h3"]):
        title=clean(h.get_text(" ",strip=True))
        low=title.lower()
        if low in {"программа мероприятий","связанные события"}:
            if low=="связанные события":
                break
            continue
        if len(title)<8:
            continue

        prev=[]
        node=h
        for _ in range(18):
            node=node.previous_element
            if node is None or node is marker:
                break
            if isinstance(node,str):
                t=clean(node)
                if t:
                    prev.append(t)
                    probe=clean(" ".join(reversed(prev)))
                    dt=parse_date(probe,require_year=False,default_year=page_year)
                    if dt:
                        tm=parse_time(probe)
                        break
        else:
            dt=None; tm=None
        if not dt:
            probe=clean(" ".join(reversed(prev)))
            dt=parse_date(probe,require_year=False,default_year=page_year)
            tm=parse_time(probe)
        if not dt or dt < date.today():
            continue

        parts=[]
        for sib in h.find_all_next():
            if sib is h:
                continue
            if getattr(sib,"name",None) in ("h2","h3"):
                break
            if getattr(sib,"name",None)=="p":
                t=clean(sib.get_text(" ",strip=True))
                if len(t)>=35:
                    parts.append(t)
                    if len(parts)>=2:
                        break
        desc=clean(" ".join(parts))
        price,price_text=parse_price(page_text)
        reg=bool(re.search(r"регистрац|зарегистр|купить билет",page_text,re.I)) or None
        cat=event_category(title+" "+desc)
        ev=make_event(src,dt.isoformat(),tm,title,full,desc,
                      price=price,price_text=price_text,registration=reg,
                      categories=[cat] if cat else [])
        out.append(ev)
    return out

def extract_event_links(html, src):
    soup=BeautifulSoup(html,"html.parser")
    out=[]; seen_urls=set(); today=date.today()
    patterns=src.get("href_contains") or ["/events/"]
    exclude_paths=set(src.get("exclude_paths") or [])
    urls=[]
    for a in soup.find_all("a",href=True):
        full=urljoin(src["url"],a.get("href",""))
        parsed=urlparse(full)
        if parsed.path in exclude_paths:
            continue
        if any(p in full for p in patterns) and full not in seen_urls:
            seen_urls.add(full); urls.append(full)

    max_pages=int(src.get("max_detail_pages",60))
    urls=urls[:max_pages]

    def parse_detail(full):
        try:
            detail=fetch(full)
        except Exception:
            return None
        dsoup=BeautifulSoup(detail,"html.parser")
        dtext=clean(dsoup.get_text(" ",strip=True))
        if src.get("split_programs"):
            page_date=parse_date(dtext,require_year=True)
            split=extract_split_program_events(dsoup,src,full,dtext,(page_date or today).year)
            if split:
                return split
        start_dt=end_dt=None
        path_low=urlparse(full).path.lower()
        host=urlparse(full).netloc.lower()
        is_az=("museum-az.com" in host)
        is_winzavod=("winzavod.ru" in host)
        is_exhibition=(src.get("kind")=="exhibition" or "/exhibitions/" in path_low or "/exhibition/" in path_low)

        title=""
        # AZ pages contain a persistent exhibition heading before the actual
        # event. Their OpenGraph title is the event title and is more reliable.
        if is_az:
            meta=dsoup.find("meta",attrs={"property":"og:title"}) or dsoup.find("meta",attrs={"name":"twitter:title"})
            candidate=clean(meta.get("content","")) if meta else ""
            candidate=re.sub(r"\s*[|—-]\s*Музей\s*AZ.*$","",candidate,flags=re.I)
            if candidate and candidate.lower() not in SKIP_TITLES:
                title=candidate
        if not title:
            for h in dsoup.find_all(["h1","h2","h3"]):
                t=clean(h.get_text(" ",strip=True))
                if len(t)>=8 and not t.startswith("#") and t.lower() not in SKIP_TITLES and t.lower() not in EVENT_TYPES:
                    title=t; break
        if not title:
            meta=dsoup.find("meta",attrs={"property":"og:title"}) or dsoup.find("meta",attrs={"name":"twitter:title"})
            candidate=clean(meta.get("content","")) if meta else ""
            if candidate and candidate.lower() not in SKIP_TITLES:
                title=candidate
        if not title and dsoup.title:
            candidate=clean(dsoup.title.get_text(" ",strip=True))
            candidate=re.sub(r"\s*[|—-]\s*Музей.*$","",candidate,flags=re.I)
            if candidate and candidate.lower() not in SKIP_TITLES:
                title=candidate
        if not title:
            return None

        context=event_context(dtext,title,2200)
        if is_winzavod:
            start_dt,end_dt=parse_ru_date_range(context,today.year)
            if not start_dt:
                start_dt,end_dt=parse_exhibition_range(context)
            dt=start_dt or parse_date(context,require_year=False,default_year=today.year)
        elif is_az:
            start_dt,end_dt=parse_ru_date_range(context,today.year)
            dt=start_dt or parse_date(context,require_year=False,default_year=today.year)
        elif is_exhibition:
            start_dt,end_dt=parse_exhibition_range(dtext)
            dt=start_dt or parse_date(dtext,require_year=True)
        else:
            dt=parse_date(dtext,require_year=True)

        if not dt:
            return None
        if end_dt:
            if end_dt<today:
                return None
        elif not is_exhibition and dt<today:
            return None
        elif is_exhibition and dt<today-timedelta(days=365):
            return None

        tm=parse_time(context[:700])
        price,price_text=parse_price(context[:1200] if (is_az or is_winzavod) else dtext)
        reg=bool(re.search(r"регистрац|зарегистр|купить билет",context[:1400] if (is_az or is_winzavod) else dtext,re.I)) or None
        cat=event_category(context[:1800])
        desc=""
        # Russian Museum exhibition pages have a reliable "О выставке" section.
        # Prefer it over generic paragraph scraping, which otherwise reaches the legal footer.
        if "rusmuseum.ru" in urlparse(full).netloc.lower() and is_exhibition:
            about=None
            for h in dsoup.find_all(["h2","h3"]):
                if clean(h.get_text(" ",strip=True)).lower()=="о выставке":
                    about=h
                    break
            if about:
                parts=[]
                for node in about.find_all_next():
                    if node is about:
                        continue
                    if getattr(node,"name",None) in ("h2","h3"):
                        break
                    if getattr(node,"name",None)=="p":
                        t=clean(node.get_text(" ",strip=True))
                        if len(t)>=40 and t.lower()!="читать далее":
                            parts.append(t)
                            if len(parts)>=2 or len(" ".join(parts))>=420:
                                break
                if parts:
                    desc=clean(" ".join(parts))
        hard_boilerplate=(
            "сегодня выставки и галереи закрыты",
            "сегодня выставки, галереи, магазины и кафе работают",
            "магазины и кафе работают в обычном режиме",
            "режим работы"
        )

        if is_winzavod:
            # The site repeats global opening-hours/navigation text before the
            # actual exhibition copy. Anchor on a heading equal to the title
            # and take the first substantive paragraphs after it.
            anchor=None
            for h in dsoup.find_all(["h1","h2","h3","h4"]):
                if clean(h.get_text(" ",strip=True)).lower()==title.lower():
                    anchor=h
                    break
            if anchor:
                win_parts=[]
                for node in anchor.find_all_next():
                    if getattr(node,"name",None) in ("h1","h2") and node is not anchor:
                        label=clean(node.get_text(" ",strip=True)).lower()
                        if label in ("похожие события","информационные партнеры галереи"):
                            break
                    if getattr(node,"name",None)=="p":
                        t=clean(node.get_text(" ",strip=True))
                        low=t.lower()
                        if len(t)<45:
                            continue
                        if any(x in low for x in hard_boilerplate):
                            continue
                        if "бесплатно"==low or "купить билет" in low:
                            continue
                        win_parts.append(t)
                        if len(" ".join(win_parts))>=420 or len(win_parts)>=2:
                            break
                if win_parts:
                    desc=clean(" ".join(win_parts))
        start_node=dsoup.find("h1") or dsoup.find("h2") or dsoup
        parts=[]
        if not desc:
            paragraph_nodes=start_node.find_all_next("p")
        else:
            paragraph_nodes=[]
        for p in paragraph_nodes:
            t=clean(p.get_text(" ",strip=True))
            t=re.sub(r"(?:Доступно по Пушкинской карте\s*Узнать больше\s*)+","",t,flags=re.I)
            t=re.sub(r"\bУзнать больше\b","",t,flags=re.I)
            t=clean(t)
            low=t.lower()
            if len(t)<55:
                continue
            if any(x in low for x in hard_boilerplate):
                continue
            if title.lower() in low and len(t)<len(title)+80:
                continue
            parts.append(t)
            if len(" ".join(parts))>=650 or len(parts)>=3:
                break
        if parts:
            desc=clean(" ".join(parts))
            desc=re.sub(r"(?:Доступно по Пушкинской карте\s*Узнать больше\s*)+","",desc,flags=re.I)
            # Keep exhibition copy concise: up to 3 complete sentences / about 360 chars.
            sentences=re.split(r"(?<=[.!?])\s+",desc)
            picked=[]
            total=0
            for sent in sentences:
                sent=clean(sent)
                if len(sent)<25:
                    continue
                if total+len(sent)>380 and picked:
                    break
                picked.append(sent)
                total+=len(sent)+1
                if len(picked)>=3:
                    break
            if picked:
                desc=" ".join(picked)
            elif len(desc)>380:
                desc=desc[:377].rsplit(" ",1)[0]+"..."
        ev=make_event(src,dt.isoformat(),tm,title,full,desc,
                      price=price,price_text=price_text,registration=reg,
                      categories=[cat] if cat else [])
        if start_dt:
            ev["start_date"]=start_dt.isoformat()
        if end_dt:
            ev["end_date"]=end_dt.isoformat()
        if is_exhibition:
            ev["kind"]="exhibition"
            ev["categories"]=[c for c in ev.get("categories",[]) if c not in ("лекция","концерт","встреча","событие","программа")]
            if "выставка" not in ev["categories"]:
                ev["categories"].append("выставка")
            if start_dt: ev["start_date"]=start_dt.isoformat()
            if end_dt: ev["end_date"]=end_dt.isoformat()
        return ev

    workers=max(1,min(int(src.get("detail_workers",8)),12))
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures={pool.submit(parse_detail,full):full for full in urls}
        for future in as_completed(futures):
            try:
                ev=future.result()
            except Exception as e:
                print(f"WARN {src['name']} detail {futures[future]}: {e}",file=sys.stderr)
                continue
            if ev:
                if isinstance(ev,list):
                    out.extend(ev)
                else:
                    out.append(ev)
    return out

def extract_single_event_page(html, src):
    soup=BeautifulSoup(html,"html.parser")
    text=clean(soup.get_text(" ",strip=True))
    today=date.today()
    dt=parse_date(text,require_year=False,default_year=today.year)
    if not dt:
        return []
    if dt < today - timedelta(days=60):
        try:
            dt=date(dt.year+1,dt.month,dt.day)
        except ValueError:
            return []
    if dt < today:
        return []

    title=""
    h=soup.find("h1") or soup.find("h2")
    if h:
        title=clean(h.get_text(" ",strip=True))
    if not title:
        meta=soup.find("meta",attrs={"property":"og:title"}) or soup.find("meta",attrs={"name":"twitter:title"})
        if meta:
            title=clean(meta.get("content",""))
    if not title:
        return []

    tm=parse_time(text[:2200])
    price,price_text=parse_price(text[:2600])
    reg=bool(re.search(r"регистрац|зарегистр",text,re.I)) or None
    venue=src.get("venue","")
    address=""
    am=re.search(r"(?:адрес|место)\s*[:—–-]?\s*([^.!?]{6,180})",text,re.I)
    if am:
        address=clean(am.group(1))
    cat=event_category(title+" "+text[:1200])
    desc=""
    for p in soup.find_all("p"):
        t=clean(p.get_text(" ",strip=True))
        if len(t)>=70 and title.lower() not in t.lower():
            desc=t
            break
    ev=make_event(
        src,dt.isoformat(),tm,title,src["url"],desc,
        venue=venue,address=address,price=price,price_text=price_text,
        registration=reg,categories=[cat] if cat else [],
        status="check",reason="standalone_primary_event_page"
    )
    return [ev]

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

def extract_telegram_digest(html, src):
    soup=BeautifulSoup(html,"html.parser")
    out=[]; seen=set(); today=date.today()
    for msg in soup.select(".tgme_widget_message"):
        text_node=msg.select_one(".tgme_widget_message_text")
        if not text_node:
            continue
        raw=text_node.get_text("\n",strip=True)
        if "Дайджест событий" not in raw:
            continue
        post=msg.get("data-post","")
        post_url=f"https://t.me/{post}" if post else src["url"]
        current_date=None
        for line in [clean(x) for x in raw.split("\n") if clean(x)]:
            dm=re.match(r"^[➖\-–—]?\s*(\d{1,2})\s+([а-яё]+)",line,re.I)
            if dm:
                month=MONTHS.get(dm.group(2).lower().replace("ё","е"))
                if month:
                    year=today.year
                    try:
                        current_date=date(year,month,int(dm.group(1)))
                        if current_date < today - timedelta(days=60):
                            current_date=date(year+1,month,int(dm.group(1)))
                    except ValueError:
                        current_date=None
                continue
            if not current_date or current_date < today:
                continue
            em=re.match(r"^(\d{1,2}:\d{2})(?:\s*[–—-]\s*\d{1,2}:\d{2})?\s+(.+)$",line)
            if not em:
                continue
            tm=em.group(1)
            body=clean(em.group(2))
            venue=src.get("venue","")
            vm=re.search(r"\(([^()]{3,80})\)\s*$",body)
            if vm:
                venue=clean(vm.group(1))
                body=clean(body[:vm.start()])
            title=body
            if len(title)<6:
                continue
            key=(current_date.isoformat(),tm,title.lower(),venue.lower())
            if key in seen:
                continue
            seen.add(key)
            cat=event_category(title)
            ev=make_event(
                src,current_date.isoformat(),tm,title,post_url,"",
                venue=venue,categories=[cat] if cat else [],
                status="check",reason="official_telegram_fallback_needs_primary_event_link"
            )
            out.append(ev)
    return out

def extract_telegram_channel_events(html, src):
    soup=BeautifulSoup(html,"html.parser")
    out=[]; seen=set(); today=date.today()
    for msg in soup.select(".tgme_widget_message"):
        text_node=msg.select_one(".tgme_widget_message_text")
        if not text_node:
            continue
        raw=text_node.get_text("\n",strip=True)
        low=raw.lower()
        if re.search(r"open\s*call|опен[- ]?колл|при[её]м заявок|дедлайн|deadline",low,re.I):
            continue

        dt=parse_date(raw,require_year=False,default_year=today.year)
        if not dt:
            continue
        if dt < today - timedelta(days=60):
            try:
                dt=date(dt.year+1,dt.month,dt.day)
            except ValueError:
                continue
        if dt < today:
            continue

        post=msg.get("data-post","")
        post_url=f"https://t.me/{post}" if post else src["url"]
        link_candidates=[]
        for a in text_node.find_all("a",href=True):
            full=urljoin(src["url"],a.get("href",""))
            host=urlparse(full).netloc.lower()
            if not host or host in {"t.me","telegram.me"}:
                continue
            label=clean(a.get_text(" ",strip=True))
            path=urlparse(full).path or "/"
            score=0
            low_label=label.lower()
            if "официаль" in low_label and "анонс" in low_label:
                score+=100
            if "регистрац" in low_label:
                score+=90
            if any(x in low_label for x in ("подробнее","событие","лекция","выставка","встреча","паблик-ток")):
                score+=50
            if path not in ("","/"):
                score+=30
            if len(path.strip("/").split("/"))>=2:
                score+=20
            link_candidates.append((score,full,label))
        link_candidates.sort(key=lambda x:(-x[0],x[1]))
        event_url=link_candidates[0][1] if link_candidates else post_url

        lines=[clean(x).replace("�","") for x in raw.split("\n") if clean(x)]
        title=""
        editorial_prefixes=(
            "почему интересно","нетворкинг","почему стоит","зачем идти",
            "можно пойти","мой комментарий","комментарий"
        )

        # Sonya Go posts often contain the real event title as a quoted linked
        # phrase followed by "официальный анонс". Prefer that over editorial notes.
        for line in lines:
            m=re.search(r"[«\"]([^»\"]{6,220})[»\"]\s*[—–-]?\s*(?:официальн(?:ый|ая)\s+анонс|анонс|регистрац)",line,re.I)
            if m:
                title=clean(m.group(1))
                break

        if not title:
            for line in lines[:16]:
                l=line.lower()
                if any(l.startswith(p) for p in editorial_prefixes):
                    continue
                if re.fullmatch(r"\d{1,2}:\d{2}",line):
                    continue
                if parse_date(line,require_year=False,default_year=today.year):
                    continue
                if line.startswith(("http://","https://","#","📍","🕒","⏰","📅")):
                    continue
                if re.match(r"^(место|где|когда|дата|время)\s*[:—–-]",l):
                    continue
                if len(line)>=6 and any(t in l for t in EVENT_TYPES):
                    title=line
                    break
        if not title:
            for line in lines[:16]:
                l=line.lower()
                if any(l.startswith(p) for p in editorial_prefixes):
                    continue
                if re.fullmatch(r"\d{1,2}:\d{2}",line):
                    continue
                if parse_date(line,require_year=False,default_year=today.year):
                    continue
                if line.startswith(("http://","https://","#","📍","🕒","⏰","📅")):
                    continue
                if re.match(r"^(место|где|когда|дата|время)\s*[:—–-]",l):
                    continue
                if len(line)>=6:
                    title=line
                    break
        if not title:
            continue

        venue=""
        for line in lines:
            vm=re.match(r"^(?:📍\s*)?(?:место|где)\s*[:—–-]\s*(.+)$",line,re.I)
            if vm:
                venue=clean(vm.group(1)); break
            if line.startswith("📍"):
                venue=clean(line.lstrip("📍 ").strip()); break

        desc_parts=[]
        for line in lines:
            l=line.lower()
            if line==title:
                continue
            if any(l.startswith(p) for p in editorial_prefixes):
                continue
            if "официальный анонс" in l or "можно пойти" in l:
                continue
            if line.startswith(("http://","https://")):
                continue
            if len(line)>=25 and not parse_date(line,require_year=False,default_year=today.year):
                desc_parts.append(line)
            if len(" ".join(desc_parts))>=500:
                break
        desc=clean(" ".join(desc_parts)).replace("�","")[:600]

        price,price_text=parse_price(raw)
        reg=bool(re.search(r"регистрац|зарегистр",raw,re.I)) or None
        cat=event_category(title+" "+raw[:600])
        tm=parse_time(raw)
        key=(dt.isoformat(),tm,title.lower(),event_url)
        if key in seen:
            continue
        seen.add(key)

        ev=make_event(
            src,dt.isoformat(),tm,title,event_url,desc,
            venue=venue,price=price,price_text=price_text,registration=reg,
            categories=[cat] if cat else [],
            status="check",reason="curated_telegram_source"
        )
        ev["kind"]="event"
        out.append(ev)
    return out

def extract_rnb(html, src):
    soup=BeautifulSoup(html,"html.parser")
    lines=[clean(x) for x in soup.get_text("\n",strip=True).split("\n")]
    lines=[x for x in lines if x]
    out=[]; today=date.today(); i=0
    month_pat="|".join(sorted(MONTHS,key=len,reverse=True))
    date_re=re.compile(rf"^(\d{{1,2}})\s+({month_pat})\s+(20\d{{2}})$",re.I)
    while i < len(lines):
        m=date_re.match(lines[i].lower().replace("ё","е"))
        if not m:
            i+=1; continue
        try:
            dt=date(int(m.group(3)),MONTHS[m.group(2)],int(m.group(1)))
        except Exception:
            i+=1; continue
        j=i+1
        block=[]
        while j < len(lines) and not date_re.match(lines[j].lower().replace("ё","е")):
            block.append(lines[j]); j+=1
        i=j
        if dt < today:
            continue
        tm=""
        for x in block[:8]:
            if re.fullmatch(r"\d{1,2}:\d{2}",x):
                tm=x.zfill(5); break
        meaningful=[x for x in block if not re.fullmatch(r"\d{1,2}:\d{2}",x)
                    and not re.fullmatch(r"\d{1,2}\+",x)
                    and x.lower() not in {"понедельник","вторник","среда","четверг","пятница","суббота","воскресенье","image"}]
        title=""
        for x in meaningful[:12]:
            lowx=x.lower()
            if any(k in lowx for k in ("лекция","концерт","встреча","семинар","тренинг","квиз","мастер","х/ф","спектакль","выставк","лекторий")):
                title=x; break
        if not title and meaningful:
            title=meaningful[0]
        if not title or title.lower()=="афиша мероприятий рнб":
            continue
        raw=" ".join(block)
        price,price_text=parse_price(raw)
        reg=bool(re.search(r"регистрац",raw,re.I)) or None
        cat=event_category(title+" "+raw[:500])
        desc=""
        for x in meaningful:
            if x==title: continue
            if len(x)>=35 and not x.lower().startswith(("теги:","справки","вход ")):
                desc=x; break
        out.append(make_event(src,dt.isoformat(),tm,title,src["url"],desc,
                              price=price,price_text=price_text,registration=reg,
                              categories=[cat] if cat else []))
    return out

def extract_zotov(html, src):
    soup=BeautifulSoup(html,"html.parser")
    out=[]; seen=set(); today=date.today()
    category_names=sorted(EVENT_TYPES + ["инклюзивное событие","детям","новинки проката","снова в кино","кино крохам"], key=len, reverse=True)

    def add_one(dt, tm, cat, title, full, raw, end_dt=None):
        if not dt or len(title)<4:
            return
        is_exhibition=(cat=="выставка" or "/exhib" in urlparse(full).path.lower())
        if is_exhibition:
            if end_dt and end_dt < today:
                return
        elif dt < today:
            return
        key=(dt.isoformat(),full,title,tm)
        if key in seen:
            return
        seen.add(key)
        price,price_text=parse_price(raw)
        reg=bool(re.search(r"зарегистр",raw,re.I)) or None
        ev=make_event(src,dt.isoformat(),tm,title,full,"",
                      price=price,price_text=price_text,registration=reg,
                      categories=[cat] if cat else [])
        if is_exhibition:
            ev["kind"]="exhibition"
            ev["start_date"]=dt.isoformat()
            if end_dt:
                ev["end_date"]=end_dt.isoformat()
        out.append(ev)

    for a in soup.find_all("a",href=True):
        raw=clean(a.get_text(" ",strip=True))
        if not raw or len(raw)<8:
            continue
        full=urljoin(src["url"],a.get("href",""))
        if urlparse(full).netloc and not urlparse(full).netloc.endswith("centrezotov.ru"):
            # Ticket links are not event cards.
            continue

        # Standard cards: 24.09.26 / 19:30 Лекция Название
        m=re.match(r"^(\d{1,2}\.\d{1,2}\.\d{2,4})\s*/\s*(\d{1,2}:\d{2})\s+(.+)$",raw)
        if m:
            dt=parse_date(m.group(1),True)
            rest=m.group(3).strip()
            cat=""
            for name in category_names:
                if rest.lower().startswith(name):
                    cat=name
                    rest=rest[len(name):].strip()
                    break
            add_one(dt,m.group(2),cat,rest,full,raw)
            continue

        # Start-date cards: "с 24.09.26 Новинки проката ..."
        m=re.match(r"^с\s+(\d{1,2}\.\d{1,2}\.\d{2,4})\s+(.+)$",raw,re.I)
        if m:
            dt=parse_date(m.group(1),True)
            rest=m.group(2).strip()
            cat=""
            for name in category_names:
                if rest.lower().startswith(name):
                    cat=name
                    rest=rest[len(name):].strip()
                    break
            add_one(dt,"",cat,rest,full,raw)
            continue

        # Date-range cards: exhibitions/excursions.
        m=re.match(r"^(\d{1,2}\.\d{1,2}\.\d{2,4})\s*[-–—]\s*(\d{1,2}\.\d{1,2}\.\d{2,4})\s+(.+)$",raw)
        if m:
            start_dt=parse_date(m.group(1),True)
            end_dt=parse_date(m.group(2),True)
            if end_dt and end_dt >= today:
                rest=m.group(3).strip()
                cat=""
                for name in category_names:
                    if rest.lower().startswith(name):
                        cat=name
                        rest=rest[len(name):].strip()
                        break
                # Keep the real exhibition/program start date stable. Using
                # "today" here generated a fresh ID every day for long-running
                # exhibitions such as Zotov's "Хлеб".
                event_dt=start_dt or today
                add_one(event_dt,"",cat,rest,full,raw,end_dt=end_dt)
            continue

        # Recurring cards such as 05.09, 12.09, 19.09, 26.09 / 15:00 ...
        m=re.match(r"^((?:\d{1,2}\.\d{1,2}(?:\s*,\s*)?)+)\s*/\s*(\d{1,2}:\d{2})\s+(.+)$",raw)
        if m:
            rest=m.group(3).strip()
            cat=""
            for name in category_names:
                if rest.lower().startswith(name):
                    cat=name
                    rest=rest[len(name):].strip()
                    break
            for dm in re.findall(r"(\d{1,2})\.(\d{1,2})",m.group(1)):
                try:
                    dt=date(today.year,int(dm[1]),int(dm[0]))
                except ValueError:
                    continue
                add_one(dt,m.group(2),cat,rest,full,raw)

    return out


def extract_mamm(html, src):
    soup=BeautifulSoup(html,"html.parser")
    out=[]; seen=set(); today=date.today()
    for a in soup.find_all("a",href=True):
        href=a.get("href","")
        if "/events/detail/" not in href:
            continue
        title=clean(a.get_text(" ",strip=True))
        if len(title)<8 or title.lower() in SKIP_TITLES:
            continue
        full=urljoin(src["url"],href)
        if full in seen:
            continue
        seen.add(full)
        try:
            detail=fetch(full)
        except Exception:
            continue
        dsoup=BeautifulSoup(detail,"html.parser")
        dtext=clean(dsoup.get_text(" ",strip=True))
        dt=parse_date(dtext,require_year=True)
        if not dt or dt<today:
            continue
        h=dsoup.find(["h1","h2"])
        if h:
            htitle=clean(h.get_text(" ",strip=True))
            if len(htitle)>=8:
                title=htitle
        tm=parse_time(dtext[:1200])
        price,price_text=parse_price(dtext)
        reg=bool(re.search(r"регистрац|купить билет",dtext,re.I)) or None
        desc=""
        ps=dsoup.find_all("p")
        if ps:
            desc=clean(" ".join(clean(p.get_text(" ",strip=True)) for p in ps[:3]))
            if len(desc)>650:
                desc=desc[:647].rstrip()+"..."
        out.append(make_event(src,dt.isoformat(),tm,title,full,desc,
                              price=price,price_text=price_text,registration=reg))
    return out

def open_call_summary(soup, title, fallback=""):
    text=clean(soup.get_text(" ",strip=True)) if soup else clean(fallback)
    # Ewert pages contain a concise editorial lead between the arrow and "О конкурсе".
    m=re.search(r"↓\s*(.+?)\s+О конкурсе\b",text,re.I)
    if m:
        summary=clean(m.group(1))
        if len(summary)>=60:
            return summary[:520].rstrip()
    # Prefer an actual content paragraph over navigation/breadcrumb text.
    if soup:
        for p in soup.find_all("p"):
            t=clean(p.get_text(" ",strip=True))
            low=t.lower()
            if (len(t)>=80 and title.lower() not in low and
                not any(x in low for x in ("перейти к содержимому","политика конфиденциальности",
                                           "подписаться","все конкурсы","афиша на почту"))):
                return t[:520].rstrip()
        meta=soup.find("meta",attrs={"name":"description"}) or soup.find("meta",attrs={"property":"og:description"})
        if meta:
            t=clean(meta.get("content",""))
            if len(t)>=60:
                return t[:520].rstrip()
    t=clean(fallback)
    return t[:520].rstrip()

def extract_open_call_listing(html, src):
    soup=BeautifulSoup(html,"html.parser")
    out=[]; seen=set(); today=date.today()
    patterns=src.get("href_contains") or []
    deadline_words=("deadline","прием заявок до","приём заявок до","прием работ до","приём работ до")
    for a in soup.find_all("a",href=True):
        full=urljoin(src["url"],a.get("href",""))
        if patterns and not any(p in full for p in patterns):
            continue
        node=a; block=None; txt=""
        for _ in range(7):
            node=getattr(node,"parent",None)
            if node is None: break
            txt=clean(node.get_text(" ",strip=True))
            if len(txt)>2600: break
            low=txt.lower()
            if any(w in low for w in deadline_words) and parse_deadline(txt):
                block=node; break
        if block is None:
            continue
        dt=parse_deadline(txt)
        if not dt or dt<today:
            continue

        detail_text=""
        detail_title=""
        primary_url=""
        try:
            detail_html=fetch(full)
            detail_soup=BeautifulSoup(detail_html,"html.parser")
            h=detail_soup.find("h1") or detail_soup.find("h2")
            detail_title=clean(h.get_text(" ",strip=True)) if h else ""
            detail_text=clean(detail_soup.get_text(" ",strip=True))
            if "ewert.ru" in urlparse(full).netloc.lower():
                for link in detail_soup.find_all("a",href=True):
                    label=clean(link.get_text(" ",strip=True)).lower()
                    href=urljoin(full,link.get("href",""))
                    host=urlparse(href).netloc.lower()
                    if ("перейти к конкурсу" in label and host and "ewert.ru" not in host):
                        primary_url=href
                        break
        except Exception as e:
            print(f"WARN open call detail {full}: {e}",file=sys.stderr)

        title=normalize_anchor_title(a)
        if not title or title.lower() in SKIP_TITLES or len(title)<6:
            title=detail_title
            if not title:
                for h in block.find_all(["h2","h3","h4"]):
                    t=clean(h.get_text(" ",strip=True))
                    if t.lower() not in SKIP_TITLES and len(t)>=6:
                        title=t; break
        if not title or title.lower() in SKIP_TITLES or len(title)<6:
            continue

        event_url=primary_url or full
        key=(dt.isoformat(),event_url,title)
        if key in seen: continue
        seen.add(key)

        desc=open_call_summary(detail_soup if detail_text else None,title,txt)
        price,price_text=parse_price(detail_text or txt)
        ev=make_event(
            src,dt.isoformat(),"",title,event_url,desc,
            venue=src.get("venue",""),price=price,price_text=price_text,registration=None,
            categories=["open-call"],status="check",
            reason="discovery_source_needs_primary_verification"
        )
        # Keep the full opportunity page text for validation. CuratorSpace and
        # similar aggregators often put application/selection fees below the
        # short summary, so the fee would otherwise be invisible to the filter.
        ev["audience_text"]=(detail_text or txt)[:12000]
        out.append(ev)
    return out

def extract_ges2(src, days=14):
    out, seen = [], set()
    today = date.today()
    detail_cache={}

    def detail_info(full):
        if full in detail_cache:
            return detail_cache[full]
        info={"title":"","text":"","cat":""}
        try:
            detail_html=fetch(full)
            ds=BeautifulSoup(detail_html,"html.parser")
            h=ds.find("h1") or ds.find("h2")
            info["title"]=clean(h.get_text(" ",strip=True)) if h else ""
            chunks=[]
            if h:
                total=0
                for s in h.find_all_next(string=True):
                    t=clean(s)
                    if not t or t==info["title"]:
                        continue
                    chunks.append(t)
                    total+=len(t)
                    if total>=2500:
                        break
            info["text"]=clean(" ".join(chunks))
            info["cat"]=event_category(info["text"]) or ""
        except Exception as e:
            print(f"WARN {src['name']} detail {full}: {e}",file=sys.stderr)
        detail_cache[full]=info
        return info

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
        month_names = [k for k,v in MONTHS.items() if v==dt.month and len(k)>3]
        if str(dt.year) not in bodytxt or not any(re.search(rf"\b{dt.day}\s+{re.escape(m)}\b",bodytxt,re.I) for m in month_names):
            continue

        for a in soup.find_all("a",href=True):
            card_title = normalize_anchor_title(a)
            if len(card_title)<8 or card_title.lower() in SKIP_TITLES:
                continue
            full=urljoin(src["url"],a.get("href",""))
            parsed=urlparse(full)
            if parsed.netloc not in {"ges-2.org","www.ges-2.org"}:
                continue
            if parsed.path in GES2_NON_EVENT_PATHS or "/calendar" in parsed.path or parsed.path in {"/",""}:
                continue

            li=a.find_parent("li")
            txt=clean(li.get_text(" ",strip=True)) if li else card_title
            if len(txt)>1200:
                continue
            if not (event_category(txt) or parse_time(txt)):
                continue

            detail=detail_info(full)
            title=detail["title"] or card_title
            if title.lower() in SKIP_TITLES or title.lower() in GES2_NON_EVENT_TITLES or len(title)<8:
                continue

            cat=detail["cat"] or event_category(txt)
            key=(dt.isoformat(),full)
            if key in seen:
                continue
            seen.add(key)

            price,price_text=parse_price(detail["text"] or txt)
            reg=bool(re.search(r"регистрац|зарегистр",detail["text"] or txt,re.I)) or None
            ev=make_event(src,dt.isoformat(),parse_time(txt),title,full,"",
                          price=price,price_text=price_text,registration=reg,
                          categories=[cat] if cat else [])
            ev["audience_text"]=(detail["text"] or "")[:2500]
            out.append(ev)
    return out

def main():
    cfg=load_json(SOURCES,{"sources":[]})
    db=load_json(DB,{"schema_version":1,"events":[]})
    existing={e.get("id"):e for e in db.get("events",[])}
    occurrence_index={
        (e.get("city"),e.get("date"),str(e.get("url","")).strip().lower(),
         re.sub(r"\W+","",str(e.get("title","")).lower())):e.get("id")
        for e in db.get("events",[]) if e.get("id") and e.get("url")
    }
    url_date_index={
        (e.get("city"),e.get("date"),str(e.get("url","")).strip().lower()):e.get("id")
        for e in db.get("events",[]) if e.get("id") and e.get("url")
    }
    url_title_index={
        (e.get("city"),str(e.get("url","")).strip().lower(),
         re.sub(r"\W+","",str(e.get("title","")).lower())):e.get("id")
        for e in db.get("events",[]) if e.get("id") and e.get("url") and e.get("title")
    }
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
            elif adapter=="rnb":
                candidates.extend(extract_rnb(html,src))
            elif adapter=="event_links":
                candidates.extend(extract_event_links(html,src))
            elif adapter=="zotov":
                candidates.extend(extract_zotov(html,src))
            elif adapter=="mamm":
                candidates.extend(extract_mamm(html,src))
            elif adapter=="open_call_listing":
                candidates.extend(extract_open_call_listing(html,src))
            elif adapter=="telegram_digest":
                candidates.extend(extract_telegram_digest(html,src))
            elif adapter=="telegram_channel_events":
                candidates.extend(extract_telegram_channel_events(html,src))

        for n in candidates:
            occ=(n.get("city"),n.get("date"),str(n.get("url","")).strip().lower(),
                 re.sub(r"\W+","",str(n.get("title","")).lower()))
            old_id=occurrence_index.get(occ)
            # A specific official event URL on the same date is a stronger
            # duplicate signal than slightly different editorial titles.
            # Do not use this shortcut for a source's shared listing URL.
            n_url=str(n.get("url","")).strip().lower()
            src_url=str(src.get("url","")).strip().lower()
            if not old_id and n_url and n_url != src_url:
                old_id=url_date_index.get((n.get("city"),n.get("date"),n_url))
            host=urlparse(n_url).netloc.lower() if n_url else ""
            # Winzavod and AZ previously stored the wrong end-date/opening-time
            # from page chrome. Match their existing approved records by stable
            # detail URL + title so a corrected scrape repairs facts instead of
            # creating a duplicate candidate.
            if not old_id and n_url and any(h in host for h in ("winzavod.ru","museum-az.com")):
                old_id=url_title_index.get((
                    n.get("city"),n_url,re.sub(r"\W+","",str(n.get("title","")).lower())
                ))
            if old_id and old_id in existing:
                old=existing[old_id]
                final_status=old.get("status") if old.get("status") in ("approved","rejected") else n.get("status","new")
                editor_note=old.get("editor_note","")
                reviewed_at=old.get("reviewed_at","")
                discovered_at=old.get("discovered_at") or n.get("discovered_at")
                old.update(n)
                old["id"]=old_id
                old["status"]=final_status
                old["editor_note"]=editor_note
                old["reviewed_at"]=reviewed_at
                old["discovered_at"]=discovered_at
            elif n["id"] not in existing:
                existing[n["id"]]=n
                occurrence_index[occ]=n["id"]
                if n_url:
                    url_date_index[(n.get("city"),n.get("date"),n_url)]=n["id"]
                    url_title_index[(n.get("city"),n_url,re.sub(r"\W+","",str(n.get("title","")).lower()))]=n["id"]
                found+=1

    db["updated_at"]=datetime.now(timezone.utc).date().isoformat()
    db["events"]=sorted(existing.values(),key=lambda e:(e.get("date",""),e.get("time",""),e.get("title","")))
    DB.write_text(json.dumps(db,ensure_ascii=False,indent=2)+"\n","utf-8")
    print(f"Collector found {found} raw new candidates before validation; temporary total {len(db['events'])}")

if __name__=="__main__":
    main()
