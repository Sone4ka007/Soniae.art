#!/usr/bin/env python3
import importlib.util
import os
import unittest
from datetime import date
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]

class TelegramOpenCallsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        spec=importlib.util.spec_from_file_location("tgcollector",ROOT/"scripts/events/collect_telegram_open_calls.py")
        cls.mod=importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.mod)

    def test_russian_deadline(self):
        d=self.mod.parse_deadline("Опен-колл. Дедлайн: 30 сентября 2026")
        self.assertEqual(d,date(2026,9,30))

    def test_primary_url_prefers_non_telegram(self):
        u=self.mod.choose_primary(["https://t.me/test/1","https://example.org/open-call"])
        self.assertEqual(u,"https://example.org/open-call")

    def test_city_inference(self):
        self.assertEqual(self.mod.infer_city("open call в Санкт-Петербурге"),"spb")
        self.assertEqual(self.mod.infer_city("Москва, художники"),"moscow")

    def test_workflow_has_secret_and_chat_allowlist(self):
        source=(ROOT/".github/workflows/events-pipeline.yml").read_text("utf-8")
        self.assertIn("TELEGRAM_OPEN_CALLS_BOT_TOKEN",source)
        self.assertIn("TELEGRAM_OPEN_CALLS_CHAT_ID",source)
        self.assertIn("collect_telegram_open_calls.py",source)

if __name__=="__main__":
    unittest.main()
