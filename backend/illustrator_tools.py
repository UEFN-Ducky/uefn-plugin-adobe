"""Register vendored ie3jp Illustrator tools as illustrator_*."""

from __future__ import annotations

import json
from typing import Any

from . import catalogs
from .com_runner import INTENT, execute_illustrator, plugin_root
from .session import apply_session, set_workflow


def _load_jsx(rel: str) -> str:
    root = plugin_root() / "assets" / "illustrator"
    path = root / rel.replace("\\", "/")
    if path.is_file():
        return path.read_text(encoding="utf-8")
    pack = root / "jsx_bundle.json"
    data = json.loads(pack.read_text(encoding="utf-8"))
    return str(data[path.name])


def run_illustrator_tool(name: str, params: dict[str, Any] | None) -> dict[str, Any]:
    row = next((r for r in catalogs.illustrator_catalog() if r["name"] == name), None)
    if row is None:
        return {"ok": False, "error": f"unknown illustrator tool {name}"}
    payload = apply_session(params or {})
    if row.get("session"):
        return set_workflow(payload)
    rel = row.get("jsx")
    if not rel:
        return {"ok": False, "error": f"{name} has no JSX"}
    return execute_illustrator(_load_jsx(str(rel)), payload, activate=bool(row.get("activate")))


def register_illustrator_tools(api: Any) -> None:
    for row in catalogs.illustrator_catalog():
        short = str(row["name"])
        full = f"illustrator_{short}"
        desc = str(row.get("description") or short)

        def _make(n: str, d: str):
            def fn(params: dict[str, Any] | None = None) -> str:
                """Illustrator tool."""
                try:
                    result = run_illustrator_tool(n, params)
                except Exception as exc:
                    return json.dumps({"ok": False, "error": str(exc)}, indent=2, default=str)
                if isinstance(result, dict) and result.get("error"):
                    result = {**result, "ok": False}
                return json.dumps(result, indent=2, default=str)

            fn.__name__ = f"illustrator_{n}"
            fn.__doc__ = d
            return fn

        api.tool(name=full, intent=INTENT, listener=False)(_make(short, desc))
