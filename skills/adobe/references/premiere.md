---
name: premiere
description: "Premiere Pro tool map: the Ducky Bridge panel, project, bins, sequences, clips, razor, transitions, effects, motion, markers, frame and sequence export"
metadata:
  label: Premiere Pro
---

# Premiere Pro

Tools are named `premiere_*`. Every tool takes one `params` object (keys in its
description).

## Setup (once)

Premiere only runs scripts from inside a panel, so the plugin ships one: **Ducky Bridge**.

1. `premiere_status`. `bridge.installed: false` → `premiere_install_bridge` (copies the panel
   into `%APPDATA%/Adobe/CEP/extensions/` and sets PlayerDebugMode for this Windows user so
   Premiere loads an unsigned panel). Tell the person it changed that setting.
2. The person restarts Premiere Pro and opens **Window > Extensions > Ducky Bridge** once.
   It starts with Premiere after that while it stays docked; closing the panel stops it.
3. `premiere_status` → `ready: true`. `bridge.up_to_date: false` after a plugin update →
   `premiere_install_bridge` again and restart Premiere.

`premiere_remove_bridge` deletes the panel and puts back only the PlayerDebugMode values the
install changed. Never run `npx`, install a different CEP panel, or edit the registry by hand.

## Loop

1. Read: `premiere_project_info` → `premiere_get_sequence` (tracks, clips, markers).
2. One edit per call.
3. Look: `premiere_export_frame(time, path)` + `view_image`; read the sequence back.
4. Mistake: `premiere_undo`.

## Addressing

- Sequence: `sequence` (name) or `sequence_id`; default = active.
- Project items: `item` (name) or `item_id` (`id` from `premiere_list_items`).
- Track: `track` (0 = V1 / A1) + `track_type` (`video` default, `audio`).
- Clip: `clip_index` (0-based, from `premiere_get_sequence`), `clip` (name) or `time`.
- Times are seconds. Motion `position` is normalized: `[0.5, 0.5]` = frame centre.

## Tools

| Area | Tools |
| --- | --- |
| Project | `project_info`, `list_items`, `open_project`, `save_project`, `import_media`, `create_bin` |
| Sequences | `create_sequence` (from clips or a `.sqpreset`, no dialog), `set_active_sequence`, `get_sequence`, `set_playhead`, `set_in_out`, `add_marker` |
| Edit | `add_clip` (overwrite / insert, source range), `set_clip` (trim, move, speed, enable), `remove_clip` (ripple), `razor` (one or all tracks) |
| Look | `apply_effect`, `set_effect_property` (value or keyframe), `set_motion`, `add_transition`, `list_effects` |
| Export | `export_frame` (PNG), `list_presets`, `export_sequence` (`.epr`; direct or Media Encoder queue) |
| Other | `undo`, `premiere_status`, `premiere_install_bridge`, `premiere_remove_bridge`, `premiere_execute_jsx` (last resort) |

## Rough cut recipe

1. `import_media(paths, bin="Footage")`.
2. `create_sequence(name, items=[first clip])` so the sequence matches the footage.
3. `add_clip` each shot in order (no `time` = append at the end; `source_in` / `source_out`
   for the part you want).
4. `add_transition` only where the story needs one (`Cross Dissolve`, 0.5–1 s).
5. `add_marker` notes for the person, `export_frame` to check, `save_project`.

## Export

`premiere_list_presets("H.264")` → `export_sequence(path, preset_path, range)`. Direct export
blocks Premiere until done; `queue: true` hands it to Adobe Media Encoder instead
(`start_queue: true` starts it). For a Fortnite Discover trailer master use a ProRes 422 HQ
preset and follow `skill_read_subskill("island-media-kit", "trailer")`.

Craft (pacing, cuts, audio): `skill_read_subskill("adobe", "video_editing")`.
