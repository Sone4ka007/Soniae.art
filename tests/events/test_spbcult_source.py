#!/usr/bin/env python3
import json
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]

class SpbCultSourceTests(unittest.TestCase):
    def test_spbcult_source_present(self):
        data=json.loads((ROOT/"events/sources.json").read_text("utf-8"))
        src=next(s for s in data["sources"] if s["url"]=="https://spbcult.ru/news/anonsy/")
        self.assertEqual(src["city"],"spb")
        self.assertEqual(src["adapter"],"event_links")

    def test_manege_roundtables_added_for_moderation(self):
        db=json.loads((ROOT/"content/events.json").read_text("utf-8"))
        items=[e for e in db["events"] if str(e.get("id","")).startswith("spb-2026-09-25-manege-")]
        self.assertEqual(len(items),4)
        self.assertTrue(all(e["status"]=="check" for e in items))
        self.assertTrue(all(e["url"]=="https://manegespb.timepad.ru/event/4205671/" for e in items))

if __name__=="__main__":
    unittest.main()
