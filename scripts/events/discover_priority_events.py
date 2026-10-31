#!/usr/bin/env python3
"""Discover priority art/animation events, keeping all new hits under editorial review."""
import json
import re
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, timedelta, datetime, timezone
from pathlib import Path
from urllib.parse import urlencode, urljoin, urlparse
from xml.etree import ElementTree
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[2]
CONFIG = ROOT / "events/priority_watch.json"
DB = ROOT / "content/events.json"


def clean(text):
    return re.sub(r"\s+", " ", str(text or "")).strip()


def contains_any(text, words):
    value = clean(text).casefold().replace("ё", "е")
    return any(clean(word).casefold().replace("ё", "е") in value for word in words)


def link_candidates(html, src):
    """Match only individual event cards, not unrelated text in the listing."""
    soup = BeautifulSoup(html, "html.parser")
    seen = set()
    urls = []
    patterns = src.get("href_contains", ["/shows/"])
    for anchor in soup.find_all("a", href=True):
        full = urljoin(src["url"], anchor["href"])
        parsed = urlparse(full)
        if parsed.scheme not in ("http", "https"):
            continue
        if parsed.netloc.lower().removeprefix("www.") != urlparse(src["url"]).netloc.lower().removeprefix("www."):
            continue
        if not any(p in parsed.path for p in patterns):
            continue
        if parsed.path.rstrip("/") in {"/shows", "/education"} or full in seen:
            continue
        seen.add(full)
        block = anchor
        label = clean(anchor.get_text(" ", strip=True))
        for _ in range(3):
            parent = block.parent
            if parent is None or parent.name in ("html", "body", "main", "section", "nav", "footer"):
                break
            if len(parent.find_all("a", href=True)) > 1:
                break
            parent_text = clean(parent.get_text(" ", strip=True))
            if len(parent_text) > 650:
                break
            block = parent
            label = parent_text
        if contains_any(label, src.get("keywords", [])):
            urls.append(full)
    return urls[:int(src.get("max_detail_pages", 35))]


def future_event_date(text, today):
    from collect_jsonld import parse_date
    # Historical Museum: "Дата и время проведения : 30 октября, 18:00".
    # Never guess a new year for an outdated date.
    pattern = (
        r"(?:дата\s+и\s+время\s+проведения|дата\s+проведения|"
        r"дата\s+мероприятия|когда\s+и\s+где)\s*[:—–-]?\s*(.{0,110})"
    )
    for match in re.finditer(pattern, text, flags=re.I):
        fragment = match.group(1)
        dt = parse_date(fragment, require_year=True) or parse_date(
            fragment, require_year=False, default_year=today.year
        )
        if dt and today <= dt <= today + timedelta(days=45):
            return dt, clean(fragment)[:110]
    # Otherwise require explicit year close to the event title.
    dt = parse_date(text[:1800], require_year=True)
    if dt and today <= dt <= today + timedelta(days=45):
        return dt, text[:450]
    return None, ""


def detail_event(url, src, today, fetcher):
    from collect_jsonld import make_event, parse_event_page_time, parse_price
    soup = BeautifulSoup(fetcher(url), "html.parser")
    heading = soup.find("h1")
    if not heading:
        return None
    title = clean(heading.get_text(" ", strip=True))
    if len(title) < 10 or len(title) > 220:
        return None
    parts = []
    total = 0
    for value in heading.next_elements:
        if not isinstance(value, str):
            continue
        value = clean(value)
        if not value:
            continue
        parts.append(value)
        total += len(value) + 1
        if total >= 8500:
            break
    text = clean(title + " " + " ".join(parts))
    if not contains_any(text[:5000], src.get("keywords", [])):
        return None
    hints = src.get("event_hints", [
        "лекци", "встреч", "круглый стол", "мастер-класс", "анимац",
        "мультипликац", "дискусси", "творческий вечер", "презентаци"
    ])
    if not contains_any(text[:4000], hints):
        return None
    dt, date_context = future_event_date(text[:6000], today)
    if not dt:
        return None
    tm = parse_event_page_time(date_context, urlparse(url).netloc) if date_context else ""
    description = ""
    for paragraph in heading.find_all_next("p", limit=12):
        candidate = clean(paragraph.get_text(" ", strip=True))
        if len(candidate) > 80 and not contains_any(candidate[:50], [
            "согласие на обработку", "cookie"
        ]):
            description = candidate[:440]
            break
    price, price_text = parse_price(date_context[:500])
    cats = ["анимация"] if contains_any(
        text[:4000], ["анимац", "мультипликац", "мультфильм"]
    ) else ["встреча"]
    event = make_event(
        src, dt.isoformat(), tm, title, url, description,
        venue=src.get("venue", ""), price=price, price_text=price_text,
        registration=None, categories=cats, status="check",
        reason="priority_watch_verify_date_and_tickets"
    )
    event["editor_note"] = "Приоритетный поиск: проверить дату, программу и билеты по первоисточнику"
    return event


def rss_links(xml_text, terms, limit=15):
    """Bing RSS returns direct URLs; don't ingest search redirect pages."""
    try:
        root = ElementTree.fromstring(xml_text)
    except ElementTree.ParseError:
        return []
    out = []
    for item in root.findall(".//item"):
        title = clean(item.findtext("title"))
        summary = clean(BeautifulSoup(
            item.findtext("description") or "", "html.parser"
        ).get_text(" "))
        url = clean(item.findtext("link"))
        host = urlparse(url).netloc.lower()
        if (not url.startswith(("https://", "http://"))) or any(
            x in host for x in ("bing.com", "google.com", "youtube.com", "vk.com")
        ):
            continue
        if not contains_any(title + " " + summary, terms):
            continue
        if url not in out:
            out.append(url)
        if len(out) >= limit:
            break
    return out


def search_urls(query, terms, fetcher, limit):
    endpoint = "https://www.bing.com/search?" + urlencode({
        "format": "rss", "q": query
    })
    return rss_links(fetcher(endpoint), terms, limit)


def collect(config, fetcher, today):
    urls = []
    for src in config.get("listing_sources", []):
        try:
            candidates = link_candidates(fetcher(src["url"]), src)
            print(f"PRIORITY_LISTING {src['name']}: matched_links={len(candidates)}")
        except Exception as exc:
            print(f"WARN priority listing {src['name']}: {exc}", file=sys.stderr)
            continue
        urls.extend((url, src) for url in candidates)

    for spec in config.get("search_queries", []):
        src = {
            "name": spec["name"], "city": spec.get("city", "moscow"),
            "venue": "", "keywords": spec["keywords"],
            "event_hints": spec.get("event_hints", []),
        }
        try:
            found = search_urls(
                spec["query"].replace("{year}", str(today.year)),
                spec["keywords"], fetcher, int(spec.get("max_results", 12))
            )
            print(f"PRIORITY_SEARCH {spec['name']}: matched_links={len(found)}")
        except Exception as exc:
            print(f"WARN priority search {spec['name']}: {exc}", file=sys.stderr)
            continue
        urls.extend((url, src) for url in found)

    unique = {}
    for url, src in urls:
        unique.setdefault(url.split("#")[0].rstrip("/"), (url, src))
    events = []
    with ThreadPoolExecutor(max_workers=5) as pool:
        futures = {
            pool.submit(detail_event, url, src, today, fetcher): url
            for url, src in unique.values()
        }
        for future in as_completed(futures):
            try:
                event = future.result()
                if event:
                    events.append(event)
            except Exception as exc:
                print(
                    f"WARN priority detail {futures[future]}: {exc}",
                    file=sys.stderr
                )
    return events


def merge_events(db, candidates):
    existing = db.setdefault("events", [])
    known_urls = {
        (e.get("date"), str(e.get("url", "")).rstrip("/")) for e in existing
    }
    known_titles = {
        (e.get("date"), re.sub(r"\W+", "", str(e.get("title", "")).casefold()))
        for e in existing
    }
    added = 0
    for event in candidates:
        key_url = (event["date"], event["url"].rstrip("/"))
        key_title = (
            event["date"], re.sub(r"\W+", "", event["title"].casefold())
        )
        if key_url in known_urls or key_title in known_titles:
            continue
        existing.append(event)
        known_urls.add(key_url)
        known_titles.add(key_title)
        added += 1
    existing.sort(key=lambda x: (
        x.get("date", ""), x.get("time", ""), x.get("title", "")
    ))
    return added


def bounded_fetch(url):
    """Bound a priority search so a blocked search engine cannot stall the main feed."""
    import requests
    from collect_jsonld import BROWSER_HEADERS
    response = requests.get(
        url, headers=BROWSER_HEADERS, timeout=(6, 12), allow_redirects=True
    )
    response.raise_for_status()
    response.encoding = response.encoding or "utf-8"
    return response.text


def main():
    from quality_gate import exclusion_reason
    today = date.today()
    config = json.loads(CONFIG.read_text("utf-8"))
    db = json.loads(DB.read_text("utf-8"))
    candidates = [
        e for e in collect(config, bounded_fetch, today)
        if not exclusion_reason(e, today)
    ]
    count = merge_events(db, candidates)
    db["updated_at"] = datetime.now(timezone.utc).date().isoformat()
    DB.write_text(json.dumps(db, ensure_ascii=False, indent=2) + "\n", "utf-8")
    print(f"PRIORITY_DISCOVERY candidates={len(candidates)} new={count}")


if __name__ == "__main__":
    main()
