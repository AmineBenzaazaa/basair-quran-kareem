from __future__ import annotations

import csv
import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

from .models import Finding, PLAN_COLUMNS, SEVERITY_ORDER


def make_log_event(event: str, **payload: object) -> dict[str, object]:
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "event": event,
        **payload,
    }


def sort_findings(findings: Iterable[Finding]) -> list[Finding]:
    return sorted(
        findings,
        key=lambda item: (
            SEVERITY_ORDER.get(item.severity, 99),
            item.file_path,
            item.json_pointer,
            item.rule_id,
        ),
    )


def write_plan_csv(findings: list[Finding], path: Path) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=PLAN_COLUMNS)
        writer.writeheader()
        for finding in findings:
            writer.writerow(finding.plan_row())


def write_plan_json(findings: list[Finding], path: Path) -> None:
    payload = [finding.plan_row() for finding in findings]
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_jsonl(events: list[dict[str, object]], path: Path) -> None:
    with path.open("w", encoding="utf-8") as handle:
        for event in events:
            handle.write(json.dumps(event, ensure_ascii=False) + "\n")


def markdown_table(findings: list[Finding]) -> str:
    headers = PLAN_COLUMNS
    lines = [
        "| " + " | ".join(headers) + " |",
        "| " + " | ".join("---" for _ in headers) + " |",
    ]
    for finding in findings:
        row = finding.plan_row()
        lines.append(
            "| "
            + " | ".join(
                str((row.get(header) or "")).replace("\n", "<br>")
                for header in headers
            )
            + " |"
        )
    return "\n".join(lines)


def _counts(findings: list[Finding], field: str) -> Counter[str]:
    counter: Counter[str] = Counter()
    for finding in findings:
        counter[str(getattr(finding, field))] += 1
    return counter


def write_audit_report(
    findings: list[Finding],
    report_path: Path,
    scan_stats: dict[str, int],
    apply_mode: bool,
) -> None:
    severity_counts = _counts(findings, "severity")
    action_counts = _counts(findings, "suggested_action")
    scholar_counts = _counts(findings, "scholar_review_required")
    category_groups: dict[str, list[Finding]] = defaultdict(list)
    for finding in findings:
        category_groups[finding.reason_category].append(finding)

    critical_high = [
        finding
        for finding in findings
        if finding.severity == "critical" and finding.confidence == "high"
    ]
    encoding_count = sum(1 for finding in findings if finding.reason_category == "encoding")

    sections = [
        "# Sunni Audit Report",
        "",
        "## Executive summary",
        "",
        f"- Mode: {'apply' if apply_mode else 'dry-run'}",
        f"- Files scanned: {scan_stats.get('scanned_files', 0)}",
        f"- Files skipped: {scan_stats.get('skipped_files', 0)}",
        f"- Findings: {len(findings)}",
        f"- Critical + high-confidence findings: {len(critical_high)}",
        f"- Encoding corruption findings: {encoding_count}",
        "",
        "## Risk summary",
        "",
        f"- Severity counts: {dict(severity_counts)}",
        f"- Action counts: {dict(action_counts)}",
        f"- Scholar review required counts: {dict(scholar_counts)}",
        "",
        "## Detailed findings by category",
        "",
    ]

    for category in sorted(category_groups):
        sections.append(f"### {category}")
        sections.append("")
        for finding in sort_findings(category_groups[category]):
            sections.append(
                f"- `{finding.file_path}` `{finding.json_pointer}` [{finding.severity}/{finding.confidence}] "
                f"{finding.suggested_action}: {finding.excerpt_ar}"
            )
        sections.append("")

    sections.extend(
        [
            "## Deletion plan table",
            "",
            markdown_table(sort_findings(findings)),
            "",
        ]
    )

    report_path.write_text("\n".join(sections), encoding="utf-8")
