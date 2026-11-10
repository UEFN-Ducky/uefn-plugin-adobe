// Ducky Bridge for Premiere Pro (CEP). Polls UEFN Ducky's job folder, runs each job
// script in Premiere's ExtendScript engine and leaves the result file the job writes.
// A heartbeat file tells Ducky the bridge is alive. No network, no telemetry.
(function () {
  "use strict";
  var BRIDGE_VERSION = "1.0.0";
  var fs = require("fs");
  var path = require("path");
  var os = require("os");

  var base = path.join(process.env.LOCALAPPDATA || os.tmpdir(), "UEFN-Ducky", "adobe", "premiere");
  var busy = false;
  var hostVersion = "";
  var done = 0;

  function mkdirp(dir) {
    try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { /* exists */ }
  }

  function show(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function evalScript(code, cb) {
    if (!window.__adobe_cep__) { cb("EvalScript error. (no CEP host)"); return; }
    window.__adobe_cep__.evalScript(code, cb);
  }

  function beat() {
    mkdirp(base);
    var body = JSON.stringify({ time: Date.now(), version: hostVersion, bridge: BRIDGE_VERSION, pid: process.pid, done: done });
    var tmp = path.join(base, "bridge.json.tmp");
    try {
      fs.writeFileSync(tmp, body, "utf8");
      fs.renameSync(tmp, path.join(base, "bridge.json"));
    } catch (e) { /* next beat */ }
  }

  function nextJob() {
    var names;
    try { names = fs.readdirSync(base); } catch (e) { return null; }
    var jobs = [];
    for (var i = 0; i < names.length; i++) {
      if (/^job-[0-9a-f]+\.jsx$/.test(names[i])) jobs.push(names[i]);
    }
    if (jobs.length === 0) return null;
    jobs.sort(function (a, b) {
      try { return fs.statSync(path.join(base, a)).mtimeMs - fs.statSync(path.join(base, b)).mtimeMs; } catch (e) { return 0; }
    });
    return jobs[0];
  }

  function tick() {
    if (busy) return;
    var name = nextJob();
    if (!name) return;
    var id = name.slice(4, -4);
    var claimed = path.join(base, "run-" + id + ".jsx");
    try { fs.renameSync(path.join(base, name), claimed); } catch (e) { return; }
    var code;
    try { code = fs.readFileSync(claimed, "utf8"); } catch (e2) { return; }
    if (code.charCodeAt(0) === 0xFEFF) code = code.slice(1); // drop a BOM
    busy = true;
    show("status", "Running a Ducky job...");
    evalScript(code, function (ret) {
      busy = false;
      done += 1;
      try { fs.unlinkSync(claimed); } catch (e3) { /* gone */ }
      var result = path.join(base, "result-" + id + ".json");
      if (!fs.existsSync(result)) {
        var msg = "Premiere stopped the script: " + String(ret || "no answer");
        try { fs.writeFileSync(result, JSON.stringify({ ok: false, error: msg }), "utf8"); } catch (e4) { /* caller times out */ }
      }
      show("status", "Connected to UEFN Ducky");
      show("last", "Jobs run: " + done);
    });
  }

  mkdirp(base);
  evalScript("app.version", function (v) { hostVersion = String(v || ""); beat(); });
  beat();
  show("status", "Connected to UEFN Ducky");
  setInterval(tick, 150);
  setInterval(beat, 2000);
})();
