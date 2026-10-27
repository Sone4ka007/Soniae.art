"""Sources whose public pages are not a plain list of event links.

Each adapter reads a public, unauthenticated endpoint and stops after a small
number of pages. A 403 or a timeout is reported by the collector; these
functions do not retry past the source's own attempt limit and do not log in.
"""
import re
import time
from datetime import datetime, timedelta, timezone
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from collect_jsonld import (
    BROWSER_HEADERS,
    clean,
    event_category,
    extract_event_links,
    fetch,
    make_event,
    parse_date,
    parse_price,
    parse_time,
)

MSK = timezone(timedelta(hours=3))


def _json_request(url, timeout, attempts, method="GET", data=None, verify=True):
    headers = dict(BROWSER_HEADERS)
    headers["Accept"] = "application/json, text/plain, */*"
    last = None
    for attempt in range(max(1, attempts)):
        try:
            response = requests.request(
                method, url, headers=headers, data=data, timeout=timeout,
                allow_redirects=True, verify=verify,
            )
            if response.status_code >= 400:
                response.raise_for_status()
            return response.json()
        except Exception as exc:
            last = exc
            if attempt + 1 < attempts:
                time.sleep(1)
    raise last


def _limits(src, timeout=20, attempts=2):
    return int(src.get("timeout") or timeout), int(src.get("attempts") or attempts)


def extract_tretyakov_api(src):
    """Lectures are rendered by the site after load. The same list is public JSON."""
    timeout, attempts = _limits(src)
    section = src.get("section") or "lektsii"
    page_size = int(src.get("page_size") or 50)
    url = (
        "https://www.tretyakovgallery.ru/api/content/events/"
        f"?archive=n&page_size={page_size}&section={section}&sort=date&sort_param=asc"
    )
    payload = _json_request(url, timeout, attempts)
    return events_from_tretyakov(payload, src)


def events_from_tretyakov(payload, src):
    items = ((payload or {}).get("data") or {}).get("items") or []
    today = datetime.now(MSK).date()
    out = []
    for item in items:
        title = clean(item.get("name"))
        if len(title) < 6:
            continue
        start = clean(item.get("startDate"))
        when = parse_date(start, require_year=True)
        if not when or when < today:
            continue
        place = item.get("place") or {}
        venue = clean(place.get("name") if isinstance(place, dict) else "") or src.get("venue", "")
        link = urljoin("https://www.tretyakovgallery.ru/", str(item.get("url") or ""))
        buy = item.get("buttonBuy") or {}
        price, price_text = parse_price(clean(buy.get("text") if isinstance(buy, dict) else ""))
        category = event_category(title + " " + clean(item.get("hashtag"))) or "лекция"
        out.append(make_event(
            src, when.isoformat(), parse_time(start), title, link, "",
            venue=venue, price=price, price_text=price_text,
            registration=bool(buy) or None, categories=[category],
        ))
    return out


def extract_hermitage_api(src):
    """The what's-on HTML is a shell. The museum posts the list to /api/whats/load."""
    timeout, attempts = _limits(src)
    requests.packages.urllib3.disable_warnings()
    out = []
    for kind in src.get("api_types") or ["exhibition", "event"]:
        payload = _json_request(
            "https://hermitagemuseum.org/api/whats/load",
            timeout, attempts, method="POST", verify=False,
            data={"lng": "ru", "page": "1", "type": kind, "category": "", "local": "1"},
        )
        out.extend(events_from_hermitage(payload, src, kind))
    return out


def events_from_hermitage(payload, src, kind):
    data = (payload or {}).get("data")
    if not isinstance(data, dict):
        return []
    today = datetime.now(MSK).date()
    out = []
    for item in data.get("whatsList") or []:
        title = clean(item.get("head"))
        if len(title) < 6:
            continue
        start = _iso_day(item.get("dateStart"))
        end = _iso_day(item.get("dateEnd"))
        if end and end < today:
            continue
        if not end and start and start < today:
            continue
        if not start:
            continue
        link = urljoin("https://hermitagemuseum.org/", str(item.get("link") or ""))
        text = clean(item.get("text"))
        price, price_text = parse_price(text)
        category = "выставка" if kind == "exhibition" else (event_category(title + " " + text) or "событие")
        event = make_event(
            src, start.isoformat(), "", title, link, text[:500],
            venue=clean(item.get("location")) or src.get("venue", ""),
            price=price, price_text=price_text, categories=[category],
        )
        if kind == "exhibition":
            event["kind"] = "exhibition"
            event["start_date"] = start.isoformat()
            if end:
                event["end_date"] = end.isoformat()
        out.append(event)
    return out


def extract_kudago(src):
    timeout, attempts = _limits(src, timeout=12, attempts=1)
    since = int(datetime.now(MSK).timestamp())
    fields = "id,title,description,dates,place,price,site_url,categories,is_free"
    url = (
        "https://kudago.com/public-api/v1.4/events/"
        f"?location=msk&categories=exhibition,education&fields={fields}"
        f"&page_size=40&text_format=plain&actual_since={since}"
    )
    payload = _json_request(url, timeout, attempts)
    events = events_from_kudago(payload, src)
    next_url = (payload or {}).get("next")
    if next_url:
        time.sleep(0.8)
        events.extend(events_from_kudago(_json_request(next_url, timeout, attempts), src))
    return events


def events_from_kudago(payload, src):
    today = datetime.now(MSK).date()
    out = []
    for item in (payload or {}).get("results") or []:
        title = clean(item.get("title"))
        if len(title) < 6:
            continue
        when, clock = _kudago_when(item.get("dates") or [], today)
        if not when:
            continue
        place = item.get("place") or {}
        venue = clean(place.get("title") if isinstance(place, dict) else "")
        address = clean(place.get("address") if isinstance(place, dict) else "")
        description = clean(item.get("description"))[:500]
        price_text = clean(item.get("price"))
        price = 0 if item.get("is_free") else None
        if price is None and price_text:
            price, parsed = parse_price(price_text)
            price_text = parsed or price_text
        link = clean(item.get("site_url")) or f"https://kudago.com/msk/event/{item.get('id')}/"
        category = event_category(title + " " + description) or ""
        out.append(make_event(
            src, when.isoformat(), clock, title, link, description,
            venue=venue, address=address, price=price, price_text=price_text,
            categories=[category] if category else [],
        ))
    return out


def extract_pro_culture(src):
    """Public events API. It answers 403 without a key; we do not invent one."""
    timeout, attempts = _limits(src, timeout=12, attempts=1)
    payload = _json_request(src["url"], timeout, attempts)
    return events_from_pro_culture(payload, src)


def events_from_pro_culture(payload, src):
    rows = []
    if isinstance(payload, dict):
        rows = payload.get("events") or payload.get("result") or []
    elif isinstance(payload, list):
        rows = payload
    today = datetime.now(MSK).date()
    out = []
    for item in rows:
        if not isinstance(item, dict):
            continue
        title = clean(item.get("name") or item.get("title"))
        if len(title) < 6:
            continue
        when = _iso_day(item.get("start") or item.get("startDate") or item.get("date"))
        if when is None and str(item.get("start") or "").isdigit():
            when = datetime.fromtimestamp(int(item["start"]), MSK).date()
        if not when or when < today:
            continue
        places = item.get("places") or []
        venue = ""
        if places and isinstance(places[0], dict):
            venue = clean(places[0].get("name"))
        venue = venue or clean((item.get("organization") or {}).get("name") if isinstance(item.get("organization"), dict) else "")
        link = clean(item.get("saleLink") or item.get("url") or "")
        if not link:
            continue
        free = item.get("isFree") is True
        price, price_text = (0, "бесплатно") if free else parse_price(clean(item.get("price")))
        category = event_category(title) or ""
        out.append(make_event(
            src, when.isoformat(), "", title, link, clean(item.get("description"))[:400],
            venue=venue or src.get("venue", ""), price=price, price_text=price_text,
            categories=[category] if category else [],
        ))
    return out


def extract_timepad(html, src):
    soup = BeautifulSoup(html or "", "html.parser")
    urls = []
    seen = set()
    for anchor in soup.find_all("a", href=True):
        href = anchor["href"]
        if not re.search(r"/event/\d+", href):
            continue
        full = urljoin(src["url"], href.split("?")[0])
        if "timepad.ru" not in full or full in seen:
            continue
        seen.add(full)
        urls.append(full)
    if not urls:
        return []
    local = dict(src)
    local["href_contains"] = ["/event/"]
    local["max_detail_pages"] = int(src.get("max_detail_pages") or 12)
    local["detail_workers"] = 4
    fake = "\n".join(f'<a href="{url}">{url}</a>' for url in urls)
    return extract_event_links(fake, local)


def extract_artguide(html, src):
    local = dict(src)
    local["href_contains"] = src.get("href_contains") or ["/posts/", "/post/", "/events/"]
    local["max_detail_pages"] = int(src.get("max_detail_pages") or 20)
    local["detail_workers"] = 4
    return extract_event_links(html, local)


def _iso_day(value):
    text = str(value or "").strip()
    if len(text) >= 10 and text[4] == "-" and text[7] == "-":
        try:
            return datetime.strptime(text[:10], "%Y-%m-%d").date()
        except ValueError:
            return None
    return None


def _kudago_when(dates, today):
    upcoming = []
    for slot in dates:
        if not isinstance(slot, dict):
            continue
        raw = slot.get("start")
        if raw in (None, "", -1, 0):
            continue
        try:
            moment = datetime.fromtimestamp(int(raw), MSK)
        except (TypeError, ValueError, OSError):
            continue
        if moment.date() >= today:
            upcoming.append(moment)
    if not upcoming:
        return None, ""
    moment = min(upcoming)
    clock = "" if moment.hour == 0 and moment.minute == 0 else moment.strftime("%H:%M")
    return moment.date(), clock
