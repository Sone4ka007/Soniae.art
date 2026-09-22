#!/usr/bin/env python3
import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def load_module(name, relpath):
    spec = importlib.util.spec_from_file_location(name, ROOT / relpath)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class ValidationRulesTests(unittest.TestCase):
    def run_validate(self, event):
        mod = load_module("validate_events_test", "scripts/events/validate_events.py")
        with tempfile.TemporaryDirectory() as td:
            db = Path(td) / "events.json"
            db.write_text(json.dumps({"events": [event]}, ensure_ascii=False), "utf-8")
            mod.DB = db
            mod.main()
            return json.loads(db.read_text("utf-8"))["events"][0]

    def base_event(self, **overrides):
        event = {
            "id": "test-event",
            "status": "new",
            "kind": "event",
            "city": "moscow",
            "date": "2026-09-25",
            "time": "19:00",
            "title": "Тестовое событие",
            "venue": "Тест",
            "description": "",
            "url": "https://example.org/event",
            "source": "Тест",
            "categories": [],
            "price_type": "unknown",
        }
        event.update(overrides)
        return event

    def test_known_child_event_is_rejected(self):
        out = self.run_validate(self.base_event(title="А и Б сидели на трубе"))
        self.assertEqual(out["status"], "rejected")
        self.assertEqual(out["review_reason"], "excluded_family_children")

    def test_ges2_workshop_is_rejected(self):
        out = self.run_validate(self.base_event(
            title="Мастер-класс по коллажу",
            venue="ГЭС-2",
            source="Дом культуры «ГЭС-2»",
            url="https://ges-2.org/event/test",
        ))
        self.assertEqual(out["status"], "rejected")
        self.assertEqual(out["review_reason"], "excluded_ges2_masterclass")

    def test_generic_paid_international_competition_is_rejected(self):
        out = self.run_validate(self.base_event(
            kind="open_call",
            title="International Competition for Artists",
            description="Application fee 35 EUR",
            price_type="paid",
            categories=["open-call"],
        ))
        self.assertEqual(out["status"], "rejected")
        self.assertEqual(out["review_reason"], "excluded_paid_open_call")

    def test_whitelisted_paid_major_call_requires_review(self):
        out = self.run_validate(self.base_event(
            kind="open_call",
            title="Tokyo Biennale Open Call",
            description="Application fee 35 EUR",
            price_type="paid",
            categories=["open-call"],
        ))
        self.assertEqual(out["status"], "check")
        self.assertEqual(out["review_reason"], "paid_prestigious_call_exception_review")


class QualityGateTests(unittest.TestCase):
    def test_approved_aggregator_open_call_stays_approved(self):
        mod = load_module("quality_gate_test", "scripts/events/quality_gate.py")
        event = {
            "id": "call-1",
            "status": "approved",
            "kind": "open_call",
            "title": "Open Call",
            "venue": "Organizer",
            "categories": ["open-call"],
            "url": "https://www.curatorspace.com/opportunities/detail/test",
            "source": "CuratorSpace — opportunities",
        }
        mod.normalize(event)
        self.assertEqual(event["status"], "approved")

    def test_unreviewed_aggregator_open_call_returns_to_check(self):
        mod = load_module("quality_gate_test", "scripts/events/quality_gate.py")
        event = {
            "id": "call-2",
            "status": "new",
            "kind": "open_call",
            "title": "Open Call",
            "venue": "Organizer",
            "categories": ["open-call"],
            "url": "https://www.curatorspace.com/opportunities/detail/test",
            "source": "CuratorSpace — opportunities",
        }
        mod.normalize(event)
        self.assertEqual(event["status"], "check")
        self.assertEqual(event["review_reason"], "primary_source_required")


class EditorialDurabilityTests(unittest.TestCase):
    def test_merge_preserves_approved_content_after_generated_id_drift(self):
        generated = {
            "events": [{
                "id": "new-generated-id",
                "status": "new",
                "kind": "event",
                "city": "moscow",
                "date": "2026-09-25",
                "title": "Событие",
                "venue": "Музей",
                "description": "Сырое описание",
                "url": "https://example.org/program/event?utm_source=test",
                "source": "Музей",
                "categories": [],
            }]
        }
        remote = {
            "events": [{
                "id": "old-generated-id",
                "status": "approved",
                "kind": "event",
                "city": "moscow",
                "date": "2026-09-24",
                "title": "Событие",
                "venue": "Музей",
                "description": "Отредактированное описание",
                "url": "https://example.org/program/event",
                "source": "Музей",
                "categories": ["лекция"],
                "checked_at": "2026-09-21",
            }]
        }
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            gp, rp, op = td/"generated.json", td/"remote.json", td/"out.json"
            gp.write_text(json.dumps(generated, ensure_ascii=False), "utf-8")
            rp.write_text(json.dumps(remote, ensure_ascii=False), "utf-8")
            subprocess.run(
                [sys.executable, str(ROOT/"scripts/events/merge_remote_db.py"), str(gp), str(rp), str(op)],
                cwd=ROOT, check=True, capture_output=True, text=True
            )
            rows = json.loads(op.read_text("utf-8"))["events"]
            row = next(x for x in rows if x.get("id") == "new-generated-id")
            self.assertEqual(row["status"], "approved")
            self.assertEqual(row["description"], "Отредактированное описание")
            self.assertEqual(row["categories"], ["лекция"])

    def test_frontend_does_not_dedupe_exhibitions_by_url(self):
        js = (ROOT/"assets/events.js").read_text("utf-8")
        self.assertIn("const key = e.id || [", js)
        self.assertNotIn("const key = (e.url ||", js)

    def test_sheet_pull_accepts_only_guarded_editor_content_fields(self):
        src = (ROOT/"scripts/events/pull_sheet.py").read_text("utf-8")
        self.assertIn('editable={"status","editor_note","checked_at","review_reason","url","source"}', src)
        self.assertIn('baseline_key="synced_"+k', src)
        self.assertNotIn('"description","venue","address","price"', src)


if __name__ == "__main__":
    unittest.main()
