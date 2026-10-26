#!/usr/bin/env python3
import json, re, sys
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit
from sheet_editorial import apply_editor_overrides

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

def bad_title(value):
    title=str(value or "").strip()
    if not title:
        return True
    words=title.split()
    starts_type=bool(re.match(
        r"^(?:лекция|встреча|мастер-класс|воркшоп|презентация|паблик-ток|"
        r"дискуссия|выставка|открытие|конференция|семинар|перформанс|кинопоказ)\\b",
        title,re.I
    ))
    if title.startswith((".",",",";",":")):
        return True
    if re.match(
        r"^(?:на\\s+(?:лекции|встрече|занятии)|мы\\s+(?:будем|поговорим)|"
        r"вы\\s+(?:увидите|узнаете)|приглашаем\\b|сегодня\\b|"
        r"будущая\\s+встреча|у\\s+каждого\\s+человека|нас\\s+с\\s+детства|"
        r"человек\\s+начинает|переезд\\s+это|герой\\s+романа|по\\s+этому\\s+поводу)",
        title,re.I
    ):
        return True
    if len(title)>180 and not starts_type:
        return True
    if len(words)>24 and not starts_type:
        return True
    if len(re.findall(r"[.!?](?:\\s|$)",title))>=2 and len(words)>16 and not starts_type:
        return True
    return False

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

    # Reviewed records keep editorial decisions, but verified factual fields
    # must still be allowed to refresh from official sources. Otherwise fixes to
    # time/date and confirmed availability changes are silently reverted here.
    if old and old.get("status") in ("approved","rejected"):
        e=dict(old)
        for k in ("date","time","start_date","end_date","availability","availability_checked_at"):
            if k in generated_event and generated_event.get(k) not in (None,""):
                e[k]=generated_event[k]
        title_overridden="title" in (old.get("editor_overrides") or {})
        if (
            str(old.get("title","")).lower() in ("подписка на рассылку","подписаться на рассылку")
            or (bad_title(old.get("title")) and not title_overridden)
        ):
            if generated_event.get("title") and not bad_title(generated_event.get("title")):
                e["title"]=generated_event["title"]
            for k in ("description","categories","audience_text"):
                if k in generated_event and k not in (old.get("editor_overrides") or {}):
                    e[k]=generated_event[k]
        # Keep the generated identity when a source legitimately changes the
        # technical id, while preserving moderation/editorial fields.
        if rid:
            e["id"]=rid
    else:
        e=dict(generated_event)
        if old:
            for k in ("editor_note","checked_at","reviewed_at","price_text","price_type","registration","categories","kind","social_priority","social_title","social_description","telegram_include","instagram_include","post_include","instagram_image"):
                if k in old and old.get(k) not in ("",None,[]):
                    e[k]=old[k]
        if rid and rid in curated_by_id:
            e.update(curated_by_id[rid])

    combined_overrides={}
    if old and isinstance(old.get("editor_overrides"),dict):
        combined_overrides.update(old.get("editor_overrides") or {})
    if isinstance(generated_event.get("editor_overrides"),dict):
        combined_overrides.update(generated_event.get("editor_overrides") or {})
    if combined_overrides:
        e["editor_overrides"]=combined_overrides
        apply_editor_overrides(e)

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
        item=dict(old)
        apply_editor_overrides(item)
        merged.append(item)
    else:
        item=dict(curated_event)
        apply_editor_overrides(item)
        merged.append(item)
    seen.add(rid)

# Reviewed records are durable even if a source temporarily disappears or an
# event is now in the past. The frontend date filters decide whether to display
# them; the collector is not allowed to delete editorial decisions.
for e in remote.get("events",[]):
    rid=e.get("id")
    if not rid or rid in seen:
        continue
    if e.get("status") in ("approved","rejected"):
        item=dict(e)
        apply_editor_overrides(item)
        merged.append(item)
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
