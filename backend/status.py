"""Unity-shaped adobe_status."""

from __future__ import annotations

from typing import Any

from . import catalogs
from .com_runner import official_mcp_up
from .session import snapshot

HINTS = {
    "missing_app": "Install Adobe Illustrator and/or Photoshop, then call adobe_status again.",
    "launching": "Launching Adobe… wait, then adobe_status.",
    "ready": "Ready. Call illustrator_get_document_info or photoshop_get_state and do the work. Do not refuse Adobe.",
    "error": "COM ping failed. Call adobe_redeploy once, then read again. Do not paste MCP tokens.",
}


def classify(apps: dict[str, Any]) -> str:
    ai = apps.get("illustrator") or {}
    ps = apps.get("photoshop") or {}
    if not ai.get("installed") and not ps.get("installed"):
        return "missing_app"
    if ai.get("com") or ps.get("com"):
        return "ready"
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


def build_status(apps: dict[str, Any] | None = None, *, heal: bool = True) -> dict[str, Any]:
    from .heal import ensure_live, snapshot_apps

    if apps is not None:
        live = apps
    elif heal:
        live = ensure_live()
    else:
        live = snapshot_apps()
    state = classify(live)
    tools = catalogs.list_entries()
    return {
        "ok": state == "ready",
        "plugin_id": "adobe",
        "state": state,
        "hint": HINTS[state],
        "illustrator": live.get("illustrator") or {},
        "photoshop": live.get("photoshop") or {},
        "official_mcp": {
            "reachable": official_mcp_up(),
            "url": "http://127.0.0.1:18412/v1/mcp",
            "note": "Bonus probe only. COM is the plug-and-play path.",
        },
        "session": snapshot(),
        "tools": {"count": len(tools), "available": state == "ready"},
    }
