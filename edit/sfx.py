"""Soft synthesized sound effects, mixed into one WAV track per part.

Every sound sits well under the voice: they mark a graphic arriving, never
compete with what is being said.
"""
import wave

import numpy as np

RATE = 48000


def _t(dur):
    return np.arange(int(RATE * dur)) / RATE


def _attack(t, ms):
    return np.clip(t / (ms / 1000), 0, 1)


def pop():
    """Low, rounded bubble for a card or panel appearing."""
    t = _t(0.16)
    freq = 260 + 260 * np.exp(-t * 45)
    phase = 2 * np.pi * np.cumsum(freq) / RATE
    return 0.12 * np.sin(phase) * _attack(t, 3) * np.exp(-t * 32)


def tick():
    """Tiny tick for each new line in a list."""
    t = _t(0.12)
    s = np.sin(2 * np.pi * 1600 * t) + 0.3 * np.sin(2 * np.pi * 3200 * t)
    return 0.05 * s * _attack(t, 1) * np.exp(-t * 60)


def tone():
    """Warm two-note bell for chapter labels."""
    t = _t(1.2)
    s = np.sin(2 * np.pi * 660 * t) + 0.5 * np.sin(2 * np.pi * 990 * t)
    return 0.045 * s * _attack(t, 10) * np.exp(-t * 4.5)


def chime():
    """Gentle major-chord chime for the key quote."""
    t = _t(1.8)
    s = sum(a * np.sin(2 * np.pi * f * t) for f, a in ((523.25, 1), (784, 0.6), (1046.5, 0.35)))
    return 0.03 * s * _attack(t, 15) * np.exp(-t * 3)


def page():
    """Quiet paper brush."""
    t = _t(0.5)
    rng = np.random.default_rng(7)
    n = rng.uniform(-1, 1, len(t))
    hp = np.empty_like(n)          # one-pole high-pass, ~1.8 kHz
    a, prev_x, prev_y = 0.8, 0.0, 0.0
    for i, x in enumerate(n):
        prev_y = a * (prev_y + x - prev_x)
        prev_x = x
        hp[i] = prev_y
    return 0.08 * hp * (1 - np.exp(-t * 40)) * np.exp(-t * 8)


SOUNDS = {"pop": pop, "tick": tick, "tone": tone, "chime": chime, "page": page}


def write_track(path, duration, events):
    """events: [(sound_name, time_in_seconds)] -> stereo 16-bit WAV."""
    track = np.zeros(int(RATE * duration) + RATE)
    cache = {}
    for name, at in events:
        s = cache.setdefault(name, SOUNDS[name]())
        i = int(at * RATE)
        track[i:i + len(s)] += s[:len(track) - i]
    pcm = (np.clip(track, -1, 1) * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(np.repeat(pcm, 2).tobytes())
