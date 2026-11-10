---
name: video_editing
description: "Premiere Pro editing craft: rough cut to fine cut, pacing by format, J and L cuts, transitions, audio levels, color, captions, delivery presets and Fortnite trailer masters"
metadata:
  label: Video editing in Premiere Pro
---

# Video editing in Premiere Pro

## Order of work

1. **Organize:** `import_media` into bins (`Footage`, `Audio`, `Graphics`).
2. **Rough cut:** every shot in story order on V1 (`add_clip` without `time` appends).
3. **Fine cut:** trim heads and tails (`set_clip` `in_point` / `out_point`), `razor` dead air,
   `remove_clip(ripple=true)` to close gaps.
4. **Layers:** B-roll on V2 over the A-roll, titles and logos on V3+, music on A2.
5. **Look and sound:** effects, motion, levels.
6. **Check:** `export_frame` at every cut you changed, read the sequence back.
7. **Deliver:** `export_sequence` with the right preset.

## Pacing

| Format | Average shot | Notes |
| --- | --- | --- |
| Hype trailer / social | 0.5–1.5 s | cut on the beat, hook in the first 2 s |
| Gameplay showcase | 2–4 s | let actions finish before cutting |
| Tutorial / devlog | 4–8 s | cut out pauses, keep the speaker's rhythm |

Music sets the grid: beat = `60 / bpm` s. Put cuts on beats with `razor` at beat times.

## Cuts and transitions

- The cut is the default. Use `Cross Dissolve` for time passing, `Dip to Black` for a section
  end. 0.5–1 s; one style per section.
- J cut: the next shot's audio starts before its picture. L cut: the picture changes while the
  previous audio continues. Both need the audio unlinked from the video; there is no unlink
  tool, so ask the person to unlink (right-click > Unlink) or skip them.
- Never leave a 1-frame gap: read `get_sequence` and check each clip's `end` equals the
  next `start`.

## Audio

- Dialogue around -12 dB peak, music bed well under it while someone speaks.
- `set_effect_property(effect="Volume", property="Level", time=..., value=...)` keyframes duck
  the music under a line. Premiere stores Level on its own scale, not in dB: read the clip's
  value with `get_clip` first, set values relative to it, and have the person listen.
- Audio transitions: `add_transition(track_type="audio", transition="Constant Power")` on
  music edits.

## Picture

- `apply_effect("Lumetri Color")` per clip (or on an adjustment layer) for a grade; match
  shots before styling.
- `set_motion(scale=...)` punch-ins of 105–115 % hide a jump cut.
- `Warp Stabilizer` on shaky footage (slow: one clip at a time).

## Delivery

| Destination | Preset (`premiere_list_presets`) |
| --- | --- |
| YouTube / web | H.264 "Match Source - High bitrate" |
| Shorts / TikTok | H.264 1080×1920 (sequence must be vertical) |
| Editing master / Fortnite Discover trailer | Apple ProRes 422 HQ |

Fortnite Discover trailers have Epic's rules (15–30 s, 16:9, real gameplay, no text or outside
music): `skill_read_subskill("island-media-kit", "trailer")`. For a full Island Media Kit edit,
export from Premiere and `imk_media_link` the file.
