#!/usr/bin/env python3
import importlib.util
import json
import unittest
from datetime import date
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]

class HseStandaloneLectureTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        spec=importlib.util.spec_from_file_location("collector",ROOT/"scripts/events/collect_jsonld.py")
        cls.mod=importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.mod)

    def test_standalone_hse_source_present(self):
        data=json.loads((ROOT/"events/sources.json").read_text("utf-8"))
        src=next(s for s in data["sources"] if s["url"]=="https://design.hse.ru/info/lecture_drive")
        self.assertEqual(src["adapter"],"single_event_page")

    def test_single_event_page(self):
        html="""
        <html><body>
          <h1>Дизайн рулит: как дизайн-концепции драйвят бизнес</h1>
          <p>Бесплатная открытая лекция и публичная сессия вопросов-ответов.</p>
          <div>Дата и время: 29 сентября 2026, 14:00</div>
          <div>Адрес: ул. Малая Пионерская, 12</div>
          <div>Зарегистрироваться</div>
        </body></html>
        """
        src={"name":"Школа дизайна НИУ ВШЭ — отдельные регистрационные страницы","city":"moscow","url":"https://design.hse.ru/info/lecture_drive","venue":"Школа дизайна НИУ ВШЭ","kind":"event"}
        events=self.mod.extract_single_event_page(html,src)
        self.assertEqual(len(events),1)
        self.assertEqual(events[0]["date"],"2026-09-29")
        self.assertEqual(events[0]["time"],"14:00")
        self.assertEqual(events[0]["price"],0)
        self.assertEqual(events[0]["status"],"check")

if __name__=="__main__":
    unittest.main()
