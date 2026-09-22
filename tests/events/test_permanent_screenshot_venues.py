#!/usr/bin/env python3
import json
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]

class PermanentScreenshotVenueTests(unittest.TestCase):
    def setUp(self):
        sources=json.loads((ROOT/"events/sources.json").read_text("utf-8"))["sources"]
        discovery=json.loads((ROOT/"events/discovery_sources.json").read_text("utf-8"))["sources"]
        self.sources={s["name"]:s for s in sources}
        self.discovery={s["name"]:s for s in discovery}

    def test_permanent_museum_and_art_sources_present(self):
        required=(
            "Музей AZ — выставки и события",
            "AZART — выставки",
            "AZART — события",
            "Фонд Ruarts — проекты",
            "Фонд Ruarts — события",
            "Масловка — выставки",
            "Масловка — события",
            "Музей архитектуры им. Щусева — выставки",
            "Музей архитектуры им. Щусева — мероприятия",
            "Музей транспорта Москвы — выставки",
            "Музей транспорта Москвы — афиша",
            "Музей ЗИЛАРТ",
        )
        for name in required:
            self.assertIn(name,self.sources)

    def test_screenshot_recurring_sources_present(self):
        for name in ("blazar","Первая фабрика авангарда","SCAN"):
            self.assertIn(name,self.discovery)

    def test_exhibition_streams_are_typed(self):
        for name in (
            "AZART — выставки",
            "Фонд Ruarts — проекты",
            "Масловка — выставки",
            "Музей архитектуры им. Щусева — выставки",
            "Музей транспорта Москвы — выставки",
        ):
            self.assertEqual(self.sources[name].get("kind"),"exhibition")

if __name__=="__main__":
    unittest.main()
