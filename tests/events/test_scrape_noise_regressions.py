import sys,unittest
from pathlib import Path
from unittest.mock import patch
from datetime import date,timedelta
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'scripts/events'))
import collect_jsonld as c
from dedupe_exhibitions import collapse_exhibitions
class ScrapeNoiseTests(unittest.TestCase):
 def test_library_popup_is_not_event_heading(self):
  dt=date.today()+timedelta(days=3)
  h=f'<h2>Подписка на рассылку</h2><div class="articletext"><h2 class="articleheader">Лекция об искусстве</h2>{dt.day} октября {dt.year} 19:00</div>'
  src={'name':'РГБМ','city':'moscow','venue':'РГБМ','url':'https://rgub.ru/schedule/','href_contains':['item.php']}
  with patch.object(c,'fetch',return_value=h):out=c.extract_event_links('<a href="item.php?new_id=1">Лекция</a>',src)
  self.assertEqual(out[0]['title'],'Лекция об искусстве');self.assertEqual(out[0]['time'],'19:00')
 def test_rnb_split_date_and_title(self):
  dt=date.today()+timedelta(days=3)
  h=f'<div class="row"><div class="day">{dt.day}</div><div class="month">октября</div><div class="year">{dt.year}</div><div class="time">18:30</div><div class="zagl"><a href="/nlr_visit/event/1">Лекция <strong>«Искусство»</strong></a></div></div>'
  out=c.extract_rnb(h,{'name':'РНБ','city':'spb','venue':'РНБ','url':'https://nlr.ru/afisha'})
  self.assertEqual(out[0]['title'],'Лекция «Искусство»');self.assertEqual(out[0]['url'],'https://nlr.ru/nlr_visit/event/1')
 def test_exhibition_collapse_preserves_approval(self):
  base={'city':'moscow','kind':'exhibition','url':'https://ges-2.org/project','title':'Начала'}
  out=collapse_exhibitions([dict(base,id='a',date='2026-10-01',status='rejected'),dict(base,id='b',date='2026-10-02',status='approved'),dict(base,id='c',date='2026-10-03',status='new',start_date='2026-09-01',end_date='2026-11-01')])
  self.assertEqual(len(out),1);self.assertEqual(out[0]['id'],'b');self.assertEqual(out[0]['date'],'2026-09-01')
 def test_recurring_lectures_remain_separate(self):
  self.assertEqual(len(collapse_exhibitions([{'kind':'event','title':'Лекция','date':'2026-10-01'},{'kind':'event','title':'Лекция','date':'2026-10-02'}])),2)
 def test_ges2_month_range(self):
  start,end=c.parse_ru_date_range('Дата: 1 окт–4 ноя 2026')
  self.assertEqual(start.isoformat(),'2026-10-01');self.assertEqual(end.isoformat(),'2026-11-04')
