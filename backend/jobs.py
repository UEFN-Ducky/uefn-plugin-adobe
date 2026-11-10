"""One ExtendScript job = one script file that writes one result file.

Shared by After Effects (``AfterFX.exe -r job.jsx``) and Premiere Pro (the Ducky
Bridge CEP panel picks the job up). The script carries its own params and result
path, so no side channel is needed.
"""

from __future__ import annotations

import json
import os
import tempfile
import time
import uuid
from pathlib import Path
from typing import Any

from .com_runner import plugin_root


def job_root(app: str) -> Path:
    base = os.environ.get("LOCALAPPDATA") or tempfile.gettempdir()
    root = Path(base) / "UEFN-Ducky" / "adobe" / app
    root.mkdir(parents=True, exist_ok=True)
    return root


def slash(path: Path | str) -> str:
    return str(path).replace("\\", "/")


def read_asset(rel: str) -> str:
    return (plugin_root() / rel).read_text(encoding="utf-8")


def build_job(libs: list[str], runner: str, command: str, params: dict[str, Any], result_path: Path, label: str = "") -> str:
    """A self-contained script: prelude (result path + params), the libraries, one call."""
    prelude = (
        f"var DUCKY_RESULT_PATH = {json.dumps(slash(result_path))};\n"
        f"var DUCKY_PARAMS = {json.dumps(params or {}, ensure_ascii=True, default=str)};\n"
    )
    body = "\n".join(read_asset(rel) for rel in libs)
    call = f"{runner}({json.dumps(command)}, DUCKY_PARAMS, DUCKY_RESULT_PATH, {json.dumps(label or command)});\n"
    return "(function () {\n" + prelude + body + "\n" + call + "})();\n"


STALE_SEC = 3600.0


def sweep(root: Path, older_than: float = STALE_SEC) -> None:
    """Drop job / result files a timed-out call left behind."""
    cutoff = time.time() - older_than
    for pattern in ("job-*.jsx", "run-*.jsx", "result-*.json*"):
        for p in root.glob(pattern):
            try:
                if p.stat().st_mtime < cutoff:
                    p.unlink()
            except OSError:
                pass


def new_job(app: str) -> tuple[str, Path, Path]:
    jid = uuid.uuid4().hex
    root = job_root(app)
    sweep(root)
    return jid, root / f"job-{jid}.jsx", root / f"result-{jid}.json"


def wait_result(path: Path, timeout: float, *, poll: float = 0.1, alive=None) -> dict[str, Any] | None:
    """Poll for the result file. ``alive()`` returning False ends the wait early."""
    deadline = time.monotonic() + max(0.5, timeout)
    polls = 0
    while time.monotonic() < deadline:
        polls += 1
        if path.is_file():
            try:
                raw = path.read_text(encoding="utf-8-sig")
                data = json.loads(raw)
            except (OSError, ValueError):
                time.sleep(poll)
                continue
            return data if isinstance(data, dict) else {"ok": True, "result": data}
        if alive is not None and polls % 10 == 0 and not alive():
            return None
        time.sleep(poll)
    return None


def remove_quietly(*paths: Path) -> None:
    for p in paths:
        for cand in (p, p.with_name(p.name + ".tmp")):
            try:
                cand.unlink()
            except OSError:
                pass


def shape(data: dict[str, Any]) -> dict[str, Any]:
    """Job result {ok, result, error} -> tool answer."""
    if not data.get("ok"):
        return {"ok": False, "error": str(data.get("error") or "the script failed")}
    result = data.get("result")
    if isinstance(result, dict):
        return {"ok": True, **result}
    return {"ok": True, "result": result}
