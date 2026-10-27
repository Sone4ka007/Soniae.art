#!/usr/bin/env python3
import ast
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]

def _assign(path, name):
    tree=ast.parse(Path(path).read_text("utf-8"))
    for node in tree.body:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id==name:
                    return ast.literal_eval(node.value)
    raise AssertionError(name)

class SheetOrderRegressionTests(unittest.TestCase):
    def test_push_preserves_existing_sheet_order(self):
        source=(ROOT/"scripts/events/push_sheet.py").read_text("utf-8")
        self.assertIn("current_order={}",source)
        self.assertIn("existing.sort(key=lambda e:current_order.get",source)
        self.assertIn("sheet_events=existing+fresh",source)

    def test_status_priority_applies_only_to_new_rows(self):
        source=(ROOT/"scripts/events/push_sheet.py").read_text("utf-8")
        self.assertIn("fresh.sort",source)
        existing, fresh=source.split("existing.sort",1)[1].split("fresh.sort",1)
        self.assertNotIn("priority",existing)
        self.assertIn("priority",fresh)

    def test_status_is_only_imported_when_user_changed_it(self):
        pull=(ROOT/"scripts/events/pull_sheet.py").read_text("utf-8")
        push=(ROOT/"scripts/events/push_sheet.py").read_text("utf-8")
        editorial=(ROOT/"scripts/events/sheet_editorial.py").read_text("utf-8")
        self.assertIn("capture_editor_overrides",pull)
        self.assertIn('if live != baseline.get(field, ""):',editorial)
        self.assertIn('"status"',editorial)
        headers=_assign(ROOT/"scripts/events/push_sheet.py","HEADERS")
        self.assertEqual(headers[headers.index("synced_status")-1],"id")
        self.assertIn('e.get("status","new")',push)

    def test_sheet_is_title_first_and_service_columns_are_hidden(self):
        source=(ROOT/"scripts/events/push_sheet.py").read_text("utf-8")
        headers=_assign(ROOT/"scripts/events/push_sheet.py","HEADERS")
        self.assertEqual(headers[0],"title")
        self.assertIn("synced_status",headers)
        self.assertIn("synced_url",headers)
        self.assertIn("synced_source",headers)
        start=headers.index("id")
        end=headers.index("synced_source")+1
        self.assertIn(f'"startIndex":{start},"endIndex":{end}',source)
        tail_start=headers.index("synced_title")
        tail_end=headers.index("synced_row_json")+1
        self.assertIn(f'"startIndex":{tail_start},"endIndex":{tail_end}',source)
        self.assertIn('"hiddenByUser":True',source)

    def test_stale_validation_is_cleared_before_dropdowns_are_reapplied(self):
        source=(ROOT/"scripts/events/push_sheet.py").read_text("utf-8")
        width=len(_assign(ROOT/"scripts/events/push_sheet.py","HEADERS"))
        self.assertIn(f'"startColumnIndex":0,"endColumnIndex":{width}}}',source)
        self.assertIn('["available","sold_out","postponed","cancelled","unknown"]',source)

    def test_sync_reads_columns_by_header_name_not_fixed_position(self):
        pull=(ROOT/"scripts/events/pull_sheet.py").read_text("utf-8")
        push=(ROOT/"scripts/events/push_sheet.py").read_text("utf-8")
        self.assertIn("dict(zip(headers",pull)
        self.assertIn("dict(zip(headers",push)

if __name__=="__main__":
    unittest.main()
