#!/usr/bin/env python3
import importlib.util
import json
import unittest
from datetime import date
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]

class WinzavodAzParsingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        spec=importlib.util.spec_from_file_location("collector",ROOT/"scripts/events/collect_jsonld.py")
        cls.mod=importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.mod)

    def test_explicit_ruble_price_beats_free_navigation_text(self):
        price,text=self.mod.parse_price("Бесплатные Платные 650 ₽ Купить билет")
        self.assertEqual(price,650)
        self.assertEqual(text,"650 ₽")

    def test_winzavod_cross_month_range(self):
        a,b=self.mod.parse_ru_date_range("01 сентября — 11 октября 2026",2026)
        self.assertEqual(a,date(2026,9,1))
        self.assertEqual(b,date(2026,10,11))

    def test_winzavod_same_month_range(self):
        a,b=self.mod.parse_ru_date_range("10–11 октября 2026",2026)
        self.assertEqual(a,date(2026,10,10))
        self.assertEqual(b,date(2026,10,11))

    def test_winzavod_scans_enough_details(self):
        data=json.loads((ROOT/"events/sources.json").read_text("utf-8"))
        src=next(s for s in data["sources"] if s["name"]=="ЦСИ Винзавод")
        self.assertGreaterEqual(src["max_detail_pages"],100)

if __name__=="__main__":
    unittest.main()
