#!/usr/bin/env python3
"""
Nav-bar icons — Chat / Games / Tools / Settings — in the SAME filled-gloss,
warm-glow grammar as the game icons (replaces the Unicode glyph placeholders
▭ ◉ ▤ ▦). Drawn at 4x then LANCZOS to 96px, transparent background. Full-colour;
the tab bar shows active state via its LED + label (inactive icons dim slightly).

Regenerate: python tools/art/gen_nav_icons.py
"""
import math
import os
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "ui", "nav")
WS = 384
C = WS // 2

AMBER = (255, 170, 40); AMBER_HI = (255, 214, 140); AMBER_DK = (190, 110, 12)
CYAN = (40, 224, 255); CYAN_HI = (190, 248, 255); CYAN_DK = (6, 140, 170)
RED = (255, 96, 86); RED_HI = (255, 170, 150); RED_DK = (170, 44, 40)
STEEL = (176, 190, 206); STEEL_HI = (232, 240, 248); STEEL_DK = (92, 104, 122)
OUT_C = (20, 26, 38, 255)


def canvas():
    im = Image.new("RGBA", (WS, WS), (0, 0, 0, 0))
    return im, ImageDraw.Draw(im)


def finish(im):
    return im.resize((96, 96), Image.LANCZOS)


def glow(im, cx, cy, r, rgb, a=70):
    g = Image.new("RGBA", (WS, WS), (0, 0, 0, 0))
    ImageDraw.Draw(g).ellipse([cx - r, cy - r, cx + r, cy + r], fill=rgb + (a,))
    im.alpha_composite(g.filter(ImageFilter.GaussianBlur(r * 0.42)))


def _grad(w, h, top, bot):
    g = Image.new("RGBA", (w, h)); px = g.load()
    for y in range(h):
        t = y / max(1, h - 1)
        col = (int(top[0] + (bot[0] - top[0]) * t), int(top[1] + (bot[1] - top[1]) * t),
               int(top[2] + (bot[2] - top[2]) * t), 255)
        for x in range(w):
            px[x, y] = col
    return g


def ell_grad(im, box, top, bot, outline=OUT_C, ow=6):
    x0, y0, x1, y1 = [int(v) for v in box]; w, h = x1 - x0, y1 - y0
    if w <= 0 or h <= 0:
        return
    m = Image.new("L", (w, h), 0); ImageDraw.Draw(m).ellipse([0, 0, w - 1, h - 1], fill=255)
    im.paste(_grad(w, h, top, bot), (x0, y0), m)
    if outline:
        ImageDraw.Draw(im).ellipse(box, outline=outline, width=ow)


def rr_grad(im, box, r, top, bot, outline=OUT_C, ow=6):
    x0, y0, x1, y1 = [int(v) for v in box]; w, h = x1 - x0, y1 - y0
    if w <= 0 or h <= 0:
        return
    m = Image.new("L", (w, h), 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, w - 1, h - 1], r, fill=255)
    im.paste(_grad(w, h, top, bot), (x0, y0), m)
    if outline:
        ImageDraw.Draw(im).rounded_rectangle(box, r, outline=outline, width=ow)


def ring(im, box, top, bot, inner=0.5):
    x0, y0, x1, y1 = [int(v) for v in box]; w, h = x1 - x0, y1 - y0
    m = Image.new("L", (w, h), 0); md = ImageDraw.Draw(m)
    md.ellipse([0, 0, w - 1, h - 1], fill=255)
    iw, ih = int(w * inner), int(h * inner); ix, iy = (w - iw) // 2, (h - ih) // 2
    md.ellipse([ix, iy, ix + iw, iy + ih], fill=0)
    im.paste(_grad(w, h, top, bot), (x0, y0), m)
    ImageDraw.Draw(im).ellipse(box, outline=OUT_C, width=6)


def gloss(im, box):
    x0, y0, x1, y1 = box
    g = Image.new("RGBA", (WS, WS), (0, 0, 0, 0))
    ImageDraw.Draw(g).ellipse([x0 + (x1 - x0) * 0.16, y0 + (y1 - y0) * 0.08,
                               x1 - (x1 - x0) * 0.16, y0 + (y1 - y0) * 0.42], fill=(255, 255, 255, 90))
    im.alpha_composite(g.filter(ImageFilter.GaussianBlur(6)))


def spec(im, cx, cy, rx, ry, a=210):
    g = Image.new("RGBA", (WS, WS), (0, 0, 0, 0))
    ImageDraw.Draw(g).ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=(255, 255, 255, a))
    im.alpha_composite(g.filter(ImageFilter.GaussianBlur(7)))


def chat():
    im, d = canvas(); glow(im, C, C, 130, CYAN, 40)
    rr_grad(im, [54, 66, 330, 246], 56, CYAN_HI, CYAN_DK)        # bubble
    g = Image.new("RGBA", (WS, WS), (0, 0, 0, 0))
    ImageDraw.Draw(g).polygon([(108, 236), (176, 236), (108, 320)], fill=CYAN_DK + (255,))  # tail
    im.alpha_composite(g)
    d.polygon([(108, 236), (176, 236), (108, 320)], outline=OUT_C, width=6)
    gloss(im, [54, 66, 330, 246])
    for x in (130, 192, 254):                                    # dots
        d.ellipse([x - 16, 140, x + 16, 172], fill=(20, 60, 80, 255))
    return finish(im)


def games():
    im, d = canvas(); glow(im, C, C, 130, RED, 40)
    ell_grad(im, [96, 250, 288, 334], STEEL, STEEL_DK)           # base
    rr_grad(im, [176, 150, 208, 276], 14, STEEL_HI, STEEL_DK)    # shaft
    ell_grad(im, [138, 92, 246, 200], RED_HI, RED_DK)            # ball top
    spec(im, 170, 122, 20, 14)
    return finish(im)


def tools():
    im, d = canvas(); glow(im, C, C, 130, AMBER, 36)
    # spanner: diagonal handle + ring head (reads as a wrench)
    g = Image.new("RGBA", (WS, WS), (0, 0, 0, 0))
    ImageDraw.Draw(g).polygon([(96, 300), (140, 324), (262, 158), (218, 134)], fill=AMBER + (255,))
    im.alpha_composite(g)
    d.polygon([(96, 300), (140, 324), (262, 158), (218, 134)], outline=OUT_C, width=6)
    ring(im, [200, 68, 320, 188], AMBER_HI, AMBER_DK, inner=0.44)  # head
    spec(im, 238, 104, 13, 10)
    return finish(im)


def settings():
    im, d = canvas(); glow(im, C, C, 130, CYAN, 34)
    # gear teeth (8), as rounded rects around the hub
    teeth = Image.new("RGBA", (WS, WS), (0, 0, 0, 0)); td = ImageDraw.Draw(teeth)
    for k in range(8):
        a = k * math.pi / 4
        tx, ty = C + math.cos(a) * 118, C + math.sin(a) * 118
        td.ellipse([tx - 34, ty - 34, tx + 34, ty + 34], fill=STEEL + (255,), outline=OUT_C, width=5)
    im.alpha_composite(teeth)
    ell_grad(im, [96, 96, 288, 288], STEEL_HI, STEEL_DK)         # body
    gloss(im, [96, 96, 288, 288])
    ell_grad(im, [156, 156, 228, 228], (40, 52, 70), (18, 24, 36))  # centre hole
    spec(im, 150, 150, 16, 11)
    return finish(im)


def library():
    im, d = canvas(); glow(im, C, C, 130, AMBER, 38)
    # a stack of three slabs (books / saved material) in the console grammar
    rr_grad(im, [86, 224, 300, 292], 16, STEEL_HI, STEEL_DK)       # bottom book
    rr_grad(im, [96, 168, 290, 232], 16, AMBER_HI, AMBER_DK)       # middle book (amber)
    rr_grad(im, [110, 110, 276, 176], 16, CYAN_HI, CYAN_DK)        # top book (cyan)
    gloss(im, [110, 110, 276, 176])
    for x in (126, 158, 190, 222):                                 # spine ticks
        d.line([(x, 182), (x, 226)], fill=(90, 50, 8, 210), width=5)
    return finish(im)


ICONS = {"chat": chat, "games": games, "tools": tools, "library": library, "settings": settings}


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, fn in ICONS.items():
        fn().save(os.path.join(OUT, f"{name}.png"))
    print(f"wrote {len(ICONS)} nav icons to", os.path.normpath(OUT))


if __name__ == "__main__":
    main()
