"""Unity-shaped adobe_status."""

from __future__ import annotations

from typing import Any

from . import catalogs
from .com_runner import official_mcp_up
from .session import snapshot

HINTS = {
    "missing_app": "Install Adobe Illustrator, Photoshop, After Effects or Premiere Pro, then call adobe_status again.",
    "launching": (
        "Installed, not running. Call the illustrator_* or photoshop_* tool you need, "
        "or adobe_status(app=...) — only that app opens (aftereffects / premiere too)."
    ),
    "ready": (
        "Ready. Call illustrator_get_document_info, photoshop_get_state, aftereffects_project_info "
        "or premiere_project_info and do the work. Do not refuse Adobe."
    ),
    "error": "COM ping failed. Call adobe_redeploy once, then read again. Do not paste MCP tokens.",
}


def classify(apps: dict[str, Any]) -> str:
    ai = apps.get("illustrator") or {}
    ps = apps.get("photoshop") or {}
    ae = apps.get("aftereffects") or {}
    pr = apps.get("premiere") or {}
    if not any(row.get("installed") for row in (ai, ps, ae, pr)):
        return "missing_app"
    if ai.get("com") or ps.get("com") or ae.get("ready") or pr.get("ready"):
        return "ready"
    if ae.get("running") or (pr.get("running") and (pr.get("bridge") or {}).get("alive")):
        return "ready"
    if not ai.get("installed") and not ps.get("installed"):
        return "launching"
    # Window title with a .ai is enough — COM may be bound to empty Beta.
    if ai.get("running") and ai.get("open_documents"):
        return "ready"
    if ai.get("error") or ps.get("error"):
        if ai.get("running") or ps.get("running") or ai.get("installed") or ps.get("installed"):
            if not ai.get("running") and not ps.get("running"):
                return "launching"
            return "error"
        return "missing_app"
    return "launching"


def _video_rows(app: str) -> dict[str, Any]:
    """After Effects / Premiere: a full status (ping, maybe launch) only when named."""
    from . import aftereffects, premiere

    want = (app or "").strip().lower()
    rows: dict[str, Any] = {}
    for key, mod, names in (("aftereffects", aftereffects, ("after", "ae")), ("premiere", premiere, ("prem", "pr"))):
        try:
            if any(want == n or want.startswith(n) and len(n) > 2 for n in names):
                rows[key] = mod.status(launch_app=True)
            else:
                exe = mod.find_exe()
                is_running = mod.running()
                rows[key] = {"installed": bool(exe) or is_running, "running": is_running, "exe": str(exe) if exe else ""}
                if key == "premiere":
                    rows[key]["bridge"] = mod.bridge_state()
        except Exception as exc:
            rows[key] = {"installed": False, "running": False, "error": str(exc)}
    return rows


def build_status(apps: dict[str, Any] | None = None, *, heal: bool = True, app: str = "") -> dict[str, Any]:
    from .heal import ensure_live, snapshot_apps

    if apps is not None:
        live = apps
    elif heal:
        live = {**ensure_live(app), **_video_rows(app)}
    else:
        live = {**snapshot_apps(), **_video_rows("")}
    state = classify(live)
    tools = catalogs.list_entries()
    return {
        "ok": state == "ready",
        "plugin_id": "adobe",
        "state": state,
        "hint": HINTS[state],
        "illustrator": live.get("illustrator") or {},
        "photoshop": live.get("photoshop") or {},
        "aftereffects": live.get("aftereffects") or {},
        "premiere": live.get("premiere") or {},
        "official_mcp": {
            "reachable": official_mcp_up(),
            "url": "http://127.0.0.1:18412/v1/mcp",
            "note": "Bonus probe only. COM is the plug-and-play path.",
        },
        "session": snapshot(),
        "tools": {"count": len(tools), "available": state == "ready"},
    }
