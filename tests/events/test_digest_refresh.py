#!/usr/bin/env python3
import importlib.util
import json
import tempfile
import unittest
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def load_module(name, relpath):
    spec = importlib.util.spec_from_file_location(name, ROOT / relpath)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


social = load_module("build_social_digest", "scripts/events/build_social.py")
identity = load_module("event_identity_digest", "scripts/events/event_identity.py")
hygiene = load_module("row_hygiene_digest", "scripts/events/row_hygiene.py")
health = load_module("source_health_digest", "scripts/events/source_health.py")
extra = load_module("extra_sources_digest", "scripts/events/extra_sources.py")
cleanup = load_module("propose_cleanup_digest", "scripts/events/propose_cleanup.py")
collect = load_module("collect_jsonld_digest", "scripts/events/collect_jsonld.py")


def event(**kwargs):
    base = {
        "id": "x", "status": "approved", "kind": "event", "city": "moscow",
        "date": "2026-10-29", "time": "19:00", "title": "Лекция о цвете",
        "venue": "Третьяковская галерея", "categories": ["лекция"],
        "description": "разбор цвета", "price_type": "paid", "price": 500,
        "price_text": "500 ₽", "registration": False,
    }
    base.update(kwargs)
    return base


class SocialPackageTests(unittest.TestCase):
    def test_footer_matches_the_reference_for_one_month(self):
        self.assertEqual(
            social.footer_range(date(2026, 10, 19), date(2026, 10, 25)),
            "19–25 ОКТЯБРЯ 2026",
        )

    def test_footer_names_both_months(self):
        self.assertEqual(
            social.footer_range(date(2026, 10, 26), date(2026, 11, 1)),
            "26 ОКТЯБРЯ – 1 НОЯБРЯ 2026",
        )

    def test_price_chips(self):
        self.assertEqual(social.badge_label(event())[0], "500 ₽")
        self.assertEqual(social.badge_label(event(price=None, price_text="", price_type="paid"))[0], "платно")
        self.assertEqual(
            social.badge_label(event(price=None, price_text="", price_type="unknown", registration=True))[0],
            "по регистрации",
        )
        self.assertEqual(
            social.badge_label(event(price=None, price_text="", price_type="paid", registration=True))[0],
            "регистрация + билет",
        )
        self.assertEqual(social.badge_label(event(price=0, price_text="бесплатно", price_type="free", registration=False))[0], "бесплатно")

    def test_day_page_has_her_footer_and_page_number(self):
        page = social.day_page(
            date(2026, 10, 22), [event(date="2026-10-22", time="18:00")],
            2, 5, "moscow", date(2026, 10, 19), date(2026, 10, 25),
        )
        self.assertIn("2/5", page)
        self.assertIn("19–25 ОКТЯБРЯ 2026", page)
        self.assertIn("СОНЯ ЕНОКАЕВА", page)
        self.assertIn("500 ₽", page)
        self.assertIn("Третьяковская галерея", page)
        self.assertNotIn("t.me/sonnya_ee", page)

    def test_cover_has_no_page_number(self):
        page = social.cover_page(date(2026, 10, 19), date(2026, 10, 25), "moscow")
        self.assertIn("КУДА", page)
        self.assertIn("ПОДБОРКА", page)
        self.assertIn("19–25", page)
        self.assertNotIn("1/5", page)

    def test_curation_keeps_four_days_and_respects_the_tick(self):
        rows = []
        for day in range(26, 32):
            rows.append(event(id=f"a{day}", date=f"2026-10-{day}", title=f"Лекция {day}", venue="Третьяковская галерея"))
            rows.append(event(id=f"b{day}", date=f"2026-10-{day}", title=f"Курс {day}", venue="Двор", categories=[]))
        rows.append(event(id="skip", date="2026-10-26", title="Не брать", post_include=False))
        rows.append(event(id="force", date="2026-11-01", title="Обязательная", venue="Двор", categories=[], post_include=True, time="12:00"))
        groups = social.curate_week(rows, per_day=3, max_days=4)
        self.assertLessEqual(len(groups), 4)
        picked = [item["id"] for _day, items in groups for item in items]
        self.assertIn("force", picked)
        self.assertNotIn("skip", picked)
        self.assertLessEqual(len(groups) * 3, 12)

    def test_telegram_text_is_short(self):
        groups = [("2026-10-29", [event(), event(title="Вторая лекция", time="20:00")])]
        text = social.short_telegram(groups, date(2026, 10, 26), date(2026, 11, 1), "moscow")
        self.assertLess(len(text), 700)
        self.assertIn("sonyae.art/events", text)
        self.assertNotIn("http://", text)
        self.assertIn("Лекция о цвете", text)


class HygieneTests(unittest.TestCase):
    def test_same_title_and_venue_on_one_day_is_one_event(self):
        left = event(id="1", url="https://a.example/1")
        right = event(id="2", url="https://b.example/2", time="")
        self.assertTrue(identity.same_occurrence(left, right))
        other_time = event(id="3", time="21:00")
        self.assertFalse(identity.same_occurrence(left, other_time))

    def test_junk_reasons(self):
        self.assertEqual(hygiene.junk_reason(event(title="Курсы")), "generic_section_title")
        self.assertEqual(
            hygiene.junk_reason(event(description="Спасибо, что оставляете обратную связь на странице.")),
            "comment_form_boilerplate",
        )
        self.assertEqual(
            hygiene.junk_reason(event(url="https://spbcult.ru/news/1", time="", title="Открылись выставки")),
            "news_portal_not_event",
        )
        self.assertEqual(
            hygiene.junk_reason(event(source="Дом культуры «ГЭС-2»", url="https://ges-2.org/x", categories=["экскурсия"])),
            "excluded_ges2_excursion",
        )
        self.assertEqual(hygiene.infer_clock("Начало в 19:30 в лектории"), "19:30")
        self.assertTrue(hygiene.dangling_title("Дом Радио и"))

    def test_english_exhibition_range(self):
        start, end = collect.parse_exhibition_range("2 September - 6 December 2026")
        self.assertEqual(start, date(2026, 9, 2))
        self.assertEqual(end, date(2026, 12, 6))
        start, end = collect.parse_exhibition_range("December 1 - 5, 2026")
        self.assertEqual((start, end), (date(2026, 12, 1), date(2026, 12, 5)))

    def test_health_alerts_only_when_a_productive_source_goes_quiet(self):
        rows = [
            {"name": "Гараж", "candidates": 0, "error": "timeout"},
            {"name": "Новый", "candidates": 0, "error": "403"},
        ]
        found = health.alerts_for(rows, {"Гараж": {"min_candidates": 1}})
        self.assertEqual([item["name"] for item in found], ["Гараж"])

    def test_proposal_does_not_touch_the_database(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "events.json"
            path.write_text(json.dumps({"events": [event(id="1"), event(id="2", url="https://other")]}), "utf-8")
            before = path.read_bytes()
            text = cleanup.render(cleanup.propose(json.loads(before)["events"]))
            self.assertIn("Повторы", text)
            self.assertEqual(path.read_bytes(), before)

    def test_tretyakov_payload_becomes_a_lecture(self):
        payload = {"data": {"items": [{
            "name": "Лекция «Рыцарство»",
            "startDate": "20 декабря 2026 13:00",
            "url": "/events/o/lektsiya/",
            "place": {"name": "Новая Третьяковка"},
            "hashtag": "лекция",
            "buttonBuy": {"text": "Купить билет"},
        }]}}
        rows = extra.events_from_tretyakov(payload, {"city": "moscow", "name": "Третьяковка", "venue": "Третьяковская галерея", "kind": "event"})
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["date"], "2026-12-20")
        self.assertEqual(rows[0]["time"], "13:00")
        self.assertIn("tretyakovgallery.ru/events/o/", rows[0]["url"])

    def test_hermitage_payload_keeps_a_running_exhibition(self):
        payload = {"data": {"whatsList": [{
            "head": "Императорский Китай",
            "dateStart": "2026-06-24 11:00:00",
            "dateEnd": "2026-11-22 11:00:00",
            "link": "/what-s-on/china26?lng=ru",
            "location": "Зимний дворец",
            "text": "Выставка в Гербовом зале.",
        }]}}
        rows = extra.events_from_hermitage(payload, {"city": "spb", "name": "Эрмитаж", "venue": "Эрмитаж", "kind": "event"}, "exhibition")
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["kind"], "exhibition")
        self.assertEqual(rows[0]["end_date"], "2026-11-22")

    def test_kudago_skips_dateless_rows(self):
        payload = {"results": [
            {"id": 1, "title": "Без даты", "dates": [], "place": {}, "site_url": "https://example.test/1"},
            {"id": 2, "title": "Лекция в музее", "dates": [{"start": 1796000000}], "place": {"title": "Гараж"}, "site_url": "https://example.test/2", "is_free": True, "description": "лекция"},
        ]}
        rows = extra.events_from_kudago(payload, {"city": "moscow", "name": "KudaGo", "venue": "", "kind": "event"})
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["title"], "Лекция в музее")
        self.assertEqual(rows[0]["price"], 0)


if __name__ == "__main__":
    unittest.main()
