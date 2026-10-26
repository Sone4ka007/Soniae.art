"""Identity of an event occurrence, shared by the collector and the cleanup proposal.

Two rows are the same occurrence when the city, date and title match, the venues
do not contradict each other, and the clock times do not contradict each other.
A missing time or a missing venue does not keep a duplicate alive: that is how
the same lecture arrived twice with two URLs, and how one title was stored
three times.
"""
import re


def norm(value):
    return re.sub(r"\W+", "", str(value or "").lower().replace("ё", "е"))


def identity_key(event):
    title = norm(event.get("title"))
    if not title or title in {"названиетребуетпроверки"}:
        return None
    day = str(event.get("date") or "")
    if not day:
        return None
    return (str(event.get("city") or ""), day, title)


def venues_compatible(left, right):
    a, b = norm(left.get("venue")), norm(right.get("venue"))
    if not a or not b:
        return True
    return a == b or a in b or b in a


def times_compatible(left, right):
    a, b = str(left.get("time") or "").strip(), str(right.get("time") or "").strip()
    if not a or not b:
        return True
    return a == b


def same_occurrence(left, right):
    key = identity_key(left)
    return bool(key) and key == identity_key(right) and venues_compatible(left, right) and times_compatible(left, right)
