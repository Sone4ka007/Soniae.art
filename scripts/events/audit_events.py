#!/usr/bin/env python3
import json,re,sys
from pathlib import Path

DB=Path(__file__).resolve().parents[2]/"content/events.json"
GENERIC={"more details","see more","learn more","подробнее"}
CHILD=(
    "для детей","детский","детская","детские","семейный","семейная","семейное",
    "для всей семьи","для семей","детям","подростков","для подростков",
    "школьников","для школьников","малышей","для самых маленьких","для юных",
    "юные художники","детская студия","детская мастерская","детская лаборатория",
    "игровая","детский клуб","семейная мастерская","семейная лаборатория",
    "дети и подростки"
)
AGE_YEARS=re.compile(r"(?<!\d)(\d{1,2})\s*[-–—]\s*(\d{1,2})\s*(?:лет|года?)\b",re.I)
AGE_CONTEXT=re.compile(r"(?:возраст|дети|подростки)[^\d]{0,20}(\d{1,2})\s*[-–—]\s*(\d{1,2})",re.I)

def norm(s):
    return re.sub(r"\W+","",str(s or "").lower().replace("ё","е"))

db=json.loads(DB.read_text("utf-8"))
events=db.get("events",[])
errors=[]

seen_occ={}
seen_ex={}
for e in events:
    title=str(e.get("title","")).strip()
    if not title:
        errors.append(f"missing title: {e.get('id')}")
    if title.lower() in GENERIC:
        errors.append(f"generic title: {e.get('id')} {title}")

    url=str(e.get("url","")).strip().lower()
    occ=(e.get("city"),e.get("date"),url,norm(e.get("title")))
    if url and occ in seen_occ:
        errors.append(f"duplicate occurrence: {seen_occ[occ]} / {e.get('id')}")
    elif url:
        seen_occ[occ]=e.get("id")

    if e.get("kind")=="exhibition":
        key=url or (norm(e.get("title"))+"|"+norm(e.get("venue")))
        if key in seen_ex:
            errors.append(f"duplicate exhibition: {seen_ex[key]} / {e.get('id')}")
        else:
            seen_ex[key]=e.get("id")

    if e.get("status") in ("new","check"):
        blob=" ".join([
            str(e.get("title","")),str(e.get("description","")),str(e.get("url","")),
            str(e.get("audience_text","")),
            " ".join(str(x) for x in (e.get("categories") or []))
        ]).lower()
        m=AGE_YEARS.search(blob) or AGE_CONTEXT.search(blob)
        youth=bool(m and int(m.group(1))<18)
        if any(x in blob for x in CHILD) or youth:
            errors.append(f"child candidate not rejected: {e.get('id')} {title}")

if errors:
    print("\n".join(errors))
    print(f"AUDIT FAILED: {len(errors)} issue(s)")
    sys.exit(1)
print(f"AUDIT OK: {len(events)} records; {len(seen_ex)} exhibitions")
