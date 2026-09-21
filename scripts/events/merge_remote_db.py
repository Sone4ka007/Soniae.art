#!/usr/bin/env python3
import json, re, sys
from datetime import date, timedelta
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

generated_path=Path(sys.argv[1])
remote_path=Path(sys.argv[2])
out_path=Path(sys.argv[3])
root=Path(__file__).resolve().parents[2]
curated_path=root/"content/events_curated.json"

generated=json.loads(generated_path.read_text("utf-8"))
remote=json.loads(remote_path.read_text("utf-8"))
curated=json.loads(curated_path.read_text("utf-8")) if curated_path.exists() else {"events":[]}

remote_by_id={e.get("id"):e for e in remote.get("events",[]) if e.get("id")}
curated_by_id={e.get("id"):e for e in curated.get("events",[]) if e.get("id")}

def norm(v):
    return re.sub(r"\W+","",str(v or "").lower())

def canonical_url(v):
    try:
        p=urlsplit(str(v or "").strip())
        if not p.scheme or not p.netloc:
            return ""
        return urlunsplit((p.scheme.lower(),p.netloc.lower(),p.path.rstrip("/"),"",""))
    except Exception:
        return ""

def unique_map(events, key_fn):
    grouped={}
    for item in events:
        key=key_fn(item)
        if key:
            grouped.setdefault(key,[]).append(item)
    return {k:items[0] for k,items in grouped.items() if len(items)==1}

# Secondary identities protect editorial decisions when a source slightly changes
# a title/date and therefore produces a new generated id. Shared museum landing
# pages are deliberately ignored unless they identify exactly one remote record.
remote_by_unique_url=unique_map(remote.get("events",[]), lambda e: canonical_url(e.get("url")))
remote_by_unique_title_venue=unique_map(
    remote.get("events",[]),
    lambda e: (norm(e.get("title")), norm(e.get("venue") or e.get("source")))
        if norm(e.get("title")) and norm(e.get("venue") or e.get("source")) else None
)

def find_remote_match(e):
    rid=e.get("id")
    if rid and rid in remote_by_id:
        return remote_by_id[rid]
    u=canonical_url(e.get("url"))
    if u and u in remote_by_unique_url:
        return remote_by_unique_url[u]
    key=(norm(e.get("title")), norm(e.get("venue") or e.get("source")))
    if all(key) and key in remote_by_unique_title_venue:
        return remote_by_unique_title_venue[key]
    return None

FINAL_PRESERVE_FIELDS={
    "status","kind","categories","editor_note","checked_at","reviewed_at",
    "price","price_text","price_type","registration","description","url","source",
    "venue","address","start_date","end_date"
}

def still_relevant(e):
    today=date.today()
    try:
        if e.get("kind")=="exhibition":
            end=e.get("end_date")
            if end:
                return date.fromisoformat(end)>=today
            start=e.get("start_date") or e.get("date")
            return not start or date.fromisoformat(start)>=today-timedelta(days=365)
        d=e.get("date")
        return not d or date.fromisoformat(d)>=today
    except Exception:
        return True

merged=[]
seen=set()
for e in generated.get("events",[]):
    rid=e.get("id")
    old=find_remote_match(e)
    if old:
        # Final editorial decisions are the source of truth for public-facing fields.
        if old.get("status") in ("approved","rejected"):
            for k in FINAL_PRESERVE_FIELDS:
                if k in old and old.get(k) not in ("",None,[]):
                    e[k]=old[k]
        else:
            for k in ("editor_note","checked_at","reviewed_at","price_text","price_type","registration","categories","kind"):
                if k in old and old.get(k) not in ("",None,[]):
                    e[k]=old[k]
    if rid and rid in curated_by_id:
        e.update(curated_by_id[rid])
    merged.append(e)
    if rid: seen.add(rid)

# Curated entries are durable independent records.
for e in curated.get("events",[]):
    rid=e.get("id")
    if rid and rid not in seen:
        merged.append(e); seen.add(rid)

# A temporary source failure must not erase reviewed future records.
for e in remote.get("events",[]):
    rid=e.get("id")
    if not rid or rid in seen: continue
    if e.get("status") in ("approved","rejected") and still_relevant(e):
        merged.append(e); seen.add(rid)

generated["events"]=sorted(
    merged,
    key=lambda e:(e.get("date",""),e.get("time",""),e.get("title",""))
)
out_path.write_text(json.dumps(generated,ensure_ascii=False,indent=2)+"\n","utf-8")
print(
    f"Merged {len(merged)} records; curated={len(curated.get('events',[]))}; "
    f"preserved reviewed={sum(1 for e in remote.get('events',[]) if e.get('status') in ('approved','rejected') and still_relevant(e))}"
)
