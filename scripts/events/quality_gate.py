#!/usr/bin/env python3
import argparse, json, re
from datetime import date, timedelta
from pathlib import Path
from urllib.parse import urlparse

AGGREGATOR_HOSTS=("ewert.ru","curatorspace.com","artconnect.com","on-the-move.org")
BOILERPLATE=(
    "сегодня выставки и галереи закрыты",
    "магазины и кафе работают в обычном режиме",
    "доступно по пушкинской карте",
    "узнать больше",
    "русский музей является обладателем исключительных прав",
)
EVENT_ONLY_CATS={
    "лекция","концерт","встреча","экскурсия","воркшоп","мастер-класс",
    "мастер класс","кинопоказ","презентация","диалог","семинар",
    "медиаторский тур","событие","программа"
}
VALID_KINDS={"event","exhibition","open_call"}
VALID_STATUSES={"new","check","approved","rejected"}

def low(v): return str(v or "").strip().lower()

def is_aggregator_url(url):
    host=urlparse(str(url or "")).netloc.lower().removeprefix("www.")
    return any(host==x or host.endswith("."+x) for x in AGGREGATOR_HOSTS)

def clean_description(text, kind):
    s=re.sub(r"\s+"," ",str(text or "")).strip()
    s=re.sub(r"(?:Доступно по Пушкинской карте\s*Узнать больше\s*)+","",s,flags=re.I)
    if any(x in s.lower() for x in BOILERPLATE[:2]) and len(s)<260:
        return ""
    if "русский музей является обладателем исключительных прав" in s.lower():
        return ""
    if kind=="exhibition" and len(s)>420:
        cut=s[:420]
        stop=max(cut.rfind(". "),cut.rfind("! "),cut.rfind("? "))
        if stop>220: s=cut[:stop+1].strip()
        else: s=cut.rsplit(" ",1)[0].strip()+"…"
    return s

def normalize(e):
    changed=[]
    e.setdefault("categories",[])
    if not isinstance(e["categories"],list):
        e["categories"]=[x.strip() for x in str(e["categories"]).split(",") if x.strip()]
        changed.append("categories_list")

    cats=[]
    for c in e["categories"]:
        c=str(c).strip()
        if c and c not in cats: cats.append(c)
    e["categories"]=cats

    blob=" ".join([
        low(e.get("title")), low(e.get("description")), low(e.get("source")),
        low(e.get("venue")), low(e.get("url")), low(e.get("audience_text")),
        " ".join(low(x) for x in cats)
    ])

    kind=e.get("kind") if e.get("kind") in VALID_KINDS else "event"
    is_open = kind=="open_call" or "open-call" in [low(x) for x in cats] or any(x in low(e.get("title")) for x in ("open call","опен-колл","опен колл"))
    is_exh = (
        kind=="exhibition" or
        any(low(x) in ("выставка","exhibition") for x in cats) or
        "/exhibitions/" in low(e.get("url")) or
        bool(re.search(r"тип:\s*(?:выставка|инсталляция)\b",str(e.get("audience_text","")),re.I))
    )
    new_kind="open_call" if is_open else ("exhibition" if is_exh else "event")
    if kind!=new_kind:
        e["kind"]=new_kind; changed.append("kind")
    else:
        e["kind"]=kind

    if e["kind"]=="exhibition":
        clean_cats=[c for c in e["categories"] if low(c) not in EVENT_ONLY_CATS]
        if not any(low(c) in ("выставка","exhibition") for c in clean_cats):
            clean_cats.append("выставка")
        if clean_cats!=e["categories"]:
            e["categories"]=clean_cats; changed.append("exhibition_categories")
        if not e.get("start_date") and re.fullmatch(r"20\d\d-\d\d-\d\d",str(e.get("date",""))):
            e["start_date"]=e["date"]; changed.append("start_date")
    elif e["kind"]=="open_call":
        if "open-call" not in [low(c) for c in e["categories"]]:
            e["categories"].append("open-call"); changed.append("open_call_category")

    price=e.get("price")
    try:
        if price not in (None,""):
            p=float(price)
            wanted="free" if p==0 else "paid"
            if e.get("price_type")!=wanted:
                e["price_type"]=wanted; changed.append("price_type")
    except Exception:
        pass
    pt=low(e.get("price_text"))
    if ("бесплат" in pt or "вход свобод" in pt) and e.get("price_type")!="free":
        e["price_type"]="free"; changed.append("price_type_text")
    if re.search(r"по\s+регистрац|нужна\s+регистрац|регистрация\s+на\s+вход",pt+" "+low(e.get("audience_text"))) and e.get("registration") is not True:
        e["registration"]=True; changed.append("registration")

    desc=clean_description(e.get("description"),e["kind"])
    if desc!=e.get("description",""):
        e["description"]=desc; changed.append("description")

    if e["kind"]=="open_call" and e.get("status") in ("new","check") and (
        is_aggregator_url(e.get("url")) or any(x in low(e.get("source")) for x in ("ewert","curatorspace","artconnect","on the move"))
    ):
        e["status"]="check"
        e["review_reason"]="primary_source_required"
        changed.append("open_call_primary_source")

    if e.get("status") not in VALID_STATUSES:
        e["status"]="check"; changed.append("status")
    return changed

def stale(e,today):
    try:
        if e.get("kind")=="exhibition":
            end=e.get("end_date")
            if end: return date.fromisoformat(end)<today
            start=e.get("start_date") or e.get("date")
            return bool(start and date.fromisoformat(start)<today-timedelta(days=365))
        d=e.get("date")
        return bool(d and date.fromisoformat(d)<today)
    except Exception:
        return False

def run(path,fix=False,strict=False):
    p=Path(path)
    db=json.loads(p.read_text("utf-8"))
    changed=0
    errors=[]
    for e in db.get("events",[]):
        changed+=bool(normalize(e))

    # Do not treat a shared museum/homepage URL as a duplicate by itself.
    # Duplicate detection is conservative: same normalized title + venue/source.
    groups={}
    for e in db.get("events",[]):
        if e.get("status")!="approved": continue
        key=(
            re.sub(r"\W+","",low(e.get("title"))),
            re.sub(r"\W+","",low(e.get("venue") or e.get("source")))
        )
        if key[0]:
            groups.setdefault(key,[]).append(e)
    for key,items in groups.items():
        if len(items)<=1: continue
        # Multiple dated occurrences of the same normal event are allowed.
        if all(e.get("kind")=="event" for e in items):
            continue
        items.sort(key=lambda e:(0 if str(e.get("id","")).startswith("manual-") else 1, low(e.get("id"))))
        for e in items[1:]:
            e["status"]="rejected"
            e["review_reason"]="duplicate_record"
            changed+=1

    ids=set()
    today=date.today()
    for e in db.get("events",[]):
        rid=e.get("id")
        if not rid: errors.append("missing id")
        elif rid in ids: errors.append(f"duplicate id: {rid}")
        else: ids.add(rid)
        if e.get("status")=="approved":
            if not str(e.get("url","")).startswith("http"): errors.append(f"approved without url: {rid}")
            if not e.get("title"): errors.append(f"approved without title: {rid}")
            if e.get("kind")=="exhibition" and not any(low(c) in ("выставка","exhibition") for c in e.get("categories",[])):
                errors.append(f"exhibition/category mismatch: {rid}")
            # An editor-approved record is durable even when the current URL is
            # still an aggregator discovery link. The source can be improved
            # later without unpublishing the approved opportunity.

    db["events"]=sorted(db.get("events",[]),key=lambda e:(e.get("date",""),e.get("time",""),e.get("title","")))
    if fix:
        p.write_text(json.dumps(db,ensure_ascii=False,indent=2)+"\n","utf-8")
    print(f"quality_gate: {len(db.get('events',[]))} records; normalized={changed}; errors={len(errors)}")
    for err in errors[:50]: print("ERROR",err)
    if strict and errors: raise SystemExit(1)

if __name__=="__main__":
    ap=argparse.ArgumentParser()
    ap.add_argument("path",nargs="?",default="content/events.json")
    ap.add_argument("--fix",action="store_true")
    ap.add_argument("--strict",action="store_true")
    args=ap.parse_args()
    run(args.path,args.fix,args.strict)
