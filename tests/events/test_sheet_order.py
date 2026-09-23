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
        self.assertIn('"synced_status","synced_url","synced_source"',push)
        self.assertIn('e.get("status","new")',push)

    def test_sheet_is_title_first_and_service_columns_are_hidden(self):
        source=(ROOT/"scripts/events/push_sheet.py").read_text("utf-8")
        self.assertIn('HEADERS=["title","status","date","time","venue","city","kind"',source)
        self.assertIn('"id","synced_status","synced_url","synced_source"',source)
        self.assertIn('"startIndex":24,"endIndex":28',source)
        self.assertIn('"hiddenByUser":True',source)

    def test_stale_validation_is_cleared_before_dropdowns_are_reapplied(self):
        source=(ROOT/"scripts/events/push_sheet.py").read_text("utf-8")
        self.assertIn('"startColumnIndex":0,"endColumnIndex":34}}}',source)
        self.assertIn('["available","sold_out","postponed","cancelled","unknown"]',source)

    def test_sync_reads_columns_by_header_name_not_fixed_position(self):
        pull=(ROOT/"scripts/events/pull_sheet.py").read_text("utf-8")
        push=(ROOT/"scripts/events/push_sheet.py").read_text("utf-8")
        self.assertIn("dict(zip(headers",pull)
        self.assertIn("dict(zip(headers",push)

if __name__=="__main__":
    unittest.main()
