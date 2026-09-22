#!/usr/bin/env python3
import json, re, sys
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

merged=[]
seen=set()
for generated_event in generated.get("events",[]):
    rid=generated_event.get("id")
    old=find_remote_match(generated_event)

    # Reviewed records are editorially locked. Once the editor has approved or
    # rejected an item, automated collection, curated seed data, and source
    # changes must not rewrite that record. The only way to change it is through
    # an explicit editor action in the moderation Sheet.
    if old and old.get("status") in ("approved","rejected"):
        e=dict(old)
    else:
        e=dict(generated_event)
        if old:
            for k in ("editor_note","checked_at","reviewed_at","price_text","price_type","registration","categories","kind"):
                if k in old and old.get(k) not in ("",None,[]):
                    e[k]=old[k]
        if rid and rid in curated_by_id:
            e.update(curated_by_id[rid])

    merged.append(e)
    final_id=e.get("id")
    if final_id:
        seen.add(final_id)

# Curated entries are durable independent records, but a reviewed remote record
# with the same id wins over stale curated seed data.
for curated_event in curated.get("events",[]):
    rid=curated_event.get("id")
    if not rid or rid in seen:
        continue
    old=remote_by_id.get(rid)
    if old and old.get("status") in ("approved","rejected"):
        merged.append(dict(old))
    else:
        merged.append(dict(curated_event))
    seen.add(rid)

# Reviewed records are durable even if a source temporarily disappears or an
# event is now in the past. The frontend date filters decide whether to display
# them; the collector is not allowed to delete editorial decisions.
for e in remote.get("events",[]):
    rid=e.get("id")
    if not rid or rid in seen:
        continue
    if e.get("status") in ("approved","rejected"):
        merged.append(dict(e))
        seen.add(rid)

generated["events"]=sorted(
    merged,
    key=lambda e:(e.get("date",""),e.get("time",""),e.get("title",""))
)
out_path.write_text(json.dumps(generated,ensure_ascii=False,indent=2)+"\n","utf-8")
print(
    f"Merged {len(merged)} records; curated={len(curated.get('events',[]))}; "
    f"preserved reviewed={sum(1 for e in remote.get('events',[]) if e.get('status') in ('approved','rejected'))}"
)
