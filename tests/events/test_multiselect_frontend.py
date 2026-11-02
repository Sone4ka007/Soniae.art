#!/usr/bin/env python3
import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

class MultiSelectFrontendTests(unittest.TestCase):
    def test_all_four_sections_selected_by_default(self):
        html = (ROOT / "events/index.html").read_text("utf-8")
        js = (ROOT / "assets/events.js").read_text("utf-8")
        for name in ("event", "exhibition", "open_call", "sketch"):
            self.assertRegex(html, rf'data-kind="{name}" aria-pressed="true"')
        self.assertIn("kinds: new Set(allKinds)", js)
        self.assertIn("state.kinds = new Set([kind]);", js)
        self.assertIn("state.kinds.add(kind);", js)
        self.assertIn("state.kinds.delete(kind);", js)
        self.assertIn("state.kinds = new Set(allKinds);", js)

    def test_sketch_sessions_classified_separately(self):
        js = (ROOT / "assets/events.js").read_text("utf-8")
        self.assertIn("const sketchCategory = cats.some(", js)
        self.assertIn("return e.kind === 'sketch' || sketchCategory || sketchTitle ? 'sketch' : 'event';", js)
        self.assertIn("if (!state.kinds.has(normalizedKind)) return false;", js)
        self.assertIn("const groupDate = e =>", js)
        self.assertIn("renderSketchPlaces();", js)
        self.assertNotIn("state.kind =", js)

    def test_places_are_real_and_displayed(self):
        places = json.loads((ROOT / "content/sketch-places.json").read_text("utf-8"))["places"]
        self.assertEqual(len(places), 5)
        self.assertTrue(all(p["status"] == "approved" for p in places))
        self.assertTrue(all(p["url"].startswith("https://") for p in places))
        html = (ROOT / "events/index.html").read_text("utf-8")
        self.assertIn('id="sketch-section"', html)
        self.assertIn('id="sketch-places-list"', html)

    def test_mobile_layout_avoids_overlapping_card_columns(self):
        css = (ROOT / "assets/events.css").read_text("utf-8")
        self.assertIn(".events-primary-tabs{position:static;top:auto;", css)
        self.assertIn(".event-card,.sketch-place-card{display:grid;grid-template-columns:minmax(0,1fr);", css)
        self.assertIn(".date-filter-calendar{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));", css)

if __name__ == "__main__":
    unittest.main()
