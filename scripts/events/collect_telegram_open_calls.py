#!/usr/bin/env python3
import hashlib
import html as html_mod
import json
import os
import re
import sys
from datetime import date, datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup

ROOT=Path(__file__).resolve().parents[2]
DB=ROOT/"content/events.json"

TOKEN=os.getenv("TELEGRAM_OPEN_CALLS_BOT_TOKEN","").strip()
ALLOWED_CHAT=os.getenv("TELEGRAM_OPEN_CALLS_CHAT_ID","").strip()
API_BASE=f"https://api.telegram.org/bot{TOKEN}" if TOKEN else ""

MONTHS={
    "января":1,"январь":1,"янв":1,
    "февраля":2,"февраль":2,"фев":2,
    "марта":3,"март":3,"мар":3,
    "апреля":4,"апрель":4,"апр":4,
    "мая":5,"май":5,
    "июня":6,"июнь":6,"июн":6,
    "июля":7,"июль":7,"июл":7,
    "августа":8,"август":8,"авг":8,
    "сентября":9,"сентябрь":9,"сен":9,"сент":9,
    "октября":10,"октябрь":10,"окт":10,
    "ноября":11,"ноябрь":11,"ноя":11,
    "декабря":12,"декабрь":12,"дек":12,
}
MONTH_RE="|".join(sorted((re.escape(x) for x in MONTHS),key=len,reverse=True))
UA="Mozilla/5.0 SonyaeEventsBot/1.5 (+https://sonyae.art/events/)"

def clean(v):
    return re.sub(r"\s+"," ",str(v or "")).strip()

def parse_date_token(day,month,year=None):
    try:
        y=int(year or date.today().year)
        d=date(y,int(month),int(day))
        if not year and d < date.today() and (date.today()-d).days > 60:
            d=date(y+1,int(month),int(day))
        return d
    except Exception:
        return None

def parse_deadline(text):
    t=clean(text).lower().replace("ё","е")
    patterns=[
        rf"(?:deadline|дедлайн|прием заявок до|приём заявок до|прием работ до|приём работ до|заявки до|подать(?:ся)? до|до)\s*[:—–-]?\s*(\d{{1,2}})\s+({MONTH_RE})\.?\s*(20\d{{2}})?",
        r"(?:deadline|дедлайн|до)\s*[:—–-]?\s*(\d{1,2})[./](\d{1,2})(?:[./](20\d{2}))?",
    ]
    m=re.search(patterns[0],t,re.I)
    if m:
        return parse_date_token(m.group(1),MONTHS[m.group(2)],m.group(3))
    m=re.search(patterns[1],t,re.I)
    if m:
        return parse_date_token(m.group(1),m.group(2),m.group(3))
    # If the whole post is clearly about an open call, accept the nearest
    # future explicit date as a fallback.
    if re.search(r"open\s*call|опен[- ]?колл|при[её]м заявок|конкурс",t,re.I):
        m=re.search(rf"(?<!\d)(\d{{1,2}})\s+({MONTH_RE})\.?\s*(20\d{{2}})?",t,re.I)
        if m:
            return parse_date_token(m.group(1),MONTHS[m.group(2)],m.group(3))
        m=re.search(r"(?<!\d)(\d{1,2})[./](\d{1,2})(?:[./](20\d{2}))?(?!\d)",t)
        if m:
            return parse_date_token(m.group(1),m.group(2),m.group(3))
    return None

def urls_from_message(msg,text):
    urls=[]
    entities=(msg.get("entities") or [])+(msg.get("caption_entities") or [])
    # Telegram entity offsets are UTF-16 based; direct slicing is unreliable
    # for emoji-heavy text. Prefer explicit text_link URLs and regex scanning.
    for ent in entities:
        if ent.get("type")=="text_link" and ent.get("url"):
            urls.append(ent["url"])
    urls += re.findall(r"https?://[^\s<>()\]\[{}]+", text or "")
    out=[]
    for u in urls:
        u=html_mod.unescape(u).rstrip(".,;:!?)]}")
        if u not in out:
            out.append(u)
    return out

def choose_primary(urls):
    for u in urls:
        host=urlparse(u).netloc.lower().removeprefix("www.")
        if host and host not in {"t.me","telegram.me"}:
            return u
    return urls[0] if urls else ""

def fetch_page(url):
    if not url:
        return "",""
    try:
        r=requests.get(url,headers={"User-Agent":UA,"Accept-Language":"ru,en;q=0.8"},timeout=20,allow_redirects=True)
        r.raise_for_status()
        soup=BeautifulSoup(r.text,"html.parser")
        title=""
        og=soup.find("meta",attrs={"property":"og:title"})
        if og and og.get("content"):
            title=clean(og["content"])
        if not title:
            h=soup.find("h1") or soup.find("h2")
            if h: title=clean(h.get_text(" ",strip=True))
        if not title and soup.title:
            title=clean(soup.title.get_text(" ",strip=True))
        body=clean(soup.get_text(" ",strip=True))
        return title,body[:6000]
    except Exception as exc:
        print(f"WARN telegram linked page {url}: {exc}",file=sys.stderr)
        return "",""

def infer_city(text):
    t=clean(text).lower()
    if re.search(r"санкт[- ]?петербург|петербург|\bспб\b|saint petersburg|st\. petersburg",t):
        return "spb"
    if re.search(r"\bмоскв|\bmoscow\b",t):
        return "moscow"
    if re.search(r"\bросси|\brussia\b|\brussian\b",t):
        return "russia"
    return "international"

def title_from(text,page_title):
    lines=[clean(x) for x in str(text or "").splitlines() if clean(x)]
    skip=re.compile(r"^(open\s*call|опен[- ]?колл|дедлайн|deadline)\s*[:—–-]?$",re.I)
    for line in lines[:8]:
        if len(line)>=7 and not skip.match(line) and not line.startswith("http"):
            return line[:220]
    return clean(page_title)[:220] or "Open call из Telegram"

def stable_id(chat_id,message_id):
    raw=f"{chat_id}|{message_id}".encode("utf-8")
    return "telegram-open-call-"+hashlib.sha1(raw).hexdigest()[:16]

def telegram_post_url(msg):
    chat=msg.get("chat") or {}
    username=chat.get("username")
    mid=msg.get("message_id")
    if username and mid:
        return f"https://t.me/{username}/{mid}"
    return ""

def get_updates():
    r=requests.get(API_BASE+"/getUpdates",params={
        "timeout":0,
        "limit":100,
        "allowed_updates":json.dumps(["message","channel_post","edited_message","edited_channel_post"]),
    },timeout=30)
    r.raise_for_status()
    data=r.json()
    if not data.get("ok"):
        raise RuntimeError(data)
    return data.get("result",[])

def acknowledge(max_update_id):
    if max_update_id is None:
        return
    try:
        requests.get(API_BASE+"/getUpdates",params={"offset":max_update_id+1,"limit":1,"timeout":0},timeout=20).raise_for_status()
    except Exception as exc:
        print(f"WARN unable to acknowledge Telegram updates: {exc}",file=sys.stderr)

def main():
    if not TOKEN:
        print("Telegram open-call source disabled: TELEGRAM_OPEN_CALLS_BOT_TOKEN is not configured.")
        return

    db=json.loads(DB.read_text("utf-8"))
    events=db.get("events",[])
    ids={e.get("id") for e in events}
    updates=get_updates()
    max_update=max((u.get("update_id",-1) for u in updates),default=None)

    if not ALLOWED_CHAT:
        observed={}
        for upd in updates:
            msg=upd.get("message") or upd.get("channel_post") or upd.get("edited_message") or upd.get("edited_channel_post") or {}
            chat=msg.get("chat") or {}
            if chat.get("id") is not None:
                observed[str(chat["id"])]=chat.get("title") or chat.get("username") or chat.get("type")
        if observed:
            print("Telegram open-call bootstrap: set TELEGRAM_OPEN_CALLS_CHAT_ID to one of:")
            for cid,label in observed.items():
                print(f"  {cid}  {label}")
        else:
            print("Telegram open-call bootstrap: no messages seen yet. Add the bot to the source chat and send/forward one message.")
        # Do not acknowledge bootstrap messages: the first configured run can ingest them.
        return

    added=0
    skipped=0
    for upd in updates:
        msg=upd.get("message") or upd.get("channel_post") or upd.get("edited_message") or upd.get("edited_channel_post") or {}
        chat=msg.get("chat") or {}
        if str(chat.get("id","")) != ALLOWED_CHAT:
            continue
        mid=msg.get("message_id")
        if mid is None:
            continue
        rid=stable_id(ALLOWED_CHAT,mid)
        if rid in ids:
            continue

        text=(msg.get("text") or msg.get("caption") or "").strip()
        urls=urls_from_message(msg,text)
        primary=choose_primary(urls)
        page_title,page_text=fetch_page(primary)
        deadline=parse_deadline(text) or parse_deadline(page_text)
        if not deadline or deadline < date.today():
            print(f"SKIP telegram message {mid}: no current deadline found")
            skipped+=1
            continue

        combined=clean((text+" "+page_text[:1800]).strip())
        title=title_from(text,page_title)
        city=infer_city(combined)
        post_url=telegram_post_url(msg)
        source_url=primary or post_url
        description=clean(text)
        if primary and primary not in description:
            description=clean(description+" "+primary)
        if len(description)>1200:
            description=description[:1197].rstrip()+"..."

        paid=bool(re.search(r"(application|submission|entry|participation|registration)\s+fee|взнос за участие|регистрационный взнос|платное участие",combined,re.I))
        ev={
            "id":rid,
            "status":"check",
            "kind":"open_call",
            "city":city,
            "date":deadline.isoformat(),
            "start_date":"",
            "end_date":"",
            "time":"",
            "title":title,
            "venue":"",
            "address":"",
            "price":None,
            "price_text":"",
            "price_type":"paid" if paid else "unknown",
            "registration":None,
            "availability":"unknown",
            "availability_checked_at":"",
            "categories":["open-call"],
            "description":description,
            "url":source_url,
            "source":"Соня — Telegram open calls",
            "checked_at":"",
            "review_reason":"telegram_manual_discovery",
            "editor_note":"Найдено в личном Telegram-чате Сони; требуется редакторская проверка и подтверждение первоисточника.",
            "discovered_at":datetime.now(timezone.utc).date().isoformat(),
            "reviewed_at":"",
        }
        events.append(ev)
        ids.add(rid)
        added+=1

    db["events"]=sorted(events,key=lambda e:(e.get("date",""),e.get("time",""),e.get("title","")))
    db["updated_at"]=datetime.now(timezone.utc).date().isoformat()
    DB.write_text(json.dumps(db,ensure_ascii=False,indent=2)+"\n","utf-8")
    acknowledge(max_update)
    print(f"Telegram open calls: added={added}; skipped_without_deadline={skipped}; updates={len(updates)}")

if __name__=="__main__":
    main()
