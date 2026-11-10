---
name: motion_design
description: "After Effects motion craft: easing values, overshoot, staggers, expression recipes (wiggle, loopOut, inertial bounce, time-driven), kinetic type, comp and render settings"
metadata:
  label: Motion design in After Effects
---

# Motion design in After Effects

## Comp settings

| Use | Size | fps |
| --- | --- | --- |
| YouTube / trailer | 1920×1080 (or 3840×2160) | 30 or 60 |
| Shorts / TikTok / Reels | 1080×1920 | 30 |
| Square feed | 1080×1080 | 30 |

Keep comp fps equal to the footage's. Build at final size; never scale a finished comp up.

## Easing

- Linear only for tickers, scrolls and loops.
- Entrances: overshoot. Scale `0 → 110 % → 100 %` over ~0.45 s with `ease` 70 on the peak.
- Exits: anticipate. A small move back, then out fast (~0.3 s).
- Moves: ease both ends (`easy_ease: true`, or `ease` 60–80 for a snappier feel).
- Stagger siblings 0.07–0.15 s: same keys, `start_time` offsets (or `duplicate_layer` and
  shift the copies).
- Nothing freezes: after a build, let it drift (scale +2 % over 3 s) or bob (expression below).

## Expression recipes (`aftereffects_set_expression`)

```javascript
// Bob (position): gentle float, 12 px, ~2 s cycle
value + [0, Math.sin(time * Math.PI) * 12]

// Wiggle: 2 times a second, 8 px
wiggle(2, 8)

// Loop the keyframes forever
loopOut("cycle")

// Inertial bounce after the last keyframe (scale or position)
n = 0; if (numKeys > 0) { n = nearestKey(time).index; if (key(n).time > time) n--; }
if (n == 0) { value } else {
  t = time - key(n).time; amp = 0.06; freq = 3; decay = 6;
  v = velocityAtTime(key(n).time - thisComp.frameDuration / 10);
  value + v * amp * Math.sin(freq * t * 2 * Math.PI) / Math.exp(decay * t);
}

// Rotate at a constant 90 degrees a second
time * 90

// Counter (Source Text): 0 → 1000 over 2 s
Math.round(linear(time, 0, 2, 0, 1000))
```

Check `expression_error` in the answer; empty = it compiled.

## Kinetic type

- One or two words per beat; at 128 BPM a beat is 0.47 s, at 172 BPM 0.35 s.
- Size words to fill the frame width (text `font_size` 250–500 at 1080p); split long phrases.
- Flip the background on phrase changes: a full-frame solid per section, cut on the beat.
- Transitions are moves (a whip with `Directional Blur`, a scale-through), not fades.
- Words stay text layers (retypable): set them with `set_layer(text=...)`.

## Effects that earn their place

| Look | Effect (match name works too) |
| --- | --- |
| Glow on neon type | `Glow` (Glow Radius, Glow Intensity) |
| Motion smear on whips | `Directional Blur` keyed 0 → 40 → 0 over the move |
| Soft focus | `Gaussian Blur` (Blurriness) |
| Grade | `Lumetri Color` or `Curves` on an adjustment layer at the top |
| Drop shadow | `Drop Shadow` (Distance, Softness, Opacity) |

`aftereffects_list_effects(query)` before guessing a name.

## Check

`render_frame` at the key moments (the first hit, every transition, the end card), not random
times. Watch for: a word sitting still for a whole beat, two new things on one beat, text
touching the frame edge.
