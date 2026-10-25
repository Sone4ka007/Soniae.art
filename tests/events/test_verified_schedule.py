import sys
from pathlib import Path
import unittest
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'scripts/events'))
import verified_schedule as v
from audit_event_times import extract,pairs

class ScheduleAuditTests(unittest.TestCase):
    def test_tretyakov_uses_current_header_not_related_date(self):
        html='<h1>Лекция Кристи</h1><div class="event-detail__info-date">30 октября 2026 19:00</div><p>6 ноября 2026 19:00</p>'
        result=extract(html,{'title':'Лекция Кристи','date':'2026-11-06','url':'https://tretyakov.ru/event/kristi'})
        self.assertEqual((result['date'],result['time']),('2026-10-30','19:00'))
    def test_numeric_date_is_not_time(self):
        self.assertEqual(pairs('06.11.2026','2026'),[])
    def test_opening_hours_are_not_start_time(self):
        self.assertIsNone(extract('<h1>Лекция</h1><p>Музей открыт 10:00–20:00</p>',{'title':'Лекция','date':'2026-10-30','url':'https://example.org/lecture'}))
    def test_audit_does_not_change_status_or_new_manual_time(self):
        facts={'x':{'previous_time':'01:20','time':'19:00','previous_date':'2026-11-06','date':'2026-10-30'}}
        with patch.object(v,'corrections',return_value=facts):
            e={'id':'x','status':'rejected','time':'01:20','date':'2026-11-06','editor_overrides':{'time':'01:20'}}
            v.apply_verified_schedule(e)
            self.assertEqual(e['time'],'19:00');self.assertEqual(e['date'],'2026-10-30');self.assertEqual(e['status'],'rejected')
            self.assertEqual(e['editor_overrides']['time'],'19:00')
            e['time']='18:30';v.apply_verified_schedule(e);self.assertEqual(e['time'],'18:30')
if __name__=='__main__':unittest.main()
