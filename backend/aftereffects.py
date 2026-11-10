"""After Effects: ``AfterFX.exe -r job.jsx`` hands one script to the running instance.

No panel and no Node. The job writes its own result file, so it needs After Effects'
Edit > Preferences > Scripting & Expressions > "Allow Scripts to Write Files and
Access Network" turned on (the timeout answer says so).
"""

from __future__ import annotations

import json
import os
import subprocess
import time
from functools import lru_cache
from pathlib import Path
from typing import Any

from . import jobs
from .com_runner import _win_no_window_kwargs, plugin_root

APP = "aftereffects"
EXE_NAME = "AfterFX.exe"
INTENT = r"\b(after ?effects|aftereffects|\.aep|motion graphics|keyframes?|expression)\b"
LIBS = ["assets/common/ducky.jsx", "assets/aftereffects/commands.jsx"]

PREF_HINT = (
    "Check three things in After Effects: a project is open, Edit > Preferences > Scripting & "
    "Expressions > 'Allow Scripts to Write Files and Access Network' is on, and no dialog is "
    "waiting for a click (scripting stops while one is open)."
)

TIMEOUTS = {
    "render_queue": 3600.0,
    "open_project": 300.0,
    "import_footage": 180.0,
    "render_frame": 120.0,
    "precompose": 120.0,
}


@lru_cache(maxsize=1)
def catalog() -> list[dict[str, Any]]:
    try:
        data = json.loads((plugin_root() / "assets" / "aftereffects" / "catalog.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return []
    return data if isinstance(data, list) else []


def find_exe() -> Path | None:
    override = os.environ.get("AE_EXE", "").strip()
    if override and Path(override).is_file():
        return Path(override)
    from .heal import _glob_exes

    found = _glob_exes("Adobe After Effects*/Support Files/AfterFX.exe")
    release = [p for p in found if "(beta)" not in str(p).lower()]
    ordered = release + [p for p in found if p not in release]
    return ordered[0] if ordered else None


def running() -> bool:
    from .heal import _win_exe_running

    return _win_exe_running(EXE_NAME)


def run(command: str, params: dict[str, Any] | None = None, *, timeout: float | None = None, label: str = "") -> dict[str, Any]:
    exe = find_exe()
    if exe is None and not running():
        return {"ok": False, "state": "missing_app", "error": "After Effects is not installed (no AfterFX.exe under Program Files\\Adobe). Set AE_EXE if it lives elsewhere."}
    if not running():
        return {
            "ok": False,
            "state": "launching",
            "error": "After Effects is not running. Call aftereffects_status(launch=true) to open it, then retry.",
        }
    if exe is None:
        return {"ok": False, "state": "error", "error": "After Effects is running but AfterFX.exe was not found. Set AE_EXE to its full path."}
    wait = timeout if timeout is not None else TIMEOUTS.get(command, 60.0)
    _jid, job, result = jobs.new_job(APP)
    script = jobs.build_job(LIBS, "DUCKY_AE.run", command, params or {}, result, label)
    job.write_bytes("﻿".encode("utf-8") + script.encode("utf-8"))
    try:
        # The forwarder hands the script to the running instance and exits.
        subprocess.Popen([str(exe), "-r", str(job)], close_fds=True, **_win_no_window_kwargs())
        data = jobs.wait_result(result, wait, alive=running)
    except OSError as exc:
        jobs.remove_quietly(job)
        return {"ok": False, "state": "error", "error": f"could not start AfterFX.exe: {exc}"}
    if data is None:
        # Keep the job file: AE may still read it once a dialog closes, and a missing
        # -r file raises a modal of its own. jobs.sweep drops it within the hour.
        jobs.remove_quietly(result)
        return {
            "ok": False,
            "state": "error",
            "error": f"After Effects did not answer within {int(wait)} s.",
            "hint": PREF_HINT,
        }
    jobs.remove_quietly(job, result)
    return jobs.shape(data)


def launch(wait: float = 120.0) -> dict[str, Any]:
    exe = find_exe()
    if exe is None:
        return {"ok": False, "error": "After Effects is not installed"}
    if not running():
        subprocess.Popen([str(exe)], close_fds=True)
    deadline = time.monotonic() + wait
    last: dict[str, Any] = {}
    while time.monotonic() < deadline:
        if running():
            last = run("ping", {}, timeout=15.0)
            if last.get("ok"):
                return last
        time.sleep(2.0)
    return {"ok": False, "error": last.get("error") or "After Effects did not become ready", "hint": PREF_HINT}


def status(launch_app: bool = False) -> dict[str, Any]:
    exe = find_exe()
    is_running = running()
    row: dict[str, Any] = {
        "installed": bool(exe) or is_running,
        "running": is_running,
        "exe": str(exe) if exe else "",
        "ready": False,
        "version": "",
        "project": None,
        "error": "",
    }
    if launch_app and not is_running and exe:
        live = launch()
        row["running"] = running()
        if not live.get("ok"):
            row["error"] = str(live.get("error") or "")
            row["hint"] = live.get("hint", "")
            return row
    if row["running"]:
        ping = run("ping", {}, timeout=15.0)
        row["ready"] = bool(ping.get("ok"))
        row["version"] = str(ping.get("version") or "")
        row["project"] = ping.get("project")
        if not ping.get("ok"):
            row["error"] = str(ping.get("error") or "")
            row["hint"] = ping.get("hint", PREF_HINT)
    elif not row["installed"]:
        row["error"] = "After Effects is not installed"
    return row


def _describe(row: dict[str, Any]) -> str:
    desc = str(row.get("description") or row["name"])
    params = row.get("params") or {}
    if params:
        desc += " Params: " + "; ".join(f"{k} = {v}" for k, v in params.items())
    return desc


def register_aftereffects_tools(api: Any) -> None:
    @api.tool(name="aftereffects_status", intent=INTENT, listener=False)
    def aftereffects_status(launch: bool = False) -> str:
        """After Effects readiness: installed, running, version, open project. launch=true opens it and waits until scripts run."""
        return json.dumps(status(bool(launch)), indent=2, default=str)

    @api.tool(name="aftereffects_execute_jsx", intent=INTENT, listener=False)
    def aftereffects_execute_jsx(code: str, params: dict[str, Any] | None = None) -> str:
        """Run raw ExtendScript in After Effects as a function body with `app` and `params` in scope; `return` a JSON-able value. One undo step. Last resort when no aftereffects_* tool fits."""
        return json.dumps(run("__eval", {"code": code, "params": params or {}}, label="script"), indent=2, default=str)

    for row in catalog():
        name = str(row["name"])

        def _make(cmd: str, doc: str):
            def fn(params: dict[str, Any] | None = None) -> str:
                try:
                    result = run(cmd, params or {})
                except Exception as exc:
                    result = {"ok": False, "error": str(exc)}
                return json.dumps(result, indent=2, default=str)

            fn.__name__ = f"aftereffects_{cmd}"
            fn.__doc__ = doc
            return fn

        api.tool(name=f"aftereffects_{name}", intent=INTENT, listener=False)(_make(name, _describe(row)))
