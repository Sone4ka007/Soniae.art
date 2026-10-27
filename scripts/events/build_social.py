#!/usr/bin/env python3
"""Weekly Instagram slides and a short Telegram text in Sonya's poster layout.

The package is a cover plus at most four day pages. Approved events are not
all printed: a row is included when `post_include` is true, and otherwise the
highest-scoring lectures and museum events fill the pages. `post_include`
false keeps a row out. An empty cell means "choose automatically".
"""
import argparse, html, json, re, sys
from datetime import date, datetime, timedelta
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from poster_assets import cover_image_uri, poster_font_face
from ruble_font import ruble_font_face

ROOT = Path(__file__).resolve().parents[2]
DB = ROOT / "content/events.json"
OUT = ROOT / "dist/events-weekly/social"

MONTHS = ["ЯНВАРЯ","ФЕВРАЛЯ","МАРТА","АПРЕЛЯ","МАЯ","ИЮНЯ","ИЮЛЯ","АВГУСТА","СЕНТЯБРЯ","ОКТЯБРЯ","НОЯБРЯ","ДЕКАБРЯ"]
MONTHS_LOW = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"]
DAYS_SHORT = ["ПН","ВТ","СР","ЧТ","ПТ","СБ","ВС"]
DAYS_FULL = ["понедельник","вторник","среда","четверг","пятница","суббота","воскресенье"]
MAJOR_VENUES = (
    "третьяков", "ммома", "зотов", "гараж", "пушкин", "винзавод",
    "мультимедиа", "мамм", "еврейск", "эрмитаж", "эрарта", "некрасов", "родченко",
)

CSS = poster_font_face() + ruble_font_face() + r"""
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#fff;color:#111}
body{font-family:"Ruble Fallback","Arial Narrow","Roboto Condensed","Liberation Sans Narrow","Noto Sans",Arial,sans-serif}
.page{width:1080px;height:1350px;background:#fff;overflow:hidden;position:relative}
.cover-copy{position:absolute;left:0;top:0;width:530px;height:1350px;padding:88px 28px 0 56px;background:#fff;z-index:2}
.cover-title{margin:0;font-family:Poster,"Arial Narrow",Impact,sans-serif;font-weight:400;font-size:78px;line-height:.86;letter-spacing:-1px;text-transform:uppercase}
.cover-title span{display:block}
.cover-rule{width:250px;border-top:4px solid #111;margin:28px 0}
.cover-days,.cover-month,.cover-year{font-family:Poster,"Arial Narrow",Impact,sans-serif;font-weight:400;line-height:.9;text-transform:uppercase}
.cover-days{font-size:92px}
.cover-month{font-size:64px;margin-top:6px}
.cover-year{font-size:64px;margin-top:2px}
.cover-kicker{font-size:28px;font-weight:700;letter-spacing:1px;line-height:1.15;text-transform:uppercase}
.cover-art{position:absolute;right:0;top:0;width:620px;height:1350px;object-fit:cover;object-position:center top}

.day{padding:46px 52px 40px}
.topline{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #111;padding-bottom:14px;font-size:22px;font-weight:700;letter-spacing:.5px;text-transform:uppercase}
.day-title{font-family:Poster,"Arial Narrow",Impact,sans-serif;font-weight:400;font-size:108px;line-height:.86;letter-spacing:-1px;margin:34px 0 8px;text-transform:uppercase}
.event-row{display:grid;grid-template-columns:188px 2px 1fr;gap:26px;border-bottom:2px solid #111;padding:22px 0 20px}
.event-time{font-family:Poster,"Arial Narrow",Impact,sans-serif;font-size:58px;line-height:1;padding-top:4px}
.event-rule{background:#111}
.event-title{font-size:36px;line-height:1.05;font-weight:800;margin:0 0 8px}
.event-venue{font-size:26px;line-height:1.15;margin:0 0 4px}
.event-blurb{font-size:24px;line-height:1.2;margin:0 0 12px}
.badge{display:inline-block;background:#ededed;color:#111;padding:6px 12px 5px;font-size:22px;line-height:1.1;font-weight:500;font-family:"Ruble Fallback","Arial Narrow","Noto Sans",sans-serif}
.badge.alert{background:#111;color:#fff}
.footer{position:absolute;left:52px;right:52px;bottom:28px;border-top:2px solid #111;display:flex;justify-content:space-between;gap:24px;padding-top:12px;font-size:18px;font-weight:700;letter-spacing:.4px;text-transform:uppercase}
.pdf-doc{margin:0;padding:0}
.pdf-page{page-break-after:always;break-after:page}
.pdf-page:last-child{page-break-after:auto;break-after:auto}
.note{width:1080px;min-height:700px;padding:72px 64px;background:#fff}
.note h1{font-family:Poster,"Arial Narrow",Impact,sans-serif;font-size:72px;line-height:.9;font-weight:400;text-transform:uppercase;margin:0 0 28px}
.note p{font-size:32px;line-height:1.35;margin:0 0 18px}
@page{size:1080px 1350px;margin:0}
"""

def monday(d):
    return d - timedelta(days=d.weekday())

def parse_bool(v):
    if isinstance(v, bool):
        return v
    if v is None:
        return None
    s = str(v).strip().lower()
    if not s:
        return None
    if s in {"true","1","yes","да"}:
        return True
    if s in {"false","0","no","нет"}:
        return False
    return None

def social_text(e, key, fallback):
    value = str(e.get(key) or "").strip()
    return value or str(e.get(fallback) or "").strip()

def social_priority(e):
    try:
        return max(0, min(5, int(e.get("social_priority") or 0)))
    except Exception:
        return 0

def is_free(e):
    return e.get("price") == 0 or e.get("price_type") == "free" or "бесплат" in str(e.get("price_text") or "").lower()

def status_label(e):
    status = str(e.get("availability") or "").lower()
    if status == "cancelled":
        return "отменено"
    if status == "postponed":
        return "перенесено"
    if status == "sold_out":
        return "мест нет"
    return ""

def badge_label(e):
    """Price chip in the same words as the reference slides."""
    flag = status_label(e)
    if flag:
        return flag, True
    text = str(e.get("price_text") or "").strip()
    amount = re.search(r"(\d[\d\s]*)\s*(?:₽|руб\.?)", text, re.I)
    if amount:
        number = re.sub(r"\s+", "", amount.group(1))
        return f"{number} ₽", False
    if e.get("price") not in (None, "", 0) and not is_free(e):
        return f"{e['price']} ₽", False
    registered = bool(e.get("registration"))
    paid = e.get("price_type") == "paid" or e.get("price") not in (None, "", 0)
    if registered and paid:
        return "регистрация + билет", False
    if registered:
        return "по регистрации", False
    if is_free(e):
        return "бесплатно", False
    if paid or "плат" in text.lower():
        return "платно", False
    if text:
        return text, False
    return "", False

def blurb(e):
    social = str(e.get("social_description") or "").strip()
    if social:
        return social
    text = str(e.get("description") or "").strip()
    text = re.sub(r"^(?:лекция|встреча|мастер-класс|воркшоп)\s+(?:о|об|про)\s+", "", text, flags=re.I)
    short = re.split(r"(?<=[.!?])\s+", text, maxsplit=1)[0].strip()
    if len(short) > 90:
        short = short[:87].rsplit(" ", 1)[0] + "…"
    return short

def city_label(city):
    return {"moscow":"МОСКВЕ","spb":"ПЕТЕРБУРГЕ","russia":"РОССИИ","international":"МИРЕ"}.get(city, str(city).upper())

def city_plain(city):
    return {"moscow":"Москве","spb":"Петербурге","russia":"России","international":"мире"}.get(city, city)

def footer_range(start, end):
    if start.month == end.month and start.year == end.year:
        return f"{start.day}–{end.day} {MONTHS[end.month-1]} {end.year}"
    if start.year == end.year:
        return f"{start.day} {MONTHS[start.month-1]} – {end.day} {MONTHS[end.month-1]} {end.year}"
    return f"{start.day} {MONTHS[start.month-1]} {start.year} – {end.day} {MONTHS[end.month-1]} {end.year}"

def plain_range(start, end):
    return footer_range(start, end).lower()

def event_score(e):
    choice = parse_bool(e.get("post_include"))
    if choice is False:
        return None
    title = str(e.get("title") or "")
    blob = " ".join([
        title,
        str(e.get("venue") or ""),
        " ".join(str(x) for x in (e.get("categories") or [])),
    ]).lower()
    score = 100 if choice is True else 0
    score += social_priority(e) * 3
    if "лекц" in blob:
        score += 5
    elif any(word in blob for word in ("мастер-класс", "воркшоп", "семинар")):
        score += 3
    if any(word in blob for word in MAJOR_VENUES):
        score += 2
    if str(e.get("time") or "").strip():
        score += 1
    if is_free(e) or e.get("price") not in (None, ""):
        score += 1
    if title.strip().lower() in {"курсы", "воркшопы", "кино", "лекции", "экскурсии"}:
        score -= 12
    if any(word in blob for word in ("для детей", "детск", "семейн")):
        score -= 8
    return score

def curate_week(events, per_day=3, max_days=4):
    """Cover plus up to four day pages. Ticked rows win; otherwise the score does."""
    forced = [e for e in events if parse_bool(e.get("post_include")) is True]
    pool = forced if forced else [e for e in events if (event_score(e) if event_score(e) is not None else -1) >= 0]
    by_day = {}
    for event in pool:
        by_day.setdefault(str(event.get("date") or ""), []).append(event)
    ranked = []
    for day, items in by_day.items():
        if not day:
            continue
        items.sort(key=lambda e: (-(event_score(e) or 0), str(e.get("time") or ""), str(e.get("title") or "")))
        chosen = items[:per_day]
        ranked.append((sum(event_score(e) or 0 for e in chosen), day, chosen))
    ranked.sort(key=lambda row: (-row[0], row[1]))
    ranked = ranked[:max_days]
    ranked.sort(key=lambda row: row[1])
    return [(day, items) for _score, day, items in ranked]

def day_items(events, d):
    iso=d.isoformat()
    return [e for e in events if str(e.get("date","")) == iso]

def safe_time(e):
    value = str(e.get("time") or "").strip()
    return html.escape(value) if value else "—"

def cover_page(start, end, city):
    if start.month == end.month and start.year == end.year:
        days = f"{start.day}–{end.day}"
        month = MONTHS[end.month-1]
        year = str(end.year)
    else:
        days = f"{start.day} {MONTHS[start.month-1]}"
        month = f"{end.day} {MONTHS[end.month-1]}"
        year = str(end.year) if start.year == end.year else f"{start.year}–{end.year}"
    image = cover_image_uri()
    return f"""<section class="page cover pdf-page">
  <div class="cover-copy">
    <h1 class="cover-title"><span>КУДА</span><span>СХОДИТЬ</span><span>ХУДОЖНИКУ</span><span>В {city_label(city)}</span></h1>
    <div class="cover-rule"></div>
    <div class="cover-days">{html.escape(days)}</div>
    <div class="cover-month">{html.escape(month)}</div>
    <div class="cover-year">{html.escape(year)}</div>
    <div class="cover-rule"></div>
    <div class="cover-kicker">ПОДБОРКА<br>СОБЫТИЙ</div>
  </div>
  <img class="cover-art" alt="" src="{image}">
</section>"""

def day_page(d, items, page_no, total_pages, city, start, end):
    date_title=f"{DAYS_SHORT[d.weekday()]} {d.day} {MONTHS[d.month-1]}"
    rows=[]
    for e in items:
        title=html.escape(social_text(e,"social_title","title"))
        venue=html.escape(str(e.get("venue") or e.get("source") or "").strip())
        short=html.escape(blurb(e))
        label, alert = badge_label(e)
        badge = f'<span class="badge{" alert" if alert else ""}">{html.escape(label)}</span>' if label else ""
        venue_html = f'<div class="event-venue">{venue}</div>' if venue else ""
        blurb_html = f'<div class="event-blurb">{short}</div>' if short else ""
        rows.append(f"""
<div class="event-row">
  <div class="event-time">{safe_time(e)}</div>
  <div class="event-rule"></div>
  <div>
    <div class="event-title">{title}</div>
    {venue_html}
    {blurb_html}
    {badge}
  </div>
</div>""")
    return f"""<section class="page day pdf-page">
  <div class="topline"><span>КУДА СХОДИТЬ ХУДОЖНИКУ В {city_label(city)}</span><span>{page_no}/{total_pages}</span></div>
  <div class="day-title">{date_title}</div>
  <div class="event-list">{''.join(rows)}</div>
  <div class="footer"><span>{html.escape(footer_range(start, end))}</span><span>СОНЯ ЕНОКАЕВА</span></div>
</section>"""

def short_telegram(groups, start, end, city):
    lines = [
        f"Куда сходить художнику в {city_plain(city)}",
        plain_range(start, end),
        "",
    ]
    if not groups:
        lines.append("На этой неделе в подборке пусто.")
    for day, items in groups:
        current = date.fromisoformat(day)
        lines.append(f"{DAYS_FULL[current.weekday()].capitalize()}, {current.day} {MONTHS_LOW[current.month-1]}")
        for event in items[:2]:
            title = social_text(event, "social_title", "title")
            place = str(event.get("venue") or event.get("source") or "").strip()
            clock = str(event.get("time") or "").strip() or "время уточняется"
            tail = f" — {place}" if place else ""
            lines.append(f"{clock} {title}{tail}")
        if len(items) > 2:
            lines.append("и ещё на карточке этого дня")
        lines.append("")
    lines.append("Карточки недели — в этом посте.")
    lines.append("Весь календарь: sonyae.art/events")
    return "\n".join(lines).rstrip() + "\n"

def short_caption(groups, start, end, city):
    highlights = []
    for _day, items in groups:
        for event in items:
            highlights.append((event_score(event) or 0, social_text(event, "social_title", "title")))
    highlights.sort(key=lambda row: -row[0])
    names = [title if "«" in title else f"«{title}»" for _score, title in highlights[:3]]
    lead = ", ".join(names) if names else "несколько событий, которые стоит поставить в календарь"
    return "\n".join([
        f"Куда сходить художнику в {city_plain(city)}, {plain_range(start, end)}.",
        "",
        f"В подборке: {lead}.",
        "",
        "Карточки — в посте. Весь календарь: sonyae.art/events",
    ]) + "\n"

def telegram_note_html(text):
    paragraphs = "".join(f"<p>{html.escape(part)}</p>" for part in text.split("\n\n") if part.strip())
    return f'<!doctype html><meta charset="utf-8"><style>{CSS}</style><main class="note"><h1>Куда сходить художнику</h1>{paragraphs}</main>'

def is_film(e):
    blob=" ".join([
        str(e.get("title") or ""),
        " ".join(str(x) for x in (e.get("categories") or [])),
        str(e.get("description") or "")
    ]).lower()
    return any(x in blob for x in ("кинопоказ","спецпоказ","показ фильма","документальный фильм","кино"))

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--week-start")
    ap.add_argument("--city",default="moscow")
    ap.add_argument("--events-per-day-page",type=int,default=3)
    ap.add_argument("--max-days",type=int,default=4)
    args=ap.parse_args()

    start=datetime.strptime(args.week_start,"%Y-%m-%d").date() if args.week_start else monday(date.today()+timedelta(days=7))
    end=start+timedelta(days=6)

    db=json.loads(DB.read_text("utf-8"))
    approved=[
        e for e in db.get("events",[])
        if e.get("status")=="approved"
        and e.get("city")==args.city
        and e.get("kind")=="event"
        and not is_film(e)
    ]
    weekly=[e for e in approved if start.isoformat()<=str(e.get("date",""))<=end.isoformat()]
    groups=curate_week(weekly, per_day=args.events_per_day_page, max_days=args.max_days)

    OUT.mkdir(parents=True,exist_ok=True)
    insta=OUT/"instagram"
    insta.mkdir(exist_ok=True)
    for old in insta.glob("*"):
        if old.is_file():
            old.unlink()

    total_pages=1+len(groups)
    cover=cover_page(start,end,args.city)
    (insta/"00-cover.html").write_text(
        f'<!doctype html><meta charset="utf-8"><style>{CSS}</style>{cover}',"utf-8")
    for index,(day,items) in enumerate(groups, start=2):
        current=date.fromisoformat(day)
        page=day_page(current, items, index, total_pages, args.city, start, end)
        (insta/f"{index-1:02d}-{day}.html").write_text(
            f'<!doctype html><meta charset="utf-8"><style>{CSS}</style>{page}',"utf-8")

    telegram=short_telegram(groups, start, end, args.city)
    (OUT/"telegram-week.txt").write_text(telegram,"utf-8")
    (OUT/"telegram-week.html").write_text(telegram_note_html(telegram),"utf-8")
    (OUT/"instagram-caption.txt").write_text(short_caption(groups, start, end, args.city),"utf-8")
    picked=sum(len(items) for _day, items in groups)
    print(
        f"Social package: {len(weekly)} approved events in {args.city}, "
        f"curated {picked} across {len(groups)} day pages, {total_pages} pages total, "
        f"{start.isoformat()} to {end.isoformat()}"
    )

if __name__=="__main__":
    main()
