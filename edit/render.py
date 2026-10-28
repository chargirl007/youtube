"""Assemble "Reset Your Natural Hair Journey Before 2027" from the six raw parts.

usage: python3 render.py <uploads_dir> <build_dir> [part_name ...]

Each part is rendered on its own (cuts, digital zooms, text overlays, sound
effects), then the parts are joined and the voice is loudness-normalised for
YouTube (-14 LUFS). All times below are in the part's own source timeline.
"""
import json
import os
import subprocess
import sys

from graphics import build as build_graphics

W, H, FPS = 1280, 720, 30
# Zooms are anchored on the speaker's eye line so her face stays put while
# the frame tightens around it.
ANCHOR_X, ANCHOR_Y = 575, 205
FADE_IN, FADE_OUT = 0.35, 0.4
WHISPER = 1.15

PARTS = [
    dict(name="p1", src="13bc50ab-part_1_gstob.mp4",
         # Hook: one slow push from 100% to 108% on "But what if the answer...",
         # back to the base frame at "Think about this".
         segments=[(0, 72.10, ("push", 1.0, 1.08, 30.34, 4.5)),
                   (72.10, None, 1.0)],
         layers=[("p1_words_panel", 59.9, 65.5),
                 ("p1_words_0", 60.25, 65.5), ("p1_words_1", 61.05, 65.5),
                 ("p1_words_2", 61.65, 65.5), ("p1_words_3", 62.65, 65.5),
                 ("p1_newproduct", 104.39, 111.2)],
         sfx=[("tick", 60.25)]),
    dict(name="p2", src="3aebfaef-part_2_gstob.mp4",
         segments=[(0, 97.55, 1.08),
                   (97.55, 108.08, WHISPER),       # "Am I caring for my hair..."
                   (108.08, None, 1.0)],
         layers=[("p2_label", 0.4, 3.0),
                 ("p2_samuel", 53.7, 61.0)]),
    dict(name="p3", src="be98280e-part_3_gstob_.mp4",
         segments=[(0, 117.70, 1.08),
                   (117.70, None, 1.0)],          # "...doesn't have to look like anyone else's"
         layers=[("p3_label", 0.4, 3.0),
                 ("p3_goal_panel", 38.1, 57.6), ("p3_goal_0", 38.4, 57.6), ("p3_goal_1", 41.2, 57.6),
                 ("p3_progress_panel", 73.0, 96.0),
                 ("p3_progress_0", 78.0, 96.0), ("p3_progress_1", 79.6, 96.0),
                 ("p3_progress_2", 85.7, 96.0), ("p3_progress_3", 90.5, 96.0)]),
    dict(name="p4", src="9b8771f3-part_4_gstob.mp4",
         # 65.45-68.73 ("three cords or 30 cords") is cut; the punch-in to the
         # emphasis crop hides the jump.
         segments=[(0, 65.45, 1.0),
                   (68.73, 77.91, 1.10),           # "You can be disappointed with a result..."
                   (77.91, None, 1.0)],
         layers=[("p4_label", 0.4, 3.0),
                 ("p4_cycle_panel", 29.8, 41.4),
                 ("p4_cycle_0", 31.6, 41.4), ("p4_cycle_1", 33.6, 41.4), ("p4_cycle_2", 37.0, 41.4),
                 ("p4_quote", 74.2, 78.6)]),
    dict(name="p5", src="535acf8d-part_5_gstob.mp4",
         # 4.90-6.86 (a fumbled "create an elaborate routine") is cut; the
         # chapter crop starts on the cut.
         segments=[(0, 4.90, 1.0),
                   (6.86, 68.73, 1.08),
                   (68.73, None, 1.0)],            # "You don't need the most elaborate routine"
         layers=[("p5_label", 0.4, 3.0),
                 ("p5_audit_panel", 34.8, 61.2),
                 ("p5_audit_0", 37.6, 61.2), ("p5_audit_1", 41.6, 61.2), ("p5_audit_2", 44.5, 61.2),
                 ("p5_audit_3", 47.8, 61.2), ("p5_audit_4", 55.9, 61.2)]),
    dict(name="f", src="14d0b0f7-final_part_gstob.mp4",
         segments=[(0, 113.44, 1.08),
                   (113.44, None, 1.0)],           # "You don't need to enter 2027 with perfect hair"
         layers=[("f_nov_panel", 5.9, 49.7)]
                + [(f"f_nov_{i}", t, 49.7) for i, t in enumerate([10.1, 20.0, 29.7, 40.8])]
                + [(f"f_nov_week_{i}", t, 49.7) for i, t in enumerate([10.1, 20.0, 29.7, 40.8])]
                + [("f_dec_panel", 49.9, 91.2)]
                + [(f"f_dec_{i}", t, 91.2) for i, t in enumerate([52.6, 83.3, 86.3, 87.5])]
                + [("f_values", 118.0, 123.5)],
         sfx=[("page", 49.68)]),
]

SFX = {
    # A soft, short tick for the four-word graphic.
    "tick": ("aevalsrc=0.5*sin(2*PI*1400*t)*exp(-t*45)+0.2*sin(2*PI*2800*t)*exp(-t*70):d=0.18:s=44100,"
             "volume=0.10", ),
    # A quiet paper brush for the November -> December change.
    "page": ("aevalsrc=(random(0)*2-1)*(1-exp(-t*40))*exp(-t*8):d=0.5:s=44100,"
             "highpass=f=1800,lowpass=f=7000,volume=0.10", ),
}


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

    # Sound effects under the voice.
    mix = ["[ab]"]
    for j, (name, t) in enumerate(part.get("sfx", [])):
        ms = int(to_output_time(segments, t) * 1000)
        inputs += ["-f", "lavfi", "-i", SFX[name][0]]
        fc.append(f"[{n_in}:a]aformat=channel_layouts=stereo,adelay={ms}|{ms}[s{j}]")
        mix.append(f"[s{j}]")
        n_in += 1
    if len(mix) > 1:
        fc.append("".join(mix) + f"amix=inputs={len(mix)}:duration=first:normalize=0[aout]")
    else:
        fc.append("[ab]anull[aout]")

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
