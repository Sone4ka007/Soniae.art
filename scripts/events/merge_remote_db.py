#!/usr/bin/env python3
import json, sys
from pathlib import Path

generated_path=Path(sys.argv[1])
remote_path=Path(sys.argv[2])
out_path=Path(sys.argv[3])

generated=json.loads(generated_path.read_text("utf-8"))
remote=json.loads(remote_path.read_text("utf-8"))
remote_by_id={e.get("id"):e for e in remote.get("events",[]) if e.get("id")}

manual_remote=[
    e for e in remote.get("events",[])
    if str(e.get("id","")).startswith("manual-")
]

preserve_fields={
    "status","editor_note","checked_at","reviewed_at",
    "price_text","registration","categories"
}

merged=[]
for e in generated.get("events",[]):
    rid=e.get("id")
    old=remote_by_id.get(rid)
    if old:
        # Final manual moderation always wins.
        if old.get("status") in ("approved","rejected"):
            e["status"]=old["status"]
        for k in preserve_fields - {"status"}:
            if k in old and old.get(k) not in ("",None,[]):
                e[k]=old[k]
    merged.append(e)

existing_ids={e.get("id") for e in merged if e.get("id")}
for e in manual_remote:
    if e.get("id") not in existing_ids:
        merged.append(e)

generated["events"]=sorted(
    merged,
    key=lambda e:(e.get("date",""),e.get("time",""),e.get("title",""))
)
out_path.write_text(json.dumps(generated,ensure_ascii=False,indent=2)+"\n","utf-8")
print(f"Merged {len(merged)} generated records with latest remote editor state; preserved {len(manual_remote)} manual records")
