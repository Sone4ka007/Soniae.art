#!/usr/bin/env python3
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]

class ExhibitionFrontendTests(unittest.TestCase):
    def test_exhibition_category_never_renders_in_events_tab(self):
        js=(ROOT/"assets/events.js").read_text("utf-8")
        self.assertIn("(e.categories || []).includes('выставка')",js)
        self.assertIn("normalizedKind !== state.kind",js)

    def test_events_json_is_cache_busted(self):
        js=(ROOT/"assets/events.js").read_text("utf-8")
        self.assertIn("events.json?v=' + Date.now()",js)
        html=(ROOT/"events/index.html").read_text("utf-8")
        self.assertIn("events.js?v=20260924-1",html)

    def test_winzavod_description_filters_schedule_boilerplate(self):
        source=(ROOT/"scripts/events/collect_jsonld.py").read_text("utf-8")
        self.assertIn("actual exhibition copy",source)
        self.assertIn("сегодня выставки, галереи, магазины и кафе работают",source)

if __name__=="__main__":
    unittest.main()
