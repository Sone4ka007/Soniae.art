#!/usr/bin/env python3
import argparse, html, json
from datetime import date, datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DB = ROOT / "content/events.json"
OUT = ROOT / "dist/events-weekly/social"
MONTHS = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"]

CSS = """
*{box-sizing:border-box}
body{margin:0;background:#fff;color:#0b0b0b;font-family:Arial Narrow,Arial,Helvetica,sans-serif}
.slide{width:1080px;height:1350px;padding:72px;display:flex;flex-direction:column;overflow:hidden;background:#fff}
.eyebrow{font-size:26px;font-weight:800;letter-spacing:1.2px;border-bottom:4px solid #111;padding-bottom:18px}
.cover h1{font-size:128px;line-height:.82;letter-spacing:-5px;margin:110px 0 28px;font-weight:900}
.cover .range{font-size:34px;font-weight:800}
.event .meta{font-size:30px;font-weight:900;margin-top:56px}
.event h1{font-size:82px;line-height:.95;letter-spacing:-2.5px;margin:28px 0 26px;font-weight:900}
.event .venue{font-size:30px;font-weight:800;margin-bottom:30px}
.event .desc{font-size:34px;line-height:1.18;max-width:890px}
.event .footer{margin-top:auto;border-top:4px solid #111;padding-top:22px;display:flex;justify-content:space-between;gap:28px;font-size:25px;font-weight:800}
.badge{display:inline-block;background:#111;color:#fff;padding:8px 12px;margin-right:12px}
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

def price_text(e):
    if is_free(e):
        return "БЕСПЛАТНО"
    if str(e.get("price_text") or "").strip():
        return str(e["price_text"]).strip()
    if e.get("price") not in (None, ""):
        return f'{e["price"]} ₽'
    return "ЦЕНА НА САЙТЕ"

def status_label(e):
    status = str(e.get("availability") or "").lower()
    if status == "cancelled":
        return "ОТМЕНЕНО"
    if status == "postponed":
        return "ПЕРЕНЕСЕНО"
    if status == "sold_out":
        return "МЕСТ НЕТ"
    return ""

def fmt_date(iso):
    try:
        d = date.fromisoformat(iso)
        return f"{d.day} {MONTHS[d.month-1]}"
    except Exception:
        return iso or ""

def city_label(city):
    return {"moscow":"Москва","spb":"Петербург","russia":"Россия","international":"Международные"}.get(city, city)

def telegram_item(e, deadline=False):
    title = social_text(e, "social_title", "title")
    desc = social_text(e, "social_description", "description")
    when = fmt_date(e.get("date",""))
    if e.get("time") and not deadline:
        when += f", {e['time']}"
    parts = []
    flag = status_label(e)
    if flag:
        parts.append(f"⚠️ {flag}")
    parts.append(f"{when} — {title}" if when else title)
    place = str(e.get("venue") or e.get("source") or "").strip()
    meta = " · ".join(x for x in [place, price_text(e) if not deadline else ""] if x)
    if meta:
        parts.append(meta)
    if desc:
        parts.append(desc)
    if e.get("url"):
        parts.append(str(e["url"]))
    return "\n".join(parts)

def write_collection(path, heading, items, deadline=False):
    lines = [heading, ""]
    for e in items:
        lines.extend([telegram_item(e, deadline=deadline), ""])
    if not items:
        lines.append("На этот период подходящих событий нет.")
    path.write_text("\n".join(lines).rstrip() + "\n", "utf-8")

def event_slide(e, index, total):
    title = html.escape(social_text(e, "social_title", "title"))
    desc = html.escape(social_text(e, "social_description", "description"))
    venue = html.escape(str(e.get("venue") or e.get("source") or ""))
    date_text = html.escape(fmt_date(e.get("date","")) + (f" · {e.get('time')}" if e.get("time") else ""))
    badge = status_label(e)
    badge_html = f'<span class="badge">{html.escape(badge)}</span>' if badge else ""
    image_note = html.escape(str(e.get("instagram_image") or ""))
    image_meta = f'<span>IMAGE: {image_note}</span>' if image_note else "<span>sonyae.art/events</span>"
    return f"""<!doctype html><meta charset="utf-8"><style>{CSS}</style>
<main class="slide event">
  <div class="eyebrow">СОНЯ ЕНОКАЕВА · СОБЫТИЯ ДЛЯ ХУДОЖНИКОВ · {index}/{total}</div>
  <div class="meta">{badge_html}{date_text}</div>
  <h1>{title}</h1>
  <div class="venue">{venue}</div>
  <div class="desc">{desc}</div>
  <div class="footer"><span>{html.escape(price_text(e))}</span>{image_meta}</div>
</main>"""

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--week-start")
    ap.add_argument("--city", default="moscow")
    ap.add_argument("--instagram-limit", type=int, default=9)
    args = ap.parse_args()

    start = datetime.strptime(args.week_start, "%Y-%m-%d").date() if args.week_start else monday(date.today() + timedelta(days=7))
    end = start + timedelta(days=6)

    db = json.loads(DB.read_text("utf-8"))
    approved = [e for e in db.get("events", []) if e.get("status") == "approved"]

    weekly = [
        e for e in approved
        if e.get("city") == args.city
        and start.isoformat() <= str(e.get("date","")) <= end.isoformat()
    ]
    weekly.sort(key=lambda e:(e.get("date",""), e.get("time",""), e.get("title","")))

    tg_week = [e for e in weekly if parse_bool(e.get("telegram_include")) is not False]
    tg_free = [e for e in tg_week if is_free(e)]
    open_calls = [
        e for e in approved
        if e.get("kind") == "open_call"
        and start.isoformat() <= str(e.get("date","")) <= end.isoformat()
        and parse_bool(e.get("telegram_include")) is not False
    ]
    open_calls.sort(key=lambda e:(e.get("date",""), -social_priority(e), e.get("title","")))
    ending = [
        e for e in approved
        if e.get("city") == args.city
        and e.get("kind") == "exhibition"
        and start.isoformat() <= str(e.get("end_date","")) <= end.isoformat()
        and parse_bool(e.get("telegram_include")) is not False
    ]
    ending.sort(key=lambda e:(e.get("end_date",""), -social_priority(e), e.get("title","")))

    OUT.mkdir(parents=True, exist_ok=True)
    label = city_label(args.city)
    range_text = f"{start.day}–{end.day} {MONTHS[end.month-1]} {end.year}"

    write_collection(OUT / "telegram-week.txt", f"КУДА СХОДИТЬ ХУДОЖНИКУ\n{label} · {range_text}", tg_week)
    write_collection(OUT / "telegram-free.txt", f"БЕСПЛАТНО НА ЭТОЙ НЕДЕЛЕ\n{label} · {range_text}", tg_free)
    write_collection(OUT / "telegram-open-calls.txt", f"ОПЕН-КОЛЛЫ · ДЕДЛАЙНЫ {range_text}", open_calls, deadline=True)

    ending_copy = []
    for e in ending:
        x = dict(e)
        x["date"] = e.get("end_date")
        ending_copy.append(x)
    write_collection(OUT / "telegram-ending-soon.txt", f"ПОСЛЕДНИЙ ШАНС УВИДЕТЬ\n{label} · {range_text}", ending_copy)

    candidates = [e for e in weekly if parse_bool(e.get("instagram_include")) is not False]
    candidates.sort(key=lambda e:(
        0 if parse_bool(e.get("instagram_include")) is True else 1,
        -social_priority(e),
        0 if is_free(e) else 1,
        e.get("date",""),
        e.get("time",""),
        e.get("title","")
    ))
    selected = candidates[:max(1, args.instagram_limit)]

    insta = OUT / "instagram"
    insta.mkdir(exist_ok=True)
    cover = f"""<!doctype html><meta charset="utf-8"><style>{CSS}</style>
<main class="slide cover">
  <div class="eyebrow">СОНЯ ЕНОКАЕВА · {html.escape(label.upper())}</div>
  <h1>КУДА<br>СХОДИТЬ<br>ХУДОЖНИКУ</h1>
  <div class="range">{html.escape(range_text)}</div>
</main>"""
    (insta / "00-cover.html").write_text(cover, "utf-8")
    total = len(selected) + 1
    for i, e in enumerate(selected, 1):
        (insta / f"{i:02d}-{e.get('id','event')}.html").write_text(event_slide(e, i+1, total), "utf-8")

    caption = [
        f"Куда сходить художнику · {label} · {range_text}",
        "",
        "Сохраняйте подборку. Полный календарь — на sonyae.art/events.",
    ]
    (OUT / "instagram-caption.txt").write_text("\n".join(caption) + "\n", "utf-8")
    (OUT / "instagram.json").write_text(json.dumps({
        "week_start": start.isoformat(),
        "week_end": end.isoformat(),
        "city": args.city,
        "selected": [
            {
                "id": e.get("id"),
                "title": social_text(e, "social_title", "title"),
                "description": social_text(e, "social_description", "description"),
                "date": e.get("date"),
                "time": e.get("time"),
                "venue": e.get("venue"),
                "url": e.get("url"),
                "instagram_image": e.get("instagram_image"),
                "social_priority": social_priority(e),
            }
            for e in selected
        ]
    }, ensure_ascii=False, indent=2) + "\n", "utf-8")

    print(
        f"Built social package: weekly={len(tg_week)}, free={len(tg_free)}, "
        f"open_calls={len(open_calls)}, ending={len(ending)}, instagram={len(selected)}"
    )

if __name__ == "__main__":
    main()
