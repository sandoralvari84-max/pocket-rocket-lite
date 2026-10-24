#!/usr/bin/env python3
"""
Draughts — board + pieces, "Pocket Rocket nostalgia" polish (smooth glossy discs,
gradient wood squares, gold crowns). Smooth 2x->1x via shared helpers. Same
filenames/sizes so the game needs no change. Pillow, owned.
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFilter
sys.path.insert(0, os.path.dirname(__file__))
from polish import P  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "arcade", "draughts")

LIGHT = ((214, 184, 136), (176, 142, 94))
DARK = ((92, 62, 42), (52, 34, 22))
AMBER = ((255, 212, 130), (255, 152, 16), (150, 80, 8), (120, 60, 4))
CYAN = ((180, 246, 255), (0, 198, 230), (0, 110, 140), (0, 56, 72))


def square(ramp):
    W = 240
    im, d = P.canvas(W)
    P.rr_grad(im, [0, 0, W, W], 0, ramp[0], ramp[1], outline=None)
    grain = (ramp[1][0] + 14, ramp[1][1] + 10, ramp[1][2] + 8, 150)
    for y in range(12, W, 22):
        d.line([(0, y), (W, y + 3)], fill=grain, width=3)
    d.line([(0, 1), (W, 1)], fill=(255, 255, 255, 40), width=3)
    d.rectangle([0, 0, W - 1, W - 1], outline=(0, 0, 0, 40), width=3)
    return P.finish(im, 120)


def disc(ramp, crown=False):
    hi, base, rim, edge = ramp
    W = 240
    im, d = P.canvas(W)
    sh = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse([44, 64, W - 28, W - 16], fill=(0, 0, 0, 120))
    im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(10)))
    cx, cy, r = W // 2, W // 2 - 8, 88
    P.ell_grad(im, [cx - r, cy - r, cx + r, cy + r], hi, edge, outline=rim + (255,), ow=8)
    d.ellipse([cx - 52, cy - 52, cx + 52, cy + 52], outline=rim + (255,), width=6)
    P.ell_grad(im, [cx - 44, cy - 44, cx + 44, cy + 44], hi, base, outline=None)
    P.spec(im, cx - 26, cy - 28, 20, 14)
    if crown:
        gold_hi, gold = (255, 236, 160), (210, 160, 44)
        band = cy + 18
        P.rr_grad(im, [cx - 44, band, cx + 44, band + 16], 4, gold_hi, gold)
        xs = [cx - 44, cx - 14, cx + 14, cx + 44]
        for i, px in enumerate((cx - 30, cx, cx + 30)):
            P.poly_grad(im, [(xs[i], band), (px, band - 44), (xs[i + 1], band)], gold_hi, gold, outline=None)
            d.ellipse([px - 8, band - 60, px + 8, band - 44], fill=gold_hi + (255,))
    return P.finish(im, 120)


def main():
    os.makedirs(OUT, exist_ok=True)
    square(LIGHT).save(os.path.join(OUT, "square_light.png"))
    square(DARK).save(os.path.join(OUT, "square_dark.png"))
    disc(AMBER).save(os.path.join(OUT, "man_amber.png"))
    disc(CYAN).save(os.path.join(OUT, "man_cyan.png"))
    disc(AMBER, crown=True).save(os.path.join(OUT, "king_amber.png"))
    disc(CYAN, crown=True).save(os.path.join(OUT, "king_cyan.png"))
    print("wrote polished squares + man/king to", os.path.normpath(OUT))


if __name__ == "__main__":
    main()
