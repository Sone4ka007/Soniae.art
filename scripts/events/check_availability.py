#!/usr/bin/env python3
import json,re,urllib.request
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
REG_HINTS=[r"регистрац",r"зарегистр",r"по предварительной записи",r"по записи"]
TICKET_HINTS=[r"билет",r"₽",r"руб"]

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

def main():
    db=json.loads(DB.read_text("utf-8"))
    today=date.today()
    horizon=today+timedelta(days=30)
    kept=[]
    for e in db.get("events",[]):
        try:
            d=date.fromisoformat(e.get("date",""))
        except Exception:
            kept.append(e); continue
        if d < today or d > horizon:
            continue

        e["price_type"]=classify_price(e)
        e["availability"]="unknown"
        e["availability_checked_at"]=datetime.now(timezone.utc).date().isoformat()

        url=str(e.get("url",""))
        if not url.startswith("http"):
            kept.append(e); continue

        try:
            html=fetch(url)
            text=re.sub(r"<[^>]+>"," ",html)
            text=re.sub(r"\s+"," ",text).lower()
        except Exception:
            kept.append(e); continue

        if any(re.search(p,text,re.I) for p in SOLD_OUT):
            e["availability"]="sold_out"
        elif any(re.search(p,text,re.I) for p in AVAILABLE):
            e["availability"]="available"

        if e.get("registration") is None:
            if any(re.search(p,text,re.I) for p in REG_HINTS):
                e["registration"]=True
            elif any(re.search(p,text,re.I) for p in TICKET_HINTS):
                e["registration"]=False

        kept.append(e)

    db["events"]=sorted(kept,key=lambda e:(e.get("date",""),e.get("time",""),e.get("price_type",""),e.get("title","")))
    db["updated_at"]=datetime.now(timezone.utc).date().isoformat()
    DB.write_text(json.dumps(db,ensure_ascii=False,indent=2)+"\n","utf-8")
    print(f"Availability checked; kept {len(kept)} events in 30-day horizon")

if __name__=="__main__":
    main()
