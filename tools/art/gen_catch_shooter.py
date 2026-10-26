#!/usr/bin/env python3
"""
Rocket Raid (shooter) — enemy craft + plasma bolt. ORIGINAL owned art (Pillow),
"Pocket Rocket nostalgia" polish: smooth 2x->1x, gradient hulls, glass, glow, chrome.
Same filenames/sizes for the originals so the game needs no change.

Originals:  drone.png 120   gunship.png 120   bolt.png 64
Added for Rocket Raid (enemy variety): strafer / shielded / splitter / kamikaze /
sniper (all 120), ebolt.png 48 (enemy plasma).
"""
import os
import sys
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(__file__))
from polish import P  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "arcade", "catch")

FOE_HI = (240, 150, 128); FOE = (196, 86, 72); FOE_DK = (116, 40, 36)
STEEL_HI = (210, 220, 232); STEEL = (140, 152, 168); STEEL_DK = (72, 82, 98)
CYAN = (0, 229, 255); CYAN_HI = (180, 250, 255); CYAN_DK = (6, 130, 160)
GLASS_HI = (210, 248, 255); GLASS_DK = (90, 170, 205)
# Brand amber EXACTLY #FF9800 = (255,152,0) — never #FF9810.
AMBER = (255, 152, 0); AMBER_HI = (255, 196, 110); AMBER_DK = (150, 80, 6)


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


def strafer():
    # Fast side-dashing interceptor; nose to the RIGHT, rear thrusters LEFT.
    W = 240
    im, d = P.canvas(W)
    P.glow(im, 120, 120, 60, AMBER, 46)
    for ty in (96, 144):
        P.glow(im, 52, ty, 14, CYAN, 150)
        d.ellipse([42, ty - 9, 64, ty + 9], fill=CYAN + (255,))
    # swept dart pointing right
    P.poly_grad(im, [(206, 120), (150, 74), (70, 86), (54, 120), (70, 154), (150, 166)], AMBER_HI, AMBER_DK)
    # wing slashes
    P.poly_grad(im, [(120, 80), (96, 42), (150, 74)], STEEL_HI, STEEL_DK, outline=None)
    P.poly_grad(im, [(120, 160), (96, 198), (150, 166)], STEEL_HI, STEEL_DK, outline=None)
    # cockpit near nose
    P.ell_grad(im, [150, 100, 186, 140], GLASS_HI, GLASS_DK)
    P.spec(im, 162, 112, 8, 6)
    P.gloss(im, [54, 74, 206, 122])
    return P.finish(im, 120)


def shielded():
    # Steel/amber hull behind a CONVEX cyan frontal shield plate (flank to kill).
    W = 240
    im, d = P.canvas(W)
    P.glow(im, 120, 146, 58, STEEL, 40)
    P.poly_grad(im, [(120, 206), (188, 128), (150, 86), (90, 86), (52, 128)], STEEL_HI, STEEL_DK)
    P.poly_grad(im, [(120, 196), (170, 128), (70, 128)], AMBER_HI, AMBER_DK, outline=None)
    P.ell_grad(im, [100, 108, 140, 146], GLASS_HI, GLASS_DK)
    # frontal energy shield (cyan arc across the top/front)
    P.glow(im, 120, 72, 74, CYAN, 70)
    d.arc([34, 18, 206, 170], 200, 340, fill=CYAN + (255,), width=12)
    d.arc([44, 26, 196, 162], 206, 334, fill=CYAN_HI + (230,), width=5)
    P.gloss(im, [52, 86, 188, 146])
    return P.finish(im, 120)


def splitter():
    # Rounded pod with a bright central seam + two cyan cells; it dies into two.
    W = 240
    im, d = P.canvas(W)
    P.glow(im, 120, 120, 64, AMBER, 50)
    P.rr_grad(im, [54, 62, 186, 182], 40, AMBER_HI, AMBER_DK)
    # cyan cells either side of the seam
    for cxx in (92, 148):
        P.glow(im, cxx, 122, 18, CYAN, 120)
        P.sphere(im, [cxx - 22, 100, cxx + 22, 144], CYAN_HI, CYAN_DK)
    # splitting seam
    P.glow(im, 120, 122, 14, CYAN, 150)
    d.rectangle([116, 64, 124, 180], fill=(8, 40, 56, 255))
    P.gloss(im, [60, 70, 180, 130])
    return P.finish(im, 120)


def kamikaze():
    # Aggressive dive-dart, nose DOWN (toward the player), red + amber warning.
    W = 240
    im, d = P.canvas(W)
    P.glow(im, 120, 120, 62, FOE, 62)
    P.glow(im, 120, 72, 18, AMBER, 170)
    P.poly_grad(im, [(120, 210), (174, 100), (120, 68), (66, 100)], FOE_HI, FOE_DK)
    # amber warning chevron
    P.poly_grad(im, [(120, 156), (150, 112), (90, 112)], AMBER_HI, AMBER_DK, outline=None)
    P.ell_grad(im, [102, 96, 138, 132], GLASS_HI, GLASS_DK)
    P.gloss(im, [66, 88, 174, 140])
    return P.finish(im, 120)


def sniper():
    # Long-barrel marksman, nose/barrel DOWN, cyan scope lens eye.
    W = 240
    im, d = P.canvas(W)
    P.glow(im, 120, 134, 58, STEEL, 42)
    P.rr_grad(im, [112, 118, 128, 214], 6, STEEL_HI, STEEL_DK)
    P.glow(im, 120, 208, 10, CYAN, 150)
    P.poly_grad(im, [(120, 150), (184, 112), (150, 66), (90, 66), (56, 112)], STEEL_HI, STEEL_DK)
    P.glow(im, 120, 96, 20, CYAN, 140)
    P.sphere(im, [100, 76, 140, 116], CYAN_HI, CYAN_DK)
    P.gloss(im, [56, 66, 184, 120])
    return P.finish(im, 120)


def bolt():
    W = 128
    im, d = P.canvas(W)
    P.glow(im, W // 2, W // 2, 26, CYAN, 150)
    P.rr_grad(im, [W // 2 - 12, 12, W // 2 + 12, W - 12], 12, (190, 248, 255), CYAN_DK, outline=None)
    d.rounded_rectangle([W // 2 - 4, 20, W // 2 + 4, W - 20], 4, fill=(245, 252, 255, 255))
    return P.finish(im, 64)


def ebolt():
    # Enemy plasma slug — hot amber/red core so it reads clearly against cyan fire.
    W = 96
    im, d = P.canvas(W)
    c = W // 2
    P.glow(im, c, c, 26, FOE, 160)
    P.ell_grad(im, [c - 22, c - 22, c + 22, c + 22], (255, 210, 150), (150, 40, 30), outline=None)
    d.ellipse([c - 9, c - 9, c + 9, c + 9], fill=(255, 246, 220, 255))
    return P.finish(im, 48)


def main():
    os.makedirs(OUT, exist_ok=True)
    drone().save(os.path.join(OUT, "drone.png"))
    gunship().save(os.path.join(OUT, "gunship.png"))
    strafer().save(os.path.join(OUT, "strafer.png"))
    shielded().save(os.path.join(OUT, "shielded.png"))
    splitter().save(os.path.join(OUT, "splitter.png"))
    kamikaze().save(os.path.join(OUT, "kamikaze.png"))
    sniper().save(os.path.join(OUT, "sniper.png"))
    bolt().save(os.path.join(OUT, "bolt.png"))
    ebolt().save(os.path.join(OUT, "ebolt.png"))
    print("wrote enemies (drone,gunship,strafer,shielded,splitter,kamikaze,sniper) + bolt,ebolt to",
          os.path.normpath(OUT))


if __name__ == "__main__":
    main()
