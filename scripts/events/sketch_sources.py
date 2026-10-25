"""Sketch meetings: dated social posts and explicitly recurring school practices."""
import json
import re
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo
from urllib.parse import urljoin

from bs4 import BeautifulSoup

MONTHS = {"января":1,"февраля":2,"марта":3,"апреля":4,"мая":5,"июня":6,
          "июля":7,"августа":8,"сентября":9,"октября":10,"ноября":11,"декабря":12}
DATE_RE = re.compile(r"(?<!\d)(\d{1,2})\s*(?:[./](\d{1,2})(?:[./](20\d{2}))?|\s+("+
                     "|".join(MONTHS)+r")(?:\s+(20\d{2}))?)(?!\d)", re.I)
SKETCH_RE = re.compile(r"наброс|скетч|рисован|рисуем|рисунок|портрет|натур", re.I)
DAY = {"mon":0,"tue":1,"wed":2,"wen":2,"thu":3,"fri":4,"sat":5,"sun":6}


def plain(node):
    return re.sub(r"\s+", " ", node.get_text(" ", strip=True)).strip()


def objects(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from objects(child)
    elif isinstance(value, list):
        for child in value:
            yield from objects(child)


def extract(html, src, make_event, parse_price, today=None):
    today = today or datetime.now(ZoneInfo("Europe/Moscow")).date()
    soup = BeautifulSoup(html, "html.parser")
    if "Site Unavailable" in soup.get_text() or "Access Denied" in soup.get_text():
        raise ValueError("source_unavailable: public page is blocked")
    if src["adapter"] == "sketch_prostaya":
        return school(soup, src, make_event, today)
    return posts(soup, src, make_event, parse_price, today)


def school(soup, src, make_event, today):
    node = soup.find("script", id="__NEXT_DATA__")
    if not node:
        raise ValueError("source_layout_changed: missing school schedule data")
    out = []
    seen = set()
    for item in objects(json.loads(node.string or node.get_text())):
        if item.get("__typename") != "OpenClass" or item.get("isOnline") or item.get("isArchived"):
            continue
        title = str(item.get("title") or "").strip()
        if not SKETCH_RE.search(title):
            continue
        for slot in item.get("schedule") or []:
            weekday = DAY.get(slot.get("day"))
            tm = str(slot.get("startTime") or "")[:5]
            if weekday is None or not re.fullmatch(r"\d{2}:\d{2}", tm):
                continue
            for offset in range(14):
                dt = today + timedelta(days=offset)
                if dt.weekday() != weekday:
                    continue
                key = (title, dt.isoformat(), tm)
                if key in seen:
                    continue
                seen.add(key)
                price = item.get("price")
                ev = make_event(src, dt.isoformat(), tm, title, src["url"],
                    str(item.get("intro") or "").replace("\\n", " "),
                    address=src.get("address", ""), price=price,
                    price_text=f"{price} ₽" if price is not None else "",
                    registration=False, categories=["наброски"], status="check",
                    reason="recurring_schedule_confirm_specific_date")
                ev["editor_note"] = "По еженедельному расписанию школы; проверить отмены и анонс конкретной даты."
                out.append(ev)
    if not out:
        raise ValueError("source_empty: no active in-person sketch practices")
    return out


def posts(soup, src, make_event, parse_price, today):
    telegram = src["adapter"] == "sketch_telegram"
    nodes = soup.select(".tgme_widget_message" if telegram else ".wall_item, .post, .Post")
    if not nodes:
        raise ValueError("source_unavailable: no public posts (group, login wall or changed layout)")
    out = []; seen = set()
    for node in nodes:
        body = node.select_one(".tgme_widget_message_text" if telegram else ".wall_post_text, .pi_text, .Post__text")
        if not body:
            continue
        raw = body.get_text("\n", strip=True)
        if not SKETCH_RE.search(raw) or re.search(r"отмен[а-я]*|не\s+состоится", raw, re.I):
            continue
        # Never treat an archived October post as next October's announcement.
        stamp = node.select_one("time[datetime]")
        published = None
        if stamp:
            try:
                published = date.fromisoformat(stamp["datetime"][:10])
            except ValueError:
                pass
        if published and (today - published).days > 60:
            continue
        year = published.year if published else today.year
        if telegram:
            post = node.get("data-post", "")
            url = "https://t.me/" + post if post else src["url"]
        else:
            link = node.select_one('a[href*="wall-"]')
            post = node.get("data-post-id") or node.get("id", "").removeprefix("post")
            url = urljoin(src["url"], link["href"]) if link else (
                "https://vk.com/wall" + post if re.fullmatch(r"-\d+_\d+", post) else src["url"])
        matches = list(DATE_RE.finditer(raw))
        for index, match in enumerate(matches):
            y = int(match.group(3) or match.group(5) or year)
            month = int(match.group(2)) if match.group(2) else MONTHS[match.group(4).lower()]
            if not (match.group(3) or match.group(5)) and published and published.month == 12 and month == 1:
                y += 1
            try:
                dt = date(y, month, int(match.group(1)))
            except ValueError:
                continue
            if not today <= dt <= today + timedelta(days=45):
                continue
            # A weekly digest may announce several separate dated sessions.
            end = matches[index+1].start() if index+1 < len(matches) else len(raw)
            segment = raw[match.end():end]
            time_match = re.search(r"(?<!\d)([01]?\d|2[0-3])[:.]([0-5]\d)(?!\d)", segment)
            tm = f"{int(time_match[1]):02d}:{time_match[2]}" if time_match else ""
            key = (url, dt.isoformat(), tm)
            if key in seen:
                continue
            seen.add(key)
            title = "Наброски — " + src["venue"]
            price, price_text = parse_price(segment if len(matches) > 1 else raw)
            ev = make_event(src, dt.isoformat(), tm, title, url,
                re.sub(r"\s+", " ", raw)[:1200], price=price, price_text=price_text,
                categories=["наброски"], status="check", reason="sketch_post_verify_date_time")
            # Different sessions on the same day must not overwrite each other.
            ev["id"] += "-" + (tm.replace(":", "") or "unknown")
            out.append(ev)
    return out
