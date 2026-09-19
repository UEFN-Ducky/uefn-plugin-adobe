"""JSX pack/unpack — no Adobe required."""

from __future__ import annotations

import json
from pathlib import Path

from backend.com_runner import build_illustrator_jsx, plugin_root


def test_build_wraps_helpers_and_paths() -> None:
    jsx = build_illustrator_jsx(
        "writeResultFile(RESULT_PATH, {ok:true});\n",
        Path("C:/tmp/params.json"),
        Path("C:/tmp/result.json"),
    )
    assert "readParamsFile" in jsx or "jsonStringify" in jsx
    assert "C:/tmp/params.json" in jsx
    assert "C:/tmp/result.json" in jsx
    assert jsx.startswith("(function()")


def test_catalog_jsx_files_exist() -> None:
    root = plugin_root()
    catalog = json.loads((root / "assets" / "illustrator" / "catalog.json").read_text(encoding="utf-8"))
    missing = []
    for row in catalog:
        rel = row.get("jsx")
        if not rel:
            continue
        if not (root / "assets" / "illustrator" / rel).is_file():
            missing.append(row["name"])
    assert not missing, missing
    assert len([r for r in catalog if r.get("jsx")]) >= 63


def test_bind_ps1_placeholders() -> None:
    raw = (Path(__file__).resolve().parents[1] / "assets" / "illustrator" / "bind.ps1").read_text(
        encoding="utf-8"
    )
    for token in ("__META__", "__JSX__", "__PROGID__", "__ACTIVATE__", "__APP_NAME__"):
        assert token in raw


def test_plugin_json_shape() -> None:
    spec = json.loads((plugin_root() / "plugin.json").read_text(encoding="utf-8"))
    assert spec["id"] == "adobe"
    assert spec["default_enabled"] is False
    contrib = spec.get("contributes") or {}
    assert "settings.tabs" not in contrib
    assert "adobe_status" in contrib["agent.tools"]["plan_tools"]
