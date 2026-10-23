"""Clean the AI person matte (drops chair/mic/plush) and add a white sticker outline."""
from collections import deque
import numpy as np
from PIL import Image, ImageFilter

src = Image.open("photo.jpg").convert("RGB")
ai = Image.open("cutout.png").convert("RGBA")
rgb = np.asarray(src).astype(int)
A = np.asarray(ai.getchannel("A")).astype(int)
h, w = A.shape

mx, mn = rgb.max(2), rgb.min(2)
sat = (mx - mn) / np.maximum(mx, 1)
greyish = (sat < 0.22) & (mx < 200)          # chair mesh, mic foam, plush ghost
yy, xx = np.mgrid[0:h, 0:w]
# Dark sequins on the dress read as grey; only filter grey above the dress or at the far right.
greyish &= (yy < 0.72 * h) | (xx > 0.83 * w)
keep = (A > 110) & ~greyish
# Chair back + plush sit right of her hair (photo-space polygon); mic foam at the left edge.
from PIL import ImageDraw
clip = Image.new("L", (w, h), 0)
d = ImageDraw.Draw(clip)
d.polygon([(690, 450), (w, 450), (w, 1150), (845, 1150), (775, 900), (716, 700), (708, 600)], fill=255)
d.polygon([(0, 1040), (150, 1040), (118, 1560), (0, 1610)], fill=255)
keep &= np.asarray(clip) == 0


def flood(seed_mask, passable):
    seen = np.zeros_like(passable)
    dq = deque(zip(*np.nonzero(seed_mask & passable)))
    for y, x in dq:
        seen[y, x] = True
    while dq:
        y, x = dq.popleft()
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < h and 0 <= nx < w and passable[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                dq.append((ny, nx))
    return seen


# Her blob = everything connected to the face region.
face = np.zeros_like(keep)
face[int(h * 0.30):int(h * 0.45), int(w * 0.35):int(w * 0.6)] = True
body = flood(face, keep)
# Fill enclosed holes (eye whites, glove straps) that the grey filter punched out.
border = np.zeros_like(keep)
border[0, :] = border[-1, :] = border[:, 0] = border[:, -1] = True
outside = flood(border, ~body)
# Only refill small enclosed holes (eyes, straps); big ones are chair/mic gaps.
solid = body.copy()
holes = ~body & ~outside
seen = np.zeros_like(holes)
for sy, sx in zip(*np.nonzero(holes)):
    if seen[sy, sx]:
        continue
    comp = [(sy, sx)]
    seen[sy, sx] = True
    i = 0
    while i < len(comp):
        y, x = comp[i]
        i += 1
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < h and 0 <= nx < w and holes[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                comp.append((ny, nx))
    if len(comp) < 6000:
        ys, xs = zip(*comp)
        solid[list(ys), list(xs)] = True

mask = Image.fromarray((solid * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5))
person = src.convert("RGBA")
person.putalpha(mask)
person.save("person.png")

# White sticker outline: dilate the silhouette.
outline = Image.fromarray((solid * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(29)).filter(ImageFilter.GaussianBlur(1.2))
sticker = Image.new("RGBA", (w, h), (255, 255, 255, 0))
sticker.putalpha(outline)
sticker.alpha_composite(person)
sticker.save("person_sticker.png")
print("ok", int(solid.sum()))
