#!/usr/bin/env python3
import importlib.util
import json
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]

spec=importlib.util.spec_from_file_location("quality_gate_test",ROOT/"scripts/events/quality_gate.py")
quality=importlib.util.module_from_spec(spec)
spec.loader.exec_module(quality)

class RussianMuseumRegressionTests(unittest.TestCase):
    def test_listing_pages_are_excluded(self):
        cfg=json.loads((ROOT/"events/sources.json").read_text("utf-8"))
        src=next(s for s in cfg["sources"] if s["name"]=="Русский музей — выставки")
        self.assertIn("/exhibitions/coming/",src.get("exclude_paths",[]))

    def test_service_titles_are_skipped_by_collector(self):
        source=(ROOT/"scripts/events/collect_jsonld.py").read_text("utf-8")
        self.assertIn('"будущие выставки"',source)
        self.assertIn('"текущие выставки"',source)

    def test_legal_footer_is_removed_by_quality_gate(self):
        bad=("Русский музей является обладателем исключительных прав на все изображения "
             "интерьеров и произведений искусства из коллекции Русского музея.")
        self.assertEqual(quality.clean_description(bad,"exhibition"),"")

    def test_collector_prefers_about_exhibition_section(self):
        source=(ROOT/"scripts/events/collect_jsonld.py").read_text("utf-8")
        self.assertIn('"О выставке"',source)
        self.assertIn('"rusmuseum.ru"',source)

if __name__=="__main__":
    unittest.main()
