---
name: connection
description: "Adobe COM heal, status states, the official MCP probe, and how After Effects and Premiere Pro connect"
metadata:
  label: Connection
---

# Adobe connection

Transport is Windows COM: `Illustrator.Application` / `Photoshop.Application`.

Two Illustrator editions can run at once (2026 + Beta). `GetActiveObject` often
binds the **empty Beta**. Tools therefore:

1. NativeOM on Illustrator windows that show a `.ai` title
2. `BindToMoniker` / `GetObject` on the open file path or document name
3. `GetActiveObject` only if that instance already has documents
4. `CreateObject` last — and never launch a second edition if one is running

PowerShell `DoJavaScript` first; `TYPE_E_LIBNOTREGISTERED` falls back to `cscript`.

Work in one app = call only that app's tools. `adobe_status` never opens the
other app; pass `app="illustrator"` or `app="photoshop"` to open one. Omit
`app` and nothing launches. If a `.ai` window exists, the file is open —
call `illustrator_get_document_info`.

Official Illustrator Beta MCP (`http://127.0.0.1:18412/v1/mcp`) is a **bonus line**
on `adobe_status.official_mcp.reachable`. Never ask for a token.

For Illustrator and Photoshop, do not install CEP panels or set `PlayerDebugMode`.

## After Effects

`AfterFX.exe -r <job>.jsx` (Windows) hands one script to the running instance; the job
writes `result-<id>.json` under `%LOCALAPPDATA%/UEFN-Ducky/adobe/aftereffects/`. After
Effects 2027 allows that with its defaults; on a version that refuses, the first timed-out
call turns on "Allow Scripts to Write Files and Access Network" (a preference script needs no
file access) once per session. Ducky never runs `-r` while After
Effects is closed (that would boot a copy). A call that times out leaves its job file
for AE to finish later; old job files are swept after an hour. `AE_EXE` overrides the path.

## Premiere Pro

Premiere runs ExtendScript only inside a panel. The plugin installs its own on first use
(any `premiere_*` call, `premiere_status`, and before `launch` starts Premiere), and again
when the shipped panel is newer: the Ducky Bridge (`com.uefnducky.premiere.bridge`) in
`%APPDATA%/Adobe/CEP/extensions/`, plus `PlayerDebugMode = 1` under
`HKCU\Software\Adobe\CSXS.9`–`12` (recorded so `premiere_remove_bridge` restores only
what it changed). The panel polls `%LOCALAPPDATA%/UEFN-Ducky/adobe/premiere/` for
`job-*.jsx`, claims each by renaming it, runs it and writes a `bridge.json` heartbeat every
2 s; it loads with Premiere (StartOn ApplicationActivate), no menu needed. States:
`restart_needed` (installed while Premiere was open: the person restarts it),
`bridge_closed` (Window > Extensions > Ducky Bridge, or restart). `PREMIERE_EXE` overrides
the path.
