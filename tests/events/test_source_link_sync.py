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

def _headers():
    return _assign(ROOT/"scripts/events/push_sheet.py","HEADERS")

def _column_letter(n):
    letters=""
    while n:
        n, rem=divmod(n-1, 26)
        letters=chr(65+rem)+letters
    return letters

class SourceLinkSyncTests(unittest.TestCase):
    def test_pull_sheet_tracks_url_and_source_baselines(self):
        pull=(ROOT/"scripts/events/pull_sheet.py").read_text("utf-8")
        editorial=(ROOT/"scripts/events/sheet_editorial.py").read_text("utf-8")
        headers=_headers()
        self.assertIn("capture_editor_overrides",pull)
        self.assertIn('"url","source"',editorial)
        self.assertIn('"social_priority","social_title","social_description"',editorial)
        self.assertIn("synced_row_json",headers)
        self.assertEqual(_assign(ROOT/"scripts/events/pull_sheet.py","RANGE"),
                         f"Events!A:{_column_letter(len(headers))}")

    def test_push_sheet_tracks_hidden_source_baselines(self):
        src=(ROOT/"scripts/events/push_sheet.py").read_text("utf-8")
        headers=_headers()
        self.assertIn("synced_url",headers)
        self.assertIn("synced_source",headers)
        start=headers.index("id")
        end=headers.index("synced_source")+1
        self.assertIn(f'"startIndex":{start},"endIndex":{end}',src)
        self.assertEqual(_assign(ROOT/"scripts/events/push_sheet.py","RANGE"),
                         f"Events!A:{_column_letter(len(headers))}")

    def test_approved_ewert_rows_no_longer_use_ewert_as_primary(self):
        import json
        db=json.loads((ROOT/"content/events.json").read_text("utf-8"))
        bad=[]
        for e in db.get("events",[]):
            if e.get("status")!="approved":
                continue
            # The source label may still say where the row was discovered.
            # The link the digest publishes must not be the aggregator.
            if "ewert.ru" in str(e.get("url","")).lower():
                bad.append(e.get("id"))
        self.assertEqual(bad,[])

if __name__=="__main__":
    unittest.main()
