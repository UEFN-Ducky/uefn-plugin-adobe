"""Premiere Pro through the Ducky Bridge CEP panel.

Premiere runs ExtendScript only from inside a panel, so the plugin ships a small one
(``assets/premiere/cep``). ``premiere_install_bridge`` copies it into the user's CEP
extensions folder and turns on PlayerDebugMode (HKCU, unsigned panels); the panel then
polls ``%LOCALAPPDATA%/UEFN-Ducky/adobe/premiere`` for job scripts and runs them.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import time
from functools import lru_cache
from pathlib import Path
from typing import Any

from . import jobs
from .com_runner import plugin_root

APP = "premiere"
EXE_NAME = "Adobe Premiere Pro.exe"
EXT_ID = "com.uefnducky.premiere.bridge"
INTENT = r"\b(premiere|premiere ?pro|prproj|timeline|sequence|rough ?cut)\b"
LIBS = ["assets/common/ducky.jsx", "assets/premiere/commands.jsx"]
CSXS_VERSIONS = (9, 10, 11, 12)
HEARTBEAT_SEC = 10.0

TIMEOUTS = {
    "export_sequence": 3600.0,
    "open_project": 300.0,
    "import_media": 300.0,
    "export_frame": 120.0,
}

BRIDGE_HINT = (
    "Open Premiere Pro, then Window > Extensions > Ducky Bridge once (it starts by itself after "
    "that, as long as it stays docked). Not in the menu? Call premiere_install_bridge, then restart Premiere."
)


@lru_cache(maxsize=1)
def catalog() -> list[dict[str, Any]]:
    try:
        data = json.loads((plugin_root() / "assets" / "premiere" / "catalog.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return []
    return data if isinstance(data, list) else []


def find_exe() -> Path | None:
    override = os.environ.get("PREMIERE_EXE", "").strip()
    if override and Path(override).is_file():
        return Path(override)
    from .heal import _glob_exes

    found = _glob_exes("Adobe Premiere Pro*/Adobe Premiere Pro.exe")
    release = [p for p in found if "(beta)" not in str(p).lower()]
    ordered = release + [p for p in found if p not in release]
    return ordered[0] if ordered else None


def running() -> bool:
    from .heal import _win_exe_running

    return _win_exe_running(EXE_NAME)


# ---------------------------------------------------------------- the CEP panel


def cep_extensions_dir() -> Path:
    appdata = os.environ.get("APPDATA") or str(Path.home() / "AppData" / "Roaming")
    return Path(appdata) / "Adobe" / "CEP" / "extensions"


def bridge_source() -> Path:
    return plugin_root() / "assets" / "premiere" / "cep"


def bridge_version(folder: Path) -> str:
    try:
        text = (folder / "CSXS" / "manifest.xml").read_text(encoding="utf-8")
    except OSError:
        return ""
    marker = 'ExtensionBundleVersion="'
    at = text.find(marker)
    if at < 0:
        return ""
    return text[at + len(marker): text.find('"', at + len(marker))]


def _install_record() -> Path:
    return jobs.job_root(APP) / "install.json"


def _debug_mode_keys() -> list[tuple[int, str | None]]:
    """(csxs version, current PlayerDebugMode or None)."""
    if sys.platform != "win32":
        return []
    import winreg

    out: list[tuple[int, str | None]] = []
    for v in CSXS_VERSIONS:
        try:
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, rf"Software\Adobe\CSXS.{v}") as key:
                val, _ = winreg.QueryValueEx(key, "PlayerDebugMode")
                out.append((v, str(val)))
        except OSError:
            out.append((v, None))
    return out


def _set_debug_mode(version: int, value: str | None) -> None:
    import winreg

    path = rf"Software\Adobe\CSXS.{version}"
    if value is None:
        try:
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, path, 0, winreg.KEY_SET_VALUE) as key:
                winreg.DeleteValue(key, "PlayerDebugMode")
        except OSError:
            pass
        return
    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, path) as key:
        winreg.SetValueEx(key, "PlayerDebugMode", 0, winreg.REG_SZ, value)


def bridge_state() -> dict[str, Any]:
    target = cep_extensions_dir() / EXT_ID
    shipped = bridge_version(bridge_source())
    installed = bridge_version(target)
    debug = _debug_mode_keys()
    beat = heartbeat()
    return {
        "installed": bool(installed),
        "installed_version": installed,
        "shipped_version": shipped,
        "up_to_date": bool(installed) and installed == shipped,
        "path": str(target),
        "debug_mode": {f"CSXS.{v}": val == "1" for v, val in debug},
        "alive": beat is not None,
        "heartbeat": beat,
    }


def install_bridge(*, extensions_dir: Path | None = None, set_debug: bool = True) -> dict[str, Any]:
    """Copy the panel into the CEP folder and allow unsigned panels for this user."""
    dest_root = extensions_dir or cep_extensions_dir()
    target = dest_root / EXT_ID
    src = bridge_source()
    if not (src / "CSXS" / "manifest.xml").is_file():
        return {"ok": False, "error": "the plugin's Premiere bridge files are missing"}
    dest_root.mkdir(parents=True, exist_ok=True)
    if target.exists():
        shutil.rmtree(target)
    shutil.copytree(src, target)
    changed: list[int] = []
    if set_debug and sys.platform == "win32":
        record_path = _install_record()
        try:
            record = json.loads(record_path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            record = {}
        before = record.get("debug_before") or {}
        for v, val in _debug_mode_keys():
            if val != "1":
                before.setdefault(str(v), val)
                _set_debug_mode(v, "1")
                changed.append(v)
        record_path.write_text(json.dumps({"debug_before": before, "path": str(target)}), encoding="utf-8")
    return {
        "ok": True,
        "path": str(target),
        "version": bridge_version(target),
        "debug_mode_set": [f"CSXS.{v}" for v in changed],
        "next": "Restart Premiere Pro, then open Window > Extensions > Ducky Bridge once.",
    }


def remove_bridge(*, extensions_dir: Path | None = None) -> dict[str, Any]:
    target = (extensions_dir or cep_extensions_dir()) / EXT_ID
    removed = target.exists()
    if removed:
        shutil.rmtree(target)
    restored: list[str] = []
    record_path = _install_record()
    if sys.platform == "win32" and extensions_dir is None:
        try:
            record = json.loads(record_path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            record = {}
        # Only undo the PlayerDebugMode values this plugin changed; other panels may need them.
        for v, val in (record.get("debug_before") or {}).items():
            _set_debug_mode(int(v), val)
            restored.append(f"CSXS.{v}")
        try:
            record_path.unlink()
        except OSError:
            pass
    return {"ok": True, "removed": removed, "debug_mode_restored": restored}


_INSTALLED_NOW: dict[str, bool] = {}


def ensure_bridge() -> dict[str, Any] | None:
    """Zero setup: install (or update) the Ducky Bridge panel the first time it is needed.
    Returns the install answer when it installed now, else None."""
    state = bridge_state()
    if state["installed"] and state["up_to_date"]:
        return None
    try:
        out = install_bridge()
    except (OSError, PermissionError) as exc:
        return {"ok": False, "error": f"could not install the Ducky Bridge panel: {exc}"}
    _INSTALLED_NOW["while_running"] = running()
    return out


def heartbeat() -> dict[str, Any] | None:
    path = jobs.job_root(APP) / "bridge.json"
    try:
        if time.time() - path.stat().st_mtime > HEARTBEAT_SEC:
            return None
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return data if isinstance(data, dict) else None


# ---------------------------------------------------------------- jobs


def run(command: str, params: dict[str, Any] | None = None, *, timeout: float | None = None,
        code: str | None = None) -> dict[str, Any]:
    """Run one catalog command, or with ``code`` raw ExtendScript (a function body with
    ``app`` and ``params``)."""
    if find_exe() is None and not running():
        return {"ok": False, "state": "missing_app", "error": "Premiere Pro is not installed (set PREMIERE_EXE if it lives elsewhere)."}
    installed = ensure_bridge()
    if installed is not None and not installed.get("ok"):
        return {"ok": False, "state": "bridge_missing", "error": installed.get("error")}
    if not running():
        return {"ok": False, "state": "launching", "error": "Premiere Pro is not running. Call premiere_status(launch=true), then retry."}
    if heartbeat() is None:
        if _INSTALLED_NOW.get("while_running"):
            return {"ok": False, "state": "restart_needed",
                    "error": "Ducky installed its Premiere panel while Premiere Pro was open: Premiere loads it on its next start.",
                    "hint": "Ask the person to save and restart Premiere Pro (never close it for them), then retry."}
        return {"ok": False, "state": "bridge_closed", "error": "The Ducky Bridge panel is not running in Premiere Pro.", "hint": BRIDGE_HINT}
    wait = timeout if timeout is not None else TIMEOUTS.get(command, 60.0)
    _jid, job, result = jobs.new_job(APP)
    tmp = job.with_name(job.name + ".tmp")
    if code is not None:
        script = jobs.build_code_job(LIBS, "DUCKY_PR.runFn", code, params or {}, result)
    else:
        script = jobs.build_job(LIBS, "DUCKY_PR.run", command, params or {}, result)
    tmp.write_text(script, encoding="utf-8")
    tmp.replace(job)  # the panel never sees a half-written job
    data, popups = jobs.wait_unblocking(result, wait, "premiere", alive=lambda: heartbeat() is not None)
    if data is None:
        if any(p.get("blocking") for p in popups.get("popups") or []):
            return {"ok": False, "state": "popup", "error": "A dialog in Premiere Pro is waiting for an answer.",
                    "popups": popups["popups"], "pressed": popups["pressed"],
                    "hint": "Look at the capture, then app_popup_press(hwnd, n). The change may already have run: read before retrying."}
        if job.exists():
            jobs.remove_quietly(job)
            return {"ok": False, "state": "bridge_closed", "error": "The Ducky Bridge panel did not pick the job up.", "hint": BRIDGE_HINT}
        return {"ok": False, "state": "error", "error": f"Premiere Pro did not finish within {int(wait)} s.",
                "hint": "app_popups(app='premiere') shows anything Premiere is waiting on."}
    jobs.remove_quietly(result)
    out = jobs.shape(data)
    if popups.get("pressed"):
        out["popups_pressed"] = popups["pressed"]  # e.g. Premiere's File Import Failure, with its text
    return out


def launch(wait: float = 180.0) -> dict[str, Any]:
    exe = find_exe()
    if exe is None:
        return {"ok": False, "error": "Premiere Pro is not installed"}
    if not running():
        ensure_bridge()  # before Premiere starts, so it loads the panel on this start
        _INSTALLED_NOW["while_running"] = False
        subprocess.Popen([str(exe)], close_fds=True)
    deadline = time.monotonic() + wait
    while time.monotonic() < deadline:
        if running() and heartbeat() is not None:
            return run("ping", {}, timeout=20.0)
        time.sleep(2.0)
    if running():
        return {"ok": False, "error": "Premiere Pro is open but the Ducky Bridge panel is not running.", "hint": BRIDGE_HINT}
    return {"ok": False, "error": "Premiere Pro did not start"}


def status(launch_app: bool = False) -> dict[str, Any]:
    exe = find_exe()
    if exe:
        ensure_bridge()
    if launch_app and exe and not running():
        launch()
    is_running = running()
    bridge = bridge_state()
    row: dict[str, Any] = {
        "installed": bool(exe) or is_running,
        "running": is_running,
        "exe": str(exe) if exe else "",
        "bridge": bridge,
        "ready": False,
        "version": "",
        "project": None,
        "error": "",
    }
    if not row["installed"]:
        row["error"] = "Premiere Pro is not installed"
    elif not bridge["installed"]:
        row["error"] = "Ducky Bridge panel not installed: call premiere_install_bridge, then restart Premiere Pro."
    elif not bridge["up_to_date"]:
        row["error"] = "Ducky Bridge panel is out of date: call premiere_install_bridge, then restart Premiere Pro."
    elif is_running and bridge["alive"]:
        ping = run("ping", {}, timeout=20.0)
        row["ready"] = bool(ping.get("ok"))
        row["version"] = str(ping.get("version") or "")
        row["project"] = ping.get("project")
        row["active_sequence"] = ping.get("active_sequence")
        if not ping.get("ok"):
            row["error"] = str(ping.get("error") or "")
    elif is_running:
        row["error"] = "Ducky Bridge panel is not running."
        row["hint"] = BRIDGE_HINT
    return row


def list_presets(query: str = "") -> dict[str, Any]:
    """Find .epr export presets in the Adobe install and the user's Documents."""
    adobe = Path(r"C:\Program Files\Adobe")
    roots: list[Path] = []
    if adobe.is_dir():
        for pattern in ("Adobe Media Encoder*/MediaIO/systempresets", "Adobe Premiere Pro*/MediaIO/systempresets"):
            roots.extend(adobe.glob(pattern))
    roots.append(Path.home() / "Documents" / "Adobe")
    q = query.strip().lower()
    found: list[dict[str, str]] = []
    for root in roots:
        if not root.is_dir():
            continue
        for p in root.rglob("*.epr"):
            if q and q not in p.stem.lower():
                continue
            found.append({"name": p.stem, "path": str(p)})
            if len(found) >= 200:
                break
    return {"ok": True, "count": len(found), "presets": found}


def _describe(row: dict[str, Any]) -> str:
    desc = str(row.get("description") or row["name"])
    params = row.get("params") or {}
    if params:
        desc += " Params: " + "; ".join(f"{k} = {v}" for k, v in params.items())
    return desc


def register_premiere_tools(api: Any) -> None:
    @api.tool(name="premiere_status", intent=INTENT, listener=False)
    def premiere_status(launch: bool = False) -> str:
        """Premiere Pro readiness: installed, running, Ducky Bridge panel installed / alive, version, open project. launch=true opens Premiere."""
        return json.dumps(status(bool(launch)), indent=2, default=str)

    @api.tool(name="premiere_install_bridge", intent=INTENT, listener=False)
    def premiere_install_bridge() -> str:
        """Install (or update) the Ducky Bridge CEP panel Premiere needs to run scripts, and allow unsigned panels for this Windows user (PlayerDebugMode). Restart Premiere afterwards."""
        try:
            return json.dumps(install_bridge(), indent=2)
        except (OSError, PermissionError) as exc:
            return json.dumps({"ok": False, "error": str(exc)}, indent=2)

    @api.tool(name="premiere_remove_bridge", intent=INTENT, listener=False)
    def premiere_remove_bridge() -> str:
        """Remove the Ducky Bridge panel and put back the PlayerDebugMode values the install changed."""
        try:
            return json.dumps(remove_bridge(), indent=2)
        except (OSError, PermissionError) as exc:
            return json.dumps({"ok": False, "error": str(exc)}, indent=2)

    @api.tool(name="premiere_list_presets", intent=INTENT, listener=False)
    def premiere_list_presets(query: str = "") -> str:
        """Find .epr export presets (H.264, ProRes, ...) for premiere_export_sequence."""
        return json.dumps(list_presets(query), indent=2)

    @api.tool(name="premiere_execute_jsx", intent=INTENT, listener=False)
    def premiere_execute_jsx(code: str, params: dict[str, Any] | None = None) -> str:
        """Run raw ExtendScript in Premiere Pro as a function body with `app` and `params` in scope; `return` a JSON-able value. Last resort when no premiere_* tool fits."""
        return json.dumps(run("script", params or {}, code=code), indent=2, default=str)

    for row in catalog():
        name = str(row["name"])

        def _make(cmd: str, doc: str):
            def fn(params: dict[str, Any] | None = None) -> str:
                try:
                    result = run(cmd, params or {})
                except Exception as exc:
                    result = {"ok": False, "error": str(exc)}
                return json.dumps(result, indent=2, default=str)

            fn.__name__ = f"premiere_{cmd}"
            fn.__doc__ = doc
            return fn

        api.tool(name=f"premiere_{name}", intent=INTENT, listener=False)(_make(name, _describe(row)))
