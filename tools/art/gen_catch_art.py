#!/usr/bin/env python3
"""
Dot Catcher — player ship + collectible orb + stars. ORIGINAL owned art (Pillow),
"Pocket Rocket nostalgia" polish: smooth 2x->1x, gradient hull, glass cockpit,
chrome, thruster glow, soft gloss. Same filenames/sizes so the game needs no change.
"""
import os
import sys
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(__file__))
from polish import P  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "arcade", "catch")

HULL_HI = (170, 220, 250); HULL = (80, 150, 210); HULL_DK = (36, 80, 126)
GLASS_HI = (210, 248, 255); GLASS_DK = (90, 170, 205)
AMBER = (255, 170, 40); AMBER_HI = (255, 214, 140)
CYAN = (40, 224, 255); CYAN_DK = (6, 130, 160)


def ship():
    W = 240
    im, d = P.canvas(W)
    P.glow(im, 120, 150, 70, (90, 160, 220), 46)
    # twin thruster flames (behind)
    for tx in (92, 148):
        P.glow(im, tx, 196, 22, AMBER, 150)
        d.polygon([(tx - 10, 176), (tx, 220), (tx + 10, 176)], fill=AMBER + (255,))
        d.polygon([(tx - 5, 176), (tx, 206), (tx + 5, 176)], fill=(255, 240, 200, 255))
    # hull — swept wing
    P.poly_grad(im, [(120, 36), (210, 140), (176, 184), (64, 184), (30, 140)], HULL_HI, HULL_DK)
    # cockpit glass
    P.poly_grad(im, [(120, 74), (152, 132), (88, 132)], GLASS_HI, GLASS_DK)
    d.ellipse([110, 88, 130, 108], fill=(255, 255, 255, 120))
    P.gloss(im, [30, 60, 210, 150])
    return P.finish(im, 120)


def orb():
    W = 240
    im, d = P.canvas(W)
    P.glow(im, 120, 120, 96, CYAN, 90)
    P.ell_grad(im, [54, 54, 186, 186], (150, 244, 255), CYAN_DK, outline=(4, 90, 110, 255), ow=5)
    P.ell_grad(im, [84, 84, 156, 156], AMBER_HI, (190, 110, 12), outline=None)
    P.spec(im, 104, 100, 20, 14)
    return P.finish(im, 120)


def star(sz):
    im, d = P.canvas_wh(sz * 2 + 4, sz * 2 + 4)
    c = sz + 2
    d.ellipse([c - sz, c - sz, c + sz, c + sz], fill=(235, 242, 255, 235))
    return im


def main():
    os.makedirs(OUT, exist_ok=True)
    ship().save(os.path.join(OUT, "ship.png"))
    orb().save(os.path.join(OUT, "orb.png"))
    star(3).save(os.path.join(OUT, "star_s.png"))
    star(5).save(os.path.join(OUT, "star_m.png"))
    star(8).save(os.path.join(OUT, "star_l.png"))
    print("wrote polished ship, orb, stars to", os.path.normpath(OUT))


if __name__ == "__main__":
    main()
