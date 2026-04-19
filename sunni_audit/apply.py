from __future__ import annotations

import difflib
import json
import re
from pathlib import Path

from .models import Finding


def _decode_pointer(pointer: str) -> list[str]:
    if pointer in {"", "/"}:
        return []
    return [
        token.replace("~1", "/").replace("~0", "~")
        for token in pointer.lstrip("/").split("/")
    ]


def _navigate_parent(document: object, segments: list[str]) -> tuple[object, str] | None:
    if not segments:
        return None
    current = document
    for segment in segments[:-1]:
        if isinstance(current, list):
            current = current[int(segment)]
        elif isinstance(current, dict):
            current = current[segment]
        else:
            return None
    return current, segments[-1]


def _delete_json_target(document: object, pointer: str) -> bool:
    segments = _decode_pointer(pointer)
    if not segments:
        return False

    if len(segments) >= 2 and segments[-1] == "url":
        array_segments = segments[:-2]
        array_parent = document
        for segment in array_segments:
            if isinstance(array_parent, list):
                array_parent = array_parent[int(segment)]
            elif isinstance(array_parent, dict):
                array_parent = array_parent[segment]
            else:
                return False
        index_segment = segments[-2]
        if isinstance(array_parent, list):
            del array_parent[int(index_segment)]
            return True

    parent_info = _navigate_parent(document, segments)
    if parent_info is None:
        return False
    parent, key = parent_info
    if isinstance(parent, list):
        del parent[int(key)]
        return True
    if isinstance(parent, dict):
        del parent[key]
        return True
    return False


def _rewrite_json_target(document: object, pointer: str, replacement: str) -> bool:
    parent_info = _navigate_parent(document, _decode_pointer(pointer))
    if parent_info is None:
        return False
    parent, key = parent_info
    if isinstance(parent, list):
        parent[int(key)] = replacement
        return True
    if isinstance(parent, dict):
        parent[key] = replacement
        return True
    return False


def _read_lines(path: Path) -> list[str]:
    return path.read_text(encoding="utf-8").splitlines()


def _parse_line_range(pointer: str) -> tuple[int, int] | None:
    match = re.fullmatch(r"L(\d+)-L(\d+)", pointer)
    if not match:
        return None
    return int(match.group(1)), int(match.group(2))


def select_findings_for_apply(findings: list[Finding]) -> tuple[list[Finding], list[Finding]]:
    allowed: list[Finding] = []
    skipped: list[Finding] = []
    for finding in findings:
        if finding.confidence != "high":
            skipped.append(finding)
            continue
        if finding.content_kind == "quran_text":
            skipped.append(finding)
            continue
        if finding.reason_category == "external_link" and finding.suggested_action == "delete":
            allowed.append(finding)
            continue
        if (
            finding.reason_category == "prompt_system"
            and finding.suggested_action == "rewrite"
            and finding.scholar_review_required == "no"
        ):
            allowed.append(finding)
            continue
        skipped.append(finding)
    return allowed, skipped


def apply_findings(
    findings: list[Finding], root: Path
) -> tuple[list[dict[str, str]], str]:
    applicable, skipped = select_findings_for_apply(findings)
    log_entries: list[dict[str, str]] = []
    patch_chunks: list[str] = []

    skipped_ids = {(finding.file_path, finding.json_pointer, finding.rule_id) for finding in skipped}

    for finding in skipped:
        log_entries.append(
            {
                "event": "apply_skip",
                "file_path": finding.file_path,
                "location": finding.json_pointer,
                "rule_id": finding.rule_id,
                "reason": "unsupported_or_requires_manual_review",
            }
        )

    files = sorted({finding.file_path for finding in applicable})
    for file_path in files:
        path = root / file_path
        file_findings = [
            finding
            for finding in applicable
            if finding.file_path == file_path
            and (finding.file_path, finding.json_pointer, finding.rule_id) not in skipped_ids
        ]
        if not file_findings:
            continue

        original_text = path.read_text(encoding="utf-8")
        updated_text = original_text

        if file_findings[0].file_type == "json":
            document = json.loads(original_text)
            changed = False
            for finding in sorted(file_findings, key=lambda item: item.json_pointer, reverse=True):
                if finding.suggested_action == "delete":
                    changed = _delete_json_target(document, finding.json_pointer) or changed
                    log_entries.append(
                        {
                            "event": "apply_delete",
                            "file_path": finding.file_path,
                            "location": finding.json_pointer,
                            "rule_id": finding.rule_id,
                        }
                    )
                elif finding.suggested_action == "rewrite":
                    replacement = (
                        finding.suggested_replacement_ar
                        or finding.suggested_replacement_en
                        or ""
                    )
                    changed = _rewrite_json_target(document, finding.json_pointer, replacement) or changed
                    log_entries.append(
                        {
                            "event": "apply_rewrite",
                            "file_path": finding.file_path,
                            "location": finding.json_pointer,
                            "rule_id": finding.rule_id,
                        }
                    )
            if changed:
                updated_text = json.dumps(document, ensure_ascii=False, indent=2) + "\n"

        elif file_findings[0].file_type == "text":
            lines = _read_lines(path)
            changed = False
            for finding in file_findings:
                line_range = _parse_line_range(finding.json_pointer)
                if line_range is None:
                    continue
                start = line_range[0] - 1
                end = line_range[1]
                if finding.suggested_action == "rewrite":
                    replacement = (
                        finding.suggested_replacement_ar
                        or finding.suggested_replacement_en
                        or ""
                    )
                    lines[start:end] = [replacement]
                    changed = True
                    log_entries.append(
                        {
                            "event": "apply_rewrite",
                            "file_path": finding.file_path,
                            "location": finding.json_pointer,
                            "rule_id": finding.rule_id,
                        }
                    )
            if changed:
                updated_text = "\n".join(lines) + "\n"

        if updated_text == original_text:
            continue

        diff = difflib.unified_diff(
            original_text.splitlines(),
            updated_text.splitlines(),
            fromfile=file_path,
            tofile=file_path,
            lineterm="",
        )
        patch_chunks.append("\n".join(diff))
        path.write_text(updated_text, encoding="utf-8")

    return log_entries, "\n".join(chunk for chunk in patch_chunks if chunk)
