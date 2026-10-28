"""Assemble "Reset Your Natural Hair Journey Before 2027" from the six raw parts.

usage: python3 render.py <uploads_dir> <build_dir> [part_name ...]

Each part is rendered on its own (cuts, digital zooms, text overlays, sound
effects), then the parts are joined and the voice is loudness-normalised for
YouTube (-14 LUFS). All times below are in the part's own source timeline.
"""
import json
import os
import re
import subprocess
import sys

from graphics import build as build_graphics
from sfx import write_track

W, H, FPS = 1280, 720, 30
# Zooms are anchored on the speaker's eye line so her face stays put while
# the frame tightens around it.
ANCHOR_X, ANCHOR_Y = 575, 205
FADE_IN, FADE_OUT = 0.35, 0.4
WHISPER = 1.15

def group(prefix, panel_in, item_times, out):
    """A panel plus items revealed one by one, all leaving together."""
    return ([(prefix + "_panel", panel_in, out)]
            + [(f"{prefix}_{i}", t, out) for i, t in enumerate(item_times)])


PARTS = [
    dict(name="p1", src="13bc50ab-part_1_gstob.mp4",
         # Hook: punch in on the list of things tried, back out on "still
         # starting over", one slow push from 100% to 108% on "But what if the
         # answer...", back to the base frame at "Think about this".
         segments=[(0, 14.10, 1.0),
                   (14.10, 20.03, 1.06),
                   (20.03, 72.10, ("push", 1.0, 1.08, 30.34, 4.5)),
                   (72.10, 91.03, 1.0),
                   (91.03, None, 1.06)],
         layers=group("x1_proud", 4.2, [4.2, 6.4], 11.4)
                + group("x1_tried", 14.2, [14.3, 15.9, 17.4], 19.9)
                + [("x1_2027", 25.2, 30.2)]
                + group("x1_how", 36.5, [36.6, 40.1, 42.8], 46.5)
                + [("x1_novdec", 53.7, 59.3)]
                + group("p1_words", 59.9, [60.25, 61.05, 61.65, 62.65], 65.5)
                + group("x1_still", 74.2, [74.3, 79.0, 86.7], 90.8)
                + [("x1_beliefs", 95.8, 102.9),
                   ("p1_newproduct", 104.39, 111.2)]),
    dict(name="p2", src="3aebfaef-part_2_gstob.mp4",
         segments=[(0, 36.79, 1.08),
                   (36.79, 61.05, 1.0),
                   (61.05, 97.55, 1.06),
                   (97.55, 108.08, WHISPER),       # "Am I caring for my hair..."
                   (108.08, None, 1.0)],
         layers=[("p2_label", 0.4, 3.0),
                 ("x2_confidence", 3.4, 12.0),
                 ("x2_appreciate", 28.2, 32.6),
                 ("x2_worth", 38.0, 44.0),
                 ("x2_value", 46.9, 53.5),
                 ("p2_samuel", 53.7, 61.0),
                 ("x2_heart", 54.0, 61.0),
                 ("x2_measure", 66.5, 74.4)]
                + group("x2_caring", 74.7, [74.8, 83.8], 92.3)
                + [("x2_first", 92.6, 97.3),
                   ("x2_wait", 110.6, 118.5)]),
    dict(name="p3", src="be98280e-part_3_gstob_.mp4",
         segments=[(0, 38.07, 1.08),
                   (38.07, 72.99, 1.0),
                   (72.99, 117.70, 1.06),
                   (117.70, None, 1.0)],          # "...doesn't have to look like anyone else's"
         layers=[("p3_label", 0.4, 3.0)]
                + group("x3_believed", 3.2, [3.3, 8.3, 11.0], 15.3)
                + [("x3_failed", 16.4, 19.9),
                   ("x3_onesize", 21.2, 26.2)]
                + group("x3_differ", 26.4, [26.6, 28.3, 29.3, 30.3, 32.0], 37.4)
                + group("p3_goal", 38.1, [38.4, 41.2], 57.6)
                + group("x3_length", 57.9, [58.0, 62.4], 72.6)
                + group("p3_progress", 73.0, [78.0, 79.6, 85.7, 90.5], 96.0)
                + group("x3_measure", 107.6, [107.7, 113.7], 117.4)
                + [("x3_success", 118.2, 125.5)]),
    dict(name="p4", src="9b8771f3-part_4_gstob.mp4",
         # 65.45-68.73 ("three cords or 30 cords") is cut; the punch-in to the
         # emphasis crop hides the jump.
         segments=[(0, 15.72, 1.0),
                   (15.72, 40.61, 1.06),
                   (40.61, 65.45, 1.0),
                   (68.73, 77.91, 1.10),           # "You can be disappointed with a result..."
                   (77.91, 92.09, 1.0),
                   (92.09, None, 1.06)],
         layers=[("p4_label", 0.4, 3.0)]
                + group("x4_remembers", 6.4, [7.6, 10.6, 13.0], 15.5)
                + group("x4_postpone", 15.8, [16.4, 18.4], 22.0)
                + [("x4_difficult", 27.3, 29.7)]
                + group("p4_cycle", 29.8, [31.6, 33.6, 37.0], 41.4)
                + group("x4_triggers", 44.8, [45.0, 49.1, 55.4], 60.7)
                + [("x4_valid", 60.95, 65.3),
                   ("p4_quote", 74.2, 78.6)]
                + group("x4_setback", 78.8, [78.9, 82.2], 86.4)
                + group("x4_ask", 100.4, [100.5, 103.8], 111.8)
                + [("x4_solution", 112.4, 117.8)]),
    dict(name="p5", src="535acf8d-part_5_gstob.mp4",
         # 4.90-6.86 (a fumbled "create an elaborate routine") is cut; the
         # chapter crop starts on the cut.
         segments=[(0, 4.90, 1.0),
                   (6.86, 31.97, 1.08),
                   (31.97, 68.73, 1.0),
                   (68.73, 87.71, 1.06),           # "You don't need the most elaborate routine"
                   (87.71, None, 1.0)],
         layers=[("p5_label", 0.4, 3.0),
                 ("x5_ten", 2.3, 4.85),
                 ("x5_january", 7.6, 12.3),
                 ("x5_fresh", 12.6, 20.8)]
                + group("x5_working", 23.3, [23.4, 25.5], 31.7)
                + group("p5_audit", 34.8, [37.6, 41.6, 44.5, 47.8, 55.9], 61.2)
                + group("x5_cost", 63.0, [63.1, 63.8, 64.5], 68.5)
                + group("x5_dontneed", 68.9, [69.0, 72.2, 75.0], 81.9)
                + [("x5_need", 82.1, 87.6),
                   ("x5_pro", 88.0, 99.8),
                   ("x5_informed", 100.1, 106.4)]),
    dict(name="f", src="14d0b0f7-final_part_gstob.mp4",
         segments=[(0, 49.67, 1.08),
                   (49.67, 90.97, 1.0),
                   (90.97, 113.44, 1.06),
                   (113.44, 135.74, 1.0),          # "You don't need to enter 2027 with perfect hair"
                   (135.74, None, 1.05)],
         layers=[("x6_label", 0.3, 3.8)]
                + group("f_nov", 5.9, [10.1, 20.0, 29.7, 40.8], 49.7)
                + [(f"f_nov_week_{i}", t, 49.7) for i, t in enumerate([10.1, 20.0, 29.7, 40.8])]
                + group("f_dec", 49.9, [52.6, 83.3, 86.3, 87.5], 91.2)
                + [("x6_patterns", 91.4, 98.8)]
                + group("x6_understand", 109.3, [109.4, 110.4, 111.3], 113.3)
                + [("f_values", 118.0, 123.5)]
                + group("x6_comment", 126.8, [130.6, 131.4, 132.1, 133.0], 136.2)
                + [("x6_next", 144.0, 157.4),
                   ("x6_beauty", 159.4, 163.4)],
         sfx=[("page", 49.68)]),
]

LOWER = {"p2_samuel", "f_values", "x5_pro"}
SOUND_OVERRIDES = {"p4_quote": "chime", "f_dec_panel": None}  # December has its page turn


def layer_area(name):
    if name.endswith("_label"):
        return "top"
    return "lower" if name in LOWER else "mid"


def layer_group(name):
    return re.sub(r"_(panel|week_\d+|\d+)$", "", name)


def check_layers(part):
    """Fail if two different graphics share the same screen area at once."""
    spans = {}
    for name, t_in, t_out in part.get("layers", []):
        key = (layer_area(name), layer_group(name))
        a, b = spans.get(key, (t_in, t_out))
        spans[key] = (min(a, t_in), max(b, t_out))
    items = sorted(spans.items(), key=lambda kv: kv[1])
    for i, ((area, g), (a, b)) in enumerate(items):
        for (area2, g2), (a2, b2) in items[i + 1:]:
            if area == area2 and a2 < b - 0.05:
                raise SystemExit(f"{part['name']}: {g} ({a}-{b}) overlaps {g2} ({a2}-{b2})")


def layer_sounds(part):
    """One soft sound per graphic: bell for labels, pop for cards, tick per list line."""
    layers = part.get("layers", [])
    panel_in = {layer_group(n): t for n, t, _ in layers if n.endswith("_panel")}
    events = []
    for name, t_in, _ in layers:
        if name in SOUND_OVERRIDES:
            sound = SOUND_OVERRIDES[name]
        elif name.endswith("_label"):
            sound = "tone"
        elif "_week_" in name:
            sound = None
        elif re.search(r"_\d+$", name):
            # A line that arrives with its panel shares the panel's pop.
            sound = None if abs(panel_in.get(layer_group(name), -9) - t_in) < 0.3 else "tick"
        else:
            sound = "pop"
        if sound:
            events.append((sound, t_in))
    return events + list(part.get("sfx", []))


def run(cmd):
    print("+", " ".join(cmd[:6]), "...", flush=True)
    subprocess.run(cmd, check=True)


def duration(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                          "-of", "csv=p=0", path], capture_output=True, text=True, check=True).stdout
    return float(out)


def crop_filter(z):
    if z == 1.0:
        return "null"
    cw, ch = round(W / z / 2) * 2, round(H / z / 2) * 2
    x, y = round(ANCHOR_X * (1 - 1 / z)), round(ANCHOR_Y * (1 - 1 / z))
    return f"crop={cw}:{ch}:{x}:{y},scale={W}:{H}:flags=lanczos,unsharp=5:5:0.35"


def push_filter(z0, z1, t0, dur):
    """Eased push-in, sub-pixel smooth: upscale 3x, then zoompan back down."""
    k = 3
    p = f"clip((it-{t0})/{dur},0,1)"
    z = f"{z0}+({z1}-{z0})*{p}*{p}*(3-2*{p})"
    return (f"scale={W * k}:{H * k}:flags=lanczos,"
            f"zoompan=z='{z}':x='{ANCHOR_X * k}*(1-1/zoom)':y='{ANCHOR_Y * k}*(1-1/zoom)'"
            f":d=1:s={W}x{H}:fps={FPS},unsharp=5:5:0.25")


def to_output_time(segments, t):
    """Map a source time to the part's output time (after cuts)."""
    acc = 0.0
    for s, e, _ in segments:
        if t < s:
            return acc
        if t <= e:
            return acc + (t - s)
        acc += e - s
    return acc


def render_part(part, uploads, gfx, out_dir):
    src = os.path.join(uploads, part["src"])
    total = duration(src)
    segments = [(s, e if e is not None else total, z) for s, e, z in part["segments"]]
    check_layers(part)

    inputs = ["-i", src]
    fc = []
    n_in = 1

    # Picture and sound for each kept segment, each with its own framing.
    for k, (s, e, z) in enumerate(segments):
        if isinstance(z, tuple):
            _, z0, z1, t0, d = z
            vf = push_filter(z0, z1, t0 - s, d)
        else:
            vf = crop_filter(z)
        fc.append(f"[0:v]trim=start={s}:end={e},setpts=PTS-STARTPTS,{vf},setsar=1[v{k}]")
        fc.append(f"[0:a]atrim=start={s}:end={e},asetpts=PTS-STARTPTS,"
                  f"afade=t=in:d=0.012,afade=t=out:st={e - s - 0.012:.3f}:d=0.012[a{k}]")
    fc.append("".join(f"[v{k}][a{k}]" for k in range(len(segments)))
              + f"concat=n={len(segments)}:v=1:a=1[vb][ab]")

    # Text layers, faded in and out on their own alpha.
    last = "vb"
    for i, (name, t_in, t_out) in enumerate(part.get("layers", [])):
        a, b = to_output_time(segments, t_in), to_output_time(segments, t_out)
        d = b - a
        inputs += ["-loop", "1", "-framerate", str(FPS), "-t", f"{d:.3f}",
                   "-i", os.path.join(gfx, name + ".png")]
        fc.append(f"[{n_in}:v]format=rgba,fade=t=in:st=0:d={FADE_IN}:alpha=1,"
                  f"fade=t=out:st={d - FADE_OUT:.3f}:d={FADE_OUT}:alpha=1,"
                  f"setpts=PTS-STARTPTS+{a:.3f}/TB[o{i}]")
        fc.append(f"[{last}][o{i}]overlay=0:0:eof_action=pass:format=auto[l{i}]")
        last = f"l{i}"
        n_in += 1
    fc.append(f"[{last}]format=yuv420p[vout]")

    # Sound effects under the voice, pre-mixed into one track.
    events = [(snd, to_output_time(segments, t)) for snd, t in layer_sounds(part)]
    track = os.path.join(out_dir, part["name"] + "_sfx.wav")
    write_track(track, to_output_time(segments, total), events)
    inputs += ["-i", track]
    fc.append(f"[{n_in}:a]aresample=44100[sfx]")
    fc.append("[ab][sfx]amix=inputs=2:duration=first:normalize=0[aout]")

    out = os.path.join(out_dir, part["name"] + ".mkv")
    script = os.path.join(out_dir, part["name"] + ".filter")
    with open(script, "w") as f:
        f.write(";\n".join(fc))
    run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex_script", script,
         "-map", "[vout]", "-map", "[aout]", "-r", str(FPS),
         "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p",
         "-c:a", "pcm_s16le", "-ar", "48000", out])
    return out


def finish(part_files, out_dir):
    listing = os.path.join(out_dir, "parts.txt")
    with open(listing, "w") as f:
        f.writelines(f"file '{p}'\n" for p in part_files)
    joined = os.path.join(out_dir, "joined.mkv")
    run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", listing, "-c", "copy", joined])

    # Two-pass loudness normalisation to YouTube's -14 LUFS.
    pre = "highpass=f=70"
    probe = subprocess.run(["ffmpeg", "-hide_banner", "-i", joined, "-vn", "-af",
                            f"{pre},loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"],
                           capture_output=True, text=True, check=True).stderr
    m = json.loads(probe[probe.rindex("{"):probe.rindex("}") + 1])
    ln = (f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}"
          f":measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}"
          f":offset={m['target_offset']}:linear=true")
    final = os.path.join(out_dir, "Natural_Hair_2027_edit.mp4")
    run(["ffmpeg", "-v", "error", "-y", "-i", joined, "-c:v", "copy", "-af", f"{pre},{ln}",
         "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", final])
    return final


def main():
    uploads, build = sys.argv[1], sys.argv[2]
    only = set(sys.argv[3:])
    gfx = os.path.join(build, "gfx")
    build_graphics(gfx)
    files = []
    for part in PARTS:
        out = os.path.join(build, part["name"] + ".mkv")
        if not only or part["name"] in only:
            render_part(part, uploads, gfx, build)
        files.append(out)
    if not only:
        print(finish(files, build))


if __name__ == "__main__":
    main()
