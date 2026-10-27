#!/usr/bin/env python3
import importlib.util
import unittest
from datetime import date, timedelta
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
_MONTHS=("января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря")

def _future(days):
    d=date.today()+timedelta(days=days)
    if d.year!=date.today().year:
        d=date.today()
    return d

def _ru(d):
    return f"{d.day} {_MONTHS[d.month-1]} {d.year}"

class RnbParserTests(unittest.TestCase):
    def test_listing_is_split_into_real_events(self):
        spec=importlib.util.spec_from_file_location("collector",ROOT/"scripts/events/collect_jsonld.py")
        mod=importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
        first=_future(10)
        second=_future(12)
        html=f"""
        <html><body>
        <h1>Афиша мероприятий РНБ</h1>
        <div>{_ru(first)}</div><div>среда</div><div>19:00</div><div>12+</div>
        <div>Цикл «Еще один Юсуповский»</div>
        <div>Лекция «Княгиня, графиня, маркиза. Судьба Зинаиды Ивановны Юсуповой»</div>
        <div>Вход по регистрации на Timepad.</div>
        <div>{_ru(second)}</div><div>пятница</div><div>18:30</div><div>16+</div>
        <div>Лекция «Сердце в пятки: что с нами делает тревога»</div>
        </body></html>
        """
        src={"name":"Российская национальная библиотека — афиша","city":"spb","url":"https://nlr.ru/nlr_visit/RA593/afisha-rnb","venue":"Российская национальная библиотека"}
        events=mod.extract_rnb(html,src)
        self.assertEqual(len(events),2)
        self.assertTrue(events[0]["title"].startswith("Лекция"))
        self.assertNotEqual(events[0]["title"],"Афиша мероприятий РНБ")

if __name__=="__main__":
    unittest.main()
