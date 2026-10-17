"""Editorial overrides from the live Google Sheet.

Any user-facing field manually changed in the Sheet becomes a durable override.
Collectors may continue refreshing fields that have never been manually changed.
"""
import json

USER_EDITABLE_FIELDS = (
    "title","status","date","time","venue","city","kind","categories","description",
    "url","source","address","price_type","price_text","registration","availability",
    "availability_checked_at","review_reason","editor_note","discovered_at","reviewed_at",
    "price","checked_at","social_priority","social_title","social_description",
    "telegram_include","instagram_include","instagram_image",
)

BOOL_FIELDS = {"registration","telegram_include","instagram_include"}
INT_FIELDS = {"social_priority"}
NUMBER_FIELDS = {"price"}

def parse_bool(v):
    if isinstance(v, bool):
        return v
    s = str(v or "").strip().lower()
    if not s:
        return None
    if s in ("true","1","yes","да"):
        return True
    if s in ("false","0","no","нет"):
        return False
    return None

def coerce_sheet_value(field, value):
    if field in BOOL_FIELDS:
        return parse_bool(value)
    if field == "categories":
        if isinstance(value, list):
            return [str(x).strip() for x in value if str(x).strip()]
        return [x.strip() for x in str(value or "").split(",") if x.strip()]
    if field in INT_FIELDS:
        s = str(value or "").strip()
        try:
            return int(float(s)) if s else None
        except ValueError:
            return None
    if field in NUMBER_FIELDS:
        s = str(value or "").strip().replace(" ", "").replace(",", ".")
        if not s:
            return None
        try:
            n = float(s)
            return int(n) if n.is_integer() else n
        except ValueError:
            return str(value).strip()
    return str(value or "").strip()

def canonical(field, value):
    if field in BOOL_FIELDS:
        v = parse_bool(value)
        return "" if v is None else ("TRUE" if v else "FALSE")
    if field == "categories":
        if isinstance(value, list):
            return ",".join(str(x).strip() for x in value if str(x).strip())
        return ",".join(x.strip() for x in str(value or "").split(",") if x.strip())
    if field in NUMBER_FIELDS or field in INT_FIELDS:
        if value in (None, ""):
            return ""
        try:
            n = float(value)
            return str(int(n)) if n.is_integer() else str(n)
        except (TypeError, ValueError):
            return str(value).strip()
    return str(value or "").strip()

def snapshot_from_event(event):
    return {field: canonical(field, event.get(field)) for field in USER_EDITABLE_FIELDS}

def snapshot_from_row(row):
    return {field: canonical(field, row.get(field)) for field in USER_EDITABLE_FIELDS}

def load_synced_snapshot(row, event):
    raw = str(row.get("synced_row_json") or "").strip()
    if raw:
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                return {field: canonical(field, parsed.get(field)) for field in USER_EDITABLE_FIELDS}
        except Exception:
            pass
    # Migration path: compare the live Sheet with the current repository event.
    # This preserves existing manual edits without freezing every current field.
    return snapshot_from_event(event)

def capture_editor_overrides(event, row):
    baseline = load_synced_snapshot(row, event)
    overrides = dict(event.get("editor_overrides") or {})
    changed = []
    for field in USER_EDITABLE_FIELDS:
        if field not in row:
            continue
        live = canonical(field, row.get(field))
        if live != baseline.get(field, ""):
            overrides[field] = coerce_sheet_value(field, row.get(field))
            changed.append(field)
    if overrides:
        event["editor_overrides"] = overrides
    elif "editor_overrides" in event:
        event.pop("editor_overrides", None)
    apply_editor_overrides(event)
    return changed

def apply_editor_overrides(event):
    for field, value in (event.get("editor_overrides") or {}).items():
        if field in USER_EDITABLE_FIELDS:
            event[field] = value
    return event
