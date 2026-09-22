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

    def test_status_is_only_imported_when_user_changed_it(self):
        pull=(ROOT/"scripts/events/pull_sheet.py").read_text("utf-8")
        push=(ROOT/"scripts/events/push_sheet.py").read_text("utf-8")
        self.assertIn('synced_status=str(row.get("synced_status","")).strip()',pull)
        self.assertIn("live_status==synced_status",pull)
        self.assertIn('"synced_status"]',push)
        self.assertIn('e.get("status","new")',push)

    def test_baseline_column_is_hidden(self):
        source=(ROOT/"scripts/events/push_sheet.py").read_text("utf-8")
        self.assertIn('"startIndex":25,"endIndex":26',source)
        self.assertIn('"hiddenByUser":True',source)

if __name__=="__main__":
    unittest.main()
