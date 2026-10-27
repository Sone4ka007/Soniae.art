#!/usr/bin/env python3
import importlib.util
import json
import os
import shutil
import struct
import subprocess
import sys
import tempfile
import unittest
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def load_module(name, relpath):
    spec = importlib.util.spec_from_file_location(name, ROOT / relpath)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def cmap_has_ruble(ttf):
    data = ttf.read_bytes()
    num = struct.unpack(">H", data[4:6])[0]
    offset = 12
    cmap_at = None
    for _ in range(num):
        tag, _checksum, table_offset, _length = struct.unpack(">4sIII", data[offset:offset + 16])
        if tag == b"cmap":
            cmap_at = table_offset
            break
        offset += 16
    if cmap_at is None:
        return False
    _version, tables = struct.unpack(">HH", data[cmap_at:cmap_at + 4])
    for index in range(tables):
        _plat, _enc, sub = struct.unpack(">HHI", data[cmap_at + 4 + index * 8:cmap_at + 12 + index * 8])
        start = cmap_at + sub
        fmt = struct.unpack(">H", data[start:start + 2])[0]
        if fmt != 4:
            continue
        seg_count = struct.unpack(">H", data[start + 6:start + 8])[0] // 2
        end_at = start + 14
        ends = [struct.unpack(">H", data[end_at + 2 * i:end_at + 2 * i + 2])[0] for i in range(seg_count)]
        start_at = end_at + 2 * seg_count + 2
        starts = [struct.unpack(">H", data[start_at + 2 * i:start_at + 2 * i + 2])[0] for i in range(seg_count)]
        for begin, end in zip(starts, ends):
            if begin <= 0x20BD <= end:
                return True
    return False


class RebaseEditorEditsTests(unittest.TestCase):
    def rebase(self, captured, remote):
        mod = load_module("rebase_editor_edits_test", "scripts/events/rebase_editor_edits.py")
        merged, applied, skipped = mod.rebase(captured, remote)
        return merged, applied, skipped

    def test_newer_remote_events_survive_stale_snapshot(self):
        captured = {"events": [
            {
                "id": "kept",
                "status": "approved",
                "title": "Отредактировано",
                "description": "устаревшее описание",
                "date": "2026-10-22",
                "editor_overrides": {"title": "Отредактировано", "status": "approved"},
                "reviewed_at": "2026-10-25",
            },
            {
                "id": "stale-only",
                "status": "new",
                "title": "Этого уже нет на main",
                "date": "2026-10-01",
            },
        ]}
        remote = {"events": [
            {
                "id": "kept",
                "status": "new",
                "title": "Исходное",
                "description": "свежее описание с main",
                "date": "2026-10-22",
            },
            {
                "id": "brand-new",
                "status": "new",
                "title": "Событие, добавленное пока джоба ждала очередь",
                "date": "2026-10-26",
            },
        ]}
        merged, applied, skipped = self.rebase(captured, remote)
        by_id = {event["id"]: event for event in merged["events"]}
        self.assertEqual(applied, 1)
        self.assertEqual(skipped, ["stale-only"])
        self.assertIn("brand-new", by_id)
        self.assertNotIn("stale-only", by_id)
        self.assertEqual(by_id["kept"]["title"], "Отредактировано")
        self.assertEqual(by_id["kept"]["status"], "approved")
        self.assertEqual(by_id["kept"]["description"], "свежее описание с main")
        self.assertEqual(by_id["kept"]["reviewed_at"], "2026-10-25")

    def test_remote_facts_stay_when_snapshot_has_no_overrides(self):
        captured = {"events": [{
            "id": "kept",
            "status": "new",
            "title": "Старый заголовок",
            "date": "2026-10-01",
        }]}
        remote = {"events": [{
            "id": "kept",
            "status": "new",
            "title": "Новый заголовок",
            "date": "2026-10-22",
        }]}
        merged, applied, skipped = self.rebase(captured, remote)
        self.assertEqual(applied, 0)
        self.assertEqual(skipped, [])
        self.assertEqual(merged["events"][0]["title"], "Новый заголовок")
        self.assertEqual(merged["events"][0]["date"], "2026-10-22")


class WorkflowGuardTests(unittest.TestCase):
    def test_sheet_sync_refreshes_main_and_does_not_force_push(self):
        text = (ROOT / ".github/workflows/events-sheet-sync.yml").read_text("utf-8")
        self.assertIn("git_sync_main.sh", text)
        self.assertIn("persist_events_json.sh", text)
        self.assertNotIn("git push\n", text)
        self.assertNotIn("--force", text)

    def test_pipeline_retries_merge_and_social_render_is_independent(self):
        text = (ROOT / ".github/workflows/events-pipeline.yml").read_text("utf-8")
        self.assertIn("commit_merged_events.sh", text)
        self.assertIn("persist_events_json.sh", text)
        self.assertIn("git_sync_main.sh", text)
        self.assertNotIn("--force", text)
        renderer = (ROOT / "scripts/events/render_weekly.js").read_text("utf-8")
        exists_at = renderer.find("existsSync(weeklyPath)")
        goto_at = renderer.find("page.goto(weeklyUrl")
        self.assertGreater(exists_at, 0)
        self.assertGreater(goto_at, exists_at)
        self.assertIn("weekly.html is absent", renderer)


class RubleGlyphTests(unittest.TestCase):
    def test_fallback_font_contains_ruble_sign(self):
        font = ROOT / "assets/fonts/ruble-fallback.ttf"
        self.assertTrue(font.exists())
        self.assertTrue(cmap_has_ruble(font))

    def test_social_price_badge_embeds_ruble_font(self):
        mod = load_module("build_social_ruble", "scripts/events/build_social.py")
        self.assertIn("Ruble Fallback", mod.CSS)
        self.assertIn("unicode-range:U+20BD", mod.CSS)
        self.assertIn("data:font/ttf;base64,", mod.CSS)
        page = mod.day_page(date(2026, 10, 22), [{
            "time": "18:00",
            "title": "Сквозь объектив символизма",
            "venue": "Третьяковская галерея",
            "description": "фотография Виктора Борисова-Мусатова",
            "price": 500,
            "price_text": "500 ₽",
            "price_type": "paid",
        }], 2, 5, "moscow")
        self.assertIn("500 ₽", page)
        self.assertNotIn("500 руб", page)


class PersistStaleSnapshotTests(unittest.TestCase):
    def test_persist_keeps_events_added_on_main_while_job_was_queued(self):
        if shutil.which("git") is None:
            self.skipTest("git is required")
        script = ROOT / "scripts/events/persist_events_json.sh"
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            origin = td / "origin.git"
            work = td / "work"
            subprocess.run(["git", "init", "--bare", "-b", "main", str(origin)], check=True, capture_output=True)
            subprocess.run(["git", "clone", str(origin), str(work)], check=True, capture_output=True)
            self._git(work, ["config", "user.name", "test"])
            self._git(work, ["config", "user.email", "test@example.com"])
            events = work / "content/events.json"
            events.parent.mkdir()
            self._write(events, [
                {"id": "kept", "status": "new", "title": "Исходное", "date": "2026-10-22", "description": "база"},
                {"id": "stale-only", "status": "new", "title": "Устаревшее", "date": "2026-10-01"},
            ])
            self._git(work, ["add", "content/events.json"])
            self._git(work, ["commit", "-m", "base"])
            self._git(work, ["push", "origin", "HEAD:main"])
            base = self._git(work, ["rev-parse", "HEAD"]).stdout.strip()

            self._write(events, [
                {"id": "kept", "status": "new", "title": "Исходное", "date": "2026-10-22", "description": "свежее описание"},
                {"id": "brand-new", "status": "new", "title": "Добавлено позже", "date": "2026-10-26"},
            ])
            self._git(work, ["add", "content/events.json"])
            self._git(work, ["commit", "-m", "newer events"])
            self._git(work, ["push", "origin", "HEAD:main"])

            # The queued job is still on the triggering commit, with Sheet
            # edits applied on top of that stale database.
            self._git(work, ["reset", "--hard", base])
            self._write(events, [
                {
                    "id": "kept",
                    "status": "approved",
                    "title": "Правка из таблицы",
                    "date": "2026-10-22",
                    "description": "устаревшее описание",
                    "editor_overrides": {"title": "Правка из таблицы", "status": "approved"},
                    "reviewed_at": "2026-10-25",
                },
                {"id": "stale-only", "status": "new", "title": "Устаревшее", "date": "2026-10-01"},
            ])
            env = os.environ.copy()
            env["EVENTS_REPO_ROOT"] = str(work)
            env.pop("EVENTS_SHEET_ID", None)
            env.pop("GOOGLE_SERVICE_ACCOUNT_JSON", None)
            result = subprocess.run(
                ["bash", str(script), "Preserve event moderation edits during Sheet push"],
                cwd=work,
                env=env,
                text=True,
                capture_output=True,
                check=False,
            )
            self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
            saved = json.loads(events.read_text("utf-8"))["events"]
            by_id = {event["id"]: event for event in saved}
            self.assertIn("brand-new", by_id)
            self.assertNotIn("stale-only", by_id)
            self.assertEqual(by_id["kept"]["title"], "Правка из таблицы")
            self.assertEqual(by_id["kept"]["status"], "approved")
            self.assertEqual(by_id["kept"]["description"], "свежее описание")
            remote = subprocess.run(
                ["git", "show", "origin/main:content/events.json"],
                cwd=work, text=True, capture_output=True, check=True,
            )
            remote_ids = {event["id"] for event in json.loads(remote.stdout)["events"]}
            self.assertEqual(remote_ids, {"kept", "brand-new"})

    def _git(self, cwd, args):
        return subprocess.run(["git", *args], cwd=cwd, text=True, capture_output=True, check=True)

    def _write(self, path, events):
        path.write_text(json.dumps({"events": events}, ensure_ascii=False, indent=2) + "\n", "utf-8")


if __name__ == "__main__":
    unittest.main()
