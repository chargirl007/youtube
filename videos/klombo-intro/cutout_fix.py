"""Fix sprite cutouts the AI matte got wrong.

gold: AI matte is good but leaves a faint haze -> harden low alpha.
green: translucent glowing body confuses the AI -> flood-fill the dark
       background in from the borders on the original image instead.
"""
from collections import deque
import numpy as np
from PIL import Image, ImageFilter

# gold: drop the low-alpha haze, keep soft edges.
g = Image.open("ai/gold.png").convert("RGBA")  # raw AI matte, so reruns don't compound
a = np.asarray(g.getchannel("A")).astype(float)
a = np.clip((a - 70) * 255 / 160, 0, 255).astype(np.uint8)
g.putalpha(Image.fromarray(a))
g.save("public/img/gold.png")

# green: background = dark, low-saturation pixels connected to the border.
src = Image.open("raw/green.png").convert("RGB")
rgb = np.asarray(src).astype(int)
h, w, _ = rgb.shape
mx, mn = rgb.max(2), rgb.min(2)
sat = (mx - mn) / np.maximum(mx, 1)
bgish = (mx < 95) & ((sat < 0.45) | (mx < 60))
seen = np.zeros((h, w), bool)
q = deque([(y, x) for y in range(h) for x in (0, w - 1)] + [(y, x) for x in range(w) for y in (0, h - 1)])
while q:
    y, x = q.popleft()
    if y < 0 or x < 0 or y >= h or x >= w or seen[y, x] or not bgish[y, x]:
        continue
    seen[y, x] = True
    q.extend(((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)))
alpha = Image.fromarray(np.where(seen, 0, 255).astype(np.uint8))
alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
out = src.convert("RGBA")
out.putalpha(alpha)
out.save("public/img/green.png")
print("background px removed:", int(seen.sum()), "of", h * w)

# green: keep only the largest connected blob (drops stray specks near the top).
im = Image.open("public/img/green.png").convert("RGBA")
A = np.asarray(im.getchannel("A")).copy()
solid = A > 100
lab = np.zeros(A.shape, int)
sizes = {}
cur = 0
for sy in range(h):
    for sx in range(w):
        if solid[sy, sx] and not lab[sy, sx]:
            cur += 1
            dq = deque([(sy, sx)])
            lab[sy, sx] = cur
            n = 0
            while dq:
                y, x = dq.popleft()
                n += 1
                for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                    if 0 <= ny < h and 0 <= nx < w and solid[ny, nx] and not lab[ny, nx]:
                        lab[ny, nx] = cur
                        dq.append((ny, nx))
            sizes[cur] = n
keep = max(sizes, key=sizes.get)
grow = Image.fromarray(((lab == keep) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))
A = np.minimum(A, np.asarray(grow))
im.putalpha(Image.fromarray(A))
im.save("public/img/green.png")
print("blobs:", len(sizes), "kept size:", sizes[keep])
