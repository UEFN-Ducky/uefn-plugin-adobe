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
} else if (host === "prt") {
  // Two touching shots, video and audio linked, each with 2 s of source handle.
  global.Time = class { constructor() { this._s = 0; } get seconds() { return this._s; } set seconds(v) { this._s = v; }
                        get ticks() { return String(Math.round(this._s * 254016000000)); } };
  const T = (s) => { const t = new Time(); t.seconds = s; return t; };
  const coll = (a) => { a.numItems = a.length; return a; };
  let nid = 0;
  global.calls = [];
  const level = { displayName: "Level", v: 0.17783, tv: false, keys: [],
    getValue() { return this.v; }, setValue(v) { this.v = v; }, isTimeVarying() { return this.tv; },
    setTimeVarying(b) { this.tv = b; }, addKey(t) { this.keys.push(t); }, setValueAtKey(t, v) { this.keys.push([t, v]); } };
  const clip = (name, owner, start, end, inp, audio) => {
    const c = { name, nodeId: String(++nid), start: T(start), end: T(end), inPoint: T(inp), outPoint: T(inp + end - start),
      selected: 0, links: [], owner,
      components: coll(audio ? [{ displayName: "Volume", properties: coll([level]) }] : [{ displayName: "Motion", properties: coll([]) }]),
      setSelected(v) { this.selected = v; },
      move(d) { if (typeof d !== "number") throw new Error("move takes seconds"); const len = this.end.seconds - this.start.seconds;
                this.start = T(this.start.seconds + d); this.end = T(this.start.seconds + len); },
      remove() { const i = this.owner.indexOf(this); if (i >= 0) { this.owner.splice(i, 1); this.owner.numItems = this.owner.length; } },
      getLinkedItems() { return coll([this, ...this.links]); } };
    owner.push(c); owner.numItems = owner.length;
    return c;
  };
  const vClips = coll([]), aClips = coll([]);
  const vA = clip("A", vClips, 0, 5, 0, false), vB = clip("B", vClips, 5, 10, 2, false);
  const aA = clip("A", aClips, 0, 5, 0, true), aB = clip("B", aClips, 5, 10, 2, true);
  vA.links = [aA]; aA.links = [vA]; vB.links = [aB]; aB.links = [vB];
  const all = [vA, vB, aA, aB];
  const tracks = (a) => { a.numTracks = a.length; return a; };
  const seq = { sequenceID: "s1", name: "Cut", timebase: "8467200000",
    videoTracks: tracks([{ name: "V1", clips: vClips }]),
    audioTracks: tracks([{ name: "A1", clips: aClips, muted: 0, setMute(v) { this.muted = v; }, isMuted() { return !!this.muted; } }]),
    unlinkSelection() { calls.push("unlink"); all.forEach((c) => { if (c.selected) c.links = []; }); },
    linkSelection() { calls.push("link"); } };
  global.app = { version: "25.0", project: { name: "Cut", path: "C:/Cut.prproj", activeSequence: seq,
    rootItem: { children: { numItems: 0 } }, sequences: Object.assign([seq], { numSequences: 1 }) } };
  global.state = () => ({
    video: vClips.map((c) => [c.name, c.start.seconds, c.end.seconds, c.inPoint.seconds]),
    audio: aClips.map((c) => [c.name, c.start.seconds, c.end.seconds, c.inPoint.seconds]),
    level: level.v, level_keys: level.keys, links: all.map((c) => c.links.length), calls,
    selected: all.filter((c) => c.selected).length, muted: seq.audioTracks[0].muted });
} else {
  global.app = {
    version: "25.0",
    project: { name: "Cut", path: "C:/Cut.prproj", activeSequence: null,
               rootItem: { children: { numItems: 0 } }, sequences: { numSequences: 0 } }
  };
}
(0, eval)(fs.readFileSync(process.argv[2], "utf8").replace(/^\uFEFF/, ""));
process.stdout.write(JSON.stringify(host === "prt" ? state() : counters));
"""


def _node() -> str | None:
    return shutil.which("node") or os.environ.get("DUCKY_NODE") or None


def _run_job(tmp_path: Path, mod, runner: str, host: str, command: str, params: dict, code: str | None = None) -> tuple[dict, dict]:
    node = _node()
    if not node:
        pytest.skip("node is not on PATH")
    harness = tmp_path / "harness.js"
    harness.write_text(HARNESS, encoding="utf-8")
    result = tmp_path / f"result-{command}.json"
    job = tmp_path / f"job-{command}.jsx"
    if code is not None:
        script = jobs.build_code_job(mod.LIBS, runner, code, params, result)
    else:
        script = jobs.build_job(mod.LIBS, runner, command, params, result)
    job.write_text(script, encoding="utf-8")
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


def test_ae_raw_code_and_unicode(tmp_path: Path) -> None:
    data, counters = _run_job(
        tmp_path, aftereffects, "DUCKY_AE.runFn", "ae", "script", {"s": "Café \"q\" \n"},
        code="return {v: app.version, s: params.s, list: [1, 'a-b', null]};",
    )
    assert data == {"ok": True, "result": {"v": "25.1", "s": "Café \"q\" \n", "list": [1, "a-b", None]}, "error": None}
    assert counters == {"undo": 0, "suppress": 0}


def test_premiere_raw_code(tmp_path: Path) -> None:
    data, _ = _run_job(tmp_path, premiere, "DUCKY_PR.runFn", "pr", "script", {"n": 2}, code="return app.version + ':' + params.n;")
    assert data["ok"] is True and data["result"] == "25.0:2"


def test_nothing_the_store_scan_refuses() -> None:
    """The Store's upload scan refuses a plugin whose files compile code from a string."""
    banned = ("new " + "function", "ev" + "al(")  # spelled apart so this file never matches itself
    root = plugin_root()
    hits = [str(p.relative_to(root)) for p in root.rglob("*")
            if p.is_file() and ".git" not in p.parts and "deploy" not in p.parts
            and p.suffix in {".py", ".js", ".jsx", ".json", ".md", ".html"}
            and any(b in p.read_text(encoding="utf-8", errors="ignore").lower() for b in banned)]
    assert hits == []


def test_illustrator_json_parse_without_code_execution(tmp_path: Path) -> None:
    node = _node()
    if not node:
        pytest.skip("node is not on PATH")
    sample = {"s": "Café \"q\" \n\\/", "n": [-1.5e2, 0, 3], "b": [True, False, None], "o": {"k": {}}, "e": []}
    probe = tmp_path / "probe.js"
    probe.write_text(
        (plugin_root() / "assets" / "illustrator" / "common.jsx").read_text(encoding="utf-8")
        + "\nvar fs = require('fs');\n"
        "var v = jsonParse(fs.readFileSync(process.argv[2], 'utf8'));\n"
        "var bad = 0; ['{\"a\":1}x', '{a:1}', '(1)', '[1,]'].forEach(function (s) {\n"
        "  try { jsonParse(s); } catch (e) { bad++; } });\n"
        "process.stdout.write(JSON.stringify({v: v, bad: bad}));\n",
        encoding="utf-8",
    )
    src = tmp_path / "params.json"
    src.write_text("﻿" + json.dumps(sample, indent=2), encoding="utf-8")
    proc = subprocess.run([node, str(probe), str(src)], capture_output=True, text=True, timeout=30)
    assert proc.returncode == 0, proc.stderr
    out = json.loads(proc.stdout)
    assert out == {"v": sample, "bad": 4}


def test_no_long_base64_lines_the_store_scan_refuses() -> None:
    """The Store scan refuses a line over 4000 chars that is >90% base64 (e.g. an SVG embedding a PNG)."""
    b64 = set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=")
    root = plugin_root()
    hits = []
    for p in root.rglob("*"):
        if not p.is_file() or ".git" in p.parts or "deploy" in p.parts:
            continue
        try:
            text = p.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue  # binaries (png, pyd) are not text-scanned
        for line in text.splitlines():
            if len(line) > 4000 and sum(c in b64 for c in line) * 10 > len(line) * 9:
                hits.append(str(p.relative_to(root)))
                break
    assert hits == []


def _pr_timeline(tmp_path: Path, command: str, params: dict) -> tuple[dict, dict]:
    return _run_job(tmp_path, premiere, "DUCKY_PR.run", "prt", command, params)


def test_premiere_set_volume_in_db(tmp_path: Path) -> None:
    data, st = _pr_timeline(tmp_path, "set_volume", {"track": 0, "clip_index": 1, "db": -6})
    assert data["ok"] is True, data
    assert abs(data["result"]["db_before"]) < 0.01  # Premiere's 0 dB is 0.17783
    assert abs(data["result"]["db"] + 6) < 0.001
    assert abs(st["level"] - 10 ** (-21 / 20)) < 1e-9


def test_premiere_volume_keys_are_sequence_seconds(tmp_path: Path) -> None:
    data, st = _pr_timeline(tmp_path, "set_volume", {"track": 0, "clip_index": 1, "keys": [{"time": 6, "db": 0}, {"time": 7, "db": -18}]})
    assert data["ok"] is True, data
    # Clip B sits at 5 s with in point 2 s: sequence 6 s = source 3 s.
    assert st["level_keys"][0] == 3 and st["level_keys"][2] == 4
    assert abs(st["level_keys"][3][1] - 10 ** (-33 / 20)) < 1e-9


def test_premiere_j_cut(tmp_path: Path) -> None:
    data, st = _pr_timeline(tmp_path, "split_edit", {"clip_index": 1, "type": "J", "offset": 0.5})
    assert data["ok"] is True, data
    assert st["video"] == [["A", 0, 5, 0], ["B", 5, 10, 2]]  # picture cut untouched
    assert st["audio"] == [["A", 0, 4.5, 0], ["B", 4.5, 10, 1.5]]
    assert st["calls"] == ["unlink"] and st["links"] == [0, 0, 0, 0] and st["selected"] == 0


def test_premiere_l_cut(tmp_path: Path) -> None:
    data, st = _pr_timeline(tmp_path, "split_edit", {"clip_index": 1, "type": "L", "offset": 0.5})
    assert data["ok"] is True, data
    assert st["audio"] == [["A", 0, 5.5, 0], ["B", 5.5, 10, 2.5]]


def test_premiere_split_edit_needs_source_handle(tmp_path: Path) -> None:
    data, _ = _pr_timeline(tmp_path, "split_edit", {"clip_index": 1, "type": "J", "offset": 3})
    assert data["ok"] is False and "source before its in point" in data["error"]


def test_premiere_roll_edit(tmp_path: Path) -> None:
    data, st = _pr_timeline(tmp_path, "roll_edit", {"clip_index": 1, "delta": -1})
    assert data["ok"] is True, data
    assert st["video"] == [["A", 0, 4, 0], ["B", 4, 10, 1]]


def test_premiere_unlink(tmp_path: Path) -> None:
    data, st = _pr_timeline(tmp_path, "unlink", {"clip_index": 0})
    assert data["ok"] is True and data["result"]["linked_before"] == 1 and data["result"]["linked_after"] == 0
    assert st["links"] == [0, 1, 0, 1]


def test_premiere_ripple_delete_takes_linked_audio(tmp_path: Path) -> None:
    data, st = _pr_timeline(tmp_path, "remove_clip", {"clip_index": 0, "ripple": True})
    assert data["ok"] is True, data
    assert st["video"] == [["B", 0, 5, 2]] and st["audio"] == [["B", 0, 5, 2]]
    assert data["result"]["linked_removed"] == 1


def test_premiere_set_clip_slip_and_move(tmp_path: Path) -> None:
    data, st = _pr_timeline(tmp_path, "set_clip", {"clip_index": 1, "slip": -1, "move_by": 1})
    assert data["ok"] is True, data
    assert st["video"][1] == ["B", 6, 11, 1]


def test_premiere_mute_track(tmp_path: Path) -> None:
    data, st = _pr_timeline(tmp_path, "set_track", {"track": 0, "track_type": "audio", "mute": True})
    assert data["ok"] is True and data["result"]["muted"] is True and st["muted"] == 1


def test_premiere_job_ping_and_errors(tmp_path: Path) -> None:
    data, _ = _run_job(tmp_path, premiere, "DUCKY_PR.run", "pr", "ping", {})
    assert data["ok"] is True and data["result"]["version"] == "25.0"
    data, _ = _run_job(tmp_path, premiere, "DUCKY_PR.run", "pr", "project_info", {})
    assert data["ok"] is True and data["result"]["sequences"] == []
    data, _ = _run_job(tmp_path, premiere, "DUCKY_PR.run", "pr", "get_sequence", {})
    assert data["ok"] is False and "no active sequence" in data["error"]
