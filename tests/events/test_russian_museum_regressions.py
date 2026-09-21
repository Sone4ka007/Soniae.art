#!/usr/bin/env python3
import json
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]

class RussianMuseumRegressionTests(unittest.TestCase):
    def test_listing_pages_are_excluded(self):
        cfg=json.loads((ROOT/"events/sources.json").read_text("utf-8"))
        src=next(s for s in cfg["sources"] if s["name"]=="Русский музей — выставки")
        self.assertIn("/exhibitions/coming/",src.get("exclude_paths",[]))

    def test_service_listing_is_not_pending_moderation(self):
        db=json.loads((ROOT/"content/events.json").read_text("utf-8"))
        row=next(e for e in db["events"] if e.get("id")=="spb-2026-09-25-f3e5510bdb")
        self.assertEqual(row["status"],"rejected")
        self.assertEqual(row["review_reason"],"section_listing_not_event")

    def test_exhibition_copy_does_not_contain_legal_footer(self):
        db=json.loads((ROOT/"content/events.json").read_text("utf-8"))
        for row in db["events"]:
            if row.get("source")=="Русский музей — выставки" and row.get("status") in ("new","check","approved"):
                self.assertNotIn("является обладателем исключительных прав",row.get("description","").lower())

    def test_pelageya_is_a_real_exhibition_record(self):
        db=json.loads((ROOT/"content/events.json").read_text("utf-8"))
        row=next(e for e in db["events"] if e.get("id")=="manual-spb-2026-pelageya-shuriga")
        self.assertEqual(row["kind"],"exhibition")
        self.assertEqual(row["title"],"Пелагея Шурига. 1900–1980")
        self.assertEqual(row["start_date"],"2026-09-19")
        self.assertEqual(row["end_date"],"2026-11-16")
        self.assertEqual(row["status"],"check")

if __name__=="__main__":
    unittest.main()
