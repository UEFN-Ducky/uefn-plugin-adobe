---
name: adobe
description: >-
  HARD: every Ducky drives Illustrator/Photoshop with illustrator_* /
  photoshop_*. Never refuse as out of lane. Call the tools and do the art.
license: MIT
metadata:
  label: Adobe
  version: 2
  author: UEFN-Ducky
  copyright: Copyright 2026 Mindful Path Company, LLC
  allow_redistribute: true
  managed_by: uefn-ducky
  source_plugin_id: adobe
---

# Adobe — HARD in-scope for every Ducky

**You use Illustrator and Photoshop.** Verse Coder, NPC, level design, tilefish,
and every other persona: Adobe is **in lane**. Never say "outside my lane",
"I only do Verse", or skip an open `.ai`. Call `illustrator_*` / `photoshop_*`.

A window titled `Something.ai` means the file **is open**. Read it with
`illustrator_get_document_info` and do the work. Do not ask the user to
switch apps, click the file, or restart Ducky.

Ducky is the MCP server (`adobe_*`, `illustrator_*`, `photoshop_*`).
COM / ExtendScript talks to the apps. **No UEFN listener required.**

## Zero-setup

1. Plugin **adobe** installed + enabled.
2. If Illustrator or Photoshop is already running, call the art tools now.
3. `adobe_status` only when you truly do not know if Adobe is installed.

Never `npx`. Never a Cursor `mcp.json` row. Never a Bearer token.

## Status

| state | Meaning |
|-------|---------|
| `missing_app` | Neither app installed |
| `launching` | Installed but **not running** yet |
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

Exports → `%LOCALAPPDATA%/UEFN-Ducky/tool_captures/`.

Coordinates: CMYK/print → document origin; RGB/web → artboard-web.
Override with `illustrator_set_workflow`.

Details: `skill_read_subskill("adobe", "connection")`.
