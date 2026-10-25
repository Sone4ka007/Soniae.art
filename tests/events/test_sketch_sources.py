import sys
import json
import unittest
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts/events'))
from sketch_sources import extract
from collect_jsonld import make_event, parse_price


class SketchSourcesTests(unittest.TestCase):
    def source(self, adapter):
        return dict(name='Test sketches', venue='Studio', city='moscow',
                    url='https://example.org/sketches', adapter=adapter)

    def test_school_uses_live_weekly_data_and_excludes_online_archived(self):
        data = [dict(__typename='OpenClass', title='Наброски', price=750,
                     schedule=[dict(day='wen', startTime='10:30:00')]),
                dict(__typename='OpenClass', title='Наброски онлайн', isOnline=True),
                dict(__typename='OpenClass', title='Наброски архив', isArchived=True)]
        html = '<script id="__NEXT_DATA__" type="application/json">'+json.dumps(data)+'</script>'
        events = extract(html, self.source('sketch_prostaya'), make_event, parse_price, date(2026,10,25))
        self.assertEqual([e['date'] for e in events], ['2026-10-28','2026-11-04'])
        self.assertTrue(all(e['status']=='check' and e['price']==750 and e['time']=='10:30' for e in events))

    def test_telegram_multiple_dates_old_posts_and_cancellations(self):
        def post(num, text, stamp='2026-10-24'):
            return f'<div class="tgme_widget_message" data-post="studio/{num}"><time datetime="{stamp}"></time><div class="tgme_widget_message_text">{text}</div></div>'
        html = (post(1,'Наброски<br>27 октября 19:00<br>28 октября 20:00') +
                post(2,'Наброски 27 октября 19:00','2025-10-24') +
                post(3,'Наброски 29 октября отменены') +
                post(4,'Выставка 30 октября'))
        events = extract(html, self.source('sketch_telegram'), make_event, parse_price, date(2026,10,25))
        self.assertEqual([(e['date'],e['time']) for e in events], [('2026-10-27','19:00'),('2026-10-28','20:00')])
        self.assertTrue(all(e['url']=='https://t.me/studio/1' and e['status']=='check' for e in events))

    def test_vk_dated_post_and_missing_public_feed(self):
        html = '<div class="post" id="post-41389363_123"><div class="wall_post_text">Наброски 27.10.2026 в 19:30, 800 ₽</div></div>'
        events = extract(html, self.source('sketch_vk'), make_event, parse_price, date(2026,10,25))
        self.assertEqual(events[0]['url'],'https://vk.com/wall-41389363_123')
        self.assertEqual(events[0]['price'],800)
        with self.assertRaisesRegex(ValueError,'no public posts'):
            extract('<html>Login</html>',self.source('sketch_vk'),make_event,parse_price,date(2026,10,25))


if __name__ == '__main__':
    unittest.main()
