#!/usr/bin/env python3
import argparse, json, html
from datetime import date, datetime, timedelta
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
DB=ROOT/"content/events.json"; OUT=ROOT/"dist/events-weekly"
MONTHS=["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"]
DAYS=["ПОНЕДЕЛЬНИК","ВТОРНИК","СРЕДА","ЧЕТВЕРГ","ПЯТНИЦА","СУББОТА","ВОСКРЕСЕНЬЕ"]

def esc(x): return html.escape(str(x or ""))
def monday(d): return d-timedelta(days=d.weekday())
def price(e):
    if e.get("price")==0: return "БЕСПЛАТНО"
    if e.get("price_text"): return str(e["price_text"])
    if e.get("price") not in (None,""): return f'{e["price"]} ₽'
    return "ЦЕНА НА САЙТЕ"

def card(e):
    reg=" · РЕГИСТРАЦИЯ" if e.get("registration") else ""
    return f'''<article class="event">
      <div class="time">{esc(e.get("time") or "—")}</div>
      <div class="event-body"><h3>{esc(e.get("title"))}</h3>
      <p>{esc(e.get("venue"))}{(" · "+esc(e.get("address"))) if e.get("address") else ""}</p>
      <p class="desc">{esc(e.get("description"))}</p></div>
      <div class="price">{esc(price(e))}{reg}</div>
    </article>'''

CSS='''@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;color:#0b0b0b;background:#fff;font-family:Arial,Helvetica,sans-serif}.sheet{width:210mm;min-height:297mm;padding:12mm}.mast{border-bottom:3px solid #111;padding-bottom:7mm;margin-bottom:7mm}.mast .k{font-size:10pt;font-weight:700}.mast h1{font-size:40pt;line-height:.82;letter-spacing:-2px;margin:5mm 0 2mm;font-weight:900}.mast p{margin:0;font-size:11pt}.day{margin:0 0 6mm;break-inside:avoid}.day-head{background:#111;color:#fff;padding:2.5mm 3mm;display:flex;justify-content:space-between;font-weight:900;font-size:10pt}.event{display:grid;grid-template-columns:18mm 1fr 35mm;gap:4mm;border-bottom:1px solid #111;padding:3mm 0}.time{font-weight:900}.event h3{margin:0 0 1.5mm;font-size:15pt;line-height:1}.event p{margin:0;font-size:8.5pt;line-height:1.25}.event .desc{margin-top:1.5mm;color:#333}.price{font-size:7.5pt;font-weight:700;text-align:right}.carousel{width:1080px;height:1350px;padding:70px;background:#fff;overflow:hidden}.carousel .mast h1{font-size:104px}.carousel .mast p{font-size:27px}.carousel .day-head{font-size:26px;padding:18px 20px}.carousel .event{grid-template-columns:110px 1fr 190px;padding:22px 0;gap:20px}.carousel .time{font-size:26px}.carousel .event h3{font-size:38px}.carousel .event p{font-size:21px}.carousel .price{font-size:18px}'''

def main():
    ap=argparse.ArgumentParser(); ap.add_argument("--week-start"); ap.add_argument("--city",default="moscow"); args=ap.parse_args()
    start=datetime.strptime(args.week_start,"%Y-%m-%d").date() if args.week_start else monday(date.today()+timedelta(days=7))
    end=start+timedelta(days=6)
    db=json.loads(DB.read_text("utf-8"))
    events=[e for e in db.get("events",[]) if e.get("status")=="approved" and e.get("city")==args.city and start.isoformat()<=e.get("date","")<=end.isoformat()]
    events.sort(key=lambda e:(e.get("date",""),e.get("time",""),e.get("title","")))
    OUT.mkdir(parents=True,exist_ok=True)
    city="Москва" if args.city=="moscow" else "Петербург"
    range_text=f"{start.day}–{end.day} {MONTHS[end.month-1]} {end.year}"
    days=[]
    for i in range(7):
        d=start+timedelta(days=i); items=[e for e in events if e.get("date")==d.isoformat()]
        if not items: continue
        days.append((d,items))
    body=''.join(f'<section class="day"><div class="day-head"><span>{DAYS[d.weekday()]}</span><span>{d.day} {MONTHS[d.month-1]}</span></div>{"".join(card(e) for e in items)}</section>' for d,items in days)
    doc=f'<!doctype html><meta charset="utf-8"><style>{CSS}</style><main class="sheet"><header class="mast"><div class="k">СОНЯ ЕНОКАЕВА · СОБЫТИЯ ДЛЯ ХУДОЖНИКОВ</div><h1>КУДА СХОДИТЬ<br>ХУДОЖНИКУ</h1><p>{city} · {range_text}</p></header>{body}</main>'
    (OUT/"weekly.html").write_text(doc,"utf-8")
    carousel=OUT/"carousel"; carousel.mkdir(exist_ok=True)
    cover=f'<!doctype html><meta charset="utf-8"><style>{CSS}</style><main class="carousel"><header class="mast"><div class="k">СОНЯ ЕНОКАЕВА · {city.upper()}</div><h1>КУДА<br>СХОДИТЬ<br>ХУДОЖНИКУ</h1><p>{range_text}</p></header></main>'
    (carousel/"00-cover.html").write_text(cover,"utf-8")
    for idx,(d,items) in enumerate(days,1):
        page=f'<!doctype html><meta charset="utf-8"><style>{CSS}</style><main class="carousel"><section class="day"><div class="day-head"><span>{DAYS[d.weekday()]}</span><span>{d.day} {MONTHS[d.month-1]}</span></div>{"".join(card(e) for e in items)}</section></main>'
        (carousel/f"{idx:02d}-{d.isoformat()}.html").write_text(page,"utf-8")
    lines=[f"КУДА СХОДИТЬ ХУДОЖНИКУ\n{city} · {range_text}\n"]
    for d,items in days:
        lines.append(f"\n{d.day} {MONTHS[d.month-1]}, {DAYS[d.weekday()].title()}")
        for e in items:
            lines.append(f"\n{e.get('time') or '—'} — {e.get('title')}\n{e.get('venue','')} · {price(e)}\n{e.get('url','')}")
    (OUT/"telegram.txt").write_text("\n".join(lines).strip()+"\n","utf-8")
    (OUT/"manifest.json").write_text(json.dumps({"week_start":start.isoformat(),"week_end":end.isoformat(),"city":args.city,"count":len(events)},ensure_ascii=False,indent=2)+"\n","utf-8")
    print(f"Built weekly package: {len(events)} approved events, {start}..{end}")

if __name__=="__main__": main()
