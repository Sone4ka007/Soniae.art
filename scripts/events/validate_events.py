#!/usr/bin/env python3
import json,re
from datetime import date
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]; DB=ROOT/"content/events.json"

EXCLUDE=("алим велитов","alim velitov")
PLEIN=("пленэр","пленер","plein air","plein-air")
GELD=("алексей гельд","лёша гельд","леша гельд","alexey geld")

FAMILY_CHILDREN=(
    "для детей","детский","детская","детские","семейный","семейная","семейное",
    "для всей семьи","для семей","семейная программа","семейный тур",
    "детям","подростков","для подростков","школьников","для школьников",
    "малышей","для самых маленьких","родителей с детьми","взрослых и детей",
    "мама и малыш","папа и малыш","семейная йога","для юных","юные художники",
    "детская студия","детская мастерская","детская лаборатория","игровая",
    "детский клуб","семейная мастерская","семейная лаборатория"
)
AGE_CHILD_RE=re.compile(r"\b(?:для\s+детей\s*)?(?:от\s*)?(?:[3-9]|1[0-7])\s*(?:[-–—]\s*(?:[3-9]|1[0-7]))?\s*лет\b")
AGE_RANGE_RE=re.compile(r"(?<!\d)(\d{1,2})\s*[-–—]\s*(\d{1,2})\s*(?:лет|года?)\b",re.I)

OPEN_CALL_HINTS=(
    "open call","open-call","опен колл","опен-колл","конкурс","прием заявок",
    "приём заявок","заявки принимаются","дедлайн","deadline",
    "call for artists","call for entries","прием работ","приём работ"
)

TOUR_HINTS=("экскурси","медиац","медиаторск","tour")
TOUR_KEEP=(
    "кураторск","с куратором","куратор провед","кураторская экскурсия",
    "с художником","художник провед","экскурсия художника","artist-led",
    "artist led","artist tour","авторская экскурсия"
)
EXHIBITION_HINTS=("выставка","exhibition","инсталляц","installation")

def main():
    db=json.loads(DB.read_text("utf-8")); changed=0
    seen={}
    for e in db.get("events",[]):
        blob=" ".join([
            str(e.get("title","")),str(e.get("description","")),str(e.get("venue","")),
            str(e.get("source","")),str(e.get("url","")),
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
            any(str(x).lower() in ("выставка","exhibition") for x in (e.get("categories") or []))
        ):
            e["kind"]="exhibition"
        key=(e.get("date"),re.sub(r"\W+","",e.get("title","").lower()))
        problems=[]
        if not re.fullmatch(r"20\d\d-\d\d-\d\d",e.get("date","")): problems.append("invalid_date")
        if e.get("date","")[:4] != str(date.today().year): problems.append("wrong_year")
        if not str(e.get("url","")).startswith("http"): problems.append("no_primary_url")
        if key in seen: problems.append("possible_duplicate")
        else: seen[key]=e.get("id")
        editable_status=e.get("status") in ("new","check")
        if editable_status and any(x in blob for x in EXCLUDE):
            e["status"]="rejected"; e["review_reason"]="excluded_person"; changed+=1; continue
        if editable_status and any(x in blob for x in PLEIN) and not any(x in blob for x in GELD):
            e["status"]="rejected"; e["review_reason"]="excluded_plein_air"; changed+=1; continue
        age_range=AGE_RANGE_RE.search(blob)
        youth_range=bool(age_range and int(age_range.group(1)) < 18)
        if editable_status and (
            any(x in blob for x in FAMILY_CHILDREN) or AGE_CHILD_RE.search(blob) or youth_range
        ):
            e["status"]="rejected"; e["review_reason"]="excluded_family_children"; changed+=1; continue
        if editable_status and e.get("kind")=="event" and any(x in blob for x in TOUR_HINTS):
            if not any(x in blob for x in TOUR_KEEP):
                e["status"]="rejected"; e["review_reason"]="excluded_tour_mediation"; changed+=1; continue
        if problems and e.get("status")=="new":
            e["status"]="check"; e["review_reason"]=", ".join(problems); changed+=1
    # One row per exhibition/installation. Repeated calendar occurrences only
    # extend the known run period instead of creating duplicate moderation rows.
    grouped={}
    output=[]
    for e in db.get("events",[]):
        if e.get("kind")!="exhibition":
            output.append(e); continue
        key=(str(e.get("url","")).strip().lower() or
             (re.sub(r"\W+","",str(e.get("title","")).lower())+"|"+
              re.sub(r"\W+","",str(e.get("venue","")).lower())))
        grouped.setdefault(key,[]).append(e)

    for items in grouped.values():
        items=sorted(items,key=lambda x:x.get("date",""))
        rep=items[0]
        dates=[x.get("date") for x in items if re.fullmatch(r"20\d\d-\d\d-\d\d",str(x.get("date","")))]
        explicit_starts=[x.get("start_date") for x in items if re.fullmatch(r"20\d\d-\d\d-\d\d",str(x.get("start_date","")))]
        explicit_ends=[x.get("end_date") for x in items if re.fullmatch(r"20\d\d-\d\d-\d\d",str(x.get("end_date","")))]
        if explicit_starts:
            rep["start_date"]=min(explicit_starts)
        else:
            rep.pop("start_date",None)
        if explicit_ends:
            rep["end_date"]=max(explicit_ends)
        else:
            rep.pop("end_date",None)
        if dates:
            rep["date"]=min(dates)
        rep["time"]=""
        # Preserve explicit editor decisions across duplicate occurrences.
        if any(x.get("status")=="approved" for x in items):
            rep["status"]="approved"
        elif all(x.get("status")=="rejected" for x in items):
            rep["status"]="rejected"
        elif any(x.get("status")=="check" for x in items):
            rep["status"]="check"
        else:
            rep["status"]="new"
        discovered=[x.get("discovered_at") for x in items if x.get("discovered_at")]
        if discovered:
            rep["discovered_at"]=min(discovered)
        output.append(rep)

    db["events"]=sorted(output,key=lambda e:(e.get("date",""),e.get("time",""),e.get("title","")))
    DB.write_text(json.dumps(db,ensure_ascii=False,indent=2)+"\n","utf-8")
    print(f"Validation changes: {changed}; exhibitions collapsed: {sum(max(0,len(v)-1) for v in grouped.values())}")
if __name__=="__main__": main()
