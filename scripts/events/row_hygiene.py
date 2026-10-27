"""Reasons a newly collected row should not enter the calendar.

These checks run on rows that are still `new` or `check`. Approved and rejected
rows keep the decision already stored in the sheet. `propose_cleanup.py` uses
the same reasons to describe existing rows without changing them.
"""
import re

GENERIC_TITLES = {
    "курсы", "воркшопы", "кино", "лекции", "экскурсии", "мастер-классы",
    "мастер-класс", "события", "программа",
}
COMMENT_FORM_RE = re.compile(r"спасибо,\s*что оставляете обратную связь", re.I)
OUTSIDE_CITY_RE = re.compile(
    r"состоится\s+в\s+(?:санкт-петербурге|петербурге|казани|екатеринбурге|"
    r"нижнем\s+новгороде|новосибирске|калининграде|перми|самаре|казани)",
    re.I,
)
CLOCK_RE = re.compile(
    r"(?:начало(?:\s+в)?|в)\s+([01]?\d|2[0-3])[:.]([0-5]\d)",
    re.I,
)
DANGLING_TAIL = {"и", "в", "на", "с", "со", "от", "для", "по", "из", "к", "о", "об", "во"}


def infer_clock(text):
    """A start time written as «в 19:00», not a museum's opening hours."""
    match = CLOCK_RE.search(str(text or ""))
    if not match:
        return ""
    return f"{int(match.group(1)):02d}:{match.group(2)}"


def strip_comment_form(text):
    return COMMENT_FORM_RE.split(str(text or ""), maxsplit=1)[0].strip()


def junk_reason(event):
    title = str(event.get("title") or "").strip().lower().replace("ё", "е")
    description = str(event.get("description") or "")
    audience = str(event.get("audience_text") or "")
    blob = " ".join([
        title,
        description,
        " ".join(str(x) for x in (event.get("categories") or [])),
        str(event.get("venue") or ""),
        str(event.get("source") or ""),
    ]).lower().replace("ё", "е")
    url = str(event.get("url") or "").lower()
    if title in GENERIC_TITLES:
        return "generic_section_title"
    if COMMENT_FORM_RE.search(description) or COMMENT_FORM_RE.search(audience):
        return "comment_form_boilerplate"
    if "spbcult.ru" in url and not str(event.get("time") or "").strip():
        return "news_portal_not_event"
    if str(event.get("city") or "") == "moscow" and OUTSIDE_CITY_RE.search(blob):
        return "outside_city"
    source = str(event.get("source") or "").lower()
    if ("гэс-2" in source or "ges-2.org" in url) and "экскурси" in blob:
        return "excluded_ges2_excursion"
    return ""


def dangling_title(title):
    words = str(title or "").split()
    if not words:
        return False
    return words[-1].lower().strip(".,:;…»\"") in DANGLING_TAIL
