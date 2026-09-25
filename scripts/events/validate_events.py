#!/usr/bin/env python3
import json,re
from datetime import date
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]; DB=ROOT/"content/events.json"

EXCLUDE=("алим велитов","alim velitov")
STALE_EXACT_TITLES=(
    "специальный показ с the blueprint. сделано в милане: история армани и итальянской моды",
)
PLEIN=("пленэр","пленер","plein air","plein-air")
GELD=("алексей гельд","лёша гельд","леша гельд","alexey geld")

KNOWN_CHILD_EVENT_HINTS=(
    "а и б сидели на трубе",
    "a-and-b-were-sitting-on-a-pipe"
)

FAMILY_CHILDREN=(
    "для детей","детский","детская","детские","семейный","семейная","семейное",
    "для всей семьи","для семей","семейная программа","семейный тур",
    "детям","подростков","для подростков","школьников","для школьников",
    "малышей","для самых маленьких","родителей с детьми","взрослых и детей",
    "мама и малыш","папа и малыш","семейная йога"
)
AGE_CHILD_RE=re.compile(r"\b(?:для\s+детей\s*)?(?:от\s*)?(?:[3-9]|1[0-7])\s*(?:[-–—]\s*(?:[3-9]|1[0-7]))?\s*лет\b")

OPEN_CALL_HINTS=(
    "open call","open-call","опен колл","опен-колл","конкурс","прием заявок",
    "приём заявок","заявки принимаются","дедлайн","deadline",
    "call for artists","call for entries","прием работ","приём работ"
)

PAY_TO_PLAY_HINTS=(
    "application fee","submission fee","entry fee","participation fee","exhibition fee",
    "registration fee","artist fee","selected artists pay","selected artist pays",
    "fee after selection","pay after selection","upon selection",
    "fee for successful artists","fee for successful artist",
    "successful artists pay","successful artist pays",
    "взнос за участие","регистрационный взнос","вступительный взнос",
    "оплата участия","платное участие","после отбора необходимо оплатить",
    "после отбора нужно оплатить","участники оплачивают","отобранные участники оплачивают"
)
MARKET_FEE_HINTS=(
    "маркет","ярмарка","art fair","art market","market",
    "стенд","место участника","место на маркете","table fee","booth fee","stand fee"
)
# Paid calls are exceptional only when the exact programme is explicitly trusted.
# Generic words such as "international competition", "award" or "biennale" are not
# evidence of authority on their own.
PRESTIGE_WHITELIST_HINTS=(
    "tokyo biennale",
    "токийская биеннале",
    "la biennale di venezia",
    "venice biennale",
    "prix ars electronica",
    "sony world photography awards",
    "world press photo",
)

TOUR_HINTS=("экскурси","медиац","медиаторск","tour")
TOUR_KEEP=(
    "кураторск","с куратором","куратор провед","кураторская экскурсия",
    "с художником","художник провед","экскурсия художника","artist-led",
    "artist led","artist tour","авторская экскурсия"
)
EXHIBITION_HINTS=("выставка","exhibition")

HARD_DROP_URLS={
    "https://ges-2.org/concert-hall",
    "https://ges-2.org/programme",
}

GES2_MASTERCLASS_HINTS=("мастер-класс","мастер класс","workshop","воркшоп")
GES2_FILM_HINTS=("кинопоказ","показ фильма","кинотеатр","screening","film")
GES2_FILM_FESTIVAL_HINTS=("кинофестиваль","фестиваль кино","фестиваль фильмов","film festival","фестиваля фильмов")

GES2_LOW_VALUE_HINTS=(
    "ниже травы. игровая",
    "ателье. самостоятельная работа",
    "индивидуальный медиаторский тур",
    "знакомство с домом культуры «гэс-2»",
    "знакомство с домом культуры \"гэс-2\"",
    "семейная йога",
    "лесные человечки",
    "почва для размышлений",
)

def main():
    db=json.loads(DB.read_text("utf-8")); changed=0
    seen={}
    for e in db.get("events",[]):
        blob=" ".join([
            str(e.get("title","")),str(e.get("description","")),str(e.get("venue","")),
            str(e.get("source","")),str(e.get("url","")),
            str(e.get("price_text","")),str(e.get("audience_text","")),
            " ".join(str(x) for x in (e.get("categories") or []))
        ]).lower()
        if e.get("kind") not in ("event","exhibition","open_call"):
            e["kind"]="event"
        title_blob=str(e.get("title","")).lower()
        if any(x in title_blob for x in OPEN_CALL_HINTS):
            e["kind"]="open_call"
            cats=e.get("categories") or []
            if "open-call" not in cats:
                e["categories"]=list(cats)+["open-call"]
        elif e.get("kind") != "open_call" and (
            any(x in title_blob for x in EXHIBITION_HINTS) or
            any(str(x).lower() in ("выставка","exhibition") for x in (e.get("categories") or [])) or
            (
                ("гэс-2" in blob or "ges-2.org" in blob) and
                re.search(r"тип:\s*(?:выставка|инсталляция)\b", str(e.get("audience_text","")), re.I)
            )
        ):
            e["kind"]="exhibition"
            cats=e.get("categories") or []
            if not any(str(x).lower() in ("выставка","exhibition") for x in cats):
                e["categories"]=list(cats)+["выставка"]
        key=(e.get("date"),re.sub(r"\W+","",e.get("title","").lower()))
        problems=[]
        if not re.fullmatch(r"20\d\d-\d\d-\d\d",e.get("date","")): problems.append("invalid_date")
        if e.get("date","")[:4] != str(date.today().year): problems.append("wrong_year")
        if not str(e.get("url","")).startswith("http"): problems.append("no_primary_url")
        if key in seen: problems.append("possible_duplicate")
        else: seen[key]=e.get("id")
        editable_status=e.get("status") in ("new","check")
        if editable_status and title_blob in STALE_EXACT_TITLES:
            e["status"]="rejected"; e["review_reason"]="excluded_stale_event"; changed+=1; continue
        if editable_status and (
            ("гэс-2" in blob or "ges-2.org" in blob) and
            any(x in blob for x in GES2_MASTERCLASS_HINTS)
        ):
            e["status"]="rejected"; e["review_reason"]="excluded_ges2_masterclass"; changed+=1; continue
        if editable_status and (
            ("гэс-2" in blob or "ges-2.org" in blob) and
            any(x in title_blob for x in GES2_LOW_VALUE_HINTS)
        ):
            e["status"]="rejected"; e["review_reason"]="excluded_ges2_low_value"; changed+=1; continue
        if editable_status and e.get("kind")=="event" and (
            ("гэс-2" in blob or "ges-2.org" in blob) and
            any(x in blob for x in GES2_FILM_HINTS) and
            not any(x in blob for x in GES2_FILM_FESTIVAL_HINTS)
        ):
            e["status"]="rejected"; e["review_reason"]="excluded_ges2_nonfestival_screening"; changed+=1; continue
        if editable_status and any(x in blob for x in EXCLUDE):
            e["status"]="rejected"; e["review_reason"]="excluded_person"; changed+=1; continue
        if editable_status and any(x in blob for x in PLEIN) and not any(x in blob for x in GELD):
            e["status"]="rejected"; e["review_reason"]="excluded_plein_air"; changed+=1; continue
        if editable_status and (
            any(x in blob for x in FAMILY_CHILDREN) or
            any(x in blob for x in KNOWN_CHILD_EVENT_HINTS) or
            AGE_CHILD_RE.search(blob)
        ):
            e["status"]="rejected"; e["review_reason"]="excluded_family_children"; changed+=1; continue
        if editable_status and e.get("kind")=="event" and any(x in blob for x in TOUR_HINTS):
            if not any(x in blob for x in TOUR_KEEP):
                e["status"]="rejected"; e["review_reason"]="excluded_tour_mediation"; changed+=1; continue
        if editable_status and e.get("kind")=="open_call":
            paid_call=(e.get("price_type")=="paid" or any(x in blob for x in PAY_TO_PLAY_HINTS))
            if paid_call:
                if any(x in blob for x in MARKET_FEE_HINTS):
                    e["status"]="check"; e["review_reason"]="paid_market_fee_exception_review"; changed+=1; continue
                if any(x in blob for x in PRESTIGE_WHITELIST_HINTS):
                    e["status"]="check"; e["review_reason"]="paid_prestigious_call_exception_review"; changed+=1; continue
                e["status"]="rejected"; e["review_reason"]="excluded_paid_open_call"; changed+=1; continue
        if problems and e.get("status")=="new":
            e["status"]="check"; e["review_reason"]=", ".join(problems); changed+=1
    before_drop=len(db.get("events",[]))
    db["events"]=[e for e in db.get("events",[]) if str(e.get("url","")).strip().lower() not in HARD_DROP_URLS]
    hard_dropped=before_drop-len(db["events"])
    DB.write_text(json.dumps(db,ensure_ascii=False,indent=2)+"\n","utf-8")
    print(f"Validation changes: {changed}; hard-dropped: {hard_dropped}")
if __name__=="__main__": main()
