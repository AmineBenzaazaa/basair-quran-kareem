from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


DEFAULT_EXCLUDE_GLOBS = (
    ".git/**",
    ".expo/**",
    ".playwright-cli/**",
    "artifacts/**",
    ".tmp/**",
    "__pycache__/**",
    "node_modules/**",
    "**/node_modules/**",
    "dist-web-debug/**",
    "dist-web-debug2/**",
    "dist-web-debug3/**",
    "package-lock.json",
    "dashboard/package-lock.json",
)

DEFAULT_INCLUDE_GLOBS = ("**",)

DEFAULT_RELIGIOUS_CONTENT_GLOBS = (
    "assets/content/**",
    "src/data/content/**",
    "src/data/generated/**",
    "dashboard/src/lib/content/seeds/**",
    "app/**",
    "src/**",
)

DEFAULT_TEXT_EXTENSIONS = (
    ".md",
    ".txt",
    ".py",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".json",
    ".jsonl",
    ".yaml",
    ".yml",
    ".ini",
    ".cfg",
    ".toml",
    ".html",
    ".css",
    ".sh",
)


@dataclass
class AuditConfig:
    root: Path
    artifacts_dir: Path
    allowlist_domains: set[str] = field(default_factory=set)
    include_globs: tuple[str, ...] = DEFAULT_INCLUDE_GLOBS
    exclude_globs: tuple[str, ...] = DEFAULT_EXCLUDE_GLOBS
    religious_content_globs: tuple[str, ...] = DEFAULT_RELIGIOUS_CONTENT_GLOBS
    text_extensions: tuple[str, ...] = DEFAULT_TEXT_EXTENSIONS
    scan_docx: bool = True
    max_file_size_bytes: int = 2_000_000


def _as_tuple(value: Any, fallback: tuple[str, ...]) -> tuple[str, ...]:
    if value is None:
        return fallback
    if not isinstance(value, list) or not all(isinstance(item, str) for item in value):
        raise ValueError("Expected a list of strings in config")
    return tuple(value)


def _load_yaml_if_available(text: str) -> dict[str, Any]:
    try:
        import yaml  # type: ignore
    except ModuleNotFoundError as exc:
        raise ValueError(
            "YAML config requires PyYAML. Use JSON config or install PyYAML."
        ) from exc

    data = yaml.safe_load(text)
    if not isinstance(data, dict):
        raise ValueError("Config file must contain an object")
    return data


def load_config(root: Path, config_path: str | None = None) -> AuditConfig:
    data: dict[str, Any] = {}
    if config_path:
        path = Path(config_path)
        raw_text = path.read_text(encoding="utf-8")
        if path.suffix.lower() in {".yaml", ".yml"}:
            data = _load_yaml_if_available(raw_text)
        else:
            loaded = json.loads(raw_text)
            if not isinstance(loaded, dict):
                raise ValueError("Config file must contain an object")
            data = loaded

    artifacts_dir_value = data.get("artifacts_dir", "artifacts")
    if not isinstance(artifacts_dir_value, str):
        raise ValueError("artifacts_dir must be a string")

    allowlist = data.get("allowlist_domains", [])
    if allowlist is None:
        allowlist = []
    if not isinstance(allowlist, list) or not all(
        isinstance(item, str) for item in allowlist
    ):
        raise ValueError("allowlist_domains must be a list of strings")

    max_file_size = data.get("max_file_size_bytes", 2_000_000)
    if not isinstance(max_file_size, int) or max_file_size <= 0:
        raise ValueError("max_file_size_bytes must be a positive integer")

    scan_docx = data.get("scan_docx", True)
    if not isinstance(scan_docx, bool):
        raise ValueError("scan_docx must be a boolean")

    return AuditConfig(
        root=root,
        artifacts_dir=root / artifacts_dir_value,
        allowlist_domains={item.lower() for item in allowlist},
        include_globs=_as_tuple(data.get("include_globs"), DEFAULT_INCLUDE_GLOBS),
        exclude_globs=_as_tuple(data.get("exclude_globs"), DEFAULT_EXCLUDE_GLOBS),
        religious_content_globs=_as_tuple(
            data.get("religious_content_globs"), DEFAULT_RELIGIOUS_CONTENT_GLOBS
        ),
        text_extensions=_as_tuple(
            data.get("text_extensions"), DEFAULT_TEXT_EXTENSIONS
        ),
        scan_docx=scan_docx,
        max_file_size_bytes=max_file_size,
    )
