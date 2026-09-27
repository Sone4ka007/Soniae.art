#!/usr/bin/env python3
import importlib.util
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]

class EventTimeParsingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        spec=importlib.util.spec_from_file_location("collector",ROOT/"scripts/events/collect_jsonld.py")
        cls.mod=importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.mod)

    def test_opening_hours_do_not_override_dated_event_time(self):
        text="Режим работы 12:00–22:00. Лекция. 30.09.2026, 19:00"
        self.assertEqual(self.mod.parse_event_page_time(text,"example-museum.ru"),"19:00")

    def test_dotted_event_time_is_supported(self):
        text="30 сентября 2026 19.30 Лекция о фотографии"
        self.assertEqual(self.mod.parse_event_page_time(text,"example.org"),"19:30")

    def test_labelled_start_beats_opening_hours(self):
        text="Музей открыт 10:00–20:00. Начало мероприятия: 18:30"
        self.assertEqual(self.mod.parse_event_page_time(text,"example.org"),"18:30")

    def test_jewish_museum_program_time(self):
        text="Режим работы 12:00–22:00. Программа вечера (19.00-21.00)"
        self.assertEqual(self.mod.parse_event_page_time(text,"www.jewish-museum.ru"),"19:00")

if __name__=="__main__":
    unittest.main()
