"""Automation / pipeline tiles. No Adobe required."""

from __future__ import annotations

import json
from pathlib import Path

from backend import automations


def test_plugin_json_lists_adobe_nodes() -> None:
    data = json.loads((Path(__file__).resolve().parents[1] / "plugin.json").read_text(encoding="utf-8"))
    ids = {n["id"] for n in data["contributes"]["automations"]["nodes"]}
    assert ids == set(automations.NODES)
    tpls = {t["id"] for t in data["contributes"]["automations"]["templates"]}
    assert "adobe-export-illustrator" in tpls
    assert "adobe-agent-then-export" in tpls
    assert "adobe-brief-ducky" in tpls
    assert "adobe-export-photoshop" in tpls


def test_register_nodes() -> None:
    names: list[str] = []

    class Api:
        def register_automation_node(self, name, _fn):
            names.append(name)

    automations.register_nodes(Api())
    assert names == list(automations.NODES)


def test_open_requires_path() -> None:
    assert automations.handle_illustrator_open({"config": {}}) == {
        "ok": False,
        "error": "path required",
    }


def test_jsx_requires_code() -> None:
    assert automations.handle_jsx({"config": {"app": "illustrator"}}) == {
        "ok": False,
        "error": "code required",
    }
