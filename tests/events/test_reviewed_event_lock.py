#!/usr/bin/env python3
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]

class ReviewedEventLockTests(unittest.TestCase):
    def setUp(self):
        self.source=(ROOT/"scripts/events/merge_remote_db.py").read_text("utf-8")

    def test_reviewed_record_replaces_generated_record(self):
        self.assertIn('if old and old.get("status") in ("approved","rejected"):', self.source)
        self.assertIn("e=dict(old)", self.source)

    def test_curated_seed_cannot_override_reviewed_record(self):
        self.assertIn('old=remote_by_id.get(rid)', self.source)
        self.assertIn('merged.append(dict(old))', self.source)

    def test_reviewed_record_survives_source_disappearance(self):
        self.assertIn('if e.get("status") in ("approved","rejected"):', self.source)
        self.assertNotIn("still_relevant(e)", self.source)

if __name__=="__main__":
    unittest.main()
