"""Windows COM → Illustrator / Photoshop DoJavaScript. PowerShell then cscript."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import uuid
from pathlib import Path
from typing import Any

PLUGIN_ID = "adobe"
INTENT = r"\b(adobe|illustrator|photoshop)\b"


def plugin_root() -> Path:
    try:
        from backend.uefn_plugins.store import appdata_uefn_plugins_dir

        installed = appdata_uefn_plugins_dir() / PLUGIN_ID
        if (installed / "assets" / "illustrator" / "common.jsx").is_file():
            return installed
    except Exception:
        pass
    return Path(__file__).resolve().parents[1]


def _win_no_window_kwargs() -> dict[str, Any]:
    if sys.platform != "win32":
        return {}
    startup = subprocess.STARTUPINFO()
    startup.dwFlags |= subprocess.STARTF_USESHOWWINDOW
    startup.wShowWindow = 0
    return {
        "creationflags": getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000),
        "startupinfo": startup,
    }


def _slash(path: Path) -> str:
    return str(path).replace("\\", "/")


def _write_bom(path: Path, text: str) -> None:
    path.write_bytes("\ufeff".encode("utf-8") + text.encode("utf-8"))


def _illustrator_common() -> str:
    return (plugin_root() / "assets" / "illustrator" / "common.jsx").read_text(encoding="utf-8")


def build_illustrator_jsx(tool_jsx: str, params_path: Path, result_path: Path) -> str:
    return (
        "(function() {\n"
        + _illustrator_common()
        + f"\nvar PARAMS_PATH = {json.dumps(_slash(params_path))};\n"
        + f"var RESULT_PATH = {json.dumps(_slash(result_path))};\n"
        + tool_jsx
        + "\n})();\n"
    )


def _ps1_dojavascript(progid: str, jsx_path: Path, bind_json_path: Path, *, activate: bool) -> str:
    cand = plugin_root() / "assets" / "illustrator" / "bind.ps1"
    if not cand.is_file():
        cand = Path(__file__).resolve().parents[1] / "assets" / "illustrator" / "bind.ps1"
    tmpl = cand.read_text(encoding="utf-8")
    return (
        tmpl.replace("__META__", _slash(bind_json_path).replace("'", "\\'"))
        .replace("__JSX__", _slash(jsx_path).replace("'", "\\'"))
        .replace("__PROGID__", progid)
        .replace("__ACTIVATE__", "1" if activate else "0")
        .replace("__APP_NAME__", progid.split(".")[0])
    )


def _vbs_dojavascript(progid: str, jsx_path: Path, binds: list[str]) -> str:
    lines = [
        "On Error Resume Next",
        "Dim app, doc, n",
        f'Set app = GetObject(, "{progid}")',
    ]
    for raw in binds:
        token = str(raw).replace('"', '""')
        lines += [
            "n = -1",
            'If Not app Is Nothing Then n = app.Documents.Count',
            "If n <= 0 Then",
            "  Err.Clear",
            f'  Set doc = GetObject("{token}")',
            "  If Not doc Is Nothing Then",
            "    If Not doc.Parent Is Nothing Then Set app = doc.Parent",
            "    If Not doc.Application Is Nothing Then Set app = doc.Application",
            "  End If",
            "End If",
        ]
    lines += [
        "If app Is Nothing Then Set app = CreateObject(\"" + progid + "\")",
        "On Error GoTo 0",
        f'app.DoJavaScript "$.evalFile(new File(""{_slash(jsx_path)}""))"',
        "",
    ]
    return "\n".join(lines)


def _system_exe(rel: str, fallback: str) -> str:
    # Absolute path: the host PATH can hold unexpanded "%SystemRoot%" entries (WinError 2).
    root = os.environ.get("SystemRoot") or os.environ.get("SYSTEMROOT") or r"C:\Windows"
    path = Path(root) / rel
    return str(path) if path.is_file() else fallback


def _run_hidden(argv: list[str], timeout: float) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        argv,
        capture_output=True,
        text=True,
        timeout=timeout,
        **_win_no_window_kwargs(),
    )


def _exec_jsx(progid: str, full_jsx: str, *, activate: bool, timeout: float) -> None:
    binds: list[str] = []
    titles: list[str] = []
    pids: list[int] = []
    if "Illustrator" in progid:
        try:
            from .heal import illustrator_bind_targets, illustrator_window_titles, _illustrator_pids

            binds = illustrator_bind_targets()
            titles = illustrator_window_titles()
            pids = sorted(_illustrator_pids())
        except Exception:
            binds, titles, pids = [], [], []
    tmp = Path(tempfile.mkdtemp(prefix="ducky-adobe-"))
    jsx_path = tmp / f"script-{uuid.uuid4().hex}.jsx"
    ps1_path = tmp / f"run-{uuid.uuid4().hex}.ps1"
    vbs_path = tmp / f"run-{uuid.uuid4().hex}.vbs"
    bind_json_path = tmp / f"bind-{uuid.uuid4().hex}.json"
    _write_bom(jsx_path, full_jsx)
    bind_json_path.write_text(
        json.dumps({"binds": binds, "titles": titles, "pids": pids}, ensure_ascii=False),
        encoding="utf-8",
    )
    ps1_path.write_text(
        _ps1_dojavascript(progid, jsx_path, bind_json_path, activate=activate),
        encoding="utf-8",
    )
    try:
        r = _run_hidden(
            [
                _system_exe(r"System32\WindowsPowerShell\v1.0\powershell.exe", "powershell"),
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                str(ps1_path),
            ],
            timeout,
        )
        err = (r.stderr or "") + (r.stdout or "")
        if r.returncode == 0 and "TYPE_E_LIBNOTREGISTERED" not in err and "8002801D" not in err:
            return
        vbs_path.write_text(_vbs_dojavascript(progid, jsx_path, binds), encoding="utf-8")
        r2 = _run_hidden([_system_exe(r"System32\cscript.exe", "cscript"), "//Nologo", str(vbs_path)], timeout)
        if r2.returncode != 0:
            raise RuntimeError((r2.stderr or r2.stdout or err or "COM failed").strip())
    finally:
        for p in (jsx_path, ps1_path, vbs_path, bind_json_path):
            try:
                p.unlink()
            except OSError:
                pass
        try:
            tmp.rmdir()
        except OSError:
            pass


def execute_illustrator(tool_jsx: str, params: dict[str, Any] | None, *, activate: bool = False, timeout: float = 30.0) -> dict[str, Any]:
    tmp = Path(tempfile.mkdtemp(prefix="ducky-ai-"))
    params_path = tmp / "params.json"
    result_path = tmp / "result.json"
    params_path.write_text(json.dumps(params or {}, ensure_ascii=False), encoding="utf-8")
    full = build_illustrator_jsx(tool_jsx, params_path, result_path)
    try:
        _exec_jsx("Illustrator.Application", full, activate=activate, timeout=timeout)
        if not result_path.is_file():
            raise RuntimeError("Illustrator did not write a result file")
        raw = result_path.read_text(encoding="utf-8-sig")
        data = json.loads(raw)
        return data if isinstance(data, dict) else {"ok": True, "result": data}
    finally:
        for p in (params_path, result_path):
            try:
                p.unlink()
            except OSError:
                pass
        try:
            tmp.rmdir()
        except OSError:
            pass


def execute_photoshop(script: str, *, timeout: float = 30.0) -> dict[str, Any]:
    wrapped = (
        "(function() {\n"
        + script
        + "\n})();\n"
    )
    tmp = Path(tempfile.mkdtemp(prefix="ducky-ps-"))
    result_path = tmp / "result.json"
    # Photoshop scripts should assign a string; we also write a result file when possible.
    prelude = f"var __DUCKY_RESULT = {json.dumps(_slash(result_path))};\n"
    try:
        _exec_jsx("Photoshop.Application", prelude + wrapped, activate=False, timeout=timeout)
        if result_path.is_file():
            raw = result_path.read_text(encoding="utf-8-sig")
            data = json.loads(raw)
            return data if isinstance(data, dict) else {"ok": True, "result": data}
        return {"ok": True}
    finally:
        try:
            result_path.unlink()
        except OSError:
            pass
        try:
            tmp.rmdir()
        except OSError:
            pass


def ping_app(progid: str) -> tuple[bool, str]:
    jsx = 'writeResultFile(RESULT_PATH, {ok:true, version: String(app.version)});\n' if "Illustrator" in progid else (
        "var f = new File(__DUCKY_RESULT); f.open('w'); f.write('{\"ok\":true,\"version\":\"' + app.version + '\"}'); f.close();\n"
    )
    try:
        if "Illustrator" in progid:
            data = execute_illustrator(jsx, {}, activate=False, timeout=20.0)
        else:
            data = execute_photoshop(jsx, timeout=20.0)
        ver = str(data.get("version") or "")
        return True, ver
    except Exception as exc:
        return False, str(exc)


def official_mcp_up(host: str = "127.0.0.1", port: int = 18412) -> bool:
    import socket

    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(0.25)
    try:
        sock.connect((host, port))
        return True
    except OSError:
        return False
    finally:
        try:
            sock.close()
        except OSError:
            pass
