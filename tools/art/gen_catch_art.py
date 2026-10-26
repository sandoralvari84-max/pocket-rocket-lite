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
    # Player = the Pocket Rocket, in feel not copy: amber chrome rocket-fighter,
    # cyan porthole cockpit (the emblem's eye), twin thruster flames. Nose up.
    W = 240
    im, d = P.canvas(W)
    P.glow(im, 120, 150, 76, AMBER, 44)                       # warm hull aura
    # twin thruster flames (drawn behind the hull)
    for tx in (100, 140):
        P.glow(im, tx, 208, 20, AMBER, 160)
        d.polygon([(tx - 11, 188), (tx, 234), (tx + 11, 188)], fill=AMBER + (255,))
        d.polygon([(tx - 6, 188), (tx, 218), (tx + 6, 188)], fill=(255, 244, 210, 255))
        d.polygon([(tx - 3, 188), (tx, 208), (tx + 3, 188)], fill=(255, 255, 255, 255))
    # amber chrome hull — angular rocket with swept fins
    hull = [(120, 26), (150, 92), (200, 150), (156, 156),
            (150, 196), (90, 196), (84, 156), (40, 150), (90, 92)]
    P.poly_grad(im, hull, (255, 198, 116), (176, 92, 10))
    # central keel facet (gives the rocket a crisp spine)
    P.poly_grad(im, [(120, 40), (137, 150), (120, 190), (103, 150)],
                (255, 226, 152), (210, 120, 24), outline=None)
    # cockpit: amber ring + cyan glass dome (the emblem's porthole)
    P.ell_grad(im, [92, 70, 148, 126], (255, 222, 150), (150, 86, 8), outline=(58, 30, 6, 255), ow=5)
    P.sphere(im, [99, 77, 141, 119], (160, 246, 255), (8, 120, 150))
    P.spec(im, 112, 90, 14, 10)
    P.gloss(im, [40, 50, 200, 150])
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
