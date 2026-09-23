#!/usr/bin/env python3
import json
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]

class HseCoverageTests(unittest.TestCase):
    def test_newspaper_source_present(self):
        data=json.loads((ROOT/"events/sources.json").read_text("utf-8"))
        self.assertTrue(any(s.get("url")=="https://design.hse.ru/newspaper" and s.get("adapter")=="hse" for s in data["sources"]))

    def test_design_drive_event_added_for_moderation(self):
        db=json.loads((ROOT/"content/events.json").read_text("utf-8"))
        e=next(x for x in db["events"] if x.get("url")=="https://design.hse.ru/info/lecture_drive")
        self.assertEqual(e["status"],"check")
        self.assertEqual(e["date"],"2026-09-29")
        self.assertEqual(e["time"],"14:00")
        self.assertEqual(e["price_type"],"free")
        self.assertTrue(e["registration"])

if __name__=="__main__":
    unittest.main()
