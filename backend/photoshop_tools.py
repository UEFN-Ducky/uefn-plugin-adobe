"""Register alisaitteke-named photoshop_* tools on COM."""

from __future__ import annotations

import json
from typing import Any

from . import catalogs
from .com_runner import INTENT, execute_photoshop, plugin_root


def _dispatcher(params: dict[str, Any]) -> str:
    raw = (plugin_root() / "assets" / "photoshop" / "dispatcher.jsx").read_text(encoding="utf-8")
    return raw.replace("__PARAMS__", json.dumps(params, ensure_ascii=False))


def run_photoshop_tool(name: str, params: dict[str, Any] | None) -> dict[str, Any]:
    payload = dict(params or {})
    payload["tool"] = name
    return execute_photoshop(_dispatcher(payload))


def register_photoshop_tools(api: Any) -> None:
    for row in catalogs.photoshop_catalog():
        name = str(row["name"])
        desc = str(row.get("description") or name)

        def _make(n: str, d: str):
            def fn(params: dict[str, Any] | None = None) -> str:
                """Photoshop tool."""
                try:
                    result = run_photoshop_tool(n, params)
                except Exception as exc:
                    return json.dumps({"ok": False, "error": str(exc)}, indent=2, default=str)
                if isinstance(result, dict) and result.get("ok") is False:
                    return json.dumps(result, indent=2, default=str)
                return json.dumps(result, indent=2, default=str)

            fn.__name__ = n
            fn.__doc__ = d
            return fn

        api.tool(name=name, intent=INTENT, listener=False)(_make(name, desc))
