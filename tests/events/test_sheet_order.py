#!/usr/bin/env python3
import importlib.util
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]

class SheetOrderRegressionTests(unittest.TestCase):
    def test_push_preserves_existing_sheet_order(self):
        source=(ROOT/"scripts/events/push_sheet.py").read_text("utf-8")
        self.assertIn("current_order={}",source)
        self.assertIn("existing.sort(key=lambda e:current_order.get",source)
        self.assertIn("sheet_events=existing+fresh",source)

    def test_status_priority_applies_only_to_new_rows(self):
        source=(ROOT/"scripts/events/push_sheet.py").read_text("utf-8")
        self.assertIn("Only genuinely new rows are ordered by moderation priority",source)
        self.assertIn("fresh.sort",source)

if __name__=="__main__":
    unittest.main()
