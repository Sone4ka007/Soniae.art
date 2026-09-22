#!/usr/bin/env python3
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]

class SourceLinkSyncTests(unittest.TestCase):
    def test_pull_sheet_tracks_url_and_source_baselines(self):
        src=(ROOT/"scripts/events/pull_sheet.py").read_text("utf-8")
        self.assertIn('editable={"status","editor_note","checked_at","review_reason","url","source"}',src)
        self.assertIn('baseline_key="synced_"+k',src)
        self.assertIn('RANGE="Events!A:AB"',src)

    def test_push_sheet_tracks_hidden_source_baselines(self):
        src=(ROOT/"scripts/events/push_sheet.py").read_text("utf-8")
        self.assertIn('"synced_url","synced_source"',src)
        self.assertIn('RANGE="Events!A:AB"',src)
        self.assertIn('startIndex":25,"endIndex":28',src)

    def test_approved_ewert_rows_no_longer_use_ewert_as_primary(self):
        import json
        db=json.loads((ROOT/"content/events.json").read_text("utf-8"))
        bad=[]
        for e in db.get("events",[]):
            if e.get("status")!="approved":
                continue
            if "ewert" in str(e.get("source","")).lower() or "ewert.ru" in str(e.get("url","")).lower():
                bad.append(e.get("id"))
        self.assertEqual(bad,[])

if __name__=="__main__":
    unittest.main()
