# Sunni Audit Workflow

## Purpose

`python -m sunni_audit` adds a conservative content-governance gate for this repository. It is designed to surface risky religious content, not to replace scholar judgment.

## Local usage

- Dry-run only:
  `python -m sunni_audit`
- Explicit dry-run:
  `python -m sunni_audit --dry-run`
- Apply mechanically safe edits only:
  `python -m sunni_audit --apply`
- Use a custom config:
  `python -m sunni_audit --config sunni_audit.example.json`

Artifacts are written to `artifacts/`:

- `deletion_plan.csv`
- `deletion_plan.json`
- `audit_report.md`
- `audit_log.jsonl`
- `apply.patch` in apply mode when any safe edits are made

## Safe defaults

- Qur'anic ayah text is never auto-edited.
- Unsure cases are flagged, not deleted.
- Doctrinal, fiqh, tafsir, hadith, and takfir findings stay review-driven.
- Apply mode only changes high-confidence, mechanically safe cases such as unvetted external links and certain internal prompt instructions.

## CI and governance

The GitHub Actions workflow runs dry-run only and uploads artifacts on every relevant `push` and `pull_request`.

Recommended repository settings:

1. Enable branch protection for your main branch.
2. Require the `Sunni Audit` workflow to pass before merge.
3. Require review from code owners.
4. Replace the placeholder teams in `.github/CODEOWNERS` with your real scholar and engineering teams.
5. Treat `artifacts/audit_report.md` as part of religious-content review.

## Config

The auditor accepts JSON config out of the box. YAML config also works if `PyYAML` is installed. A minimal example:

```json
{
  "allowlist_domains": [
    "example.org"
  ],
  "exclude_globs": [
    "node_modules/**",
    "**/node_modules/**",
    "dist-web-debug/**",
    "artifacts/**"
  ],
  "religious_content_globs": [
    "assets/content/**",
    "src/data/content/**",
    "dashboard/src/lib/content/seeds/**",
    "app/**",
    "src/**"
  ]
}
```

## Security notes

- The workflow uses `contents: read` only.
- The workflow avoids third-party actions beyond `actions/checkout`, `actions/setup-python`, and `actions/upload-artifact`.
- CI never runs `--apply`.
