"""Automations + Pipelines tiles. Reuse illustrator/photoshop runners."""

from __future__ import annotations

from pathlib import Path
from typing import Any

NODES = (
    "adobe.status",
    "illustrator.read",
    "illustrator.open",
    "illustrator.save",
    "illustrator.export",
    "photoshop.read",
    "photoshop.export",
    "adobe.jsx",
)


def register_nodes(api: Any) -> None:
    if not hasattr(api, "register_automation_node"):
        return
    api.register_automation_node("adobe.status", handle_status)
    api.register_automation_node("illustrator.read", handle_illustrator_read)
    api.register_automation_node("illustrator.open", handle_illustrator_open)
    api.register_automation_node("illustrator.save", handle_illustrator_save)
    api.register_automation_node("illustrator.export", handle_illustrator_export)
    api.register_automation_node("photoshop.read", handle_photoshop_read)
    api.register_automation_node("photoshop.export", handle_photoshop_export)
    api.register_automation_node("adobe.jsx", handle_jsx)


def _pair(ctx: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    cfg = ctx.get("config") if isinstance(ctx.get("config"), dict) else {}
    payload = ctx.get("payload") if isinstance(ctx.get("payload"), dict) else {}
    return cfg, payload


def _pick(cfg: dict[str, Any], payload: dict[str, Any], *keys: str, default: str = "") -> str:
    for key in keys:
        val = cfg.get(key)
        if val not in (None, ""):
            return str(val)
        val = payload.get(key)
        if val not in (None, ""):
            return str(val)
    return default


def _wrap(result: Any) -> dict[str, Any]:
    if not isinstance(result, dict):
        return {"ok": True, "result": result}
    if result.get("error") and result.get("ok") is not False:
        return {**result, "ok": False}
    if "ok" not in result:
        return {**result, "ok": True}
    return result


def handle_status(_ctx: dict[str, Any]) -> dict[str, Any]:
    from .status import build_status

    return build_status()


def handle_illustrator_read(_ctx: dict[str, Any]) -> dict[str, Any]:
    from .illustrator_tools import run_illustrator_tool

    return _wrap(run_illustrator_tool("get_document_info", {}))


def handle_illustrator_open(ctx: dict[str, Any]) -> dict[str, Any]:
    from .illustrator_tools import run_illustrator_tool

    cfg, payload = _pair(ctx)
    path = _pick(cfg, payload, "path", "file_path")
    if not path:
        return {"ok": False, "error": "path required"}
    return _wrap(run_illustrator_tool("open_document", {"path": path}))


def handle_illustrator_save(ctx: dict[str, Any]) -> dict[str, Any]:
    from .illustrator_tools import run_illustrator_tool

    cfg, payload = _pair(ctx)
    path = _pick(cfg, payload, "path", "file_path")
    params: dict[str, Any] = {}
    if path:
        params["path"] = path
    return _wrap(run_illustrator_tool("save_document", params))


def handle_illustrator_export(ctx: dict[str, Any]) -> dict[str, Any]:
    from .illustrator_tools import run_illustrator_tool

    cfg, payload = _pair(ctx)
    fmt = _pick(cfg, payload, "format") or "png"
    target = _pick(cfg, payload, "target") or "artboard:all"
    out = _pick(cfg, payload, "output_path", "path")
    if not out:
        dest = str(ctx.get("artifact_dir") or "").strip()
        if dest:
            out = str(Path(dest) / f"illustrator.{fmt}")
    params: dict[str, Any] = {"format": fmt, "target": target}
    if out:
        params["output_path"] = out
    return _wrap(run_illustrator_tool("export", params))


def handle_photoshop_read(_ctx: dict[str, Any]) -> dict[str, Any]:
    from .photoshop_tools import run_photoshop_tool

    return _wrap(run_photoshop_tool("photoshop_get_state", {}))


def handle_photoshop_export(ctx: dict[str, Any]) -> dict[str, Any]:
    from .photoshop_tools import run_photoshop_tool

    cfg, payload = _pair(ctx)
    fmt = _pick(cfg, payload, "format") or "png"
    out = _pick(cfg, payload, "output_path", "path", "file_path")
    if not out:
        dest = str(ctx.get("artifact_dir") or "").strip()
        if dest:
            out = str(Path(dest) / f"photoshop.{fmt}")
    if not out:
        return {"ok": False, "error": "output_path required"}
    return _wrap(run_photoshop_tool("photoshop_export", {"path": out, "format": fmt}))


def handle_jsx(ctx: dict[str, Any]) -> dict[str, Any]:
    from .com_runner import execute_illustrator, execute_photoshop

    cfg, payload = _pair(ctx)
    app = (_pick(cfg, payload, "app") or "illustrator").lower()
    code = _pick(cfg, payload, "code", "jsx")
    if not code:
        return {"ok": False, "error": "code required"}
    try:
        if app.startswith("ill"):
            return _wrap(execute_illustrator(code, {}, activate=True))
        if app.startswith("pho") or app == "ps":
            return _wrap(execute_photoshop(code))
    except Exception as exc:
        return {"ok": False, "error": str(exc)}
    return {"ok": False, "error": "app must be illustrator or photoshop"}
