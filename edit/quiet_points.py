"""Snap rough cut times to the quietest 20 ms window nearby (word gaps)."""
import math, struct, subprocess, sys

def envelope(path, start, dur, rate=16000, win=0.02):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(start), "-t", str(dur), "-i", path,
                          "-ac", "1", "-ar", str(rate), "-f", "s16le", "-"], capture_output=True).stdout
    a = struct.unpack("<%dh" % (len(raw) // 2), raw)
    w = int(rate * win)
    out = []
    for i in range(0, len(a) - w, w):
        r = math.sqrt(sum(x * x for x in a[i:i + w]) / w)
        out.append((start + i / rate, 20 * math.log10(r / 32768 + 1e-9)))
    return out

def snap(path, t, radius=0.3):
    env = envelope(path, max(0, t - radius), 2 * radius)
    tt, db = min(env, key=lambda p: p[1])
    return round(tt + 0.01, 2), round(db, 1)

if __name__ == "__main__":
    path = sys.argv[1]
    for t in sys.argv[2:]:
        print(t, *snap(path, float(t)))
