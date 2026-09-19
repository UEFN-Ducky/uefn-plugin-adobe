"""In-process Illustrator coordinate-system session (ie3jp set_workflow)."""

from __future__ import annotations

from typing import Any

_WORKFLOW: str | None = None
_COORD: str | None = None

_WORKFLOW_TO_COORD = {"web": "artboard-web", "print": "document", "video": "artboard-web"}


def set_workflow(params: dict[str, Any]) -> dict[str, Any]:
    global _WORKFLOW, _COORD
    if params.get("clear"):
        _WORKFLOW = None
        _COORD = None
        return {"status": "cleared", "message": "Session reset. coordinate_system auto-detects."}
    wf = params.get("workflow")
    coord = params.get("coordinate_system")
    if wf in _WORKFLOW_TO_COORD:
        _WORKFLOW = str(wf)
        _COORD = str(coord) if coord else _WORKFLOW_TO_COORD[str(wf)]
    elif coord:
        _COORD = str(coord)
    return {
        "status": "set",
        "workflow": _WORKFLOW,
        "coordinate_system": _COORD,
    }


def apply_session(params: dict[str, Any]) -> dict[str, Any]:
    out = dict(params)
    if "coordinate_system" not in out and _COORD:
        out["coordinate_system"] = _COORD
    return out


def snapshot() -> dict[str, Any]:
    return {"workflow": _WORKFLOW, "coordinate_system": _COORD}
