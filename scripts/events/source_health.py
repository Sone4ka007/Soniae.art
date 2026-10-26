"""Per-source collection health.

A source that usually contributes events and then returns nothing is printed as
an alert. The pipeline keeps going: one blocked museum should not stop the
weekly post. The baseline is the last known productive set, not a guess about
sites that have never returned a row.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASELINE = ROOT / "events" / "source_health_baseline.json"
REPORT = ROOT / "dist" / "events-audit" / "source-health.md"


def load_baseline(path=None):
    file = Path(path) if path else BASELINE
    try:
        data = json.loads(file.read_text("utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    sources = data.get("sources") if isinstance(data, dict) else None
    return sources if isinstance(sources, dict) else {}


def alerts_for(rows, baseline):
    found = []
    for row in rows:
        if row.get("disabled"):
            continue
        name = row.get("name") or ""
        expected = baseline.get(name) or {}
        minimum = int(expected.get("min_candidates") or 0)
        if minimum > 0 and int(row.get("candidates") or 0) == 0:
            found.append({
                "name": name,
                "min_candidates": minimum,
                "error": row.get("error") or "",
                "note": row.get("note") or "",
                "url": row.get("url") or "",
            })
    return found


def render_report(rows, found):
    lines = ["# Здоровье источников", ""]
    if found:
        lines.append(f"Тревога: {len(found)} обычно живых источников вернули 0.")
        lines.append("")
        for item in found:
            why = item["error"] or item["note"] or "пустой список, без ошибки сети"
            lines.append(f"- {item['name']}: ждали хотя бы {item['min_candidates']}, сейчас 0. {why}")
        lines.append("")
    else:
        lines.append("Тревог нет: ни один источник из базовой линии не упал до нуля.")
        lines.append("")
    lines.append("| Источник | Кандидаты | Новые | Состояние |")
    lines.append("| --- | ---: | ---: | --- |")
    for row in rows:
        state = "выключен" if row.get("disabled") else (row.get("error") or row.get("note") or "ok")
        state = str(state).replace("|", "/")[:180]
        lines.append(
            f"| {row.get('name','')} | {int(row.get('candidates') or 0)} | {int(row.get('new') or 0)} | {state} |"
        )
    lines.append("")
    return "\n".join(lines)


def write_health(rows, baseline=None, report_path=None):
    baseline = load_baseline() if baseline is None else baseline
    found = alerts_for(rows, baseline)
    text = render_report(rows, found)
    target = Path(report_path) if report_path else REPORT
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text, "utf-8")
    for item in found:
        why = item["error"] or item["note"] or "empty listing"
        print(f"ALERT_SOURCE {item['name']}: candidates=0 expected>={item['min_candidates']} {why}")
    print(f"source_health: {len(rows)} sources, alerts={len(found)}, report={target}")
    return found
