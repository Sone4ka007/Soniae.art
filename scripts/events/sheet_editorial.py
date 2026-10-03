"""Preserve editorial descriptions across collector and Sheet synchronization."""
import re

def valid_description(value):
    return not re.search(r"cookies?|файлы? cookie|пользовательским соглашением|настройках браузера", str(value or ""), re.I)

def merge_description(event, row):
    if "description" not in row:
        return
    live = str(row.get("description") or "").strip()
    if not valid_description(live):
        return
    baseline = str(event.get("sheet_synced_description", event.get("description", "")) or "").strip()
    if live != baseline:
        event["description"] = live
        event["description_editorial"] = True
