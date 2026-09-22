#!/usr/bin/env python3
import json
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]

class CoreMuseumSourceTests(unittest.TestCase):
    def setUp(self):
        self.data=json.loads((ROOT/"events/sources.json").read_text("utf-8"))
        self.by_name={s["name"]:s for s in self.data["sources"]}

    def test_tretyakov_exhibitions_are_explicit_exhibitions(self):
        s=self.by_name["Третьяковская галерея — выставки"]
        self.assertEqual(s["city"],"moscow")
        self.assertEqual(s["kind"],"exhibition")
        self.assertIn("tretyakovgallery.ru",s["url"])

    def test_hermitage_is_saint_petersburg_official_source(self):
        s=self.by_name["Государственный Эрмитаж — выставки и события"]
        self.assertEqual(s["city"],"spb")
        self.assertEqual(s["url"],"https://hermitagemuseum.org/what-s-on")
        self.assertEqual(s["adapter"],"event_links")

    def test_museum_of_moscow_has_events_and_exhibitions(self):
        events=self.by_name["Музей Москвы — события"]
        exhibitions=self.by_name["Музей Москвы — выставки"]
        self.assertEqual(events["city"],"moscow")
        self.assertEqual(exhibitions["kind"],"exhibition")
        self.assertIn("mosmuseum.ru",events["url"])

    def test_russian_museum_has_exhibitions_and_events(self):
        exhibition=self.by_name["Русский музей — выставки"]
        events=self.by_name["Русский музей — события и программы"]
        self.assertEqual(exhibition["city"],"spb")
        self.assertEqual(exhibition["kind"],"exhibition")
        self.assertEqual(events["city"],"spb")
        self.assertIn("rusmuseum.ru",events["url"])

if __name__=="__main__":
    unittest.main()
