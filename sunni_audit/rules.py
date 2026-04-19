from __future__ import annotations

from urllib.parse import urlparse

from .config import AuditConfig
from .models import Finding, ScanUnit
from .patterns import (
    ANTI_MADHHAB_PATTERN,
    CLASSICAL_TAFSIR_PATTERN,
    ENCODING_PATTERN,
    EVIDENCE_MARKER_PATTERN,
    FATWA_CERTAINTY_PATTERN,
    HADITH_MARKER_PATTERN,
    NOVEL_DEFINITION_PATTERN,
    PROMPT_FATWA_PATTERN,
    SCIENTIFIC_CERTAINTY_PATTERN,
    SOURCE_KEY_PATTERN,
    TAKFIR_DIRECT_PATTERN,
    URL_PATTERN,
    YOUTUBE_PATTERN,
)
from .scanner import is_religious_path


GENERIC_FIQH_REWRITE_AR = (
    "يُذكر أن هذه المسألة تحتاج إلى دليل صريح وعزو فقهي معتبر، وتُحال للمراجعة الشرعية."
)
GENERIC_FIQH_REWRITE_EN = (
    "State the ruling only with explicit evidence and recognized fiqh attribution, "
    "or route it for scholar review."
)
GENERIC_KHILAF_REWRITE_AR = (
    "توجد في هذه المسألة أقوال سنية معتبرة، ويُعرض الخلاف المعتمد مع عزو المصادر."
)
GENERIC_KHILAF_REWRITE_EN = (
    "Present the accepted Sunni range of opinion with attributed sources."
)
GENERIC_SCIENCE_REWRITE_AR = (
    "يُعرض هذا كتأمل معاصر لا كتفسيرٍ ملزِم، مع إسناده إلى تفسير معتبر إن وُجد."
)
GENERIC_SCIENCE_REWRITE_EN = (
    "Label this as a contemporary reflection rather than binding tafsir unless "
    "classical tafsir explicitly supports it."
)
GENERIC_PROMPT_REWRITE_AR = (
    "قدّم معلومات منسوبة للمصادر، واذكر الأدلة بوضوح، ولا تُصدر أحكاماً شرعية قطعية "
    "بدون إحالة إلى مراجعة عالم مؤهل."
)
GENERIC_PROMPT_REWRITE_EN = (
    "Provide sourced information, cite evidence clearly, and defer decisive religious "
    "rulings to qualified scholar review."
)


def has_structured_evidence(context_text: str) -> bool:
    return bool(
        EVIDENCE_MARKER_PATTERN.search(context_text)
        or SOURCE_KEY_PATTERN.search(context_text)
        or CLASSICAL_TAFSIR_PATTERN.search(context_text)
    )


def has_hadith_evidence(context_text: str) -> bool:
    context_lower = context_text.lower()
    return bool(
        "hadith:" in context_lower
        or ("grading=" in context_lower and "grader=" in context_lower)
    )


def is_allowlisted_url(url: str, config: AuditConfig) -> bool:
    parsed = urlparse(url)
    host = parsed.netloc.lower()
    if host.startswith("www."):
        host = host[4:]
    return host in config.allowlist_domains


def safe_takfir_context(unit: ScanUnit) -> bool:
    return unit.content_kind in {"quran_text", "tafsir"}


def _base_finding(
    unit: ScanUnit,
    excerpt: str,
    reason_category: str,
    severity: str,
    confidence: str,
    suggested_action: str,
    scholar_review_required: str,
    evidence_missing: str,
    recommended_evidence_format: str,
    rule_id: str,
    suggested_replacement_ar: str | None = None,
    suggested_replacement_en: str | None = None,
) -> Finding:
    return Finding(
        file_path=unit.file_path,
        json_pointer=unit.location,
        excerpt_ar=excerpt,
        reason_category=reason_category,
        severity=severity,
        confidence=confidence,
        suggested_action=suggested_action,
        scholar_review_required=scholar_review_required,
        evidence_missing=evidence_missing,
        recommended_evidence_format=recommended_evidence_format,
        suggested_replacement_ar=suggested_replacement_ar,
        suggested_replacement_en=suggested_replacement_en,
        content_kind=unit.content_kind,
        file_type=unit.file_type,
        rule_id=rule_id,
        absolute_path=str(unit.absolute_path),
    )


def _external_link_findings(unit: ScanUnit, config: AuditConfig) -> list[Finding]:
    if not is_religious_path(unit.file_path, config):
        return []
    findings: list[Finding] = []
    for match in URL_PATTERN.finditer(unit.text):
        url = match.group(0).rstrip('",.)]')
        if is_allowlisted_url(url, config):
            continue
        findings.append(
            _base_finding(
                unit=unit,
                excerpt=url,
                reason_category="external_link",
                severity="major" if unit.content_kind != "quran_text" else "critical",
                confidence="high",
                suggested_action="delete",
                scholar_review_required="yes",
                evidence_missing="external link not vetted; no scholarly governance",
                recommended_evidence_format="SOURCE: allowlist_domain + scholar_approval_id",
                rule_id="external_link",
            )
        )
    return findings


def analyze_unit(unit: ScanUnit, config: AuditConfig) -> list[Finding]:
    findings = _external_link_findings(unit, config)

    if ENCODING_PATTERN.search(unit.text):
        findings.append(
            _base_finding(
                unit=unit,
                excerpt=unit.text,
                reason_category="encoding",
                severity="critical" if unit.content_kind == "quran_text" else "major",
                confidence="high",
                suggested_action="flag",
                scholar_review_required="yes" if unit.content_kind in {"quran_text", "tafsir"} else "no",
                evidence_missing="Unicode replacement character indicates corrupted text",
                recommended_evidence_format="UTF-8 verified against approved source text; no U+FFFD",
                rule_id="encoding_corruption",
            )
        )

    if unit.content_kind == "quran_text":
        return findings

    has_evidence = has_structured_evidence(unit.context_text)

    if unit.content_kind == "prompt" and PROMPT_FATWA_PATTERN.search(unit.text):
        findings.append(
            _base_finding(
                unit=unit,
                excerpt=unit.text,
                reason_category="prompt_system",
                severity="critical",
                confidence="high",
                suggested_action="rewrite",
                scholar_review_required="no",
                evidence_missing="prompt instructs decisive religious rulings without mandatory citation and scholar review",
                recommended_evidence_format="POLICY: require citations + scholar review for decisive rulings",
                rule_id="prompt_fatwa",
                suggested_replacement_ar=GENERIC_PROMPT_REWRITE_AR,
                suggested_replacement_en=GENERIC_PROMPT_REWRITE_EN,
            )
        )

    if FATWA_CERTAINTY_PATTERN.search(unit.text) and not has_evidence:
        is_ui = unit.content_kind == "ui_label"
        findings.append(
            _base_finding(
                unit=unit,
                excerpt=unit.text,
                reason_category="ux_wording" if is_ui else "fiqh",
                severity="major" if is_ui else "critical",
                confidence="medium" if unit.content_kind == "tafsir" else "high",
                suggested_action="rewrite" if is_ui else "flag",
                scholar_review_required="no" if is_ui else "yes",
                evidence_missing="no dalil; no madhhab attribution; no hadith grading",
                recommended_evidence_format="QURAN: S:V + TAFSIR: author/work/vol-page + FIQH: madhhab/manual/vol-page",
                rule_id="fatwa_certainty",
                suggested_replacement_ar=GENERIC_FIQH_REWRITE_AR if is_ui else None,
                suggested_replacement_en=GENERIC_FIQH_REWRITE_EN if is_ui else None,
            )
        )

    if HADITH_MARKER_PATTERN.search(unit.text) and not has_hadith_evidence(unit.context_text):
        findings.append(
            _base_finding(
                unit=unit,
                excerpt=unit.text,
                reason_category="hadith_source",
                severity="major",
                confidence="medium",
                suggested_action="flag",
                scholar_review_required="yes",
                evidence_missing="no hadith source+grading",
                recommended_evidence_format=(
                    "HADITH: collection | book/chapter | hadith # | "
                    "grading=<sahih/hasan/daif> | grader=<authority> | source=<stable reference>"
                ),
                rule_id="hadith_without_grading",
            )
        )

    if ANTI_MADHHAB_PATTERN.search(unit.text):
        findings.append(
            _base_finding(
                unit=unit,
                excerpt=unit.text,
                reason_category="fiqh",
                severity="major",
                confidence="high" if not has_evidence else "medium",
                suggested_action="rewrite",
                scholar_review_required="yes",
                evidence_missing="dismisses mainstream Sunni madhhab transmission without attributed sources",
                recommended_evidence_format="FIQH: madhhab/manual/vol-page + note_valid_khilaf",
                rule_id="anti_madhhab",
                suggested_replacement_ar=GENERIC_KHILAF_REWRITE_AR,
                suggested_replacement_en=GENERIC_KHILAF_REWRITE_EN,
            )
        )

    if TAKFIR_DIRECT_PATTERN.search(unit.text) and not safe_takfir_context(unit):
        findings.append(
            _base_finding(
                unit=unit,
                excerpt=unit.text,
                reason_category="aqidah",
                severity="critical",
                confidence="high",
                suggested_action="flag",
                scholar_review_required="yes",
                evidence_missing="high-risk takfir or apostasy language requires qualified scholarly framing",
                recommended_evidence_format="AQIDAH: recognized Sunni source + scholar review decision",
                rule_id="takfir",
            )
        )

    if SCIENTIFIC_CERTAINTY_PATTERN.search(unit.text):
        findings.append(
            _base_finding(
                unit=unit,
                excerpt=unit.text,
                reason_category="tafsir",
                severity="major" if unit.content_kind == "tafsir" else "moderate",
                confidence="high" if unit.content_kind == "tafsir" else "medium",
                suggested_action="rewrite",
                scholar_review_required="yes",
                evidence_missing="scientific certainty presented without classical tafsir support",
                recommended_evidence_format="QURAN: S:V + TAFSIR: author | work | vol/page or id | edition or stable URL",
                rule_id="scientific_certainty",
                suggested_replacement_ar=GENERIC_SCIENCE_REWRITE_AR,
                suggested_replacement_en=GENERIC_SCIENCE_REWRITE_EN,
            )
        )

    if NOVEL_DEFINITION_PATTERN.search(unit.text) and not has_evidence:
        findings.append(
            _base_finding(
                unit=unit,
                excerpt=unit.text,
                reason_category="aqidah",
                severity="major",
                confidence="high" if unit.content_kind != "tafsir" else "medium",
                suggested_action="flag",
                scholar_review_required="yes",
                evidence_missing="novel doctrinal definition without recognized Sunni attribution",
                recommended_evidence_format="QURAN: S:V + TAFSIR: author/work/vol-page + AQIDAH: recognized Sunni source",
                rule_id="novel_definition",
            )
        )

    return findings


def analyze_units(units: list[ScanUnit], config: AuditConfig) -> list[Finding]:
    findings: list[Finding] = []
    seen: set[tuple[str, str, str]] = set()
    for unit in units:
        for finding in analyze_unit(unit, config):
            key = (finding.file_path, finding.json_pointer, finding.rule_id)
            if key in seen:
                continue
            seen.add(key)
            findings.append(finding)
    return findings
