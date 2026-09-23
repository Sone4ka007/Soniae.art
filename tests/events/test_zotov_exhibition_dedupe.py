#!/usr/bin/env python3
import importlib.util
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]

class ZotovExhibitionDedupeTests(unittest.TestCase):
    def test_ongoing_exhibition_keeps_original_start_date(self):
        spec=importlib.util.spec_from_file_location("collector",ROOT/"scripts/events/collect_jsonld.py")
        mod=importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        html="""
        <a href="/events/hleb/">01.09.2026–30.09.2026 Выставка Хлеб</a>
        """
        src={"name":"Центр Зотов","city":"moscow","url":"https://centrezotov.ru/program/","venue":"Центр Зотов"}
        events=mod.extract_zotov(html,src)
        self.assertEqual(len(events),1)
        self.assertEqual(events[0]["date"],"2026-09-01")
        self.assertEqual(events[0]["start_date"],"2026-09-01")
        self.assertEqual(events[0]["end_date"],"2026-09-30")
        self.assertEqual(events[0]["kind"],"exhibition")

if __name__=="__main__":
    unittest.main()
