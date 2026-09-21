#!/usr/bin/env python3
import importlib.util
import unittest
from datetime import date
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]

spec=importlib.util.spec_from_file_location(
    "discover_special_events_test",
    ROOT/"scripts/events/discover_special_events.py"
)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class SpecialDiscoveryTests(unittest.TestCase):
    def test_parses_same_month_range(self):
        rows=mod.candidate_ranges("23–25 сентября 2026 Санкт-Петербург", date(2026,9,21))
        self.assertIn((date(2026,9,23),date(2026,9,25)), [(a,b) for a,b,_ in rows])

    def test_parses_cross_month_range(self):
        rows=mod.candidate_ranges("28 сентября — 1 октября 2026", date(2026,9,21))
        self.assertIn((date(2026,9,28),date(2026,10,1)), [(a,b) for a,b,_ in rows])

    def test_choose_range_prefers_date_near_series_name(self):
        text="Архив: 1 января 2026. HomeFest 23–25 сентября 2026. Следующая новость 30 сентября 2026."
        src={"title_hints":["HomeFest"],"lookahead_days":180}
        self.assertEqual(
            mod.choose_range(text,src,date(2026,9,21)),
            (date(2026,9,23),date(2026,9,25))
        )

    def test_existing_match_prevents_duplicate_series(self):
        src={"name":"Digital Rain","url":"https://digitalrain.art/"}
        events=[{
            "title":"Digital Rain — фестиваль медиаискусства",
            "url":"https://digitalrain.art/",
            "date":"2026-09-25"
        }]
        self.assertIsNotNone(mod.existing_match(events,src,date(2026,9,25)))

    def test_new_discovery_is_check_not_approved(self):
        src={
            "name":"Test Festival",
            "city":"spb",
            "url":"https://example.org/",
            "category":"design"
        }
        e=mod.make_event(src,date(2026,10,2),date(2026,10,4))
        self.assertEqual(e["status"],"check")
        self.assertEqual(e["review_reason"],"special_event_discovery")
        self.assertIn("фестиваль",e["categories"])
        self.assertIn("дизайн",e["categories"])


if __name__=="__main__":
    unittest.main()
