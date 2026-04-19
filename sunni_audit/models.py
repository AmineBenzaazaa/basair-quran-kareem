from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


PLAN_COLUMNS = [
    "file_path",
    "json_pointer",
    "excerpt_ar",
    "reason_category",
    "severity",
    "confidence",
    "suggested_action",
    "scholar_review_required",
    "evidence_missing",
    "recommended_evidence_format",
    "suggested_replacement_ar",
    "suggested_replacement_en",
]

SEVERITY_ORDER = {
    "critical": 0,
    "major": 1,
    "moderate": 2,
    "minor": 3,
}


@dataclass(frozen=True)
class ScanUnit:
    file_path: str
    absolute_path: Path
    file_type: str
    location: str
    text: str
    content_kind: str
    context_text: str
    line_start: int | None = None
    line_end: int | None = None


@dataclass
class Finding:
    file_path: str
    json_pointer: str
    excerpt_ar: str
    reason_category: str
    severity: str
    confidence: str
    suggested_action: str
    scholar_review_required: str
    evidence_missing: str
    recommended_evidence_format: str
    suggested_replacement_ar: str | None = None
    suggested_replacement_en: str | None = None
    content_kind: str = "other"
    file_type: str = "text"
    rule_id: str = ""
    absolute_path: str = ""

    def plan_row(self) -> dict[str, str | None]:
        return {
            "file_path": self.file_path,
            "json_pointer": self.json_pointer,
            "excerpt_ar": self.excerpt_ar,
            "reason_category": self.reason_category,
            "severity": self.severity,
            "confidence": self.confidence,
            "suggested_action": self.suggested_action,
            "scholar_review_required": self.scholar_review_required,
            "evidence_missing": self.evidence_missing,
            "recommended_evidence_format": self.recommended_evidence_format,
            "suggested_replacement_ar": self.suggested_replacement_ar,
            "suggested_replacement_en": self.suggested_replacement_en,
        }
