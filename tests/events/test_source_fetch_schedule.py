#!/usr/bin/env python3
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]

class SourceFetchAndScheduleTests(unittest.TestCase):
    def test_collector_uses_browser_headers_and_requests(self):
        source=(ROOT/"scripts/events/collect_jsonld.py").read_text("utf-8")
        self.assertIn("BROWSER_HEADERS",source)
        self.assertIn("requests.get",source)
        self.assertIn("Sec-Fetch-Mode",source)

    def test_hermitage_has_ssl_fallback(self):
        source=(ROOT/"scripts/events/collect_jsonld.py").read_text("utf-8")
        self.assertIn('if "hermitagemuseum.org" in host',source)
        self.assertIn("verify=False",source)

    def test_pipeline_runs_three_times_daily(self):
        source=(ROOT/".github/workflows/events-pipeline.yml").read_text("utf-8")
        self.assertIn('cron: "30 3,9,15 * * *"',source)
        self.assertIn("requests certifi",source)

if __name__=="__main__":
    unittest.main()
