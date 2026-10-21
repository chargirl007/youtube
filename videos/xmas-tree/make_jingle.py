"""Synthesize a short 'Jingle Bells' opening (public-domain melody) with sleigh bells."""
import wave
import numpy as np

SR = 44100
E5 = 659.25
# (start_beat, length_beats) in eighth notes: "jin-gle bells, jin-gle bells"
NOTES = [(0, 1), (1, 1), (2, 2), (4, 1), (5, 1), (6, 2)]
EIGHTH = 0.16
TOTAL = 8 * EIGHTH + 0.9

t_all = np.arange(int(SR * TOTAL)) / SR
out = np.zeros_like(t_all)
rng = np.random.default_rng(7)

def bell(freq, dur):
    t = np.arange(int(SR * dur)) / SR
    partials = [(1.0, 1.0, 3.0), (2.0, 0.45, 4.5), (3.01, 0.25, 6.0), (4.2, 0.12, 8.0)]
    return sum(a * np.sin(2 * np.pi * freq * r * t) * np.exp(-d * t) for r, a, d in partials)

for start, length in NOTES:
    s = int(SR * start * EIGHTH)
    tone = bell(E5, length * EIGHTH + 0.6)
    e = min(len(out), s + len(tone))
    out[s:e] += 0.5 * tone[: e - s]

# Sleigh bells: short bright noise bursts on every eighth note.
for k in range(9):
    s = int(SR * k * EIGHTH)
    n = int(SR * 0.09)
    burst = rng.standard_normal(n)
    burst = np.diff(np.concatenate([[0], burst]))  # crude high-pass
    burst *= np.exp(-np.arange(n) / (SR * 0.025))
    out[s:s + n] += 0.12 * burst

out /= np.max(np.abs(out)) * 1.12
fade = int(SR * 0.3)
out[-fade:] *= np.linspace(1, 0, fade)
pcm = (out * 32767).astype(np.int16)
with wave.open("public/sfx/jingle.wav", "wb") as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print(f"jingle {TOTAL:.2f}s")
