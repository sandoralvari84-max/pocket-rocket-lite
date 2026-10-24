#!/usr/bin/env python3
"""
Fleet Hunt — naval art, "Pocket Rocket nostalgia" polish (smooth gradient ocean,
chrome hulls, glowing markers). Smooth 2x->1x via shared helpers. Same filenames/
sizes so the game needs no change. Pillow, owned.
"""
import math
import os
import sys
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(__file__))
from polish import P  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "arcade", "fleet")
S = 120
OCEAN_HI = (30, 70, 112); OCEAN_DK = (8, 22, 44); SWELL = (60, 110, 158, 200)
STEEL_HI = (176, 190, 206); STEEL = (104, 120, 138); STEEL_DK = (56, 68, 84)
DECK = (80, 94, 110); GUN = (36, 44, 56)


def water(variant):
    W = 240
    im, d = P.canvas(W)
    P.rr_grad(im, [0, 0, W, W], 0, OCEAN_HI, OCEAN_DK, outline=None)
    off = 32 if variant else 0
    for yy in range(24 + off, W, 68):
        for xx in range(-20, W, 52):
            d.arc([xx, yy, xx + 40, yy + 20], 200, 340, fill=SWELL, width=4)
    d.rectangle([0, 0, W - 1, W - 1], outline=(6, 16, 32, 120), width=4)
    return P.finish(im, 120)


def ship(cells):
    w, h = cells * S * 2, S * 2
    im, d = P.canvas_wh(w, h)
    pad = 20; y0, y1 = 64, h - 64; midy = (y0 + y1) // 2
    pts = [(pad, y0), (w - pad - 60, y0), (w - pad, midy), (w - pad - 60, y1), (pad, y1)]
    P.poly_grad(im, pts, STEEL_HI, STEEL_DK)
    d.line([(pad + 12, y0 + 10), (w - pad - 76, y0 + 10)], fill=(210, 222, 236, 255), width=6)
    cx = w // 2
    P.rr_grad(im, [cx - 52, y0 - 36, cx + 20, y0 + 24], 8, (150, 166, 182), STEEL_DK)
    P.rr_grad(im, [cx - 40, y0 - 64, cx - 12, y0 - 36], 6, STEEL_HI, STEEL_DK)
    for i in range(cells):
        gx = int((i + 0.5) * S * 2)
        P.ell_grad(im, [gx - 24, midy - 24, gx + 24, midy + 24], (90, 102, 118), GUN)
        d.rectangle([gx + 16, midy - 6, gx + 52, midy + 6], fill=GUN + (255,))
    return P.finish(im, (cells * S, S))


def hit():
    W = 240
    im, d = P.canvas(W)
    cx = cy = W // 2
    P.glow(im, cx, cy, 90, (255, 120, 40), 150)
    for a in range(0, 360, 45):
        x = cx + int(math.cos(math.radians(a)) * 96); y = cy + int(math.sin(math.radians(a)) * 96)
        d.line([(cx, cy), (x, y)], fill=(255, 150, 60, 220), width=10)
    P.ell_grad(im, [cx - 78, cy - 78, cx + 78, cy + 78], (255, 170, 70), (200, 70, 30), outline=None)
    P.ell_grad(im, [cx - 40, cy - 40, cx + 40, cy + 40], (255, 244, 170), (255, 150, 50), outline=None)
    return P.finish(im, 120)


def miss():
    W = 240
    im, d = P.canvas(W)
    cx = cy = W // 2
    P.glow(im, cx, cy, 70, (120, 210, 255), 70)
    for rad, col in [(68, (120, 210, 255, 170)), (48, (200, 240, 255, 210)), (26, (255, 255, 255, 240))]:
        d.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], outline=col, width=8)
    return P.finish(im, 120)


def sunk():
    W = 240
    im, d = P.canvas(W)
    cx = cy = W // 2
    P.glow(im, cx, cy - 10, 70, (255, 120, 40), 110)
    P.poly_grad(im, [(cx - 72, cy + 48), (cx - 60, cy - 8), (cx + 60, cy - 8), (cx + 72, cy + 48)], (70, 60, 58), (34, 28, 28))
    for fx, fh, c0, c1 in [(-32, 60, (255, 180, 70), (230, 90, 30)), (4, 84, (255, 160, 60), (220, 70, 24)), (40, 52, (255, 210, 110), (230, 120, 40))]:
        P.poly_grad(im, [(cx + fx - 16, cy - 8), (cx + fx, cy - 8 - fh), (cx + fx + 16, cy - 8)], c0, c1, outline=None)
    return P.finish(im, 120)


def main():
    os.makedirs(OUT, exist_ok=True)
    water(0).save(os.path.join(OUT, "water_0.png"))
    water(1).save(os.path.join(OUT, "water_1.png"))
    ship(2).save(os.path.join(OUT, "ship2.png"))
    ship(3).save(os.path.join(OUT, "ship3.png"))
    ship(4).save(os.path.join(OUT, "ship4.png"))
    hit().save(os.path.join(OUT, "hit.png"))
    miss().save(os.path.join(OUT, "miss.png"))
    sunk().save(os.path.join(OUT, "sunk.png"))
    print("wrote polished fleet art to", os.path.normpath(OUT))


if __name__ == "__main__":
    main()
