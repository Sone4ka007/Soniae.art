#!/usr/bin/env python3
import importlib.util
import unittest
from pathlib import Path
from bs4 import BeautifulSoup

ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location("collect_jsonld_split_test",ROOT/"scripts/events/collect_jsonld.py")
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class RosphotoSplitProgrammeTests(unittest.TestCase):
    def test_programme_page_becomes_individual_events(self):
        html="""
        <html><body>
          <h1>Культурный ассамбляж</h1>
          <p>30.09.2099</p>
          <h2>ПРОГРАММА МЕРОПРИЯТИЙ</h2>
          <p>30 сентября, 19:00</p>
          <h2>Лекция «Фотография в венгерской литературе»</h2>
          <p>Подробное описание лекции о венгерской фотографии и литературе для посетителей музея.</p>
          <p>10 октября, 17:00</p>
          <h2>Кураторская экскурсия «Йожеф Кадар»</h2>
          <p>Подробное описание кураторской экскурсии по выставке и творчеству венгерского художника.</p>
          <p>21 октября, 19:00</p>
          <h2>Кинопоказ «Классика венгерского кино»</h2>
          <p>Подробное описание показа классического венгерского фильма и разговора после просмотра.</p>
          <p>28 октября, 19:00</p>
          <h2>Творческая встреча с фотографом</h2>
          <p>Подробное описание встречи с современным фотографом и рассказа о профессиональном пути.</p>
          <h2>Связанные события</h2>
        </body></html>
        """
        soup=BeautifulSoup(html,"html.parser")
        src={"name":"РОСФОТО","city":"spb","venue":"РОСФОТО"}
        events=mod.extract_split_program_events(
            soup,src,"https://rosphoto.org/events/test/",soup.get_text(" ",strip=True),2099
        )
        self.assertEqual(len(events),4)
        self.assertEqual([e["date"] for e in events],[
            "2099-09-30","2099-10-10","2099-10-21","2099-10-28"
        ])
        self.assertEqual(events[0]["time"],"19:00")
        self.assertIn("Лекция",events[0]["title"])
        self.assertIn("Кураторская экскурсия",events[1]["title"])
        self.assertIn("Кинопоказ",events[2]["title"])
        self.assertIn("Творческая встреча",events[3]["title"])
        self.assertEqual(len({e["id"] for e in events}),4)

if __name__=="__main__":
    unittest.main()
