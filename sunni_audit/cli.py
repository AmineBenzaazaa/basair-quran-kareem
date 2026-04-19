from __future__ import annotations

import argparse
from pathlib import Path

from .apply import apply_findings
from .config import load_config
from .reporting import (
    make_log_event,
    sort_findings,
    write_audit_report,
    write_jsonl,
    write_plan_csv,
    write_plan_json,
)
from .rules import analyze_units
from .scanner import scan_repository


def run_audit(
    root: Path,
    apply_mode: bool = False,
    config_path: str | None = None,
) -> int:
    config = load_config(root, config_path)
    config.artifacts_dir.mkdir(parents=True, exist_ok=True)

    log_events: list[dict[str, object]] = [
        make_log_event(
            "run_start",
            mode="apply" if apply_mode else "dry-run",
            root=str(root),
        )
    ]

    units, scan_stats = scan_repository(config)
    log_events.append(
        make_log_event(
            "scan_complete",
            scanned_files=scan_stats.get("scanned_files", 0),
            skipped_files=scan_stats.get("skipped_files", 0),
            extracted_units=len(units),
        )
    )

    findings = sort_findings(analyze_units(units, config))
    for finding in findings:
        log_events.append(make_log_event("finding", **finding.plan_row()))

    patch_text = ""
    if apply_mode:
        apply_events, patch_text = apply_findings(findings, root)
        for event in apply_events:
            log_events.append(make_log_event(**event))
        if patch_text:
            (config.artifacts_dir / "apply.patch").write_text(
                patch_text + "\n", encoding="utf-8"
            )

    write_plan_csv(findings, config.artifacts_dir / "deletion_plan.csv")
    write_plan_json(findings, config.artifacts_dir / "deletion_plan.json")
    write_audit_report(
        findings=findings,
        report_path=config.artifacts_dir / "audit_report.md",
        scan_stats=scan_stats,
        apply_mode=apply_mode,
    )
    log_events.append(
        make_log_event(
            "run_complete",
            findings=len(findings),
            critical_high=sum(
                1
                for finding in findings
                if finding.severity == "critical" and finding.confidence == "high"
            ),
            encoding_count=sum(
                1 for finding in findings if finding.reason_category == "encoding"
            ),
        )
    )
    write_jsonl(log_events, config.artifacts_dir / "audit_log.jsonl")

    has_critical_high = any(
        finding.severity == "critical" and finding.confidence == "high"
        for finding in findings
    )
    has_encoding = any(finding.reason_category == "encoding" for finding in findings)
    return 1 if has_critical_high or has_encoding else 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Sunni-safe content auditor")
    mode_group = parser.add_mutually_exclusive_group()
    mode_group.add_argument(
        "--dry-run",
        action="store_true",
        help="Generate artifacts only (default behavior).",
    )
    mode_group.add_argument(
        "--apply",
        action="store_true",
        help="Apply only mechanically safe, high-confidence changes.",
    )
    parser.add_argument(
        "--config",
        help="Optional JSON or YAML config file for allowlists and path globs.",
    )
    parser.add_argument(
        "--root",
        default=".",
        help="Repository root to scan. Defaults to the current working directory.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    root = Path(args.root).resolve()
    apply_mode = bool(args.apply)
    return run_audit(root=root, apply_mode=apply_mode, config_path=args.config)
