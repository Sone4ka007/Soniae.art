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
    "мама и малыш","папа и малыш","семейная йога"
)
AGE_CHILD_RE=re.compile(r"\b(?:для\s+детей\s*)?(?:от\s*)?(?:[3-9]|1[0-7])\s*(?:[-–—]\s*(?:[3-9]|1[0-7]))?\s*лет\b")

def main():
    db=json.loads(DB.read_text("utf-8")); changed=0
    seen={}
    for e in db.get("events",[]):
        blob=" ".join(str(e.get(k,"")) for k in ("title","description","venue","source")).lower()
        key=(e.get("date"),re.sub(r"\W+","",e.get("title","").lower()))
        problems=[]
        if not re.fullmatch(r"20\d\d-\d\d-\d\d",e.get("date","")): problems.append("invalid_date")
        if e.get("date","")[:4] != str(date.today().year): problems.append("wrong_year")
        if not str(e.get("url","")).startswith("http"): problems.append("no_primary_url")
        if key in seen: problems.append("possible_duplicate")
        else: seen[key]=e.get("id")
        if any(x in blob for x in EXCLUDE):
            e["status"]="rejected"; e["review_reason"]="excluded_person"; changed+=1; continue
        if any(x in blob for x in PLEIN) and not any(x in blob for x in GELD):
            e["status"]="rejected"; e["review_reason"]="excluded_plein_air"; changed+=1; continue
        if e.get("status") in ("new","check") and (
            any(x in blob for x in FAMILY_CHILDREN) or AGE_CHILD_RE.search(blob)
        ):
            e["status"]="rejected"; e["review_reason"]="excluded_family_children"; changed+=1; continue
        if problems and e.get("status")=="new":
            e["status"]="check"; e["review_reason"]=", ".join(problems); changed+=1
    DB.write_text(json.dumps(db,ensure_ascii=False,indent=2)+"\n","utf-8")
    print(f"Validation changes: {changed}")
if __name__=="__main__": main()
