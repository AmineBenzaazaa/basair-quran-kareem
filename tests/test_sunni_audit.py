from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from sunni_audit.apply import apply_findings, select_findings_for_apply
from sunni_audit.config import load_config
from sunni_audit.rules import analyze_units
from sunni_audit.scanner import scan_file


class SunniAuditTests(unittest.TestCase):
    def test_json_pointer_extraction_uses_rfc6901(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            target = root / "assets" / "content"
            target.mkdir(parents=True)
            file_path = target / "sample.json"
            file_path.write_text(
                json.dumps({"entries": {"a/b~c": {"text": "معنى الإسلام هو كذا"}}}, ensure_ascii=False),
                encoding="utf-8",
            )

            units = scan_file(file_path, "assets/content/sample.json")
            pointers = {unit.location for unit in units}
            self.assertIn("/entries/a~1b~0c/text", pointers)

    def test_external_link_is_high_confidence_delete(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            target = root / "src" / "data" / "content"
            target.mkdir(parents=True)
            file_path = target / "glossary.json"
            file_path.write_text(
                json.dumps(
                    {
                        "entries": {
                            "x": {
                                "videos": [
                                    {"title": "فيديو", "url": "https://youtu.be/test"}
                                ]
                            }
                        }
                    },
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )

            config = load_config(root)
            units = scan_file(file_path, "src/data/content/glossary.json")
            findings = analyze_units(units, config)
            self.assertTrue(findings)
            self.assertEqual(findings[0].reason_category, "external_link")
            self.assertEqual(findings[0].suggested_action, "delete")
            self.assertEqual(findings[0].confidence, "high")

    def test_never_delete_ayah_text(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            target = root / "assets" / "content"
            target.mkdir(parents=True)
            file_path = target / "ayahs.json"
            file_path.write_text(
                json.dumps(
                    [{"surahId": "1", "ayahNumber": 1, "textAr": "بِسْمِ � اللَّهِ"}],
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )

            config = load_config(root)
            units = scan_file(file_path, "assets/content/ayahs.json")
            findings = analyze_units(units, config)
            self.assertEqual(len(findings), 1)
            self.assertEqual(findings[0].reason_category, "encoding")
            self.assertEqual(findings[0].suggested_action, "flag")
            applicable, skipped = select_findings_for_apply(findings)
            self.assertFalse(applicable)
            self.assertTrue(skipped)

    def test_apply_mode_removes_external_link_video_object(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            target = root / "src" / "data" / "content"
            target.mkdir(parents=True)
            file_path = target / "glossary.json"
            payload = {
                "entries": {
                    "x": {
                        "videos": [
                            {"title": "فيديو", "url": "https://youtu.be/test"},
                            {"title": "فيديو 2", "url": "https://example.org/keep"},
                        ]
                    }
                }
            }
            file_path.write_text(
                json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )

            config = load_config(root)
            units = scan_file(file_path, "src/data/content/glossary.json")
            findings = analyze_units(units, config)
            apply_events, patch_text = apply_findings(findings, root)

            updated = json.loads(file_path.read_text(encoding="utf-8"))
            videos = updated["entries"]["x"]["videos"]
            self.assertEqual(len(videos), 0)
            self.assertTrue(any(event["event"] == "apply_delete" for event in apply_events))
            self.assertIn("--- src/data/content/glossary.json", patch_text)

    def test_unsourced_fatwa_ui_label_rewrites_not_deletes(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            target = root / "app"
            target.mkdir(parents=True)
            file_path = target / "screen.tsx"
            file_path.write_text("const x = 'يحرم شرعاً هذا الفعل';\n", encoding="utf-8")

            config = load_config(root)
            units = scan_file(file_path, "app/screen.tsx")
            findings = analyze_units(units, config)
            self.assertEqual(len(findings), 1)
            self.assertEqual(findings[0].reason_category, "ux_wording")
            self.assertEqual(findings[0].suggested_action, "rewrite")


if __name__ == "__main__":
    unittest.main()
