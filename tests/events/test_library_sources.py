#!/usr/bin/env python3
import json
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]

class LibrarySourceTests(unittest.TestCase):
    def setUp(self):
        data=json.loads((ROOT/"events/sources.json").read_text("utf-8"))
        self.by_name={s["name"]:s for s in data["sources"]}

    def test_moscow_library_sources_present(self):
        for name in (
            "Библиотека им. Н. А. Некрасова",
            "Библиотека иностранной литературы — мероприятия",
            "Российская государственная библиотека — афиша",
        ):
            self.assertIn(name,self.by_name)
            self.assertEqual(self.by_name[name]["city"],"moscow")
            self.assertEqual(self.by_name[name].get("source_group"),"library")

    def test_spb_library_sources_present(self):
        for name in (
            "Российская национальная библиотека — афиша",
            "Санкт-Петербургская государственная театральная библиотека — афиша",
            "Санкт-Петербургская государственная театральная библиотека — выставки",
        ):
            self.assertIn(name,self.by_name)
            self.assertEqual(self.by_name[name]["city"],"spb")
            self.assertEqual(self.by_name[name].get("source_group"),"library")

    def test_theatrical_library_exhibitions_are_explicit_and_free(self):
        s=self.by_name["Санкт-Петербургская государственная театральная библиотека — выставки"]
        self.assertEqual(s["kind"],"exhibition")
        self.assertTrue(s.get("high_free_yield"))
        self.assertEqual(s.get("default_price_type"),"free")

if __name__=="__main__":
    unittest.main()
