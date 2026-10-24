#!/usr/bin/env python3
"""
Road Hopper — owned art, "Pocket Rocket nostalgia" polish (smooth, glossy, chrome).
Vehicles + hopper drawn at 2x then LANCZOS-downscaled; gradient bodies, glass
cabins, chrome wheels, headlight glow, soft ground shadow. Tiles get soft gradients.
Same filenames + aspect ratios so the game needs no code change. Pillow, owned.
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFilter
sys.path.insert(0, os.path.dirname(__file__))
from polish import P  # noqa: E402

OUT = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "assets", "arcade", "roadhopper"))
os.makedirs(OUT, exist_ok=True)

GLASS_HI = (196, 240, 255); GLASS_DK = (70, 130, 165)
HEAD = (255, 236, 150)
RED = ((248, 128, 118), (150, 36, 32))
BLUE = ((150, 200, 245), (36, 84, 150))
PURP = ((206, 160, 244), (92, 54, 150))
LIME_HI = (182, 236, 140); LIME = (120, 200, 72); LIME_DK = (66, 136, 44)


def shadow(im, box, a=90):
    g = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ImageDraw.Draw(g).ellipse(box, fill=(0, 0, 0, a))
    im.alpha_composite(g.filter(ImageFilter.GaussianBlur(8)))


def car(ramp):
    hi, sh = ramp
    W = 192
    im, d = P.canvas(W)
    shadow(im, [36, 150, 156, 178])
    for wx in (62, 130):
        P.sphere(im, [wx - 22, 120, wx + 22, 164], (40, 44, 52), (12, 14, 20), rim=(120, 128, 140))
        d.ellipse([wx - 8, 134, wx + 8, 150], fill=(150, 160, 174, 255))
    P.rr_grad(im, [24, 96, 168, 150], 18, hi, sh)
    P.poly_grad(im, [(60, 96), (132, 96), (116, 54), (76, 54)], hi, sh)
    P.poly_grad(im, [(74, 92), (92, 92), (90, 62), (80, 62)], GLASS_HI, GLASS_DK, outline=None)
    P.poly_grad(im, [(100, 92), (118, 92), (112, 62), (98, 62)], GLASS_HI, GLASS_DK, outline=None)
    P.gloss(im, [24, 92, 168, 150])
    P.glow(im, 162, 120, 16, HEAD, 150); d.ellipse([156, 112, 170, 126], fill=HEAD + (255,))
    d.ellipse([22, 112, 34, 126], fill=(230, 70, 60, 255))
    return P.finish(im, 96)


def truck():
    W, H = 384, 192
    im, d = P.canvas_wh(W, H)
    shadow(im, [40, 150, 360, 180])
    for wx in (80, 176, 300):
        P.sphere(im, [wx - 22, 120, wx + 22, 164], (40, 44, 52), (12, 14, 20), rim=(120, 128, 140))
    P.rr_grad(im, [16, 56, 248, 150], 10, (238, 240, 244), (150, 152, 158))
    P.gloss(im, [16, 56, 248, 150])
    P.rr_grad(im, [248, 84, 368, 150], 10, (255, 200, 110), (184, 100, 10))
    P.poly_grad(im, [(252, 88), (318, 88), (318, 112), (252, 112)], GLASS_HI, GLASS_DK, outline=None)
    P.glow(im, 362, 120, 14, HEAD, 140); d.ellipse([356, 112, 372, 128], fill=HEAD + (255,))
    return P.finish(im, (192, 96))


def hopper(jump):
    W = 192
    im, d = P.canvas(W)
    P.glow(im, 96, 110, 70, LIME, 40)
    if jump:
        shadow(im, [70, 150, 122, 168], a=70)
        P.ell_grad(im, [58, 20, 134, 150], LIME_HI, LIME_DK)
        ey = 64
        P.gloss(im, [48, 30, 144, 120])
    else:
        shadow(im, [52, 150, 140, 174], a=80)
        P.ell_grad(im, [40, 66, 152, 162], LIME_HI, LIME_DK)
        ey = 92
        P.gloss(im, [44, 60, 148, 120])
    for ex in (76, 116):
        P.ell_grad(im, [ex - 16, ey - 16, ex + 16, ey + 16], (250, 252, 255), (200, 210, 220))
        d.ellipse([ex - 6, ey - 6, ex + 7, ey + 7], fill=(20, 26, 36, 255))
        d.ellipse([ex - 4, ey - 6, ex + 1, ey - 1], fill=(255, 255, 255, 230))
    return P.finish(im, 96)


def tile(top, bot, fn=None):
    W = 128
    im, d = P.canvas(W)
    P.rr_grad(im, [0, 0, W, W], 0, top, bot, outline=None)
    if fn:
        fn(im, d)
    return P.finish(im, 48)


def main():
    car(RED).save(os.path.join(OUT, "car_red.png"))
    car(BLUE).save(os.path.join(OUT, "car_blue.png"))
    car(PURP).save(os.path.join(OUT, "bug.png"))
    truck().save(os.path.join(OUT, "truck.png"))
    hopper(False).save(os.path.join(OUT, "hopper_idle.png"))
    hopper(True).save(os.path.join(OUT, "hopper_hop.png"))

    def grass_fx(im, d):
        for (x, y) in ((24, 36), (80, 54), (52, 92), (104, 24), (34, 108), (100, 104)):
            d.line([(x, y), (x, y - 12)], fill=(150, 220, 150, 255), width=3)
    tile((62, 150, 78), (40, 110, 54), grass_fx).save(os.path.join(OUT, "grass.png"))

    def road_fx(im, d):
        d.rectangle([0, 0, 128, 6], fill=(26, 29, 35, 255))
    tile((58, 63, 74), (40, 44, 52), road_fx).save(os.path.join(OUT, "road.png"))

    def line_fx(im, d):
        d.rounded_rectangle([44, 56, 84, 72], 6, fill=(220, 210, 150, 255))
    tile((58, 63, 74), (40, 44, 52), line_fx).save(os.path.join(OUT, "road_line.png"))

    def water_fx(im, d):
        for (x, y) in ((16, 34), (70, 54), (36, 86), (92, 104)):
            d.line([(x, y), (x + 20, y)], fill=(150, 210, 245, 220), width=3)
    tile((70, 150, 220), (32, 86, 150), water_fx).save(os.path.join(OUT, "water.png"))

    names = ["hopper_idle", "hopper_hop", "car_red", "car_blue", "bug", "truck", "grass", "road", "road_line", "water"]
    sheet = Image.new("RGBA", (5 * 110, 2 * 110), (40, 46, 56, 255))
    for i, n in enumerate(names):
        t = Image.open(os.path.join(OUT, n + ".png")).convert("RGBA")
        sheet.alpha_composite(t, (6 + (i % 5) * 110, 6 + (i // 5) * 110))
    sheet.save(os.path.join(os.path.dirname(__file__), "roadhopper_v2_sheet.png"))
    print("wrote polished road-hopper ->", OUT)


if __name__ == "__main__":
    main()
