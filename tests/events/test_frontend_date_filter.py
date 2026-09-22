#!/usr/bin/env python3
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]

class EventDateFilterFrontendTests(unittest.TestCase):
    def test_calendar_controls_exist(self):
        html=(ROOT/"events/index.html").read_text("utf-8")
        for token in ('data-date-preset="today"','data-date-preset="week"','data-date-preset="next-week"',
                      'id="date-day"','id="date-from"','id="date-to"','id="date-reset"'):
            self.assertIn(token,html)

    def test_frontend_uses_custom_date_range(self):
        js=(ROOT/"assets/events.js").read_text("utf-8")
        self.assertIn("function customDateRange()",js)
        self.assertIn("const rangeFrom = custom ? custom.from : today;",js)
        self.assertIn("const rangeTo = custom ? custom.to : defaultTo;",js)
        self.assertIn("end < rangeFrom || start > rangeTo",js)

    def test_week_presets_use_monday_to_sunday(self):
        js=(ROOT/"assets/events.js").read_text("utf-8")
        self.assertIn("function mondayOfWeek(d)",js)
        self.assertIn("sunday.setDate(sunday.getDate() + 6)",js)

    def test_manual_range_does_not_collapse_into_day_mode(self):
        js=(ROOT/"assets/events.js").read_text("utf-8")
        self.assertIn("if (!from || !to)",js)
        self.assertIn("setDateRange(from, to, '', 'range')",js)
        self.assertIn("setDateRange(dateDay.value, dateDay.value, '', 'day')",js)

    def test_multiday_events_intersect_selected_range(self):
        js=(ROOT/"assets/events.js").read_text("utf-8")
        self.assertIn("const end = e.end_date || e.date;",js)
        self.assertIn("end < rangeFrom || start > rangeTo",js)

    def test_multiday_event_range_is_rendered(self):
        js=(ROOT/"assets/events.js").read_text("utf-8")
        self.assertIn("function formatEventRange(e)",js)
        self.assertIn('class="event-period"',js)

if __name__=="__main__":
    unittest.main()
