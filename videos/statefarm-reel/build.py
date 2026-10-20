"""Build public/index.html for the StateFarm reel: SRT captions + overlay cards.

All times below are in ORIGINAL source.mp4 seconds; they are mapped onto the
um-cut timeline (cut.mp4) using the ranges in cuts.json.
"""
import json
import re
from html import escape
from pathlib import Path

HERE = Path(__file__).parent
FPS = 30
DURATION = 102.6  # source.mp4 video stream (102.617s), frame-aligned
CUTS = [(a, b) for a, b, _ in json.loads((HERE / "cuts.json").read_text())["remove"]]
FILLERS = set()  # user asked to keep ums/uhs
HIGHLIGHT = {"state", "farm", "won", "jake", "funko", "pop", "twitch", "rivals",
             "fortnite", "gauntlet", "sweepstakes", "bubble", "head", "mouse", "pad",
             "t-shirt", "neighborly", "wow", "cute"}


def remap(t):
    shift = 0.0
    for a, b in CUTS:
        if t >= b:
            shift += b - a
        elif t > a:
            return q(a - shift)
    return q(t - shift)


def q(t):
    return round(round(t * FPS) / FPS, 4)


def parse_srt(text):
    cues = []
    for block in re.split(r"\n\s*\n", text.strip()):
        lines = block.strip().splitlines()
        m = re.match(r"(\d+):(\d+):(\d+),(\d+) --> (\d+):(\d+):(\d+),(\d+)", lines[1])
        g = list(map(int, m.groups()))
        start = g[0] * 3600 + g[1] * 60 + g[2] + g[3] / 1000
        end = g[4] * 3600 + g[5] * 60 + g[6] + g[7] / 1000
        cues.append((start, end, " ".join(lines[2:])))
    return cues


def bare(w):
    return re.sub(r"^[^\w]+|[^\w-]+$", "", w.lower())


def caption_chunks(cues, max_words=3):
    """Split each cue into <=max_words chunks, timed by character share (estimate)."""
    out = []
    for start, end, text in cues:
        words = [w for w in text.split() if bare(w) not in FILLERS]
        if not words:
            continue
        groups = [words[i:i + max_words] for i in range(0, len(words), max_words)]
        # avoid a lonely 1-word tail
        if len(groups) > 1 and len(groups[-1]) == 1:
            tail = groups.pop()
            groups[-1] += tail
        total = sum(len(" ".join(g)) for g in groups)
        t = start
        for g in groups:
            d = (end - start) * len(" ".join(g)) / total
            out.append((t, t + d, g))
            t += d
    return out


# (orig_start, orig_end, accent, kicker, title, extra_class)
CARDS = [
    (0.2, 4.6, "pink", "STATE FARM × TWITCH RIVALS", "I WON THE SWEEPSTAKES!", ""),
    (5.0, 9.8, "yellow", "SEPT 16 · TWITCH RIVALS", "THE FORTNITE GAUNTLET", "Happy Happy Gal × Adam Savage · presented by State Farm"),
    (17.1, 19.9, "red", "WAIT…", "I ACTUALLY WON!!", "big"),
    (25.7, 29.0, "purple", "LET'S GO", "UNBOXING TIME", ""),
    (39.3, 46.8, "yellow", "THE NOTE SAYS", "BIG THANKS FROM STATE FARM", ""),
    (52.7, 57.0, "pink", "PRIZE #1", "BOBBLEHEAD", ""),
    (59.0, 67.0, "red", "PRIZE #2", "MOUSE PAD", ""),
    (71.3, 76.0, "purple", "PRIZE #3", "T-SHIRT", ""),
    (84.4, 92.8, "yellow", "PRIZE #4", "JAKE FROM STATE FARM FUNKO POP", ""),
    (99.4, 101.3, "pink", "THANK YOU STATE FARM", "VERY NEIGHBORLY", ""),
]

# Card number -> (bundled media-use SFX, gain). Gains keep peaks under the voice.
SFX = {
    1: ("sparkle", 0.3),
    2: ("whoosh-short", 0.35),
    3: ("impact-bass-1", 0.18),
    4: ("pop", 0.5),
    5: ("notification", 0.45),
    6: ("pop", 0.5),
    7: ("pop", 0.5),
    8: ("pop", 0.5),
    9: ("sparkle", 0.3),
    10: ("chime", 0.7),
}
SFX_LEN = {"sparkle": 1.8, "whoosh-short": 0.57, "impact-bass-1": 2.12, "pop": 0.72,
           "notification": 2.46, "chime": 2.5}


def card_html(i, kicker, title, detail, accent, big):
    cid = f"card-{i:02d}"
    detail_html = f'<div class="detail" id="{cid}-detail">{escape(detail)}</div>' if detail else ""
    return cid, f"""
      <div class="card sticker {accent}{' big' if big else ''}" data-card-id="{cid}">
        <div class="root">
          <div class="kicker" id="{cid}-kicker">{escape(kicker)}</div>
          <div class="title" id="{cid}-title">{escape(title)}</div>
          {detail_html}
        </div>
      </div>"""


def main():
    cues = parse_srt((HERE / "transcript.srt").read_text())
    chunks = caption_chunks(cues)
    hosts, tl = [], []

    for i, (s, e, accent, kicker, title, extra) in enumerate(CARDS, 1):
        big = extra == "big"
        detail = "" if big else extra
        s2, e2 = remap(s), min(remap(e), DURATION)
        cid, inner = card_html(i, kicker, title, detail, accent, big)
        if i in SFX:
            name, gain = SFX[i]
            dur = min(SFX_LEN[name], DURATION - s2)
            hosts.append(
                f'<audio id="sfx-{i:02d}" class="clip" src="sfx/{name}.mp3" data-start="{s2:.4f}" '
                f'data-duration="{dur:.4f}" data-track-index="5" data-volume="{gain}"></audio>')
        hosts.append(
            f'<div class="card-host clip" data-card-id="{cid}" data-start="{s2:.4f}" '
            f'data-duration="{e2 - s2:.4f}" data-track-index="2" '
            f'style="left:0;top:0;width:1080px;height:1920px;visibility:hidden;opacity:0;">{inner}\n      </div>')
        host = f'.card-host[data-card-id="{cid}"]'
        sel = f'.card[data-card-id="{cid}"]'
        tl += [
            f"tl.set('{host}', {{ visibility: 'visible', opacity: 1 }}, {s2:.4f});",
            f"tl.fromTo('{sel} .root', {{ scale: 0.4, rotation: -8, opacity: 0 }}, "
            f"{{ scale: 1, rotation: -2, opacity: 1, duration: 0.45, ease: 'back.out(2)' }}, {s2:.4f});",
            f"tl.fromTo('{sel} .kicker', {{ y: 20, opacity: 0 }}, {{ y: 0, opacity: 1, duration: 0.3, ease: 'power2.out' }}, {q(s2 + 0.2):.4f});",
        ]
        if detail:
            tl.append(f"tl.fromTo('{sel} .detail', {{ y: 16, opacity: 0 }}, {{ y: 0, opacity: 1, duration: 0.3, ease: 'power2.out' }}, {q(s2 + 0.45):.4f});")
        tl += [
            f"tl.to('{sel} .root', {{ scale: 0.85, opacity: 0, duration: 0.25, ease: 'power2.in' }}, {q(e2 - 0.25):.4f});",
            f"tl.set('{host}', {{ visibility: 'hidden' }}, {e2:.4f});",
        ]

    caps = []
    for j, (s, e, words) in enumerate(chunks):
        s2, e2 = remap(s), min(remap(e), DURATION)
        if e2 - s2 < 1 / FPS:
            continue
        spans = " ".join(
            f'<span class="w{" hl" if bare(w) in HIGHLIGHT else ""}">{escape(w.upper())}</span>' for w in words)
        cid = f"cap-{j:03d}"
        caps.append(
            f'<div class="caption clip" id="{cid}" data-start="{s2:.4f}" data-duration="{e2 - s2:.4f}" '
            f'data-track-index="3"><div class="cap-inner">{spans}</div></div>')
        tl.append(f"tl.fromTo('#{cid} .cap-inner', {{ scale: 0.7, opacity: 0 }}, "
                  f"{{ scale: 1, opacity: 1, duration: 0.12, ease: 'back.out(3)' }}, {s2:.4f});")

    html = (HERE / "template.html").read_text()
    html = (html.replace("{{DURATION}}", f"{DURATION:.4f}")
                .replace("{{CARDS}}", "\n      ".join(hosts))
                .replace("{{CAPTIONS}}", "\n      ".join(caps))
                .replace("{{TIMELINE}}", "\n          ".join(tl)))
    (HERE / "public" / "index.html").write_text(html)
    print(f"{len(hosts)} cards, {len(caps)} caption chunks, duration {DURATION}")


if __name__ == "__main__":
    main()
