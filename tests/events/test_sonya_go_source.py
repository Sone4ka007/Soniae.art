#!/usr/bin/env python3
import importlib.util
import json
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]

class SonyaGoSourceTests(unittest.TestCase):
    def test_source_is_configured_as_events_only(self):
        data=json.loads((ROOT/"events/sources.json").read_text("utf-8"))
        src=next(s for s in data["sources"] if s["name"]=="Соня Go — события")
        self.assertEqual(src["url"],"https://t.me/s/sonnya_go")
        self.assertEqual(src["adapter"],"telegram_channel_events")
        self.assertEqual(src["kind"],"event")

    def test_parser_creates_check_event_and_skips_open_calls(self):
        spec=importlib.util.spec_from_file_location("collector",ROOT/"scripts/events/collect_jsonld.py")
        mod=importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
        html="""
        <div class="tgme_widget_message" data-post="sonnya_go/1">
          <div class="tgme_widget_message_text">
            Лекция «Как смотреть современное искусство»<br>
            25 сентября, 19:00<br>
            📍 Центр современного искусства<br>
            Бесплатно, по регистрации
            <a href="https://example.org/event">ссылка</a>
          </div>
        </div>
        <div class="tgme_widget_message" data-post="sonnya_go/2">
          <div class="tgme_widget_message_text">
            Open call для художников<br>
            Дедлайн 30 сентября
          </div>
        </div>
        """
        src={"name":"Соня Go — события","city":"moscow","url":"https://t.me/s/sonnya_go","venue":"","kind":"event"}
        events=mod.extract_telegram_channel_events(html,src)
        self.assertEqual(len(events),1)
        self.assertEqual(events[0]["status"],"check")
        self.assertEqual(events[0]["kind"],"event")
        self.assertEqual(events[0]["url"],"https://example.org/event")
        self.assertEqual(events[0]["venue"],"Центр современного искусства")

    def test_editorial_notes_do_not_become_title_and_specific_announcement_link_wins(self):
        spec=importlib.util.spec_from_file_location("collector2",ROOT/"scripts/events/collect_jsonld.py")
        mod=importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
        html="""
        <div class="tgme_widget_message" data-post="sonnya_go/99">
          <div class="tgme_widget_message_text">
            Почему интересно: разбор полного пути графической истории после создания страниц<br>
            Нетворкинг: высокий — руководитель программы современной графики и комикса<br>
            «Путь молодого автора: от комикса к бренду» — <a href="https://design.hse.ru/news/7109">официальный анонс</a><br>
            25 сентября, 19:00<br>
            Можно пойти ради нетворкинга<br>
            <a href="http://design.hse.ru/">Школа дизайна</a>
          </div>
        </div>
        """
        src={"name":"Соня Go — события","city":"moscow","url":"https://t.me/s/sonnya_go","venue":"","kind":"event"}
        events=mod.extract_telegram_channel_events(html,src)
        self.assertEqual(len(events),1)
        self.assertEqual(events[0]["title"],"Путь молодого автора: от комикса к бренду")
        self.assertEqual(events[0]["url"],"https://design.hse.ru/news/7109")
        self.assertNotIn("Почему интересно",events[0]["description"])
        self.assertNotIn("Нетворкинг",events[0]["description"])

if __name__=="__main__":
    unittest.main()
