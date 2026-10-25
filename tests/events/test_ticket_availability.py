import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("availability", ROOT / "scripts/events/check_availability.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class TicketAvailabilityTests(unittest.TestCase):
    def inspect(self, html):
        with patch.object(mod, "fetch", return_value=html):
            return mod.inspect_url("https://example.org/event")

    def test_purchase_link_does_not_prove_seats(self):
        self.assertEqual(self.inspect("<a>Купить билет</a>")[0], "unknown")

    def test_sold_out_beats_purchase_link(self):
        self.assertEqual(self.inspect("Купить билет. Билетов нет")[0], "sold_out")

    def test_explicit_seats_are_supported(self):
        self.assertEqual(self.inspect("Осталось 3 мест")[0], "available")
