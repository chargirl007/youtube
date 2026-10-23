"""Build public/index.html for the storytime reel: phrase captions + editorial callouts.

Captions come from transcript.srt, split into short phrases timed by character share
inside each cue (the SRT has no word timings, so phrase timing is an estimate).
"""
import re
from html import escape
from pathlib import Path

HERE = Path(__file__).parent
FPS = 30
DURATION = 190.9

# Caption text fixes (spoken name confirmed by the creator); everything else verbatim.
FIXES = {
    "the Grapple Gal": "TheGrappleGirl",
    "maybe I was much of a vigilante": "maybe I was a bit much of a vigilante",
    "an active pursuit of death": "an active theft",
    "about to scrabble": "about to scrap",
}

# Words that get the accent colour in captions. Kept short on purpose.
ACCENT_GREEN = {"thief", "walgreens", "vigilante", "supervisor", "code", "theft", "basket", "purse",
                "poison", "ivy", "thegrapplegirl", "five", "years"}
ACCENT_RED = {"fight", "no", "heck", "scabies", "apart", "scrap", "stealing", "nail"}


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
        line = " ".join(lines[2:])
        for a, b in FIXES.items():
            line = line.replace(a, b)
        cues.append((start, end, line))
    return cues


def bare(w):
    return re.sub(r"^[^\w]+|[^\w-]+$", "", w.lower())


def phrases(cues, max_words=5, max_chars=26):
    out = []
    for start, end, text in cues:
        words = text.split()
        groups, cur = [], []
        for w in words:
            if cur and (len(cur) >= max_words or len(" ".join(cur + [w])) > max_chars):
                groups.append(cur)
                cur = []
            cur.append(w)
        if cur:
            groups.append(cur)
        if len(groups) > 1 and len(groups[-1]) == 1:
            tail = groups.pop()
            groups[-1] += tail
        total = sum(len(" ".join(g)) for g in groups)
        t = start
        for g in groups:
            d = (end - start) * len(" ".join(g)) / total
            out.append((t, t + d, g))
            t += d
    # Hold each phrase until the next one starts (up to 0.6s) so gaps don't flicker.
    held = []
    for i, (s, e, g) in enumerate(out):
        nxt = out[i + 1][0] if i + 1 < len(out) else DURATION
        held.append((s, min(nxt, e + 0.6), g))
    return held


def word_span(w):
    b = bare(w)
    cls = " g" if b in ACCENT_GREEN else " r" if b in ACCENT_RED else ""
    return f'<span class="w{cls}">{escape(w)}</span>'


# ── Callouts. (start, end, id, html, kind). kind picks the enter/exit motion.
LEAF = ('<svg class="leaf" viewBox="0 0 40 40"><path d="M6 34 C6 14 20 6 36 4 C34 22 24 34 6 34 Z" '
        'fill="var(--green)"/><path d="M8 32 L28 12" stroke="#0b2a16" stroke-width="2.5" '
        'stroke-linecap="round"/></svg>')
AVATAR = '<img class="avatar" src="img/grapplegirl.png" alt="" />'

CALLOUTS = [
    (0.0, 7.7, "hook",
     '<div class="kicker">STORYTIME</div><div class="hook-title">I almost got in a<br />'
     '<em>fight with a thief</em></div><div class="rule"></div>', "hook"),
    (10.03, 11.85, "collab",
     f'<div class="row">{AVATAR}<div><div class="kicker">COLLAB TODAY</div>'
     '<div class="name">TheGrappleGirl</div></div></div>', "card"),
    (11.9, 14.7, "cosplay",
     f'<div class="row">{LEAF}<div><div class="kicker">TODAY\'S COSPLAY</div>'
     '<div class="name">Poison Ivy</div></div></div>', "card"),
    (14.8, 18.6, "ch1", '<div class="chapter"><b>01</b> The backstory</div>', "chapter"),
    (16.73, 21.5, "stat",
     '<div class="stat"><span class="num">5</span><span class="unit">years<br />at Walgreens</span></div>', "card"),
    (29.8, 35.85, "roles",
     '<div class="kicker">ON SHIFT</div>'
     '<div class="li"><span class="who">Me</span>Shift lead supervisor</div>'
     '<div class="li li2"><span class="who">Best friend</span>Shift lead supervisor</div>', "card"),
    (37.6, 42.8, "code",
     '<div class="kicker">STORE CODE</div><div class="flow"><span class="chip">Certain code</span>'
     '<span class="arrow"></span><span class="chip red">Active theft</span></div>', "card"),
    (50.13, 54.0, "ch2", '<div class="chapter"><b>02</b> The suspect</div>', "chapter"),
    (66.7, 69.6, "vigil",
     '<div class="toggle-row"><span class="kicker">VIGILANTE MODE</span>'
     '<span class="toggle"><span class="knob"></span></span></div>', "card"),
    (84.47, 89.7, "talk1",
     '<div class="li"><span class="who">Me</span>"Do you mind using this basket?"</div>'
     '<div class="li li2"><span class="who red">Her</span>"No."</div>', "card"),
    (110.4, 114.0, "alert",
     '<div class="alert"><span class="dot"></span>Code called</div>', "card"),
    (120.5, 124.4, "ch3", '<div class="chapter"><b>03</b> The standoff</div>', "chapter"),
    (130.6, 137.0, "talk2",
     '<div class="li"><span class="who">Me</span>"Hand me the products back."</div>'
     '<div class="li li2"><span class="who red">Her</span>Keeps walking.</div>', "card"),
    (142.47, 144.4, "hecknoo", '<div class="punch">Oh heck no.</div>', "punch"),
    (146.1, 150.4, "why",
     f'<div class="row">{LEAF}<div><div class="kicker">WHY THIS STORY?</div>'
     '<div class="name">The Poison Ivy cosplay</div></div></div>', "card"),
    (187.8, DURATION, "outro",
     f'<div class="row">{AVATAR}<div><div class="kicker">LIVE TODAY · COME WATCH</div>'
     '<div class="name">Stream with TheGrappleGirl</div></div></div>', "card"),
]

# Second rows that appear later than their card.
SECOND_ROW_AT = {"roles": 34.1, "talk1": 86.5, "talk2": 134.87}

SFX = [  # (start, file, duration, gain)
    (0.0, "whoosh-short", 0.57, 0.3),
    (14.8, "click-soft", 0.37, 0.5),
    (50.13, "click-soft", 0.37, 0.5),
    (111.6, "ping", 1.0, 0.25),
    (120.5, "click-soft", 0.37, 0.5),
    (142.47, "pop", 0.72, 0.45),
]


def main():
    caps, tl = [], []
    for i, (s, e, words) in enumerate(phrases(parse_srt((HERE / "transcript.srt").read_text()))):
        s2, e2 = q(s), min(q(e), DURATION)
        if e2 - s2 < 2 / FPS:
            continue
        cid = f"cap-{i:03d}"
        caps.append(f'<div class="cap clip" id="{cid}" data-start="{s2:.4f}" data-duration="{e2 - s2:.4f}" '
                    f'data-track-index="3"><div class="cap-in">{" ".join(word_span(w) for w in words)}</div></div>')
        tl.append(f"tl.fromTo('#{cid} .cap-in', {{ opacity: 0, y: 6 }}, {{ opacity: 1, y: 0, duration: 0.14, ease: 'power2.out' }}, {s2:.4f});")

    hosts = []
    for s, e, cid, html, kind in CALLOUTS:
        s2, e2 = q(s), min(q(e), DURATION)
        track = 5 if kind == "chapter" else 4
        hosts.append(f'<div class="co {kind} clip" id="{cid}" data-start="{s2:.4f}" data-duration="{e2 - s2:.4f}" '
                     f'data-track-index="{track}"><div class="co-in">{html}</div></div>')
        sel = f"#{cid} .co-in"
        if kind == "punch":
            tl.append(f"tl.fromTo('{sel}', {{ opacity: 0, scale: 0.92 }}, {{ opacity: 1, scale: 1, duration: 0.22, ease: 'power3.out' }}, {s2:.4f});")
        elif kind == "chapter":
            tl.append(f"tl.fromTo('{sel}', {{ opacity: 0, x: -24 }}, {{ opacity: 1, x: 0, duration: 0.35, ease: 'power3.out' }}, {s2:.4f});")
        else:
            tl.append(f"tl.fromTo('{sel}', {{ opacity: 0, y: 14 }}, {{ opacity: 1, y: 0, duration: 0.32, ease: 'power3.out' }}, {s2:.4f});")
        if kind == "hook":
            tl.append(f"tl.fromTo('#{cid} .rule', {{ scaleX: 0 }}, {{ scaleX: 1, duration: 0.5, ease: 'power2.inOut' }}, {q(s2 + 0.35):.4f});")
        if cid == "vigil":
            tl.append(f"tl.fromTo('#vigil .knob', {{ x: 0 }}, {{ x: 30, duration: 0.25, ease: 'power2.inOut' }}, {q(s2 + 0.45):.4f});")
            tl.append(f"tl.fromTo('#vigil .toggle', {{ backgroundColor: 'rgba(255,255,255,0.25)' }}, {{ backgroundColor: '#22c55e', duration: 0.25 }}, {q(s2 + 0.45):.4f});")
        if cid == "code":
            tl.append(f"tl.fromTo('#code .chip.red', {{ opacity: 0, x: -10 }}, {{ opacity: 1, x: 0, duration: 0.3, ease: 'power2.out' }}, {q(s2 + 0.5):.4f});")
        if cid == "alert":
            tl.append(f"tl.to('#alert .dot', {{ opacity: 0.25, duration: 0.4, yoyo: true, repeat: 7, ease: 'sine.inOut' }}, {q(s2 + 0.3):.4f});")
        if cid in SECOND_ROW_AT:
            t2 = q(SECOND_ROW_AT[cid])
            tl.append(f"tl.fromTo('#{cid} .li2', {{ opacity: 0, y: 8 }}, {{ opacity: 1, y: 0, duration: 0.3, ease: 'power2.out', immediateRender: true }}, {t2:.4f});")
        if kind != "punch" and e2 < DURATION:
            tl.append(f"tl.to('{sel}', {{ opacity: 0, duration: 0.25, ease: 'power1.in' }}, {q(e2 - 0.25):.4f});")
        elif kind == "punch":
            tl.append(f"tl.to('{sel}', {{ opacity: 0, duration: 0.3 }}, {q(e2 - 0.3):.4f});")

    # Camera: slow, small push-ins at the start of each chapter; one eased lean-in on the punchline.
    cam = [(0.0, 1.0, 1.04, 7.5), (14.8, 1.0, 1.035, 6.0), (50.13, 1.0, 1.035, 6.0),
           (120.5, 1.0, 1.035, 6.0), (172.0, 1.0, 1.035, 3.5)]
    for t0, a, b, d in cam:
        tl.append(f"tl.fromTo('#video-wrap', {{ scale: {a} }}, {{ scale: {b}, duration: {d}, ease: 'sine.inOut', immediateRender: false }}, {t0:.4f});")
        tl.append(f"tl.to('#video-wrap', {{ scale: 1, duration: 1.2, ease: 'sine.inOut' }}, {t0 + d + 0.2:.4f});")
    tl.append("tl.fromTo('#video-wrap', { scale: 1 }, { scale: 1.05, duration: 0.4, ease: 'power2.out', immediateRender: false }, 142.47);")
    tl.append("tl.to('#video-wrap', { scale: 1, duration: 1.4, ease: 'sine.inOut' }, 143.6);")

    sfx = [f'<audio id="sfx-{i}" class="clip" src="sfx/{f}.mp3" data-start="{s:.4f}" data-duration="{d}" '
           f'data-track-index="{10 + i}" data-volume="{g}"></audio>' for i, (s, f, d, g) in enumerate(SFX)]

    html = (HERE / "template.html").read_text()
    html = (html.replace("{{DURATION}}", f"{DURATION:.4f}")
                .replace("{{CALLOUTS}}", "\n      ".join(hosts))
                .replace("{{CAPTIONS}}", "\n      ".join(caps))
                .replace("{{SFX}}", "\n      ".join(sfx))
                .replace("{{TIMELINE}}", "\n          ".join(tl)))
    (HERE / "public" / "index.html").write_text(html)
    print(f"{len(caps)} caption phrases, {len(hosts)} callouts")


if __name__ == "__main__":
    main()
