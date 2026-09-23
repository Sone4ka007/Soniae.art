#!/usr/bin/env python3
import importlib.util
import json
import os
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]

class MuseumMoscowFallbackTests(unittest.TestCase):
    def test_official_telegram_source_is_configured(self):
        data=json.loads((ROOT/"events/sources.json").read_text("utf-8"))
        by_name={s["name"]:s for s in data["sources"]}
        s=by_name["Музей Москвы — официальный Telegram"]
        self.assertEqual(s["url"],"https://t.me/s/mosmuseum")
        self.assertEqual(s["adapter"],"telegram_digest")
        self.assertEqual(s["city"],"moscow")

    def test_digest_parser_extracts_future_events(self):
        os.environ.setdefault("EVENTS_SHEET_ID","test")
        os.environ.setdefault("GOOGLE_SERVICE_ACCOUNT_JSON","{}")
        spec=importlib.util.spec_from_file_location("collector",ROOT/"scripts/events/collect_jsonld.py")
        mod=importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        html="""
        <div class="tgme_widget_message" data-post="mosmuseum/9999">
          <div class="tgme_widget_message_text">
            Дайджест событий в Музее Москвы и наших филиалах<br>
            ➖ 24 сентября, четверг<br>
            19:00 лекция «Типографика авангарда» (Музей Москвы)<br>
            20:30 встреча с художником (Центр Гиляровского)
          </div>
        </div>
        """
        src={"name":"Музей Москвы — официальный Telegram","city":"moscow","url":"https://t.me/s/mosmuseum","venue":"Музей Москвы"}
        events=mod.extract_telegram_digest(html,src)
        self.assertTrue(any(e["title"]=="лекция «Типографика авангарда»" for e in events))
        self.assertTrue(any(e["venue"]=="Центр Гиляровского" for e in events))
        self.assertTrue(all(e["status"]=="check" for e in events))

if __name__=="__main__":
    unittest.main()
