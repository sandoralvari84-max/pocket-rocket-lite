#!/usr/bin/env python3
"""
Dot Catcher (shooter) — enemy craft + plasma bolt. ORIGINAL owned art (Pillow),
"Pocket Rocket nostalgia" polish: smooth 2x->1x, gradient hulls, glass, glow, chrome.
Same filenames/sizes so the game needs no change.
  drone.png 120  gunship.png 120  bolt.png 64
"""
import os
import sys
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(__file__))
from polish import P  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "arcade", "catch")

FOE_HI = (240, 150, 128); FOE = (196, 86, 72); FOE_DK = (116, 40, 36)
STEEL_HI = (210, 220, 232); STEEL = (140, 152, 168); STEEL_DK = (72, 82, 98)
CYAN = (40, 224, 255); CYAN_DK = (6, 130, 160)
GLASS_HI = (210, 248, 255); GLASS_DK = (90, 170, 205)


def drone():
    W = 240
    im, d = P.canvas(W)
    P.glow(im, 120, 150, 66, FOE, 48)
    # engine pods (cyan glow)
    for tx in (76, 164):
        P.glow(im, tx, 70, 16, CYAN, 150)
        d.ellipse([tx - 12, 56, tx + 12, 80], fill=CYAN + (255,))
    # swept scout, nose down
    P.poly_grad(im, [(120, 200), (196, 80), (144, 68), (96, 68), (44, 80)], FOE_HI, FOE_DK)
    # cockpit eye
    P.ell_grad(im, [94, 78, 146, 130], GLASS_HI, GLASS_DK)
    d.ellipse([110, 94, 130, 114], fill=FOE_DK + (255,))
    P.gloss(im, [48, 72, 196, 150])
    return P.finish(im, 120)


def gunship():
    W = 240
    im, d = P.canvas(W)
    P.glow(im, 120, 140, 70, STEEL, 40)
    # twin cannons
    for tx in (70, 170):
        P.rr_grad(im, [tx - 12, 110, tx + 12, 196], 6, STEEL_HI, STEEL_DK)
        P.glow(im, tx, 196, 12, (255, 170, 40), 130)
    # heavy hull
    P.poly_grad(im, [(120, 196), (210, 110), (168, 66), (72, 66), (30, 110)], STEEL_HI, STEEL_DK)
    P.poly_grad(im, [(120, 190), (190, 110), (50, 110)], FOE_HI, FOE_DK)
    P.ell_grad(im, [96, 78, 144, 118], GLASS_HI, GLASS_DK)
    P.gloss(im, [30, 66, 210, 140])
    return P.finish(im, 120)


def bolt():
    W = 128
    im, d = P.canvas(W)
    P.glow(im, W // 2, W // 2, 26, CYAN, 150)
    P.rr_grad(im, [W // 2 - 12, 12, W // 2 + 12, W - 12], 12, (190, 248, 255), CYAN_DK, outline=None)
    d.rounded_rectangle([W // 2 - 4, 20, W // 2 + 4, W - 20], 4, fill=(245, 252, 255, 255))
    return P.finish(im, 64)


def main():
    os.makedirs(OUT, exist_ok=True)
    drone().save(os.path.join(OUT, "drone.png"))
    gunship().save(os.path.join(OUT, "gunship.png"))
    bolt().save(os.path.join(OUT, "bolt.png"))
    print("wrote polished drone, gunship, bolt to", os.path.normpath(OUT))


if __name__ == "__main__":
    main()
