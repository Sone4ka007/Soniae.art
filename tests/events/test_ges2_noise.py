#!/usr/bin/env python3
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]

class Ges2NoiseTests(unittest.TestCase):
    def test_low_value_ges2_titles_are_filtered(self):
        source=(ROOT/"scripts/events/validate_events.py").read_text("utf-8")
        for title in (
            "ниже травы. игровая",
            "ателье. самостоятельная работа",
            "индивидуальный медиаторский тур",
        ):
            self.assertIn(title,source)
        # The hint list stays in the validator. These titles are no longer
        # auto-rejected; the editor reviews them.
        self.assertIn("GES2_LOW_VALUE_HINTS",source)
        self.assertNotIn("excluded_ges2_low_value",source)

    def test_collector_log_calls_candidates_raw(self):
        source=(ROOT/"scripts/events/collect_jsonld.py").read_text("utf-8")
        self.assertIn("raw new candidates before validation",source)

if __name__=="__main__":
    unittest.main()
