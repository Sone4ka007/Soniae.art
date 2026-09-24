#!/usr/bin/env python3
import argparse, html, json, math
from datetime import date, datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DB = ROOT / "content/events.json"
OUT = ROOT / "dist/events-weekly/social"

MONTHS = ["ЯНВАРЯ","ФЕВРАЛЯ","МАРТА","АПРЕЛЯ","МАЯ","ИЮНЯ","ИЮЛЯ","АВГУСТА","СЕНТЯБРЯ","ОКТЯБРЯ","НОЯБРЯ","ДЕКАБРЯ"]
MONTHS_LOW = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"]
DAYS_SHORT = ["ПН","ВТ","СР","ЧТ","ПТ","СБ","ВС"]
DAYS_FULL = ["ПОНЕДЕЛЬНИК","ВТОРНИК","СРЕДА","ЧЕТВЕРГ","ПЯТНИЦА","СУББОТА","ВОСКРЕСЕНЬЕ"]

CSS = r"""
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#fff;color:#080808}
body{font-family:"Arial Narrow","Roboto Condensed","Liberation Sans Narrow",Arial,sans-serif}
.page{width:1080px;height:1350px;background:#fff;padding:44px 48px 34px;overflow:hidden;position:relative}
.topline{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #111;padding-bottom:12px;font-size:25px;font-weight:700;letter-spacing:4px;text-transform:uppercase}
.day-title{font-family:Impact,"Arial Narrow",sans-serif;font-size:146px;line-height:.86;letter-spacing:-4px;font-weight:900;margin:28px 0 24px;text-transform:uppercase;white-space:nowrap}
.event-list{border-top:0 solid #111}
.event-row{display:grid;grid-template-columns:205px 1px 1fr;gap:24px;border-bottom:2px solid #111;padding:19px 0 18px;min-height:157px}
.event-time{font-family:Impact,"Arial Narrow",sans-serif;font-size:55px;line-height:.95;letter-spacing:-1px;padding-top:1px}
.event-rule{background:#111;width:1px}
.event-title{font-size:39px;line-height:.98;font-weight:900;margin:0 0 6px}
.event-meta{font-size:28px;line-height:1.05;margin:0 0 10px}
.badge{display:inline-block;background:#ececec;padding:7px 18px 6px;font-size:24px;line-height:1;font-weight:500}
.badge.alert{background:#111;color:#fff}
.footer{position:absolute;left:48px;right:48px;bottom:13px;border-top:2px solid #111;text-align:center;padding-top:8px;font-size:16px;letter-spacing:3px;text-transform:uppercase}

.summary{padding-top:26px}
.summary-title{font-family:Impact,"Arial Narrow",sans-serif;font-size:86px;line-height:.9;text-align:center;letter-spacing:-2px;font-weight:900;text-transform:uppercase;margin:0}
.summary-range{text-align:center;font-size:27px;letter-spacing:8px;margin:10px 0 18px}
.summary-grid{display:grid;border-top:3px solid #111;border-left:2px solid #111;height:1085px}
.summary-col{border-right:2px solid #111;min-width:0;overflow:hidden}
.summary-head{background:#111;color:#fff;font-family:Impact,"Arial Narrow",sans-serif;text-align:center;font-size:32px;line-height:1;padding:12px 4px 10px;letter-spacing:1px}
.summary-item{padding:13px 12px 12px;border-bottom:1.5px solid #111}
.summary-time{font-size:22px;line-height:1;font-weight:900;margin-bottom:4px}
.summary-event-title{font-size:23px;line-height:.98;font-weight:900;margin-bottom:5px}
.summary-venue{font-size:18px;line-height:1.05;margin-bottom:7px}
.summary-badge{display:inline-block;background:#ececec;padding:5px 9px 4px;font-size:16px;line-height:1}
.summary-footer{position:absolute;left:48px;right:48px;bottom:11px;text-align:center;font-size:16px;letter-spacing:3px}

.pdf-doc{margin:0;padding:0}
.pdf-page{page-break-after:always;break-after:page}
.pdf-page:last-child{page-break-after:auto;break-after:auto}
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

def price_text(e):
    if is_free(e):
        return "бесплатно"
    if str(e.get("price_text") or "").strip():
        return str(e["price_text"]).strip()
    if e.get("price") not in (None, ""):
        return f'{e["price"]} ₽'
    if e.get("registration"):
        return "по рег."
    return "билет"

def status_label(e):
    status = str(e.get("availability") or "").lower()
    if status == "cancelled":
        return "ОТМЕНЕНО"
    if status == "postponed":
        return "ПЕРЕНЕСЕНО"
    if status == "sold_out":
        return "МЕСТ НЕТ"
    return ""

def city_label(city):
    return {"moscow":"МОСКВЕ","spb":"ПЕТЕРБУРГЕ","russia":"РОССИИ","international":"МИРЕ"}.get(city, str(city).upper())

def city_plain(city):
    return {"moscow":"Москва","spb":"Петербург","russia":"Россия","international":"Международные"}.get(city, city)

def day_items(events, d):
    iso=d.isoformat()
    return [e for e in events if str(e.get("date","")) == iso]

def safe_time(e):
    return html.escape(str(e.get("time") or "по\nпрограмме")).replace("\n","<br>")

def event_meta(e):
    venue=str(e.get("venue") or e.get("source") or "").strip()
    desc=social_text(e,"social_description","description")
    if desc:
        # Keep the event card editorial and compact: venue first, then a short descriptor.
        short=desc.split(". ")[0].strip()
        if len(short)>105:
            short=short[:102].rsplit(" ",1)[0]+"…"
        if venue and short and venue.lower() not in short.lower():
            return f"{venue} · {short}"
        return short or venue
    return venue

def day_page(d, items, page_no, total_pages, city, continuation=0):
    date_title=f"{DAYS_SHORT[d.weekday()]} {d.day} {MONTHS[d.month-1]}"
    if continuation:
        date_title += f" · {continuation+1}"
    rows=[]
    for e in items:
        title=html.escape(social_text(e,"social_title","title"))
        meta=html.escape(event_meta(e))
        badge=status_label(e)
        badge_text=badge or price_text(e)
        badge_class="badge alert" if badge else "badge"
        rows.append(f"""
<div class="event-row">
  <div class="event-time">{safe_time(e)}</div>
  <div class="event-rule"></div>
  <div>
    <div class="event-title">{title}</div>
    <div class="event-meta">{meta}</div>
    <span class="{badge_class}">{html.escape(badge_text)}</span>
  </div>
</div>""")
    return f"""<section class="page pdf-page">
  <div class="topline"><span>КУДА СХОДИТЬ ХУДОЖНИКУ В {city_label(city)}</span><span>{page_no}/{total_pages}</span></div>
  <div class="day-title">{date_title}</div>
  <div class="event-list">{''.join(rows)}</div>
  <div class="footer">СОНЯ ЕНОКАЕВА · t.me/sonnya_ee · sonyae.art</div>
</section>"""

def summary_page(days, by_day, start, end, city, page_no, total_pages):
    visible=[d for d in days if by_day.get(d.isoformat())]
    if not visible:
        visible=days
    cols=[]
    for d in visible:
        items=by_day.get(d.isoformat(),[])
        blocks=[]
        for e in items[:7]:
            title=html.escape(social_text(e,"social_title","title"))
            venue=html.escape(str(e.get("venue") or e.get("source") or ""))
            badge=status_label(e) or price_text(e)
            blocks.append(f"""<div class="summary-item">
  <div class="summary-time">{safe_time(e)}</div>
  <div class="summary-event-title">{title}</div>
  <div class="summary-venue">{venue}</div>
  <span class="summary-badge">{html.escape(badge)}</span>
</div>""")
        cols.append(f"""<div class="summary-col">
  <div class="summary-head">{DAYS_SHORT[d.weekday()]} {d.day}</div>
  {''.join(blocks)}
</div>""")
    range_text=f"{start.day}–{end.day} {MONTHS_LOW[end.month-1]} {end.year}"
    return f"""<section class="page summary pdf-page">
  <h1 class="summary-title">КУДА СХОДИТЬ ХУДОЖНИКУ В {city_label(city)}</h1>
  <div class="summary-range">{range_text}</div>
  <div class="summary-grid" style="grid-template-columns:repeat({max(1,len(visible))},1fr)">{''.join(cols)}</div>
  <div class="summary-footer">Составитель: Соня Енокаева · t.me/sonnya_ee · sonyae.art · {page_no}/{total_pages}</div>
</section>"""


TELEGRAM_CSS = r"""
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#fff;color:#090909}
body{font-family:Arial,Helvetica,sans-serif}
.tg-sheet{width:1080px;padding:48px 54px 44px;background:#fff}
.tg-title{font-family:Impact,"Arial Narrow",sans-serif;font-size:86px;line-height:.88;
  font-weight:900;text-transform:uppercase;letter-spacing:-1px;margin:0 0 10px}
.tg-range{font-size:25px;letter-spacing:7px;text-transform:uppercase;margin:0 0 30px}
.tg-columns{display:grid;grid-template-columns:190px 1fr 205px;gap:18px;
  border-top:3px solid #111;border-bottom:2px solid #111;padding:10px 12px;
  font-size:18px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase}
.tg-day{background:#111;color:#fff;padding:12px 14px 10px;font-size:23px;
  font-weight:900;letter-spacing:1px;text-transform:uppercase;margin-top:8px}
.tg-row{display:grid;grid-template-columns:190px 1fr 205px;gap:18px;
  border-bottom:1.5px solid #111;padding:14px 12px 15px;break-inside:avoid}
.tg-time{font-size:24px;line-height:1.08;font-weight:800}
.tg-name{font-size:25px;line-height:1.05;font-weight:900;margin-bottom:6px}
.tg-desc{font-size:18px;line-height:1.2}
.tg-price{font-size:18px;line-height:1.15;font-weight:700}
.tg-link{display:block;margin-top:7px;font-size:16px;line-height:1.15;
  color:#111;text-decoration:underline;overflow-wrap:anywhere}
.tg-footer{border-top:2px solid #111;margin-top:24px;padding-top:10px;
  font-size:15px;letter-spacing:2px;text-transform:uppercase}
@page{margin:0}
"""

def telegram_pdf_html(events, days, start, end, city):
    range_text=f"{start.day}–{end.day} {MONTHS_LOW[end.month-1]} {end.year}"
    parts=[
        '<main class="tg-sheet">',
        f'<h1 class="tg-title">КУДА СХОДИТЬ ХУДОЖНИКУ В {city_label(city)}</h1>',
        f'<div class="tg-range">{html.escape(range_text)}</div>',
        '<div class="tg-columns"><div>ДАТА / ВРЕМЯ</div><div>НАЗВАНИЕ / КРАТКО</div><div>ЦЕНА / ССЫЛКА</div></div>'
    ]
    for d in days:
        items=day_items(events,d)
        if not items:
            continue
        parts.append(f'<div class="tg-day">{DAYS_FULL[d.weekday()]} · {d.day} {MONTHS[d.month-1]}</div>')
        for e in items:
            title=html.escape(social_text(e,"social_title","title"))
            desc=html.escape(event_meta(e))
            time=html.escape(str(e.get("time") or "по программе"))
            p=html.escape(status_label(e) or price_text(e))
            url=str(e.get("url") or "").strip()
            link=f'<a class="tg-link" href="{html.escape(url, quote=True)}">ссылка на событие</a>' if url else ""
            parts.append(
                '<div class="tg-row">'
                f'<div class="tg-time">{time}</div>'
                f'<div><div class="tg-name">{title}</div><div class="tg-desc">{desc}</div></div>'
                f'<div class="tg-price">{p}{link}</div>'
                '</div>'
            )
    parts.append('<div class="tg-footer">Составила: Соня Енокаева · Telegram · Instagram · sonyae.art</div></main>')
    return '<!doctype html><meta charset="utf-8"><style>'+TELEGRAM_CSS+'</style>'+''.join(parts)

def telegram_item(e):
    title = social_text(e, "social_title", "title")
    desc = social_text(e, "social_description", "description")
    parts = []
    flag=status_label(e)
    if flag:
        parts.append(f"⚠️ {flag}")
    parts.append(f"{e.get('time') or 'по программе'} — {title}")
    place=str(e.get("venue") or e.get("source") or "").strip()
    if place:
        parts.append(f"{place} · {price_text(e)}")
    if desc:
        parts.append(desc)
    if e.get("url"):
        parts.append(str(e["url"]))
    return "\n".join(parts)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--week-start")
    ap.add_argument("--city",default="moscow")
    ap.add_argument("--events-per-day-page",type=int,default=5)
    args=ap.parse_args()

    start=datetime.strptime(args.week_start,"%Y-%m-%d").date() if args.week_start else monday(date.today()+timedelta(days=7))
    end=start+timedelta(days=6)
    days=[start+timedelta(days=i) for i in range(7)]

    db=json.loads(DB.read_text("utf-8"))
    # Social schedules are built from the site's EVENTS section only.
    # Exhibitions and open calls have their own sections and must never leak
    # into weekly event posts.
    approved=[
        e for e in db.get("events",[])
        if e.get("status")=="approved"
        and e.get("city")==args.city
        and e.get("kind")=="event"
    ]
    weekly=[e for e in approved if start.isoformat()<=str(e.get("date",""))<=end.isoformat()]
    weekly.sort(key=lambda e:(e.get("date",""),e.get("time",""),e.get("title","")))

    # The old Sheet initialized include flags to false for almost every row,
    # which made an otherwise valid weekly package blank. Approved events are
    # included by default; the editorial include flags can be reintroduced
    # later as opt-in overrides once the Sheet defaults are migrated.
    tg_week=list(weekly)
    ig_week=list(weekly)

    OUT.mkdir(parents=True,exist_ok=True)
    insta=OUT/"instagram"
    insta.mkdir(exist_ok=True)

    # Instagram uses the summary table first, followed by one or more pages per day.
    by_day={d.isoformat():day_items(ig_week,d) for d in days}
    chunks=[]
    for d in days:
        items=by_day[d.isoformat()]
        if not items:
            continue
        for offset in range(0,len(items),args.events_per_day_page):
            chunks.append((d,items[offset:offset+args.events_per_day_page],offset//args.events_per_day_page))

    total_pages=1+len(chunks)
    summary=summary_page(days,by_day,start,end,args.city,1,total_pages)
    summary_doc=f'<!doctype html><meta charset="utf-8"><style>{CSS}</style>{summary}'
    (insta/"00-summary.html").write_text(summary_doc,"utf-8")

    pdf_pages=[summary]
    for idx,(d,items,continuation) in enumerate(chunks,start=2):
        page=day_page(d,items,idx,total_pages,args.city,continuation)
        pdf_pages.append(page)
        (insta/f"{idx-1:02d}-{d.isoformat()}-{continuation+1}.html").write_text(
            f'<!doctype html><meta charset="utf-8"><style>{CSS}</style>{page}',
            "utf-8"
        )

    # Telegram gets its own long, phone-friendly table, matching the established
    # editorial PDF rather than reusing Instagram slides.
    telegram_pdf=telegram_pdf_html(tg_week,days,start,end,args.city)
    (OUT/"telegram-week.html").write_text(telegram_pdf,"utf-8")

    # Keep a plain-text Telegram fallback.
    lines=[f"КУДА СХОДИТЬ ХУДОЖНИКУ · {city_plain(args.city)} · {start.day}–{end.day} {MONTHS_LOW[end.month-1]} {end.year}",""]
    for d in days:
        items=day_items(tg_week,d)
        if not items:
            continue
        lines.append(f"{DAYS_FULL[d.weekday()].title()} · {d.day} {MONTHS_LOW[d.month-1]}")
        for e in items:
            lines.extend([telegram_item(e),""])
    (OUT/"telegram-week.txt").write_text("\n".join(lines).rstrip()+"\n","utf-8")

    # Additional text selections remain useful for channel posts.
    free=[e for e in tg_week if is_free(e)]
    (OUT/"telegram-free.txt").write_text(
        "\n\n".join(telegram_item(e) for e in free).strip()+"\n" if free else "На этой неделе бесплатных событий нет.\n",
        "utf-8"
    )

    caption=[
        f"Куда сходить художнику · {city_plain(args.city)} · {start.day}–{end.day} {MONTHS_LOW[end.month-1]} {end.year}",
        "",
        "Сводная таблица — на первом слайде, дальше расписание по дням.",
        "Полный календарь — sonyae.art/events.",
    ]
    (OUT/"instagram-caption.txt").write_text("\n".join(caption)+"\n","utf-8")

    manifest={
        "week_start":start.isoformat(),
        "week_end":end.isoformat(),
        "city":args.city,
        "instagram_pages":total_pages,
        "telegram_pdf":"telegram-week.pdf",
        "instagram_first_slide":"instagram/00-summary.png",
        "events":len(ig_week),
    }
    (OUT/"social-manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n","utf-8")
    print(f"Built editorial social package: events={len(ig_week)}, pages={total_pages}")

if __name__=="__main__":
    main()
