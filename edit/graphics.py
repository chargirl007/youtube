"""Render the transparent 1280x720 text overlays for the Natural Hair 2027 edit.

Every layer is a full-frame RGBA PNG so the renderer can stack them with a
plain overlay=0:0. Text lives in the left third of the frame (the empty wall
beside the speaker) on a soft warm-brown panel for legibility.
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1280, 720
CREAM = (246, 238, 226, 255)
CREAM_SOFT = (246, 238, 226, 200)
SAGE = (176, 192, 156, 255)
PANEL = (48, 33, 25, 155)

INTER = "/usr/share/fonts/opentype/inter/Inter-{}.otf"
HERE = os.path.dirname(os.path.abspath(__file__))
LORA_ITALIC = os.path.join(HERE, "fonts", "Lora-Italic.ttf")
LORA = os.path.join(HERE, "fonts", "Lora-Medium.ttf")

LEFT = 58          # left margin of every text block
PANEL_PAD = 24
MAX_RIGHT = 410    # panels must stay on the wall, clear of the speaker


def inter(weight, size):
    return ImageFont.truetype(INTER.format(weight), size)


def lora(size, italic=False):
    return ImageFont.truetype(LORA_ITALIC if italic else LORA, size)


def blank():
    return Image.new("RGBA", (W, H), (0, 0, 0, 0))


def text_w(font, s, tracking=0):
    return font.getlength(s) + tracking * max(0, len(s) - 1)


def draw_text(d, xy, s, font, fill=CREAM, tracking=0):
    """Draw text with optional letter spacing (tracking, in px)."""
    x, y = xy
    if not tracking:
        d.text((x, y), s, font=font, fill=fill)
        return
    for ch in s:
        d.text((x, y), ch, font=font, fill=fill)
        x += font.getlength(ch) + tracking


def panel(box, radius=18):
    """Soft rounded backing panel with a faint shadow, as its own layer."""
    img = blank()
    x0, y0, x1, y1 = box
    assert x1 <= MAX_RIGHT or y1 <= 100, f"panel reaches x={x1}, over the speaker"
    shadow = blank()
    ImageDraw.Draw(shadow).rounded_rectangle((x0, y0 + 6, x1, y1 + 6), radius, fill=(20, 12, 8, 70))
    img.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(12)))
    ImageDraw.Draw(img).rounded_rectangle(box, radius, fill=PANEL)
    return img


def layer(draw_fn):
    img = blank()
    draw_fn(ImageDraw.Draw(img))
    return img


def save(img, out_dir, name):
    img.save(os.path.join(out_dir, name + ".png"))


def wrap(font, s, max_w):
    words, lines, cur = s.split(), [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if font.getlength(trial) <= max_w or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    lines.append(cur)
    return lines


# ---------------------------------------------------------------- components

def chapter_label(out_dir, name, num, title):
    """'01 / THE SPIRITUAL RESET' top-left."""
    f_num = inter("SemiBold", 22)
    f_title = inter("SemiBold", 22)
    y = 58
    num_s, sep = num, "  /  "
    w = text_w(f_num, num_s, 3) + text_w(f_title, sep + title, 3)
    img = panel((LEFT - PANEL_PAD, y - 18, LEFT + w + PANEL_PAD, y + 40))
    d = ImageDraw.Draw(img)
    draw_text(d, (LEFT, y), num_s, f_num, SAGE, 3)
    x = LEFT + text_w(f_num, num_s, 3) + 3
    draw_text(d, (x, y), sep + title, f_title, CREAM, 3)
    save(img, out_dir, name)


def lower_third(out_dir, name, s, size=24, tracking=4):
    f = inter("SemiBold", size)
    y = 616
    w = text_w(f, s, tracking)
    img = panel((LEFT - PANEL_PAD, y - 16, LEFT + w + PANEL_PAD, y + size + 20), radius=14)
    d = ImageDraw.Draw(img)
    d.rectangle((LEFT - PANEL_PAD + 10, y - 2, LEFT - PANEL_PAD + 13, y + size + 6), fill=SAGE)
    draw_text(d, (LEFT, y), s, f, CREAM, tracking)
    save(img, out_dir, name)


def statement(out_dir, name, s, size=40, max_w=360, y_center=360):
    """A memorable line in restrained serif italic, panel + text in one layer."""
    f = lora(size, italic=True)
    lines = wrap(f, s, max_w)
    lh = int(size * 1.32)
    block_h = lh * len(lines)
    y0 = y_center - block_h // 2
    w = max(f.getlength(l) for l in lines)
    img = panel((LEFT - PANEL_PAD - 4, y0 - 34, LEFT + w + PANEL_PAD + 4, y0 + block_h + 26))
    d = ImageDraw.Draw(img)
    d.rectangle((LEFT, y0 - 16, LEFT + 36, y0 - 13), fill=SAGE)
    for i, l in enumerate(lines):
        d.text((LEFT, y0 + i * lh), l, font=f, fill=CREAM)
    save(img, out_dir, name)


def stacked_words(out_dir, prefix, words, size=40, y0=206, gap=74):
    """Four-word reset graphic: a panel layer plus one layer per word."""
    f = inter("SemiBold", size)
    tracking = 4
    w = max(text_w(f, s, tracking) for s in words)
    save(panel((LEFT - PANEL_PAD - 6, y0 - 30, LEFT + w + PANEL_PAD + 6, y0 + gap * (len(words) - 1) + size + 34)),
         out_dir, prefix + "_panel")
    for i, s in enumerate(words):
        def fn(d, i=i, s=s):
            y = y0 + i * gap
            draw_text(d, (LEFT, y), s, f, CREAM, tracking)
            d.rectangle((LEFT, y + size + 14, LEFT + 28, y + size + 16), fill=SAGE)
        save(layer(fn), out_dir, f"{prefix}_{i}")


def list_card(out_dir, prefix, heading, items, sub=None, y0=150, item_gap=58,
              heading_font=None, item_size=28, width=None, bullet="dot"):
    """Heading (+ optional sub-heading) with items revealed one by one.

    Writes <prefix>_panel (panel + heading) and <prefix>_<i> per item.
    """
    hf = heading_font or inter("SemiBold", 24)
    sf = inter("SemiBold", 18)
    itf = inter("Medium", item_size)
    head_tracking = 4 if heading_font is None else 0
    head_h = int(hf.size * 1.25)
    y_items = y0 + head_h + (40 if sub else 22) + 18
    w = width or max([text_w(hf, heading, head_tracking)] + [itf.getlength(s) + 34 for s in items])
    bottom = y_items + item_gap * (len(items) - 1) + item_size + 28
    img = panel((LEFT - PANEL_PAD - 4, y0 - 30, LEFT + w + PANEL_PAD + 4, bottom))
    d = ImageDraw.Draw(img)
    draw_text(d, (LEFT, y0), heading, hf, CREAM, head_tracking)
    if sub:
        draw_text(d, (LEFT, y0 + head_h + 8), sub, sf, SAGE, 5)
    rule_y = y_items - 20
    d.rectangle((LEFT, rule_y, LEFT + w, rule_y + 1), fill=(246, 238, 226, 70))
    save(img, out_dir, prefix + "_panel")
    for i, s in enumerate(items):
        def fn(d, i=i, s=s):
            y = y_items + i * item_gap
            cy = y + item_size * 0.58
            if bullet == "dot":
                d.ellipse((LEFT + 2, cy - 5, LEFT + 12, cy + 5), fill=SAGE)
            else:
                d.text((LEFT, y + 2), bullet, font=inter("SemiBold", item_size - 4), fill=SAGE)
            d.text((LEFT + 34, y), s, font=itf, fill=CREAM)
        save(layer(fn), out_dir, f"{prefix}_{i}")


def two_blocks(out_dir, prefix, blocks, y0=210, gap=146):
    """GOAL vs UNREALISTIC EXPECTATION, stacked (left wall is narrow)."""
    hf = inter("SemiBold", 20)
    bf = lora(32, italic=True)
    w = max(max(max(text_w(hf, l, 4) for l in h.split("\n")), bf.getlength(b)) for h, b in blocks)
    last_h = 28 * blocks[-1][0].count("\n")
    save(panel((LEFT - PANEL_PAD - 4, y0 - 32, LEFT + w + PANEL_PAD + 4, y0 + gap * (len(blocks) - 1) + last_h + 100)),
         out_dir, prefix + "_panel")
    for i, (h, b) in enumerate(blocks):
        def fn(d, i=i, h=h, b=b):
            y = y0 + i * gap
            for j, line in enumerate(h.split("\n")):
                draw_text(d, (LEFT, y + j * 28), line, hf, SAGE, 4)
            d.text((LEFT, y + 34 + 28 * h.count("\n")), b, font=bf, fill=CREAM)
            if i < len(blocks) - 1:
                d.rectangle((LEFT, y + gap - 28, LEFT + w, y + gap - 27), fill=(246, 238, 226, 70))
        save(layer(fn), out_dir, f"{prefix}_{i}")


def flow(out_dir, prefix, steps, y0=170, gap=118):
    """FRUSTRATION -> AVOIDANCE -> MORE DIFFICULTY, vertical with arrows."""
    f = inter("SemiBold", 27)
    tracking = 3
    w = max(text_w(f, s, tracking) for s in steps)
    save(panel((LEFT - PANEL_PAD - 4, y0 - 32, LEFT + w + PANEL_PAD + 4, y0 + gap * (len(steps) - 1) + 72)),
         out_dir, prefix + "_panel")
    for i, s in enumerate(steps):
        def fn(d, i=i, s=s):
            y = y0 + i * gap
            if i:
                ax, ay = LEFT + 14, y - gap + 52
                d.line((ax, ay, ax, y - 14), fill=SAGE, width=3)
                d.polygon([(ax - 9, y - 22), (ax + 9, y - 22), (ax, y - 8)], fill=SAGE)
            draw_text(d, (LEFT, y), s, f, CREAM, tracking)
        save(layer(fn), out_dir, f"{prefix}_{i}")


def stacked_lower(out_dir, name, lines, size=22, tracking=4, gap=34):
    """Short stacked lower-left card, for lines too long for one row."""
    f = inter("SemiBold", size)
    w = max(text_w(f, s, tracking) for s in lines)
    y0 = 664 - gap * len(lines)
    img = panel((LEFT - PANEL_PAD, y0 - 18, LEFT + w + PANEL_PAD + 10, y0 + gap * len(lines) + 4), radius=14)
    d = ImageDraw.Draw(img)
    d.rectangle((LEFT - PANEL_PAD + 10, y0 - 2, LEFT - PANEL_PAD + 13, y0 + gap * len(lines) - 12), fill=SAGE)
    for i, s in enumerate(lines):
        draw_text(d, (LEFT + 6, y0 + i * gap), s, f, CREAM, tracking)
    save(img, out_dir, name)


# ---------------------------------------------------------------- the video

def build(out_dir):
    os.makedirs(out_dir, exist_ok=True)

    # Hook
    stacked_words(out_dir, "p1_words", ["SPIRITUAL.", "MENTAL.", "EMOTIONAL.", "PRACTICAL."])
    statement(out_dir, "p1_newproduct", "A new product isn’t always a new approach.", size=36, max_w=300)

    # Chapter labels
    chapter_label(out_dir, "p2_label", "01", "THE SPIRITUAL RESET")
    chapter_label(out_dir, "p3_label", "02", "THE MENTAL RESET")
    chapter_label(out_dir, "p4_label", "03", "THE EMOTIONAL RESET")
    chapter_label(out_dir, "p5_label", "04", "THE PRACTICAL RESET")

    # Spiritual
    lower_third(out_dir, "p2_samuel", "1 SAMUEL 16:7")

    # Mental
    two_blocks(out_dir, "p3_goal", [("GOAL", "Gives direction"),
                                    ("UNREALISTIC\nEXPECTATION", "Creates pressure")])
    list_card(out_dir, "p3_progress", "Progress I overlooked",
              ["Less breakage", "Easier detangling", "Products that work", "Enjoying wash day"],
              heading_font=lora(30), y0=170, item_size=24, item_gap=54)

    # Emotional
    flow(out_dir, "p4_cycle", ["FRUSTRATION", "AVOIDANCE", "MORE DIFFICULTY"])
    statement(out_dir, "p4_quote",
              "You can be disappointed with a result without becoming disappointed in yourself.",
              size=32, max_w=300)

    # Practical
    list_card(out_dir, "p5_audit", "ROUTINE CHECK",
              ["Cleansing + conditioning?", "Gentle detangling?", "Low-tension styling?",
               "Breakage, tangles, scalp?", "Fits your lifestyle?"],
              y0=150, item_gap=52, item_size=22)

    # November / December plan
    list_card(out_dir, "f_nov", "November 2026", ["Perspective", "Expectations", "Emotions", "Routine"],
              sub="REFLECT", heading_font=lora(38), y0=150, item_gap=56, item_size=25, width=300)
    list_card(out_dir, "f_dec", "December 2026", ["Choose 2–3 habits", "Practice", "Notice", "Refine"],
              sub="PRACTICE", heading_font=lora(38), y0=150, item_gap=56, item_size=25, width=300)
    # Week numbers for November sit to the right of each item.
    for i in range(4):
        def fn(d, i=i):
            f = inter("Medium", 16)
            s = f"WEEK {i + 1}"
            y = 150 + int(38 * 1.25) + 40 + 18 + i * 56 + 5
            draw_text(d, (LEFT + 300 - text_w(f, s, 3), y), s, f, CREAM_SOFT, 3)
        save(layer(fn), out_dir, f"f_nov_week_{i}")

    # Conclusion
    stacked_lower(out_dir, "f_values", ["APPRECIATION.", "PATIENCE.", "CONSISTENCY."])


if __name__ == "__main__":
    build(sys.argv[1])
