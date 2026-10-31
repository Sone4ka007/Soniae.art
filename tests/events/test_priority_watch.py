"""Regression coverage for high-priority art events (no network access)."""
import sys
import unittest
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "events"))
from discover_priority_events import link_candidates, detail_event, merge_events, rss_links

SOURCE = {
    "name": "Исторический музей — лекции и анимация",
    "city": "moscow",
    "venue": "Исторический музей",
    "url": "https://shm.ru/shows/",
    "href_contains": ["/shows/"],
    "keywords": ["анимац", "Норштейн"],
}
URL = "https://shm.ru/shows/kruglyy-stol-mezhdu-moskvoy-i-tokio-animatsiya-xx-veka/"
LISTING = """<article><a href="/shows/kruglyy-stol-mezhdu-moskvoy-i-tokio-animatsiya-xx-veka/">Круглый стол «Между Москвой и Токио: анимация XX века»</a></article>
<article><a href="/shows/other/">Лекция о казачестве</a></article>"""
DETAIL = """<main><h1>Круглый стол «Между Москвой и Токио: анимация XX века»</h1><p>История советской и японской анимации. Гость мероприятия — Юрий Норштейн, режиссёр и художник мультипликации.</p><h2>Время проведения</h2><p>Дата и время проведения : 30 октября, 18:00</p></main>"""


class PriorityWatchTests(unittest.TestCase):
    def test_historical_museum_picks_relevant_card(self):
        self.assertEqual(link_candidates(LISTING, SOURCE), [URL])

    def test_correct_event_date_and_time_even_without_year(self):
        event = detail_event(URL, SOURCE, date(2026, 10, 25), lambda _: DETAIL)
        self.assertEqual(
            (event["date"], event["time"], event["status"]),
            ("2026-10-30", "18:00", "check"),
        )

    def test_never_reintroduces_past_event(self):
        self.assertIsNone(detail_event(URL, SOURCE, date(2026, 10, 31), lambda _: DETAIL))

    def test_does_not_overwrite_approved(self):
        event = detail_event(URL, SOURCE, date(2026, 10, 25), lambda _: DETAIL)
        db = {"events": [dict(event, status="approved")]}
        self.assertEqual(merge_events(db, [event]), 0)
        self.assertEqual(db["events"][0]["status"], "approved")

    def test_search_rss_extracts_direct_links(self):
        rss = """<rss><channel><item><title>Юрий Норштейн на встрече</title><description>Лекция</description><link>https://example.com/lecture</link></item></channel></rss>"""
        self.assertEqual(rss_links(rss, ["норштейн"]), ["https://example.com/lecture"])


if __name__ == "__main__":
    unittest.main()
