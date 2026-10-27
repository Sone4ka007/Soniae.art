#!/usr/bin/env python3
import importlib.util
import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def load_apply():
    spec = importlib.util.spec_from_file_location(
        "apply_cleanup_proposal",
        ROOT / "scripts/events/apply_cleanup_proposal.py",
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class ApplyCleanupTests(unittest.TestCase):
    def test_listed_duplicates_are_rejected_and_keepers_stay(self):
        proposal = (ROOT / "events/cleanup-proposal.md").read_text("utf-8")
        apply = load_apply()
        db = json.loads((ROOT / "content/events.json").read_text("utf-8"))
        by_id = {event["id"]: event for event in db["events"]}
        duplicates = apply.listed_duplicates(proposal)
        self.assertEqual(len(duplicates), 24)
        for event_id in duplicates:
            event = by_id[event_id]
            self.assertEqual(event["status"], "rejected")
            self.assertEqual(event["review_reason"], "duplicate_record")
            self.assertEqual(event["editor_overrides"]["status"], "rejected")
        for event_id, status in re.findall(r"оставить `([^`]+)` \(([^)]+)\)", proposal):
            self.assertEqual(by_id[event_id]["status"], status)

        again, junk_changed, _skipped = apply.apply_database(db, proposal)
        self.assertEqual(again, [])
        self.assertEqual(junk_changed, [])


if __name__ == "__main__":
    unittest.main()
