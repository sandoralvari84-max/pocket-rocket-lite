#!/usr/bin/env python3
"""
Rocket Raid — the 8 BOSS sprites + mine/pod hazards. ORIGINAL owned art (Pillow),
"Pocket Rocket nostalgia" polish: chrome-nostalgia finish via polish.P
(poly_grad / ell_grad / rr_grad / sphere / gloss / glow / spec), top-left light,
brand amber EXACTLY #FF9800, cyan #00E5FF, soft dark outlines.

Each boss is drawn to the behaviour in docs/games/ROCKET_RAID.md so the silhouette
reads its role:
  carrier(bays) interceptor(swept) turret(wall+emitter) hive(cells+core)
  dreadnought(battleship+core) minelayer(dispenser bays) mirror(twin halves)
  warden(panel ring + core)

Output (all 256 square, contain-scaled in-game):
  boss_carrier/interceptor/turret/hive/dreadnought/minelayer/mirror/warden.png
Plus hazards: mine.png 120, pod.png 96  (hive swarm pod).

NOTE: generated blind (no visual check) — ALL need a human visual review.
"""
import os
import sys
import math
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(__file__))
from polish import P  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "arcade", "catch")
OUTLN = (20, 26, 38, 255)

STEEL_HI = (210, 220, 232); STEEL = (140, 152, 168); STEEL_DK = (72, 82, 98)
CYAN = (0, 229, 255); CYAN_HI = (180, 250, 255); CYAN_DK = (6, 130, 160)
GLASS_HI = (210, 248, 255); GLASS_DK = (90, 170, 205)
AMBER = (255, 152, 0); AMBER_HI = (255, 196, 110); AMBER_DK = (150, 80, 6)
FOE_HI = (240, 150, 128); FOE = (196, 86, 72); FOE_DK = (116, 40, 36)
CORE_HI = (200, 252, 255); CORE_DK = (10, 120, 150)


def carrier():
    W = 512; im, d = P.canvas(W); cx = 256
    P.glow(im, cx, 250, 150, AMBER, 40)
    P.poly_grad(im, [(cx, 120), (440, 210), (440, 300), (360, 340), (152, 340), (72, 300), (72, 210)], AMBER_HI, AMBER_DK)
    P.poly_grad(im, [(cx, 140), (300, 300), (212, 300)], STEEL_HI, STEEL_DK, outline=None)
    for bx in (150, 362):
        P.glow(im, bx, 300, 34, CYAN, 120)
        P.rr_grad(im, [bx - 34, 268, bx + 34, 330], 10, CYAN_HI, CYAN_DK)
        d.rounded_rectangle([bx - 22, 282, bx + 22, 324], 6, fill=(8, 40, 56, 255))
    P.sphere(im, [cx - 44, 170, cx + 44, 258], GLASS_HI, GLASS_DK)
    P.gloss(im, [80, 150, 432, 300])
    return P.finish(im, 256)


def interceptor():
    W = 512; im, d = P.canvas(W); cx = 256
    P.glow(im, cx, 250, 140, CYAN, 44)
    for tx in (150, 362):
        P.glow(im, tx, 150, 24, CYAN, 150)
        d.ellipse([tx - 20, 120, tx + 20, 180], fill=CYAN + (255,))
    P.poly_grad(im, [(cx, 382), (430, 182), (330, 132), (182, 132), (82, 182)], AMBER_HI, AMBER_DK)
    P.poly_grad(im, [(cx, 300), (470, 250), (360, 172)], STEEL_HI, STEEL_DK, outline=None)
    P.poly_grad(im, [(cx, 300), (42, 250), (152, 172)], STEEL_HI, STEEL_DK, outline=None)
    P.poly_grad(im, [(cx, 360), (292, 182), (220, 182)], AMBER_HI, (120, 64, 4), outline=None)
    P.sphere(im, [cx - 40, 172, cx + 40, 252], GLASS_HI, GLASS_DK)
    P.gloss(im, [90, 150, 420, 280])
    return P.finish(im, 256)


def turret():
    W = 512; im, d = P.canvas(W); cx = 256
    P.glow(im, cx, 230, 150, STEEL, 40)
    P.rr_grad(im, [60, 150, 452, 310], 24, STEEL_HI, STEEL_DK)
    for rx in (120, cx, 392):
        P.rr_grad(im, [rx - 30, 170, rx + 30, 290], 10, (170, 182, 198), (70, 80, 96), outline=None)
    # central laser emitter
    P.glow(im, cx, 304, 48, CYAN, 150)
    P.rr_grad(im, [cx - 30, 250, cx + 30, 330], 8, CYAN_HI, CYAN_DK)
    d.ellipse([cx - 26, 300, cx + 26, 352], fill=CYAN + (255,))
    for tx in (110, 402):
        P.rr_grad(im, [tx - 14, 290, tx + 14, 352], 6, AMBER_HI, AMBER_DK)
    P.gloss(im, [70, 150, 442, 248])
    return P.finish(im, 256)


def hive():
    W = 512; im, d = P.canvas(W); cx = 256
    P.glow(im, cx, 250, 150, AMBER, 46)
    hexp = [(cx, 120), (410, 190), (410, 310), (cx, 380), (102, 310), (102, 190)]
    P.poly_grad(im, hexp, AMBER_HI, AMBER_DK)
    for (cxx, cyy) in [(180, 220), (332, 220), (180, 300), (332, 300)]:
        P.glow(im, cxx, cyy, 22, CYAN, 110)
        P.sphere(im, [cxx - 26, cyy - 26, cxx + 26, cyy + 26], CYAN_HI, CYAN_DK)
    P.glow(im, cx, 258, 42, CYAN, 160)
    P.sphere(im, [cx - 42, 216, cx + 42, 300], CORE_HI, CORE_DK)
    P.gloss(im, [110, 150, 410, 258])
    return P.finish(im, 256)


def dreadnought():
    W = 512; im, d = P.canvas(W); cx = 256
    P.glow(im, cx, 250, 172, AMBER, 40)
    P.poly_grad(im, [(cx, 110), (470, 210), (470, 320), (380, 372), (132, 372), (42, 320), (42, 210)], STEEL_HI, STEEL_DK)
    P.poly_grad(im, [(cx, 140), (420, 220), (420, 300), (92, 300), (92, 220)], AMBER_HI, AMBER_DK, outline=None)
    for gx in (120, 180, 332, 392):
        P.rr_grad(im, [gx - 16, 300, gx + 16, 362], 6, STEEL_HI, STEEL_DK)
    # central exposable core
    P.glow(im, cx, 250, 58, CYAN, 150)
    P.sphere(im, [cx - 52, 198, cx + 52, 302], CORE_HI, CORE_DK)
    d.ellipse([cx - 24, 226, cx + 24, 274], fill=(255, 244, 210, 255))
    P.gloss(im, [60, 140, 452, 280])
    return P.finish(im, 256)


def minelayer():
    W = 512; im, d = P.canvas(W); cx = 256
    P.glow(im, cx, 250, 150, AMBER, 44)
    P.rr_grad(im, [90, 150, 422, 322], 26, AMBER_HI, AMBER_DK)
    for bx in (150, cx, 362):
        P.glow(im, bx, 322, 24, CYAN, 120)
        d.ellipse([bx - 28, 300, bx + 28, 356], fill=(10, 16, 26, 255))
        d.ellipse([bx - 28, 300, bx + 28, 356], outline=CYAN + (255,), width=6)
    P.sphere(im, [cx - 44, 170, cx + 44, 250], GLASS_HI, GLASS_DK)
    for sx in range(120, 392, 56):
        d.polygon([(sx, 158), (sx + 26, 158), (sx + 10, 184), (sx - 16, 184)], fill=(20, 26, 38, 180))
    P.gloss(im, [100, 150, 412, 248])
    return P.finish(im, 256)


def mirror():
    W = 512; im, d = P.canvas(W); cx = 256
    P.glow(im, cx, 250, 150, CYAN, 44)
    P.poly_grad(im, [(cx, 120), (cx, 380), (120, 320), (80, 200)], STEEL_HI, STEEL_DK)
    P.poly_grad(im, [(cx, 120), (cx, 380), (392, 320), (432, 200)], (220, 228, 240), (80, 90, 106))
    P.glow(im, cx, 250, 20, CYAN, 160)
    d.rectangle([cx - 5, 130, cx + 5, 372], fill=CYAN_DK + (255,))
    for ex in (176, 336):
        P.sphere(im, [ex - 30, 210, ex + 30, 270], CYAN_HI, CYAN_DK)
    P.gloss(im, [80, 150, 432, 258])
    return P.finish(im, 256)


def warden():
    W = 512; im, d = P.canvas(W); cx = 256; cy = 250
    P.glow(im, cx, cy, 172, CYAN, 40)
    R = 150
    for i in range(10):
        if i in (2, 7):   # the two gaps you thread
            continue
        a0 = i * 36 + 4; a1 = i * 36 + 32
        d.pieslice([cx - R, cy - R, cx + R, cy + R], a0, a1, fill=STEEL + (255,), outline=OUTLN, width=4)
    P.ell_grad(im, [cx - 96, cy - 96, cx + 96, cy + 96], (60, 70, 86), (30, 38, 52))
    P.glow(im, cx, cy, 52, CYAN, 160)
    P.sphere(im, [cx - 56, cy - 56, cx + 56, cy + 56], CORE_HI, CORE_DK)
    d.ellipse([cx - 20, cy - 20, cx + 20, cy + 20], fill=(255, 244, 210, 255))
    P.gloss(im, [cx - 150, cy - 150, cx + 150, cy - 20])
    return P.finish(im, 256)


def mine():
    W = 200; im, d = P.canvas(W); c = 100
    P.glow(im, c, c, 54, FOE, 70)
    for k in range(8):
        a = k * math.pi / 4
        x1 = c + math.cos(a) * 52; y1 = c + math.sin(a) * 52
        x2 = c + math.cos(a) * 86; y2 = c + math.sin(a) * 86
        d.line([x1, y1, x2, y2], fill=STEEL_DK + (255,), width=12)
        d.ellipse([x2 - 9, y2 - 9, x2 + 9, y2 + 9], fill=STEEL + (255,))
    P.sphere(im, [c - 54, c - 54, c + 54, c + 54], STEEL_HI, STEEL_DK)
    P.glow(im, c, c, 18, AMBER, 190)
    d.ellipse([c - 14, c - 14, c + 14, c + 14], fill=AMBER + (255,))
    return P.finish(im, 120)


def pod():
    W = 160; im, d = P.canvas(W)
    P.glow(im, 80, 80, 44, CYAN, 130)
    P.sphere(im, [30, 30, 130, 130], CORE_HI, CORE_DK)
    d.ellipse([64, 64, 96, 96], fill=(8, 40, 56, 255))
    return P.finish(im, 96)


def main():
    os.makedirs(OUT, exist_ok=True)
    jobs = {
        "boss_carrier.png": carrier, "boss_interceptor.png": interceptor,
        "boss_turret.png": turret, "boss_hive.png": hive,
        "boss_dreadnought.png": dreadnought, "boss_minelayer.png": minelayer,
        "boss_mirror.png": mirror, "boss_warden.png": warden,
        "mine.png": mine, "pod.png": pod,
    }
    for name, fn in jobs.items():
        fn().save(os.path.join(OUT, name))
    print("wrote 8 bosses + mine + pod to", os.path.normpath(OUT))


if __name__ == "__main__":
    main()
