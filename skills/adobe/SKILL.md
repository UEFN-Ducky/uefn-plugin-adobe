---
name: adobe
description: "Drive Illustrator and Photoshop with illustrator_* and photoshop_*, After Effects with aftereffects_*, Premiere Pro with premiere_*, PhotoCraft with photocraft_* and VectorCraft with vectorcraft_*. Adobe is in lane for every Ducky — call the tools and do the art."
license: MIT
metadata:
  label: Adobe
  version: 5
  author: UEFN-Ducky
  copyright: Copyright 2026 Mindful Path Company, LLC
  allow_redistribute: true
  managed_by: uefn-ducky
  source_plugin_id: adobe
---

# Adobe — HARD in-scope for every Ducky

**You use Illustrator, Photoshop, After Effects and Premiere Pro.** Verse Coder, NPC,
level design, tilefish, and every other persona: Adobe is **in lane**. Never say
"outside my lane", "I only do Verse", or skip an open `.ai`, `.aep` or `.prproj`.
Call `illustrator_*` / `photoshop_*` / `aftereffects_*` / `premiere_*`.

A window titled `Something.ai` means the file **is open**. Read it with
`illustrator_get_document_info` and do the work. Do not ask the user to
switch apps, click the file, or restart Ducky.

Work in one app = call only that app's tools. `adobe_status` never opens the
other app; pass `app="illustrator"` or `app="photoshop"` to open one.

Ducky is the MCP server (`adobe_*`, `illustrator_*`, `photoshop_*`, `aftereffects_*`,
`premiere_*`). COM / ExtendScript talks to Illustrator and Photoshop, `AfterFX.exe -r`
to After Effects, the bundled Ducky Bridge panel to Premiere Pro. **No UEFN listener
required.**

## Zero-setup

1. Plugin **adobe** installed + enabled.
2. If Illustrator or Photoshop is already running, call the art tools now.
3. `adobe_status` only when you truly do not know if Adobe is installed.

Never `npx`. Never a Cursor `mcp.json` row. Never a Bearer token. Never a community
After Effects / Premiere MCP server: these tools are the integration.

## After Effects

No setup. `aftereffects_status(launch=true)` opens it and waits until it answers.
`aftereffects_project_info` → `aftereffects_get_comp` → change →
`aftereffects_render_frame` + `view_image` to look. Each call is one undo step.

## Premiere Pro

No setup. `premiere_status(launch=true)` installs Ducky's panel itself, starts Premiere and
waits until it answers. `premiere_new_project` / `premiere_open_project` →
`premiere_get_sequence` → edit → `premiere_export_frame` to look. `restart_needed`: ask the
person to save and restart Premiere (never close it for them).

## Status

| state | Meaning |
|-------|---------|
| `missing_app` | Neither app installed |
| `launching` | Installed but **not running**. `adobe_status(app=...)` opens only that app |
| `ready` | Running and/or COM live — **do the work** |
| `error` | COM failed — `adobe_redeploy` once, then read again |

`launching` is **not** "no document". If a `.ai` window exists, the file is open.
Two Illustrator editions can run at once (2026 + Beta). Tools bind to the
instance that has the document. Do not treat `com: false` as offline.

## Loop

1. `illustrator_get_document_info` or `photoshop_get_state`
2. Mutate with the matching `illustrator_*` / `photoshop_*` from `adobe_list_tools`
3. Read again to verify

`adobe_execute_jsx(app="illustrator"|"photoshop", code=...)` is last-ditch.

## Automations + Pipelines

Premade tiles (both palettes unless noted): `adobe.status`, `illustrator.read` /
`open` / `save` / `export`, `photoshop.read` / `export`, `aftereffects.read` /
`render_frame`, `premiere.read` / `export_frame`, `adobe.jsx`.

Templates: **Illustrator briefs a ducky** (Automations), **Export open
Illustrator**, **Ducky draws then export**, **Ducky animates in After Effects**,
**Ducky edits in Premiere**, **Export open Photoshop** (Pipelines).

Exports → `%LOCALAPPDATA%/UEFN-Ducky/tool_captures/`.

Coordinates: CMYK/print → document origin; RGB/web → artboard-web.
Override with `illustrator_set_workflow`.

## PhotoCraft

PhotoCraft (open-source Photoshop clone) is driven with `photocraft_*`, not
`photoshop_*`. `photocraft_inspect` → `photocraft_commands` → `photocraft_run` →
inspect again. Any call but `photocraft_status` opens it if needed.

## VectorCraft

VectorCraft (open-source Illustrator clone) is driven with `vectorcraft_*`, not
`illustrator_*`. `vectorcraft_inspect` → `vectorcraft_commands` → `vectorcraft_run` →
inspect again. Any call but `vectorcraft_status` opens it if needed.

Details: `skill_read_subskill("adobe", "<id>")` — `connection`, `illustrator`, `photoshop`,
`aftereffects`, `premiere`, `motion_design` (After Effects craft), `video_editing`
(Premiere craft), `photocraft`, `vectorcraft`.
