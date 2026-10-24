#!/usr/bin/env python3
"""
Road Hopper — owned art, "Pocket Rocket nostalgia" polish (smooth, glossy, chrome).

Six DISTINCT, lovingly crafted vehicles (no recolored clones): a low sports coupe,
a rounded classic sedan, a bubble beetle, a checker taxi with a roof light, a tall
delivery van, and an articulated semi. Drawn at 2x then LANCZOS-downscaled; gradient
bodies, glass cabins, chrome wheels, headlight glow, taillights, soft ground shadow.
Filenames + aspect ratios unchanged so the game needs no code change. Pillow, owned.
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFilter
sys.path.insert(0, os.path.dirname(__file__))
from polish import P  # noqa: E402

OUT = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "assets", "arcade", "roadhopper"))
os.makedirs(OUT, exist_ok=True)

GLASS_HI = (200, 242, 255); GLASS_DK = (66, 128, 164)
HEAD = (255, 236, 150)
TAIL = (236, 72, 60)
CHROME_HI = (238, 244, 250); CHROME = (176, 186, 198)
# body ramps (highlight, shadow)
RED = ((252, 104, 92), (146, 24, 22))        # sports coupe
BLUE = ((150, 198, 246), (28, 74, 144))      # classic sedan
BUG = ((255, 226, 118), (208, 150, 22))      # bubble beetle
TAXI = ((255, 208, 72), (198, 120, 10))      # taxi
VAN = ((126, 220, 212), (26, 118, 118))      # delivery van
TRK = ((238, 240, 244), (150, 152, 158))     # semi tractor box


def shadow(im, box, a=90):
    g = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ImageDraw.Draw(g).ellipse(box, fill=(0, 0, 0, a))
    im.alpha_composite(g.filter(ImageFilter.GaussianBlur(8)))


def wheels(im, d, xs, y0=118, y1=162, r=22):
    for wx in xs:
        P.sphere(im, [wx - r, y0, wx + r, y1], (48, 52, 62), (12, 14, 20), rim=(142, 150, 162))
        cy = (y0 + y1) // 2
        d.ellipse([wx - 7, cy - 8, wx + 7, cy + 8], fill=(172, 180, 192, 255))  # hubcap


def headlight(im, d, x, y):
    P.glow(im, x, y, 15, HEAD, 150)
    d.ellipse([x - 7, y - 7, x + 7, y + 7], fill=HEAD + (255,))


def taillight(d, x, y):
    d.ellipse([x - 6, y - 7, x + 6, y + 7], fill=TAIL + (255,))


# ---- 1. SPORTS COUPE: low wedge, raked glass, rear spoiler, racing stripe -----
def coupe():
    W = 192
    im, d = P.canvas(W)
    shadow(im, [34, 150, 160, 178])
    wheels(im, d, (60, 134), y0=120, y1=160, r=20)
    # long low body + pointed nose
    P.poly_grad(im, [(16, 140), (24, 112), (150, 104), (176, 124), (176, 140)], RED[0], RED[1])
    # swept cabin
    P.poly_grad(im, [(58, 108), (120, 104), (112, 76), (82, 76)], RED[0], RED[1])
    P.poly_grad(im, [(70, 100), (108, 97), (103, 80), (85, 80)], GLASS_HI, GLASS_DK, outline=None)
    # rear spoiler
    P.rr_grad(im, [14, 98, 40, 108], 4, CHROME_HI, CHROME)
    # racing stripe down the hood
    d.line([(60, 110), (150, 108)], fill=(255, 250, 240, 230), width=5)
    P.gloss(im, [24, 104, 176, 140])
    headlight(im, d, 170, 122)
    taillight(d, 20, 120)
    return P.finish(im, 96)


# ---- 2. CLASSIC SEDAN: tall rounded greenhouse, chrome bumpers -----------------
def sedan():
    W = 192
    im, d = P.canvas(W)
    shadow(im, [34, 150, 160, 178])
    wheels(im, d, (60, 132))
    P.rr_grad(im, [18, 104, 174, 152], 18, BLUE[0], BLUE[1])
    # rounded 3-window cabin
    P.rr_grad(im, [54, 66, 138, 108], 14, BLUE[0], BLUE[1])
    for gx in ((60, 86), (90, 116), (120, 132)):
        P.poly_grad(im, [(gx[0], 100), (gx[1], 100), (gx[1] - 3, 74), (gx[0] + 3, 74)],
                    GLASS_HI, GLASS_DK, outline=None)
    # chrome bumpers + side trim
    P.rr_grad(im, [14, 134, 30, 146], 4, CHROME_HI, CHROME)
    P.rr_grad(im, [162, 134, 178, 146], 4, CHROME_HI, CHROME)
    d.line([(22, 128), (170, 128)], fill=CHROME_HI + (220,), width=4)
    P.gloss(im, [18, 104, 174, 148])
    headlight(im, d, 168, 120)
    taillight(d, 22, 120)
    return P.finish(im, 96)


# ---- 3. BUBBLE BEETLE: one rounded shell, round window, running board ----------
def beetle():
    W = 192
    im, d = P.canvas(W)
    P.glow(im, 96, 112, 60, BUG[0], 30)
    shadow(im, [40, 150, 152, 176])
    wheels(im, d, (58, 134), y0=122, y1=160, r=20)
    # domed shell
    P.ell_grad(im, [22, 68, 170, 158], BUG[0], BUG[1])
    # wrap-around window
    P.ell_grad(im, [66, 80, 140, 124], GLASS_HI, GLASS_DK, outline=None)
    d.line([(103, 82), (103, 122)], fill=(40, 60, 80, 160), width=4)  # centre pillar
    # running board + fender line
    d.arc([22, 96, 170, 176], 20, 160, fill=(150, 110, 10, 200), width=5)
    P.spec(im, 70, 92, 16, 10)
    headlight(im, d, 158, 120)
    taillight(d, 30, 120)
    return P.finish(im, 96)


# ---- 4. TAXI: sedan body, checker band, roof light ----------------------------
def taxi():
    W = 192
    im, d = P.canvas(W)
    shadow(im, [34, 150, 160, 178])
    wheels(im, d, (60, 132))
    P.rr_grad(im, [18, 102, 174, 152], 14, TAXI[0], TAXI[1])
    # cabin
    P.rr_grad(im, [56, 68, 134, 106], 10, TAXI[0], TAXI[1])
    P.poly_grad(im, [(62, 100), (128, 100), (122, 74), (68, 74)], GLASS_HI, GLASS_DK, outline=None)
    # roof light
    P.glow(im, 95, 58, 14, HEAD, 150)
    P.rr_grad(im, [82, 50, 108, 66], 4, (255, 240, 180), (210, 150, 40))
    # checker band
    for i in range(10):
        x = 22 + i * 15
        col = (28, 30, 36, 255) if i % 2 == 0 else (248, 248, 246, 255)
        d.rectangle([x, 120, x + 15, 134], fill=col)
    P.gloss(im, [18, 102, 174, 118])
    headlight(im, d, 168, 118)
    taillight(d, 22, 118)
    return P.finish(im, 96)


# ---- 5. DELIVERY VAN: tall boxy body, big windshield, sliding door seam --------
def van():
    W = 192
    im, d = P.canvas(W)
    shadow(im, [34, 150, 162, 178])
    wheels(im, d, (56, 140), y0=122, y1=162, r=21)
    P.rr_grad(im, [18, 70, 176, 154], 12, VAN[0], VAN[1])
    # cab nose (front right) + big windshield
    P.poly_grad(im, [(176, 86), (176, 126), (136, 126), (144, 82)], VAN[0], VAN[1], outline=None)
    P.poly_grad(im, [(170, 90), (170, 118), (142, 118), (147, 88)], GLASS_HI, GLASS_DK, outline=None)
    # side window + sliding door seam
    P.rr_grad(im, [42, 84, 112, 112], 6, GLASS_HI, GLASS_DK, outline=None)
    d.line([(120, 72), (120, 152)], fill=(20, 60, 60, 200), width=4)
    d.line([(30, 132), (170, 132)], fill=CHROME_HI + (160,), width=3)
    P.gloss(im, [18, 70, 176, 120])
    headlight(im, d, 170, 128)
    taillight(d, 22, 96)
    return P.finish(im, 96)


# ---- 6. SEMI TRUCK: tractor + cargo box, grille, stack, mudflaps (2-wide) ------
def truck():
    W, H = 384, 192
    im, d = P.canvas_wh(W, H)
    shadow(im, [40, 150, 360, 180])
    wheels(im, d, (80, 176, 300))
    # cargo trailer
    P.rr_grad(im, [16, 54, 250, 150], 8, TRK[0], TRK[1])
    for sx in (70, 124, 178, 232):
        d.line([(sx, 60), (sx, 144)], fill=(120, 122, 128, 180), width=3)  # panel seams
    P.gloss(im, [16, 54, 250, 150])
    # tractor cab
    P.rr_grad(im, [250, 80, 368, 150], 10, (255, 196, 96), (176, 92, 8))
    P.poly_grad(im, [(256, 86), (320, 86), (320, 112), (256, 112)], GLASS_HI, GLASS_DK, outline=None)
    # grille + chrome bumper
    for gy in range(118, 142, 6):
        d.line([(344, gy), (366, gy)], fill=CHROME + (255,), width=3)
    P.rr_grad(im, [336, 142, 372, 152], 3, CHROME_HI, CHROME)
    # exhaust stack behind cab
    P.rr_grad(im, [248, 40, 262, 92], 4, CHROME_HI, CHROME)
    # mudflaps
    for mx in (300,):
        d.rectangle([mx + 18, 150, mx + 30, 172], fill=(26, 28, 34, 255))
    headlight(im, d, 362, 124)
    return P.finish(im, (192, 96))


# ---- hopper (player) -----------------------------------------------------------
LIME_HI = (182, 236, 140); LIME = (120, 200, 72); LIME_DK = (66, 136, 44)


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
    coupe().save(os.path.join(OUT, "car_red.png"))     # sports coupe
    sedan().save(os.path.join(OUT, "car_blue.png"))    # classic sedan
    beetle().save(os.path.join(OUT, "bug.png"))        # bubble beetle
    taxi().save(os.path.join(OUT, "taxi.png"))         # checker taxi
    van().save(os.path.join(OUT, "van.png"))           # delivery van
    truck().save(os.path.join(OUT, "truck.png"))       # articulated semi
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

    names = ["hopper_idle", "hopper_hop", "car_red", "car_blue", "bug", "taxi",
             "van", "truck", "grass", "road", "road_line", "water"]
    sheet = Image.new("RGBA", (6 * 110, 2 * 110), (40, 46, 56, 255))
    for i, n in enumerate(names):
        t = Image.open(os.path.join(OUT, n + ".png")).convert("RGBA")
        sheet.alpha_composite(t, (6 + (i % 6) * 110, 6 + (i // 6) * 110))
    sheet.save(os.path.join(os.path.dirname(__file__), "roadhopper_v2_sheet.png"))
    print("wrote polished road-hopper (6 distinct vehicles) ->", OUT)


if __name__ == "__main__":
    main()
