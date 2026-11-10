"""After Effects + Premiere Pro: job building, the CEP bridge install, registration, and
real job scripts run in Node against stub hosts. No Adobe required."""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import time
from pathlib import Path
from unittest.mock import patch

import pytest

import backend as plugin
from backend import aftereffects, catalogs, jobs, premiere
from backend.com_runner import plugin_root


class FakeApi:
    def __init__(self) -> None:
        self.tools: dict[str, object] = {}

    def log(self, msg: str) -> None:
        return None

    def tool(self, **kwargs):  # type: ignore[no-untyped-def]
        def deco(fn):  # type: ignore[no-untyped-def]
            self.tools[kwargs.get("name") or fn.__name__] = fn
            return fn

        return deco


# ---------------------------------------------------------------- catalogs


@pytest.mark.parametrize(
    ("mod", "lib", "table"),
    [(aftereffects, "assets/aftereffects/commands.jsx", "AE_CMD"), (premiere, "assets/premiere/commands.jsx", "PR_CMD")],
)
def test_every_catalog_command_exists(mod, lib, table) -> None:
    source = (plugin_root() / lib).read_text(encoding="utf-8")
    defined = set(re.findall(rf"^{table}\.(\w+) = function", source, re.M))
    names = [row["name"] for row in mod.catalog()]
    assert len(names) >= 20
    assert len(names) == len(set(names))
    missing = [n for n in names if n not in defined]
    assert not missing, missing
    for row in mod.catalog():
        assert row["description"].endswith(".")


def test_census_lists_both_apps() -> None:
    names = {row["name"] for row in catalogs.list_entries()}
    assert "aftereffects_set_keyframes" in names
    assert "premiere_add_clip" in names
    assert "premiere_install_bridge" in names


def test_register_adds_video_tools() -> None:
    api = FakeApi()
    plugin.register(api)
    ae = [n for n in api.tools if n.startswith("aftereffects_")]
    pr = [n for n in api.tools if n.startswith("premiere_")]
    assert len(ae) == len(aftereffects.catalog()) + 2
    assert len(pr) == len(premiere.catalog()) + 5
    assert "Params:" in (api.tools["aftereffects_add_layer"].__doc__ or "")


# ---------------------------------------------------------------- jobs


def test_build_job_is_self_contained(tmp_path: Path) -> None:
    result = tmp_path / "result-x.json"
    script = jobs.build_job(aftereffects.LIBS, "DUCKY_AE.run", "ping", {"name": "Café \u2028 </script>"}, result)
    assert script.startswith("(function () {")
    assert jobs.slash(result) in script
    assert "\\u2028" in script and "\u2028" not in script
    assert 'DUCKY_AE.run("ping", DUCKY_PARAMS, DUCKY_RESULT_PATH, "ping");' in script


def test_wait_result_and_shape(tmp_path: Path) -> None:
    path = tmp_path / "r.json"
    path.write_text(json.dumps({"ok": True, "result": {"comps": []}}), encoding="utf-8")
    assert jobs.shape(jobs.wait_result(path, 1.0)) == {"ok": True, "comps": []}
    assert jobs.shape({"ok": False, "error": "boom"}) == {"ok": False, "error": "boom"}
    assert jobs.wait_result(tmp_path / "missing.json", 0.3) is None


def test_sweep_drops_only_old_files(tmp_path: Path) -> None:
    old = tmp_path / "job-old.jsx"
    new = tmp_path / "job-new.jsx"
    old.write_text("x")
    new.write_text("x")
    past = time.time() - 7200
    os.utime(old, (past, past))
    jobs.sweep(tmp_path)
    assert not old.exists() and new.exists()


def test_ae_run_refuses_when_not_installed() -> None:
    with patch.object(aftereffects, "find_exe", return_value=None), patch.object(aftereffects, "running", return_value=False):
        out = aftereffects.run("ping")
    assert out["ok"] is False and out["state"] == "missing_app"


def test_ae_run_refuses_when_closed() -> None:
    with patch.object(aftereffects, "find_exe", return_value=Path("AfterFX.exe")), patch.object(aftereffects, "running", return_value=False):
        out = aftereffects.run("ping")
    assert out["state"] == "launching"


def test_premiere_run_needs_the_bridge(tmp_path: Path) -> None:
    with (
        patch.object(premiere, "find_exe", return_value=Path("Adobe Premiere Pro.exe")),
        patch.object(premiere, "running", return_value=True),
        patch.object(premiere, "heartbeat", return_value=None),
        patch.object(premiere, "cep_extensions_dir", return_value=tmp_path),
    ):
        out = premiere.run("ping")
    assert out["state"] == "bridge_missing"


# ---------------------------------------------------------------- CEP bridge


def test_install_and_remove_bridge(tmp_path: Path) -> None:
    out = premiere.install_bridge(extensions_dir=tmp_path, set_debug=False)
    target = tmp_path / premiere.EXT_ID
    assert out["ok"] and (target / "CSXS" / "manifest.xml").is_file()
    assert (target / "bridge.js").is_file() and (target / "index.html").is_file()
    assert premiere.bridge_version(target) == premiere.bridge_version(premiere.bridge_source()) != ""
    # A second install replaces the folder cleanly.
    premiere.install_bridge(extensions_dir=tmp_path, set_debug=False)
    assert premiere.remove_bridge(extensions_dir=tmp_path)["removed"] is True
    assert not target.exists()


def test_bridge_js_matches_the_job_names() -> None:
    js = (premiere.bridge_source() / "bridge.js").read_text(encoding="utf-8")
    assert '"UEFN-Ducky", "adobe", "premiere"' in js
    assert "job-[0-9a-f]+\\.jsx" in js and '"result-" + id + ".json"' in js and "bridge.json" in js
    manifest = (premiere.bridge_source() / "CSXS" / "manifest.xml").read_text(encoding="utf-8")
    assert f'ExtensionBundleId="{premiere.EXT_ID}"' in manifest and 'Host Name="PPRO"' in manifest


def test_heartbeat_goes_stale(tmp_path: Path) -> None:
    beat = tmp_path / "bridge.json"
    beat.write_text(json.dumps({"time": 1, "version": "25.0"}), encoding="utf-8")
    with patch.object(jobs, "job_root", return_value=tmp_path):
        assert premiere.heartbeat() == {"time": 1, "version": "25.0"}
        past = time.time() - 60
        os.utime(beat, (past, past))
        assert premiere.heartbeat() is None


# ---------------------------------------------------------------- jobs run in Node

HARNESS = r"""
const fs = require("fs");
const path = require("path");
class File {
  constructor(p) { this.p = p; this.encoding = "UTF-8"; this.buf = ""; this.mode = ""; }
  get exists() { return fs.existsSync(this.p); }
  get name() { return path.basename(this.p); }
  get fsName() { return this.p; }
  open(m) { this.mode = m; this.buf = ""; return true; }
  write(s) { this.buf += s; }
  close() { if (this.mode === "w") fs.writeFileSync(this.p, this.buf, "utf8"); }
  rename(n) { fs.renameSync(this.p, path.join(path.dirname(this.p), n)); return true; }
  remove() { fs.unlinkSync(this.p); return true; }
}
global.File = File;
global.$ = { sleep() {} };
class CompItem {} class FolderItem {} class FootageItem {} class AVItem {}
Object.assign(global, { CompItem, FolderItem, FootageItem, AVItem });
global.ProjectItemType = { BIN: 2, CLIP: 1, FILE: 4 };
const counters = { undo: 0, suppress: 0 };
const comp = Object.assign(new CompItem(), {
  id: 7, name: "Main", width: 1920, height: 1080, frameRate: 30, duration: 10, pixelAspect: 1,
  numLayers: 0, bgColor: [0, 0, 0], workAreaStart: 0, workAreaDuration: 10, time: 0,
  layer() { return null; }, selectedLayers: []
});
const host = process.argv[3];
if (host === "ae") {
  global.app = {
    version: "25.1", buildName: "x",
    project: { file: null, dirty: false, numItems: 1, item: () => comp, activeItem: comp,
               bitsPerChannel: 8, renderQueue: { numItems: 0 }, itemByID: (id) => (id === 7 ? comp : null) },
    beginUndoGroup() { counters.undo++; }, endUndoGroup() { counters.undo--; },
    beginSuppressDialogs() { counters.suppress++; }, endSuppressDialogs() { counters.suppress--; }
  };
} else {
  global.app = {
    version: "25.0",
    project: { name: "Cut", path: "C:/Cut.prproj", activeSequence: null,
               rootItem: { children: { numItems: 0 } }, sequences: { numSequences: 0 } }
  };
}
(0, eval)(fs.readFileSync(process.argv[2], "utf8").replace(/^\uFEFF/, ""));
process.stdout.write(JSON.stringify(counters));
"""


def _node() -> str | None:
    return shutil.which("node") or os.environ.get("DUCKY_NODE") or None


def _run_job(tmp_path: Path, mod, runner: str, host: str, command: str, params: dict) -> tuple[dict, dict]:
    node = _node()
    if not node:
        pytest.skip("node is not on PATH")
    harness = tmp_path / "harness.js"
    harness.write_text(HARNESS, encoding="utf-8")
    result = tmp_path / f"result-{command}.json"
    job = tmp_path / f"job-{command}.jsx"
    job.write_text(jobs.build_job(mod.LIBS, runner, command, params, result), encoding="utf-8")
    proc = subprocess.run([node, str(harness), str(job), host], capture_output=True, text=True, timeout=30)
    assert proc.returncode == 0, proc.stderr
    return json.loads(result.read_text(encoding="utf-8")), json.loads(proc.stdout or "{}")


def test_ae_job_project_info(tmp_path: Path) -> None:
    data, counters = _run_job(tmp_path, aftereffects, "DUCKY_AE.run", "ae", "project_info", {})
    assert data["ok"] is True, data
    assert data["result"]["comps"][0]["name"] == "Main"
    assert data["result"]["active_item"]["type"] == "comp"
    assert counters == {"undo": 0, "suppress": 0}


def test_ae_job_errors_are_reported(tmp_path: Path) -> None:
    data, counters = _run_job(tmp_path, aftereffects, "DUCKY_AE.run", "ae", "get_comp", {"comp": "Nope"})
    assert data["ok"] is False and "no comp named 'Nope'" in data["error"]
    assert counters == {"undo": 0, "suppress": 0}
    data, _ = _run_job(tmp_path, aftereffects, "DUCKY_AE.run", "ae", "made_up", {})
    assert "unknown After Effects command" in data["error"]


def test_ae_job_eval_and_unicode(tmp_path: Path) -> None:
    data, _ = _run_job(
        tmp_path, aftereffects, "DUCKY_AE.run", "ae", "__eval",
        {"code": "return {v: app.version, s: params.s, list: [1, 'a-b', null]};", "params": {"s": "Café \"q\" \n"}},
    )
    assert data == {"ok": True, "result": {"v": "25.1", "s": "Café \"q\" \n", "list": [1, "a-b", None]}, "error": None}


def test_premiere_job_ping_and_errors(tmp_path: Path) -> None:
    data, _ = _run_job(tmp_path, premiere, "DUCKY_PR.run", "pr", "ping", {})
    assert data["ok"] is True and data["result"]["version"] == "25.0"
    data, _ = _run_job(tmp_path, premiere, "DUCKY_PR.run", "pr", "project_info", {})
    assert data["ok"] is True and data["result"]["sequences"] == []
    data, _ = _run_job(tmp_path, premiere, "DUCKY_PR.run", "pr", "get_sequence", {})
    assert data["ok"] is False and "no active sequence" in data["error"]
