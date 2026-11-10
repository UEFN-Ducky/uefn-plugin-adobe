---
name: aftereffects
description: "After Effects tool map: setup, comps, layers, shapes, text, keyframes, expressions, effects, markers, render frames and the render queue"
metadata:
  label: After Effects
---

# After Effects

Tools are named `aftereffects_*`. Every tool takes one `params` object (keys in its
description). Each call is one undo step in After Effects (Edit > Undo, or
`aftereffects_undo`).

## Setup: none

`aftereffects_status(launch=true)` opens After Effects if needed and waits until it answers
→ `ready: true`. After Effects 2027 runs Ducky's scripts with its defaults (verified). On an
older version that refuses script file access, the first call that times out switches on
"Allow Scripts to Write Files and Access Network" itself; `aftereffects_status` then asks
again. A timed-out change may still have run: read the comp before retrying it. Not under
Program Files\Adobe? The person sets `AE_EXE`.

No panel, no Node, no token. Ducky runs `AfterFX.exe -r <job>.jsx`; the job writes its
answer to `%LOCALAPPDATA%/UEFN-Ducky/adobe/aftereffects/`. A dialog open in After Effects
blocks scripting: ask the person to close it, then retry.

## Loop

1. Read: `aftereffects_project_info` → `aftereffects_get_comp(comp)` → `aftereffects_get_layer`.
2. Change one thing per call.
3. Look: `aftereffects_render_frame(comp, time, path)` and open the PNG with `view_image`.
4. Read back the property you changed (`aftereffects_get_property`).

## Addressing

- Comp: `comp` (name) or `comp_id`; default = the active comp.
- Layer: `layer` (name) or `layer_index` (1 = top); default = the selected layer.
- Property `path`: shortcuts `position`, `scale`, `rotation`, `opacity`, `anchor_point`,
  `source_text`, `time_remap`, `audio_levels`; or a path of names / match names:
  `Effects/Gaussian Blur/Blurriness`, `ADBE Transform Group/ADBE Position`,
  `Masks/Mask 1/Mask Feather`.
- Colors are `[r, g, b]` from 0 to 1. Positions are pixels in comp space. Times are seconds.

## Tools

| Area | Tools |
| --- | --- |
| Project | `project_info`, `list_items`, `new_project`, `open_project`, `save_project`, `import_footage` |
| Comps | `create_comp`, `set_comp`, `get_comp`, `precompose` |
| Layers | `add_layer` (text, solid, adjustment, null, camera, light, shape: rectangle / ellipse / star / polygon), `add_item_to_comp`, `set_layer`, `get_layer`, `duplicate_layer`, `reorder_layer`, `delete_layer` |
| Animation | `set_property`, `get_property`, `set_keyframes`, `set_expression`, `add_marker` |
| Effects | `list_effects`, `add_effect` (+ `properties`), `remove_effect` |
| Output | `render_frame`, `add_to_render_queue`, `render_queue` |
| Other | `undo`, `aftereffects_status`, `aftereffects_execute_jsx` (last resort) |

## Keyframes

```json
{"comp": "Title", "layer": "Logo", "path": "scale", "clear": true,
 "keys": [{"time": 0, "value": [0, 0]},
          {"time": 0.35, "value": [110, 110], "ease": 70},
          {"time": 0.5, "value": [100, 100], "ease": 50}]}
```

`interpolation`: `linear`, `bezier`, `hold`. `ease` is the influence % on both sides;
`easy_ease: true` gives every key 33 %. Text keys: `value` = string or
`{text, font, font_size, fill_color, justification}`.

## Render

- Check a frame: `render_frame` (PNG).
- A video: `add_to_render_queue(comp, path, output_template)` then `render_queue`. That
  blocks After Effects until done (up to an hour). Tell the person before a long render.
  Template names are After Effects' own (`Best Settings`, `H.264 - Match Render Settings - 15 Mbps`,
  `High Quality with Alpha`); the answer lists `output_templates`.
- To use the result in Island Media Kit, `imk_media_link` the rendered file.

Craft (easing, staggers, expressions, type): `skill_read_subskill("adobe", "motion_design")`.
