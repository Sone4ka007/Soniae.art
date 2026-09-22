#!/usr/bin/env python3
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]

class ApprovedStatusLockTests(unittest.TestCase):
    def test_quality_gate_does_not_downgrade_approved_open_calls(self):
        source=(ROOT/"scripts/events/quality_gate.py").read_text("utf-8")
        self.assertIn('e.get("status") in ("new","check")', source)
        self.assertNotIn('e.get("status")=="approved" and (\n        is_aggregator_url', source)

    def test_merge_locks_reviewed_records(self):
        source=(ROOT/"scripts/events/merge_remote_db.py").read_text("utf-8")
        self.assertIn('old.get("status") in ("approved","rejected")', source)

if __name__=="__main__":
    unittest.main()
