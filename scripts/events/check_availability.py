#!/usr/bin/env python3
import json,re,urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date,datetime,timezone,timedelta
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
DB=ROOT/"content/events.json"
UA="Mozilla/5.0 SonyaeEventsBot/1.4 (+https://sonyae.art/events/)"

SOLD_OUT=[
    r"билетов нет",r"мест нет",r"sold\s*out",r"распродано",r"регистрация закрыта",
    r"регистрац(?:ия|ию) завершен",r"набор закрыт",r"места закончились"
]
AVAILABLE=[
    r"купить билет",r"купить билеты",r"зарегистрироваться",r"регистрация открыта",
    r"осталось \d+ мест",r"есть места",r"выбрать билет",r"оформить билет"
]
REG_HINTS=[
    r"зарегистрироваться",r"регистрация открыта",r"регистрация закрыта",
    r"регистрация обязательна",r"требуется регистрация",r"по предварительной регистрации",
    r"по предварительной записи",r"вход по регистрации"
]
TICKET_HINTS=[r"билет",r"₽",r"руб"]
OPEN_CALL_HINTS=(
    "open call","open-call","опен колл","опен-колл","конкурс","прием заявок",
    "приём заявок","подать заявку","подать проект","заявки принимаются","дедлайн",
    "deadline","call for artists","call for entries","прием работ","приём работ"
)

RU_MONTHS={
    "янв":1,"января":1,"фев":2,"февраля":2,"мар":3,"марта":3,"апр":4,"апреля":4,
    "мая":5,"май":5,"июн":6,"июня":6,"июл":7,"июля":7,"авг":8,"августа":8,
    "сен":9,"сент":9,"сентября":9,"окт":10,"октября":10,"ноя":11,"ноября":11,
    "дек":12,"декабря":12
}

def parse_run_range(text):
    m=re.search(r"(?<!\d)(\d{1,2})\.(\d{1,2})\.(\d{2,4})\s*[-–—]\s*(\d{1,2})\.(\d{1,2})\.(\d{2,4})(?!\d)",text)
    if m:
        y1=int(m.group(3)); y2=int(m.group(6))
        if y1<100: y1+=2000
        if y2<100: y2+=2000
        try:
            return date(y1,int(m.group(2)),int(m.group(1))).isoformat(), date(y2,int(m.group(5)),int(m.group(4))).isoformat()
        except ValueError:
            pass
    month_pat="|".join(sorted(RU_MONTHS,key=len,reverse=True))
    m=re.search(rf"(?<!\d)(\d{{1,2}})\s*[-–—]\s*(\d{{1,2}})\s+({month_pat})\.?\s+(20\d{{2}})",text,re.I)
    if m:
        mon=RU_MONTHS[m.group(3).lower()]
        try:
            return date(int(m.group(4)),mon,int(m.group(1))).isoformat(), date(int(m.group(4)),mon,int(m.group(2))).isoformat()
        except ValueError:
            pass
    return None,None

def fetch(url):
    req=urllib.request.Request(url,headers={"User-Agent":UA})
    with urllib.request.urlopen(req,timeout=20) as r:
        return r.read().decode("utf-8","replace")

def classify_price(e):
    text=str(e.get("price_text","")).lower()
    if e.get("price")==0 or "бесплат" in text:
        return "free"
    if e.get("price") not in (None,"","0",0):
        return "paid"
    if re.search(r"\b\d[\d\s]{0,6}\s*(?:₽|руб)",text,re.I):
        return "paid"
    return "unknown"

def inspect_url(url):
    try:
        html=fetch(url)
        text=re.sub(r"<[^>]+>"," ",html)
        text=re.sub(r"\s+"," ",text).lower()
        run_start,run_end=parse_run_range(text)
        availability="unknown"
        has_active_action=any(re.search(p,text,re.I) for p in AVAILABLE)
        hard_sold_out=any(re.search(p,text,re.I) for p in (
            r"билетов нет",r"мест нет",r"sold\s*out",r"распродано",r"места закончились"
        ))
        soft_closed=any(re.search(p,text,re.I) for p in (
            r"регистрация закрыта",r"регистрац(?:ия|ию) завершен",r"набор закрыт"
        ))
        if has_active_action:
            availability="available"
        elif hard_sold_out or soft_closed:
            availability="sold_out"
        has_reg=any(re.search(p,text,re.I) for p in REG_HINTS)
        has_ticket=any(re.search(p,text,re.I) for p in TICKET_HINTS)
        explicit_free=bool(re.search(
            r"(?:вход\s+свобод(?:ный|ен)|участие\s+бесплатн(?:ое|о)|бесплатн(?:ый|ая|ое)\s+вход|"
            r"бесплатно\s+(?:по|при)\s+(?:предварительной\s+)?регистрации)",
            text,re.I))
        numeric_paid=bool(re.search(r"\b\d[\d\s\u00a0]{0,7}\s*(?:₽|руб(?:\.|лей|ля)?)",text,re.I))
        ticket_required=bool(re.search(
            r"(?:по|по\s+входному)\s+билету|вход\s+по\s+билету|требуется\s+билет|билет\s+в\s+музей",
            text,re.I))
        buy_ticket=bool(re.search(r"купить\s+(?:билет|билеты)|приобрести\s+(?:билет|билеты)",text,re.I))
        if numeric_paid or ticket_required:
            page_price="paid"
        elif explicit_free:
            page_price="free"
        else:
            page_price="unknown"
        return availability,has_reg,has_ticket,page_price,buy_ticket,explicit_free,run_start,run_end
    except Exception:
        return "unknown",False,False,"unknown",False,False,None,None

def main():
    db=json.loads(DB.read_text("utf-8"))
    today=date.today()
    kept=[]

    for e in db.get("events",[]):
        if e.get("kind") not in ("event","exhibition","open_call"):
            e["kind"]="event"
        title_blob=str(e.get("title","")).lower()
        if any(x in title_blob for x in OPEN_CALL_HINTS):
            e["kind"]="open_call"
        elif e.get("kind") != "open_call" and (
            "выставка" in title_blob or "exhibition" in title_blob or
            "инсталляц" in title_blob or "installation" in title_blob or
            any(str(x).lower() in ("выставка","exhibition","инсталляция","installation") for x in (e.get("categories") or []))
        ):
            e["kind"]="exhibition"
        try:
            d=date.fromisoformat(e.get("date",""))
        except Exception:
            kept.append(e); continue
        horizon=today+timedelta(days=90 if e.get("kind") in ("open_call","exhibition") else 30)
        if e.get("kind")=="exhibition" and e.get("end_date"):
            try:
                end_d=date.fromisoformat(e.get("end_date"))
                start_d=date.fromisoformat(e.get("start_date") or e.get("date"))
                in_horizon=(end_d >= today and start_d <= horizon)
            except Exception:
                in_horizon=(today <= d <= horizon)
        else:
            in_horizon=(today <= d <= horizon)
        if in_horizon:
            e["price_type"]=classify_price(e)
            kept.append(e)

    urls=sorted({str(e.get("url","")) for e in kept if str(e.get("url","")).startswith("http")})
    results={}
    with ThreadPoolExecutor(max_workers=12) as pool:
        futures={pool.submit(inspect_url,u):u for u in urls}
        for fut in as_completed(futures):
            results[futures[fut]]=fut.result()

    checked=datetime.now(timezone.utc).date().isoformat()
    for e in kept:
        url=str(e.get("url",""))
        availability,has_reg,has_ticket,page_price,buy_ticket,explicit_free,run_start,run_end=results.get(
            url,("unknown",False,False,"unknown",False,False,None,None))
        e["availability"]=availability
        e["availability_checked_at"]=checked
        if e.get("kind")=="exhibition" and run_start and run_end:
            e["start_date"]=run_start
            e["end_date"]=run_end

        # Recompute price conservatively from the live event page.
        # Never keep a stale "free" classification when the page asks to buy a ticket.
        if page_price in ("free","paid"):
            e["price_type"]=page_price
        elif buy_ticket and not explicit_free:
            e["price_type"]="unknown"
        elif e.get("price_type") not in ("free","paid"):
            e["price_type"]="unknown"
        if has_reg:
            e["registration"]=True
        elif has_ticket:
            e["registration"]=False
        else:
            e["registration"]=None

    db["events"]=sorted(kept,key=lambda e:(e.get("date",""),e.get("time",""),e.get("price_type",""),e.get("title","")))
    db["updated_at"]=checked
    DB.write_text(json.dumps(db,ensure_ascii=False,indent=2)+"\n","utf-8")
    print(f"Availability checked for {len(urls)} unique pages; kept {len(kept)} records in event/open-call horizons")

if __name__=="__main__":
    main()
