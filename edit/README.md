# Natural Hair 2027 — edit scripts

Builds the finished talking-head edit of *Reset Your Natural Hair Journey
Before 2027* from the six raw parts, following the editing blueprint (B-roll
sections dropped; the video is all talking head).

```bash
python3 render.py <folder with the six raw parts> <build folder>
```

Output: `<build folder>/Natural_Hair_2027_edit.mp4` (1280x720, 30 fps, H.264,
AAC, loudness -14 LUFS).

- `graphics.py` draws the text overlays as transparent PNGs (Inter + Lora).
- `render.py` holds the whole edit decision list in `PARTS`: kept segments
  and their framing (100% / 108% / 110% / 115% crops, one eased push-in),
  text layers with in/out times, and two soft sound effects. Times are in
  each part's own source timeline.
- `quiet_points.py` snaps a rough cut time to the nearest gap between words.

To re-render one part while adjusting it: `python3 render.py <raw> <build> p3`.

Fonts: Inter (system), Lora (SIL Open Font License, in `fonts/`).
