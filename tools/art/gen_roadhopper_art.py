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
import math
from PIL import Image, ImageDraw, ImageFilter
sys.path.insert(0, os.path.dirname(__file__))
from polish import P  # noqa: E402

OUT = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "assets", "arcade", "roadhopper"))
os.makedirs(OUT, exist_ok=True)

# Brand accents (LOCKED amber #FF9800, cyan #00E5FF) — subtle, tie sprites to the app.
ACC_AMBER = (255, 152, 0)
ACC_CYAN = (0, 229, 255)
OUT_SOFT = (20, 26, 38, 255)  # soft dark outline (matches polish OUT_C)
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


# ---- HOPPER (player) — redesigned: characterful frog, subtle cyan/amber brand -----
# Keeps the critter identity (domed body, big raised eyes, smile, splayed legs) but
# adds a cyan racing collar + amber spots so it reads as the app's mascot. Frames:
# idle (sitting), hop (stretched + legs/arms out), squash (flattened death), splash.
def _hopper_face(im, d, ey):
    for ex in (74, 118):
        # raised eye mound then glossy eyeball + forward pupil + glint
        P.ell_grad(im, [ex - 19, ey - 23, ex + 19, ey + 13], LIME_HI, LIME, outline=OUT_SOFT, ow=3)
        P.ell_grad(im, [ex - 13, ey - 16, ex + 13, ey + 10], (250, 252, 255), (205, 214, 224), outline=OUT_SOFT, ow=3)
        d.ellipse([ex - 5, ey - 8, ex + 7, ey + 6], fill=(20, 26, 36, 255))
        d.ellipse([ex - 3, ey - 7, ex + 2, ey - 2], fill=(255, 255, 255, 235))
    # wide friendly smile
    d.arc([80, ey + 4, 112, ey + 34], 18, 162, fill=(26, 58, 32, 230), width=5)


def _hopper_brand(im, d, box):
    x0, y0, x1, y1 = box
    midy = (y0 + y1) // 2
    # cyan collar stripe
    d.line([(x0 + 16, midy + 10), (x1 - 16, midy + 10)], fill=ACC_CYAN + (210,), width=5)
    # amber back spots
    for (sx, sy) in ((x0 + 26, midy + 28), (x1 - 30, midy + 30), ((x0 + x1) // 2, midy + 42)):
        if y0 < sy < y1:
            d.ellipse([sx - 6, sy - 6, sx + 6, sy + 6], fill=ACC_AMBER + (235,))


def hopper(jump):
    W = 192
    im, d = P.canvas(W)
    P.glow(im, 96, 108, 66, LIME, 42)
    if jump:
        shadow(im, [72, 152, 120, 168], a=58)
        # extended back legs + front arms reaching forward (leaping)
        P.ell_grad(im, [48, 116, 78, 170], LIME, LIME_DK, ow=4)
        P.ell_grad(im, [114, 116, 144, 170], LIME, LIME_DK, ow=4)
        P.ell_grad(im, [60, 56, 82, 96], LIME, LIME_DK, ow=4)
        P.ell_grad(im, [110, 56, 132, 96], LIME, LIME_DK, ow=4)
        box = [60, 22, 132, 150]
        P.ell_grad(im, box, LIME_HI, LIME_DK)
        ey = 56
    else:
        shadow(im, [52, 152, 140, 176], a=72)
        # tucked back legs
        P.ell_grad(im, [30, 118, 74, 166], LIME, LIME_DK, ow=4)
        P.ell_grad(im, [118, 118, 162, 166], LIME, LIME_DK, ow=4)
        box = [40, 68, 152, 162]
        P.ell_grad(im, box, LIME_HI, LIME_DK)
        ey = 90
    _hopper_face(im, d, ey)
    _hopper_brand(im, d, box)
    P.gloss(im, [box[0], box[1], box[2], (box[1] + box[3]) // 2 + 8])
    return P.finish(im, 96)


def hopper_squash():
    W = 192
    im, d = P.canvas(W)
    shadow(im, [28, 150, 164, 178], a=96)
    # splayed flattened legs
    P.ell_grad(im, [8, 118, 56, 152], LIME, LIME_DK, ow=4)
    P.ell_grad(im, [136, 118, 184, 152], LIME, LIME_DK, ow=4)
    # flattened body
    P.ell_grad(im, [22, 104, 170, 160], LIME_HI, LIME_DK)
    # dizzy X eyes
    for ex in (74, 118):
        P.ell_grad(im, [ex - 15, 106, ex + 15, 134], (250, 252, 255), (205, 214, 224), outline=OUT_SOFT, ow=3)
        d.line([(ex - 7, 112), (ex + 7, 128)], fill=(30, 36, 46, 255), width=4)
        d.line([(ex + 7, 112), (ex - 7, 128)], fill=(30, 36, 46, 255), width=4)
    d.arc([82, 136, 110, 152], 200, 340, fill=(26, 58, 32, 230), width=4)
    return P.finish(im, 96)


def hopper_splash():
    W = 192
    im, d = P.canvas(W)
    # concentric water rings (cyan-tinted) + droplets + sinking frog hint
    for i, r in enumerate((30, 50, 72)):
        a = 210 - i * 58
        d.ellipse([96 - r, 108 - r * 0.5, 96 + r, 108 + r * 0.5], outline=(150, 210, 245, a), width=6)
    for (x, y) in ((58, 64), (134, 68), (48, 112), (144, 114), (96, 44)):
        d.ellipse([x - 6, y - 6, x + 6, y + 6], fill=(192, 228, 250, 230))
    P.ell_grad(im, [66, 96, 126, 134], LIME, LIME_DK, ow=3)
    d.line([(96, 108), (96, 108)], fill=ACC_CYAN + (255,), width=2)
    return P.finish(im, 96)


# ---- 7. MOTORCYCLE: narrow, quick, dark frame + red tank, rider hump (1-wide) ---
MOTO = ((66, 72, 86), (20, 22, 30))


def motorcycle():
    W = 192
    im, d = P.canvas(W)
    shadow(im, [54, 152, 138, 174])
    wheels(im, d, (62, 130), y0=120, y1=168, r=24)
    P.poly_grad(im, [(66, 134), (126, 134), (120, 108), (84, 106)], MOTO[0], MOTO[1])
    P.rr_grad(im, [80, 96, 120, 118], 8, (214, 64, 56), (120, 22, 20))  # fuel tank
    P.ell_grad(im, [84, 58, 124, 112], (46, 50, 60), (16, 18, 26))      # rider hump
    d.line([(120, 104), (142, 94)], fill=(184, 190, 200, 255), width=5)  # handlebar
    headlight(im, d, 140, 120)
    taillight(d, 58, 112)
    return P.finish(im, 96)


# ---- 8. BUS: long cream body, amber transit band, window row (3-wide) -----------
def bus():
    W, H = 576, 192
    im, d = P.canvas_wh(W, H)
    shadow(im, [40, 152, 548, 182])
    wheels(im, d, (120, 300, 456))
    P.rr_grad(im, [18, 56, 558, 150], 20, (236, 240, 246), (150, 156, 166))
    d.rectangle([18, 118, 558, 136], fill=ACC_AMBER + (235,))  # livery band
    for i in range(8):
        x = 46 + i * 62
        P.rr_grad(im, [x, 72, x + 46, 108], 6, GLASS_HI, GLASS_DK, outline=None)
    P.poly_grad(im, [(522, 72), (548, 80), (548, 112), (522, 112)], GLASS_HI, GLASS_DK, outline=None)
    d.line([(96, 108), (96, 150)], fill=(40, 60, 70, 200), width=4)  # door seam
    P.gloss(im, [18, 56, 558, 118])
    headlight(im, d, 548, 128)
    taillight(d, 24, 120)
    return P.finish(im, (288, 96))


# ---- 9. AMBULANCE: white box, red cross + stripe, roof light bar (2-wide) --------
# The flashing red/cyan beacon is animated in-game over the roof bar (center-top).
def ambulance():
    W, H = 384, 192
    im, d = P.canvas_wh(W, H)
    shadow(im, [34, 152, 360, 182])
    wheels(im, d, (96, 288))
    P.rr_grad(im, [16, 66, 300, 152], 12, (244, 246, 250), (186, 192, 200))
    P.poly_grad(im, [(300, 92), (368, 98), (368, 152), (300, 152)], (238, 242, 248), (176, 184, 194))
    P.poly_grad(im, [(306, 100), (358, 102), (358, 124), (306, 124)], GLASS_HI, GLASS_DK, outline=None)
    d.rectangle([16, 112, 300, 130], fill=(228, 60, 52, 235))  # red stripe
    d.rectangle([150 - 9, 80, 150 + 9, 110], fill=(228, 60, 52, 255))  # cross V
    d.rectangle([150 - 18, 89, 150 + 18, 101], fill=(228, 60, 52, 255))  # cross H
    P.rr_grad(im, [120, 52, 200, 66], 4, (214, 218, 224), (150, 154, 162))  # roof bar base
    P.gloss(im, [16, 66, 300, 112])
    headlight(im, d, 366, 132)
    taillight(d, 20, 100)
    return P.finish(im, (192, 96))


# ---- 10. LOG: floating wooden log, bark lines, end rings, wet gloss (3-wide) -----
LOG = ((152, 106, 60), (92, 56, 26))


def log_ride():
    W, H = 576, 192
    im, d = P.canvas_wh(W, H)
    for (x, y) in ((70, 150), (300, 156), (500, 150)):
        d.ellipse([x - 32, y - 6, x + 32, y + 6], fill=(120, 180, 220, 120))  # wake
    P.rr_grad(im, [8, 70, 568, 150], 40, LOG[0], LOG[1])
    for ly in (92, 112, 132):
        d.line([(44, ly), (532, ly)], fill=(70, 42, 18, 150), width=3)  # bark
    for ex in (44, 532):
        P.ell_grad(im, [ex - 28, 78, ex + 28, 142], (184, 136, 86), (120, 78, 38), ow=4)
        d.ellipse([ex - 16, 94, ex + 16, 126], outline=(96, 62, 30, 220), width=3)
        d.ellipse([ex - 7, 104, ex + 7, 116], outline=(96, 62, 30, 220), width=2)
    P.gloss(im, [8, 70, 568, 108])
    return P.finish(im, (288, 96))


# ---- 11. TURTLE: domed hex shell, head + flippers; dive = submerged ripple -------
TURT = ((100, 184, 112), (40, 110, 60))


def turtle(sub=False):
    W = 192
    im, d = P.canvas(W)
    if sub:
        for i, r in enumerate((30, 52)):
            d.ellipse([96 - r, 112 - r * 0.45, 96 + r, 112 + r * 0.45], outline=(150, 210, 245, 160 - i * 44), width=5)
        P.ell_grad(im, [56, 94, 136, 140], (78, 148, 98), (38, 98, 58), ow=3)  # faint shell underwater
        return P.finish(im, 96)
    d.ellipse([44, 150, 148, 170], fill=(120, 180, 220, 120))  # wake
    P.ell_grad(im, [120, 92, 158, 126], TURT[0], TURT[1], ow=3)       # head
    d.ellipse([146, 102, 155, 111], fill=(20, 26, 36, 255))          # eye
    for fb in ([30, 120, 72, 150], [120, 120, 162, 150], [46, 70, 86, 98], [106, 70, 146, 98]):
        P.ell_grad(im, fb, TURT[0], TURT[1], ow=3)                    # flippers
    P.ell_grad(im, [40, 72, 136, 150], (96, 176, 108), (40, 110, 60))  # shell dome
    d.ellipse([74, 92, 104, 122], outline=(28, 84, 48, 220), width=3)  # hex center
    for ang in range(0, 360, 60):
        rx = 88 + 26 * math.cos(math.radians(ang))
        ry = 108 + 26 * math.sin(math.radians(ang))
        d.line([(88, 108), (rx, ry)], fill=(28, 84, 48, 180), width=2)
    P.spec(im, 70, 90, 12, 8)
    return P.finish(im, 96)


# ---- 12. TRAIN: sleek express loco, cyan/amber speed stripe, cab (4-wide) --------
TRAIN = ((74, 90, 114), (26, 34, 54))


def train():
    W, H = 768, 192
    im, d = P.canvas_wh(W, H)
    shadow(im, [40, 152, 740, 184])
    wheels(im, d, (120, 230, 540, 650))
    P.rr_grad(im, [12, 44, 756, 150], 18, TRAIN[0], TRAIN[1])
    P.poly_grad(im, [(700, 44), (756, 72), (756, 150), (700, 150)], (92, 110, 138), (30, 40, 62))  # nose
    d.rectangle([12, 104, 756, 115], fill=ACC_CYAN + (230,))   # speed stripes
    d.rectangle([12, 118, 756, 126], fill=ACC_AMBER + (220,))
    P.poly_grad(im, [(706, 58), (748, 76), (748, 100), (706, 100)], GLASS_HI, GLASS_DK, outline=None)  # cab
    for i in range(6):
        x = 56 + i * 108
        P.rr_grad(im, [x, 58, x + 72, 96], 6, GLASS_HI, GLASS_DK, outline=None)  # windows
    P.gloss(im, [12, 44, 756, 102])
    headlight(im, d, 752, 134)
    return P.finish(im, (384, 96))


# ---- 13. BARRIER: striped construction board on posts, amber lamp (2-wide) -------
def barrier():
    W, H = 384, 192
    im, d = P.canvas_wh(W, H)
    shadow(im, [40, 152, 352, 178])
    P.rr_grad(im, [22, 148, 46, 178], 3, (120, 124, 132), (70, 74, 82))   # posts
    P.rr_grad(im, [338, 148, 362, 178], 3, (120, 124, 132), (70, 74, 82))
    P.rr_grad(im, [16, 96, 368, 140], 6, (255, 170, 40), (180, 110, 10))  # board
    for sx in range(16, 352, 44):                                         # hazard stripes
        d.polygon([(sx, 96), (sx + 20, 96), (sx + 40, 140), (sx + 20, 140)], fill=(30, 32, 38, 255))
    P.glow(im, 192, 84, 14, ACC_AMBER, 150)
    d.ellipse([184, 76, 200, 92], fill=ACC_AMBER + (255,))                # warning lamp
    return P.finish(im, (192, 96))


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
    hopper_squash().save(os.path.join(OUT, "hopper_squash.png"))
    hopper_splash().save(os.path.join(OUT, "hopper_splash.png"))
    # expanded roster (overhaul 2026-10-26)
    motorcycle().save(os.path.join(OUT, "motorcycle.png"))
    bus().save(os.path.join(OUT, "bus.png"))
    ambulance().save(os.path.join(OUT, "ambulance.png"))
    log_ride().save(os.path.join(OUT, "log.png"))
    turtle(False).save(os.path.join(OUT, "turtle.png"))
    turtle(True).save(os.path.join(OUT, "turtle_dive.png"))
    train().save(os.path.join(OUT, "train.png"))
    barrier().save(os.path.join(OUT, "barrier.png"))

    def grass_fx(im, d):
        # sunlit mown verge along the top edge (reads as a tidy bank)
        d.rectangle([0, 0, 128, 7], fill=(98, 186, 108, 255))
        d.rectangle([0, 7, 128, 10], fill=(74, 160, 86, 160))
        # turf flecks for texture
        for (x, y) in ((40, 60), (70, 30), (90, 80), (20, 100), (110, 92), (60, 116)):
            d.ellipse([x, y, x + 3, y + 3], fill=(58, 140, 70, 180))
        # blades
        for (x, y) in ((24, 36), (80, 54), (52, 92), (104, 24), (34, 108), (100, 104), (14, 72), (120, 58)):
            d.line([(x, y), (x, y - 12)], fill=(150, 220, 150, 255), width=3)
        # soft shadowed bottom edge
        d.rectangle([0, 122, 128, 128], fill=(32, 92, 44, 150))
    tile((62, 150, 78), (40, 110, 54), grass_fx).save(os.path.join(OUT, "grass.png"))

    def road_fx(im, d):
        # subtle asphalt grain (baked, zero runtime cost): a few light + dark flecks
        for (x, y) in ((18, 40), (54, 22), (92, 60), (30, 96), (108, 34), (72, 104), (44, 70), (120, 86)):
            d.rectangle([x, y, x + 3, y + 3], fill=(74, 80, 92, 90))
        for (x, y) in ((26, 64), (82, 44), (100, 100), (14, 20), (60, 86), (116, 52)):
            d.rectangle([x, y, x + 3, y + 3], fill=(30, 33, 40, 110))
        # crisp lane seam at the top: dark shadow + thin light highlight below it
        d.rectangle([0, 0, 128, 7], fill=(24, 27, 33, 255))
        d.rectangle([0, 7, 128, 9], fill=(78, 84, 96, 120))
        # subtle shade at the bottom so stacked road lanes read as banded
        d.rectangle([0, 122, 128, 128], fill=(30, 33, 40, 120))
    tile((58, 63, 74), (40, 44, 52), road_fx).save(os.path.join(OUT, "road.png"))

    def line_fx(im, d):
        d.rounded_rectangle([44, 56, 84, 72], 6, fill=(220, 210, 150, 255))
    tile((58, 63, 74), (40, 44, 52), line_fx).save(os.path.join(OUT, "road_line.png"))

    def water_fx(im, d):
        # top sheen line
        d.rectangle([0, 0, 128, 5], fill=(120, 196, 240, 120))
        # calm ripples (varied alpha, each with a faint shadow stroke) — kept subtle so
        # logs/turtles stay the brightest things on the row and read clearly
        for (x, y), a in (((12, 30), 220), ((70, 50), 150), ((34, 84), 190),
                          ((92, 102), 150), ((54, 22), 120), ((100, 66), 170), ((20, 110), 130)):
            d.line([(x, y), (x + 22, y)], fill=(150, 210, 245, a), width=3)
            d.line([(x + 4, y + 4), (x + 18, y + 4)], fill=(60, 120, 180, 120), width=2)
        # darker depth at the bottom edge
        d.rectangle([0, 122, 128, 128], fill=(26, 70, 128, 120))
    tile((70, 150, 220), (32, 86, 150), water_fx).save(os.path.join(OUT, "water.png"))

    def rail_fx(im, d):
        # ballast gravel speckle between the ties
        for (x, y) in ((16, 60), (50, 30), (90, 100), (120, 70), (36, 108), (72, 20)):
            d.rectangle([x, y, x + 3, y + 3], fill=(120, 112, 96, 150))
        # trains run left<->right, so steel rails are HORIZONTAL; ties are vertical bars
        for tx in range(8, 128, 26):
            d.rectangle([tx, 10, tx + 13, 118], fill=(96, 70, 40, 255))      # wooden ties
        for ry in (40, 86):
            d.rectangle([0, ry - 5, 128, ry + 5], fill=(150, 156, 166, 255))  # steel rail
            d.rectangle([0, ry - 5, 128, ry - 1], fill=(200, 206, 214, 255))  # rail top highlight
    tile((56, 52, 48), (34, 32, 30), rail_fx).save(os.path.join(OUT, "rail.png"))

    names = ["hopper_idle", "hopper_hop", "hopper_squash", "hopper_splash",
             "car_red", "car_blue", "bug", "taxi", "van", "truck",
             "motorcycle", "bus", "ambulance", "log", "turtle", "turtle_dive",
             "train", "barrier", "grass", "road", "road_line", "water", "rail"]
    cols = 6
    rows = (len(names) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * 200, rows * 110), (40, 46, 56, 255))
    for i, n in enumerate(names):
        t = Image.open(os.path.join(OUT, n + ".png")).convert("RGBA")
        sheet.alpha_composite(t, (6 + (i % cols) * 200, 6 + (i // cols) * 110))
    sheet.save(os.path.join(os.path.dirname(__file__), "roadhopper_v2_sheet.png"))
    print("wrote overhauled road-hopper art (redesigned hopper + 13 movers + tiles) ->", OUT)


if __name__ == "__main__":
    main()
