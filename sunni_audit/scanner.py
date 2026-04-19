from __future__ import annotations

import fnmatch
import json
import os
import zipfile
from pathlib import Path
from xml.etree import ElementTree

from .config import AuditConfig
from .models import ScanUnit
from .patterns import ARABIC_CHAR_PATTERN, PROMPT_KEYWORD_PATTERN, URL_PATTERN


WORD_NAMESPACE = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}


def path_matches(rel_path: str, patterns: tuple[str, ...]) -> bool:
    normalized = rel_path.replace(os.sep, "/")
    return any(fnmatch.fnmatch(normalized, pattern) for pattern in patterns)


def is_path_excluded(rel_path: str, config: AuditConfig) -> bool:
    return path_matches(rel_path, config.exclude_globs)


def is_religious_path(rel_path: str, config: AuditConfig) -> bool:
    return path_matches(rel_path, config.religious_content_globs)


def should_scan_text_line(line: str) -> bool:
    return bool(
        line.strip()
        and (
            ARABIC_CHAR_PATTERN.search(line)
            or URL_PATTERN.search(line)
            or PROMPT_KEYWORD_PATTERN.search(line)
        )
    )


def discover_files(config: AuditConfig) -> list[tuple[Path, str]]:
    files: list[tuple[Path, str]] = []
    for dirpath, dirnames, filenames in os.walk(config.root):
        rel_dir = os.path.relpath(dirpath, config.root).replace(os.sep, "/")
        if rel_dir == ".":
            rel_dir = ""

        kept_dirs: list[str] = []
        for dirname in dirnames:
            rel_candidate = f"{rel_dir}/{dirname}" if rel_dir else dirname
            if not is_path_excluded(f"{rel_candidate}/", config):
                kept_dirs.append(dirname)
        dirnames[:] = kept_dirs

        for filename in filenames:
            rel_path = f"{rel_dir}/{filename}" if rel_dir else filename
            if is_path_excluded(rel_path, config):
                continue
            if not path_matches(rel_path, config.include_globs):
                continue

            absolute_path = config.root / rel_path
            try:
                if absolute_path.stat().st_size > config.max_file_size_bytes:
                    continue
            except FileNotFoundError:
                continue

            suffix = absolute_path.suffix.lower()
            if suffix in config.text_extensions or (
                suffix == ".docx" and config.scan_docx
            ) or filename == "CODEOWNERS":
                files.append((absolute_path, rel_path))
    return files


def escape_json_pointer_token(token: str) -> str:
    return token.replace("~", "~0").replace("/", "~1")


def classify_json_content_kind(
    rel_path: str, key: str | None, nearest_object: object | None
) -> str:
    if isinstance(nearest_object, dict):
        object_keys = set(nearest_object.keys())
    else:
        object_keys = set()

    if (
        (key in {"textAr", "text"} and {"surahId", "ayahNumber"} <= object_keys)
        or (key == "text" and {"surah", "ayah"} <= object_keys)
        or rel_path.endswith("assets/content/ayahs.json")
        or rel_path.endswith("dashboard/src/lib/content/seeds/ayahs.json")
    ):
        return "quran_text"

    if "tafsir" in rel_path or key == "tafsirParagraphs" or "tafsirParagraphs" in object_keys:
        return "tafsir"
    if key in {"translation", "textEn"} or "translation" in rel_path:
        return "translation"
    return "other"


def classify_text_content_kind(rel_path: str, line: str) -> str:
    lower_path = rel_path.lower()
    lower_line = line.lower()
    if "prompt" in lower_path or "system" in lower_path or "prompt" in lower_line:
        return "prompt"
    if rel_path.startswith("app/") or rel_path.startswith("src/") or rel_path.startswith(
        "dashboard/app/"
    ):
        return "ui_label"
    return "other"


def _context_window(lines: list[str], index: int) -> str:
    start = max(index - 2, 0)
    end = min(index + 3, len(lines))
    return "\n".join(lines[start:end])


def _serialize_context_object(value: object) -> str:
    try:
        return json.dumps(value, ensure_ascii=False)
    except TypeError:
        return str(value)


def _extract_json_units(
    rel_path: str,
    absolute_path: Path,
    value: object,
    pointer: str,
    nearest_object: object | None,
    current_key: str | None,
) -> list[ScanUnit]:
    if isinstance(value, dict):
        units: list[ScanUnit] = []
        for key, child in value.items():
            child_pointer = f"{pointer}/{escape_json_pointer_token(key)}"
            units.extend(
                _extract_json_units(
                    rel_path=rel_path,
                    absolute_path=absolute_path,
                    value=child,
                    pointer=child_pointer,
                    nearest_object=value,
                    current_key=key,
                )
            )
        return units

    if isinstance(value, list):
        units = []
        for index, child in enumerate(value):
            child_pointer = f"{pointer}/{index}"
            units.extend(
                _extract_json_units(
                    rel_path=rel_path,
                    absolute_path=absolute_path,
                    value=child,
                    pointer=child_pointer,
                    nearest_object=nearest_object,
                    current_key=current_key,
                )
            )
        return units

    if isinstance(value, str):
        return [
            ScanUnit(
                file_path=rel_path,
                absolute_path=absolute_path,
                file_type="json",
                location=pointer or "/",
                text=value,
                content_kind=classify_json_content_kind(
                    rel_path, current_key, nearest_object
                ),
                context_text=_serialize_context_object(nearest_object or value),
            )
        ]

    return []


def scan_json_file(absolute_path: Path, rel_path: str) -> list[ScanUnit]:
    data = json.loads(absolute_path.read_text(encoding="utf-8"))
    return _extract_json_units(
        rel_path=rel_path,
        absolute_path=absolute_path,
        value=data,
        pointer="",
        nearest_object=None,
        current_key=None,
    )


def scan_text_file(absolute_path: Path, rel_path: str) -> list[ScanUnit]:
    lines = absolute_path.read_text(encoding="utf-8").splitlines()
    units: list[ScanUnit] = []
    for index, line in enumerate(lines):
        if not should_scan_text_line(line):
            continue
        line_number = index + 1
        units.append(
            ScanUnit(
                file_path=rel_path,
                absolute_path=absolute_path,
                file_type="text",
                location=f"L{line_number}-L{line_number}",
                text=line.strip(),
                content_kind=classify_text_content_kind(rel_path, line),
                context_text=_context_window(lines, index),
                line_start=line_number,
                line_end=line_number,
            )
        )
    return units


def scan_docx_file(absolute_path: Path, rel_path: str) -> list[ScanUnit]:
    units: list[ScanUnit] = []
    with zipfile.ZipFile(absolute_path) as archive:
        xml_bytes = archive.read("word/document.xml")
    root = ElementTree.fromstring(xml_bytes)
    paragraphs: list[str] = []
    for paragraph in root.findall(".//w:p", WORD_NAMESPACE):
        texts = [
            node.text or ""
            for node in paragraph.findall(".//w:t", WORD_NAMESPACE)
            if node.text
        ]
        combined = "".join(texts).strip()
        if combined:
            paragraphs.append(combined)

    for index, paragraph_text in enumerate(paragraphs):
        if not should_scan_text_line(paragraph_text):
            continue
        line_number = index + 1
        units.append(
            ScanUnit(
                file_path=rel_path,
                absolute_path=absolute_path,
                file_type="docx",
                location=f"L{line_number}-L{line_number}",
                text=paragraph_text,
                content_kind="other",
                context_text=paragraph_text,
                line_start=line_number,
                line_end=line_number,
            )
        )
    return units


def scan_file(absolute_path: Path, rel_path: str) -> list[ScanUnit]:
    suffix = absolute_path.suffix.lower()
    if suffix == ".json":
        return scan_json_file(absolute_path, rel_path)
    if suffix == ".docx":
        return scan_docx_file(absolute_path, rel_path)
    return scan_text_file(absolute_path, rel_path)


def scan_repository(config: AuditConfig) -> tuple[list[ScanUnit], dict[str, int]]:
    units: list[ScanUnit] = []
    scanned_files = 0
    skipped_files = 0
    for absolute_path, rel_path in discover_files(config):
        try:
            units.extend(scan_file(absolute_path, rel_path))
            scanned_files += 1
        except (UnicodeDecodeError, json.JSONDecodeError, KeyError, zipfile.BadZipFile):
            skipped_files += 1
    return units, {"scanned_files": scanned_files, "skipped_files": skipped_files}
