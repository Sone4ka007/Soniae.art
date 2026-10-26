#!/usr/bin/env python3
"""Describe duplicate and junk rows. Does not modify events.json or the sheet.

Sonya's approved and rejected decisions stay where they are. This report is the
proposed separate pass: which rows repeat each other, which new rules would
have stopped them, and which empty times can be filled from the description.
"""
import json
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from event_identity import identity_key, same_occurrence
from row_hygiene import dangling_title, infer_clock, junk_reason

ROOT = Path(__file__).resolve().parents[2]
DB = ROOT / "content" / "events.json"
OUT = ROOT / "events" / "cleanup-proposal.md"


def propose(events):
    groups = defaultdict(list)
    for event in events:
        key = identity_key(event)
        if not key:
            continue
        placed = False
        for bucket in groups[key]:
            if same_occurrence(bucket[0], event):
                bucket.append(event)
                placed = True
                break
        if not placed:
            groups[key].append([event])
    duplicates = []
    for buckets in groups.values():
        for bucket in buckets:
            if len(bucket) > 1:
                duplicates.append(bucket)
    junk = []
    missing_time = []
    broken_titles = []
    unexplained = []
    by_url = defaultdict(list)
    for event in events:
        url = str(event.get("url") or "").strip()
        if url.startswith("http"):
            by_url[url.lower()].append(event)
    same_url = [rows for rows in by_url.values() if len({row.get("date") for row in rows}) == 1 and len(rows) > 1]
    for event in events:
        reason = junk_reason(event)
        if reason:
            junk.append((reason, event))
        if not str(event.get("time") or "").strip():
            guess = infer_clock(event.get("description") or "")
            if guess:
                missing_time.append((guess, event))
        if dangling_title(event.get("title")):
            broken_titles.append(event)
        if event.get("status") == "rejected" and not str(event.get("review_reason") or "").strip():
            unexplained.append(event)
    return {
        "duplicates": duplicates,
        "junk": junk,
        "missing_time": missing_time,
        "broken_titles": broken_titles,
        "unexplained": unexplained,
        "same_url": same_url,
    }


def _keep(bucket):
    def rank(event):
        status = {"approved": 0, "check": 1, "new": 2, "rejected": 3}.get(event.get("status"), 4)
        has_time = 0 if event.get("time") else 1
        return (status, has_time, len(str(event.get("url") or "")), str(event.get("id")))
    return sorted(bucket, key=rank)[0]


def render(found):
    lines = [
        "# Предложение по очистке календаря",
        "",
        "Этот файл ничего не применяет. `content/events.json` и решения в таблице не меняются.",
        "Новый сбор больше не добавляет такие строки. Уже сохранённые строки со статусом approved или rejected остаются.",
        "",
        "Как разобрать повторы, если Соня захочет: оставить одну строку (лучше ту, что уже approved), остальным поставить rejected и `review_reason=duplicate_record`. Не удалять строки пачкой.",
        "",
        f"## Повторы одного события: {len(found['duplicates'])} групп",
        "",
    ]
    extra = sum(len(bucket) - 1 for bucket in found["duplicates"])
    lines.append(f"Лишних строк в этих группах: {extra}.")
    lines.append("")
    same_url = found.get("same_url") or []
    extra_urls = sum(len(rows) - 1 for rows in same_url)
    lines.append(f"Отдельно одна и та же ссылка в один и тот же день записана несколько раз: {len(same_url)} ссылок, {extra_urls} лишних строк. Новый сбор такую строку не создаёт. Серии с разными датами по одной ссылке сюда не входят.")
    lines.append("")
    for bucket in sorted(found["duplicates"], key=lambda b: (b[0].get("date") or "", b[0].get("title") or ""))[:40]:
        keep = _keep(bucket)
        lines.append(f"- {bucket[0].get('date')} · {bucket[0].get('title')} · {bucket[0].get('venue') or bucket[0].get('source')}")
        lines.append(f"  оставить `{keep.get('id')}` ({keep.get('status')})")
        for event in bucket:
            if event.get("id") == keep.get("id"):
                continue
            lines.append(f"  повторяет `{event.get('id')}` ({event.get('status')}) {event.get('url')}")
    if len(found["duplicates"]) > 40:
        lines.append(f"- … ещё {len(found['duplicates']) - 40} групп в выводе скрипта не раскрыты.")
    lines += ["", f"## Шум, который новые правила узнают: {len(found['junk'])} строк", ""]
    by_reason = defaultdict(int)
    for reason, _event in found["junk"]:
        by_reason[reason] += 1
    for reason, count in sorted(by_reason.items()):
        lines.append(f"- `{reason}`: {count}")
    lines.append("")
    lines.append("У строк со статусом approved или rejected причина ниже только справочная. Скрипт их не отклоняет.")
    lines.append("")
    shown = 0
    for reason, event in found["junk"]:
        if event.get("status") in ("approved", "rejected"):
            continue
        lines.append(f"- {event.get('date')} {event.get('title')} → {reason}")
        shown += 1
        if shown >= 25:
            break
    lines += [
        "",
        f"## Пустое время, которое читается из описания: {len(found['missing_time'])}",
        "",
    ]
    for guess, event in found["missing_time"][:25]:
        lines.append(f"- {event.get('date')} {event.get('title')}: поставить {guess} (сейчас пусто, статус {event.get('status')})")
    lines += [
        "",
        f"## Обрезанные названия: {len(found['broken_titles'])}",
        "",
    ]
    for event in found["broken_titles"][:25]:
        lines.append(f"- {event.get('id')}: «{event.get('title')}»")
    lines += [
        "",
        f"## Уже rejected без причины: {len(found['unexplained'])}",
        "",
        "Им стоит дописать `review_reason`, когда будет понятно, почему строка снята. Автоматически причину не подставляем: решение уже принято.",
        "",
    ]
    return "\n".join(lines).rstrip() + "\n"


def main():
    db_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DB
    out_path = Path(sys.argv[2]) if len(sys.argv) > 2 else OUT
    original = db_path.read_bytes()
    db = json.loads(original)
    text = render(propose(db.get("events") or []))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(text, "utf-8")
    if db_path.read_bytes() != original:
        raise SystemExit("propose_cleanup must not modify the database")
    print(f"Wrote {out_path} without changing {db_path}")


if __name__ == "__main__":
    main()
