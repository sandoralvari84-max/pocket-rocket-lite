#!/usr/bin/env python3
"""
Game-card icons — ORIGINAL owned art (Pillow). Rendered in the "Pocket Rocket
nostalgia" style: an alternate-timeline 90s-FUTURE gadget — idealized chrome,
warm glow, glass highlights, smooth anti-aliased forms (how the 90s *dreamed*
the future, not literal pixel-arcade). Each keeps its game's own motif.

ONE icon grammar across all 13: filled + glossy + warm glow (no line-art). Drawn
at 4x (480px) with soft gradients / bevels / gloss / glow, then downscaled to
120px LANCZOS for smoothness. Transparent background — the card tile frames it.

Regenerate: python tools/art/gen_game_icons.py
"""
import os
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "arcade", "icons")
WS = 480            # supersampled canvas
C = WS // 2

AMBER = (255, 170, 40); AMBER_HI = (255, 214, 140); AMBER_DK = (190, 110, 12)
CYAN = (40, 224, 255); CYAN_HI = (190, 248, 255); CYAN_DK = (6, 140, 170)
GREEN = (104, 214, 116); GREEN_HI = (170, 240, 170); GREEN_DK = (40, 120, 60)
RED = (255, 96, 86); RED_HI = (255, 170, 150); RED_DK = (170, 44, 40)
STEEL = (176, 190, 206); STEEL_HI = (232, 240, 248); STEEL_DK = (92, 104, 122)
PURPLE = (190, 120, 236); PURPLE_HI = (224, 186, 250); PURPLE_DK = (118, 60, 170)
WOOD_HI = (210, 160, 108); WOOD_DK = (112, 72, 40); WOOD = (176, 122, 72)
WHITE = (240, 246, 252)
OUT_C = (20, 26, 38, 255)          # soft dark outline (not pure black)


def canvas():
    im = Image.new("RGBA", (WS, WS), (0, 0, 0, 0))
    return im, ImageDraw.Draw(im)


def finish(im):
    return im.resize((120, 120), Image.LANCZOS)


def glow(im, cx, cy, r, rgb, a=70):
    g = Image.new("RGBA", (WS, WS), (0, 0, 0, 0))
    ImageDraw.Draw(g).ellipse([cx - r, cy - r, cx + r, cy + r], fill=rgb + (a,))
    im.alpha_composite(g.filter(ImageFilter.GaussianBlur(r * 0.42)))


def _grad(w, h, top, bot):
    g = Image.new("RGBA", (w, h))
    px = g.load()
    for y in range(h):
        t = y / max(1, h - 1)
        col = (int(top[0] + (bot[0] - top[0]) * t), int(top[1] + (bot[1] - top[1]) * t),
               int(top[2] + (bot[2] - top[2]) * t), 255)
        for x in range(w):
            px[x, y] = col
    return g


def ell_grad(im, box, top, bot, outline=OUT_C, ow=6):
    x0, y0, x1, y1 = [int(v) for v in box]
    w, h = x1 - x0, y1 - y0
    if w <= 0 or h <= 0:
        return
    m = Image.new("L", (w, h), 0); ImageDraw.Draw(m).ellipse([0, 0, w - 1, h - 1], fill=255)
    im.paste(_grad(w, h, top, bot), (x0, y0), m)
    if outline:
        ImageDraw.Draw(im).ellipse(box, outline=outline, width=ow)


def rr_grad(im, box, r, top, bot, outline=OUT_C, ow=6):
    x0, y0, x1, y1 = [int(v) for v in box]
    w, h = x1 - x0, y1 - y0
    if w <= 0 or h <= 0:
        return
    m = Image.new("L", (w, h), 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, w - 1, h - 1], r, fill=255)
    im.paste(_grad(w, h, top, bot), (x0, y0), m)
    if outline:
        ImageDraw.Draw(im).rounded_rectangle(box, r, outline=outline, width=ow)


def poly_grad(im, pts, top, bot, outline=OUT_C, ow=6):
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    x0, y0, x1, y1 = int(min(xs)), int(min(ys)), int(max(xs)), int(max(ys))
    w, h = max(1, x1 - x0), max(1, y1 - y0)
    m = Image.new("L", (w, h), 0)
    ImageDraw.Draw(m).polygon([(px - x0, py - y0) for (px, py) in pts], fill=255)
    im.paste(_grad(w, h, top, bot), (x0, y0), m)
    if outline:
        ImageDraw.Draw(im).polygon(pts, outline=outline, width=ow)


def ring(im, box, top, bot, inner=0.55, outline=OUT_C):
    x0, y0, x1, y1 = [int(v) for v in box]
    w, h = x1 - x0, y1 - y0
    if w <= 0 or h <= 0:
        return
    m = Image.new("L", (w, h), 0); md = ImageDraw.Draw(m)
    md.ellipse([0, 0, w - 1, h - 1], fill=255)
    iw, ih = int(w * inner), int(h * inner); ix, iy = (w - iw) // 2, (h - ih) // 2
    md.ellipse([ix, iy, ix + iw, iy + ih], fill=0)
    im.paste(_grad(w, h, top, bot), (x0, y0), m)
    if outline:
        ImageDraw.Draw(im).ellipse(box, outline=outline, width=6)


def gloss(im, box):
    x0, y0, x1, y1 = box
    g = Image.new("RGBA", (WS, WS), (0, 0, 0, 0)); gd = ImageDraw.Draw(g)
    gd.ellipse([x0 + (x1 - x0) * 0.16, y0 + (y1 - y0) * 0.08,
                x1 - (x1 - x0) * 0.16, y0 + (y1 - y0) * 0.42], fill=(255, 255, 255, 90))
    im.alpha_composite(g.filter(ImageFilter.GaussianBlur(7)))


def spec(im, cx, cy, rx, ry, a=210):
    g = Image.new("RGBA", (WS, WS), (0, 0, 0, 0))
    ImageDraw.Draw(g).ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=(255, 255, 255, a))
    im.alpha_composite(g.filter(ImageFilter.GaussianBlur(8)))


def sphere(im, box, top, bot, rim=STEEL_HI):
    ell_grad(im, box, top, bot, outline=OUT_C, ow=7)
    x0, y0, x1, y1 = box
    ImageDraw.Draw(im).ellipse(box, outline=rim + (120,), width=4)
    spec(im, x0 + (x1 - x0) * 0.34, y0 + (y1 - y0) * 0.3, (x1 - x0) * 0.12, (y1 - y0) * 0.09)


# ---------------- icons (coords in 480-space) ----------------
def catch():
    im, d = canvas(); glow(im, C, 300, 150, CYAN, 46)
    ell_grad(im, [C - 44, 60, C + 44, 150], CYAN_HI, CYAN_DK)
    spec(im, C - 12, 86, 16, 12)
    d.ellipse([C - 20, 86, C + 20, 126], fill=(255, 190, 90, 255))
    hull = Image.new("RGBA", (WS, WS), (0, 0, 0, 0)); hd = ImageDraw.Draw(hull)
    hd.polygon([(C, 232), (WS - 104, 344), (104, 344)], fill=(96, 164, 220, 255))
    im.alpha_composite(hull)
    d.polygon([(C, 232), (WS - 104, 344), (104, 344)], outline=OUT_C, width=6)
    d.polygon([(C, 280), (C + 40, 344), (C - 40, 344)], fill=(190, 244, 255, 255))
    for tx in (C - 56, C + 56):
        d.polygon([(tx - 18, 344), (tx, 400), (tx + 18, 344)], fill=AMBER)
    return finish(im)


def maze():
    im, d = canvas(); glow(im, C, C, 150, AMBER, 60)
    m = Image.new("L", (WS, WS), 0); ImageDraw.Draw(m).pieslice([96, 96, 384, 384], 35, 325, fill=255)
    im.paste(_grad(288, 288, AMBER_HI, AMBER_DK), (96, 96), m.crop((96, 96, 384, 384)))
    d.pieslice([96, 96, 384, 384], 35, 325, outline=OUT_C, width=7)
    gloss(im, [96, 96, 384, 384])
    d.ellipse([240, 176, 272, 208], fill=OUT_C)
    return finish(im)


def nibbler():
    im, d = canvas(); glow(im, 190, 280, 150, GREEN, 46)
    for x in (104, 192, 280):
        rr_grad(im, [x, 240, x + 80, 320], 20, GREEN_HI, GREEN_DK)
    ell_grad(im, [296, 144, 400, 248], RED_HI, RED_DK)
    spec(im, 322, 176, 16, 12)
    d.line([(348, 144), (360, 104)], fill=GREEN_DK + (255,), width=12)
    return finish(im)


def road():
    # Clear glossy vehicle (matches the 6 in-game vehicles), not a car-on-a-bar.
    im, d = canvas(); glow(im, C, C, 150, RED, 40)
    glow(im, 392, 300, 46, AMBER, 120)                      # headlight glow
    for wx in (176, 304):                                   # chrome wheels
        sphere(im, [wx - 48, 300, wx + 48, 396], STEEL_DK, (28, 32, 42))
        d.ellipse([wx - 16, 332, wx + 16, 364], fill=(176, 186, 198, 255))  # hubcap
    rr_grad(im, [84, 244, 396, 336], 40, RED_HI, RED_DK)    # body
    rr_grad(im, [168, 150, 300, 252], 30, RED_HI, RED_DK)   # cabin
    rr_grad(im, [188, 170, 286, 232], 16, CYAN_HI, CYAN_DK, outline=None)   # glass
    gloss(im, [84, 244, 396, 336])
    d.ellipse([374, 280, 404, 310], fill=(255, 236, 150, 255))  # headlight
    d.ellipse([84, 280, 108, 308], fill=RED_DK + (255,))        # taillight
    return finish(im)


def block():
    im, d = canvas(); glow(im, C, C, 150, PURPLE, 52)
    u = 104; ox, oy = C - int(1.5 * u), C - u
    for (x, y) in [(0, 0), (1, 0), (2, 0), (1, 1)]:
        X, Y = ox + x * u, oy + y * u
        rr_grad(im, [X, Y, X + u - 12, Y + u - 12], 14, PURPLE_HI, PURPLE_DK)
    return finish(im)


def flipper():
    im, d = canvas(); glow(im, C, C, 150, CYAN, 48)
    sphere(im, [96, 96, 384, 384], STEEL_DK, (40, 48, 62))
    ell_grad(im, [160, 160, 320, 320], CYAN_HI, CYAN_DK)
    spec(im, 212, 196, 26, 18)
    sphere(im, [344, 344, 416, 416], STEEL_HI, STEEL_DK)
    return finish(im)


def putt():
    im, d = canvas(); glow(im, C, 360, 120, GREEN, 36)
    ell_grad(im, [136, 312, 344, 392], (36, 110, 56), (10, 42, 18))
    d.rectangle([228, 96, 244, 344], fill=WHITE)
    g = Image.new("RGBA", (WS, WS), (0, 0, 0, 0)); ImageDraw.Draw(g).polygon([(244, 104), (368, 144), (244, 192)], fill=RED + (255,))
    im.alpha_composite(g)
    d.polygon([(244, 104), (368, 144), (244, 192)], outline=RED_DK + (255,), width=4)
    d.polygon([(244, 110), (300, 128), (244, 146)], fill=RED_HI + (255,))
    return finish(im)


def ttt():
    # Filled-gloss: chunky amber X + glossy cyan O on a glass panel (was line-art).
    im, d = canvas(); glow(im, C, C, 150, CYAN, 36)
    rr_grad(im, [88, 88, 392, 392], 40, (44, 58, 92), (22, 30, 50)); gloss(im, [88, 88, 392, 392])
    for x in (205, 275):                                    # subtle inset grid
        d.line([(x, 120), (x, 360)], fill=(150, 170, 210, 170), width=8)
        d.line([(120, x), (360, x)], fill=(150, 170, 210, 170), width=8)
    cx, cy, sarm = 162, 162, 40                             # chunky X, top-left cell
    for (ax, ay, bx, by) in [(-sarm, -sarm, sarm, sarm), (sarm, -sarm, -sarm, sarm)]:
        d.line([(cx + ax, cy + ay), (cx + bx, cy + by)], fill=AMBER_DK + (255,), width=44)
    for (ax, ay, bx, by) in [(-sarm, -sarm, sarm, sarm), (sarm, -sarm, -sarm, sarm)]:
        d.line([(cx + ax, cy + ay), (cx + bx, cy + by)], fill=AMBER + (255,), width=26)
    for (ex, ey) in [(cx - sarm, cy - sarm), (cx + sarm, cy - sarm), (cx - sarm, cy + sarm), (cx + sarm, cy + sarm)]:
        d.ellipse([ex - 13, ey - 13, ex + 13, ey + 13], fill=AMBER + (255,))
    ring(im, [268, 268, 360, 360], CYAN_HI, CYAN_DK, inner=0.5)  # glossy O, bottom-right
    spec(im, 292, 292, 14, 10)
    return finish(im)


def rps():
    # Filled-gloss trio: chrome scissors (top), shaded rock, cream paper — all read.
    im, d = canvas(); glow(im, C, C, 140, STEEL, 28)
    d.line([(C, 210), (312, 96)], fill=STEEL_DK + (255,), width=34)   # scissor blades
    d.line([(C, 210), (168, 96)], fill=STEEL_DK + (255,), width=34)
    d.line([(C, 210), (312, 96)], fill=STEEL_HI + (255,), width=13)
    d.line([(C, 210), (168, 96)], fill=STEEL_HI + (255,), width=13)
    sphere(im, [C - 22, 186, C + 22, 230], STEEL_HI, STEEL_DK)        # pivot
    ring(im, [196, 196, 252, 252], AMBER_HI, AMBER_DK, inner=0.5)     # finger loops
    ring(im, [228, 196, 284, 252], CYAN_HI, CYAN_DK, inner=0.5)
    sphere(im, [92, 262, 216, 386], STEEL, STEEL_DK)                  # rock
    rr_grad(im, [264, 262, 392, 390], 16, (246, 244, 234), (200, 198, 186))  # paper
    d.polygon([(360, 262), (392, 294), (360, 294)], fill=(206, 204, 192, 255))  # fold
    gloss(im, [264, 262, 392, 330])
    return finish(im)


def fourup():
    im, d = canvas(); glow(im, C, C, 150, CYAN, 34)
    rr_grad(im, [96, 96, 384, 384], 36, (44, 58, 92), (24, 32, 52))
    gloss(im, [96, 96, 384, 384])
    cols = [[AMBER_HI, CYAN_HI], [CYAN_HI, AMBER_HI]]
    colsb = [[AMBER_DK, CYAN_DK], [CYAN_DK, AMBER_DK]]
    for r in range(2):
        for c in range(2):
            cx, cy = 176 + c * 128, 176 + r * 128
            ell_grad(im, [cx - 52, cy - 52, cx + 52, cy + 52], cols[r][c], colsb[r][c], outline=None)
            spec(im, cx - 16, cy - 16, 14, 10, a=150)
    return finish(im)


def draughts():
    im, d = canvas(); glow(im, C, 300, 150, AMBER, 46)
    g = Image.new("RGBA", (WS, WS), (0, 0, 0, 0)); ImageDraw.Draw(g).ellipse([108, 170, 372, 392], fill=(0, 0, 0, 90))
    im.alpha_composite(g.filter(ImageFilter.GaussianBlur(10)))
    ell_grad(im, [112, 150, 368, 360], AMBER_HI, AMBER_DK)
    d.ellipse([160, 186, 320, 324], outline=AMBER_DK + (255,), width=10)
    gloss(im, [112, 150, 368, 300])
    band = 232
    d.rectangle([176, band, 304, band + 28], fill=AMBER_HI + (255,))
    for px in (200, 240, 280):
        d.polygon([(px - 24, band), (px, band - 56), (px + 24, band)], fill=AMBER_HI + (255,), outline=AMBER_DK + (255,))
    return finish(im)


def fleet():
    # Filled-gloss battleship on water (was line arcs + flat ship).
    im, d = canvas(); glow(im, C, 300, 150, CYAN, 36)
    rr_grad(im, [64, 300, 416, 400], 24, (40, 120, 180), (12, 48, 92)); gloss(im, [64, 300, 416, 360])  # water
    poly_grad(im, [(104, 236), (360, 236), (404, 300), (76, 300)], STEEL_HI, STEEL_DK)    # hull
    d.line([(112, 244), (352, 244)], fill=(236, 242, 248, 255), width=10)                 # deck shine
    rr_grad(im, [196, 162, 272, 236], 10, STEEL_HI, STEEL_DK)                             # bridge
    rr_grad(im, [164, 194, 196, 236], 6, STEEL, STEEL_DK)                                 # funnel
    ell_grad(im, [214, 146, 264, 196], STEEL, STEEL_DK)                                   # turret
    d.rectangle([236, 118, 252, 158], fill=(60, 70, 86, 255))                             # gun barrel
    glow(im, 332, 330, 26, AMBER, 150); d.ellipse([320, 318, 344, 342], fill=AMBER + (255,))  # hit marker
    return finish(im)


def gallows():
    # Filled-gloss timber + solid rope loop (was thin line-art).
    im, d = canvas(); glow(im, 240, C, 150, WOOD, 32)
    rr_grad(im, [104, 360, 328, 402], 10, WOOD_HI, WOOD_DK); gloss(im, [104, 360, 328, 402])  # base
    rr_grad(im, [150, 96, 198, 384], 10, WOOD_HI, WOOD_DK)      # upright (thicker)
    rr_grad(im, [150, 96, 352, 140], 10, WOOD_HI, WOOD_DK)      # top beam
    rr_grad(im, [318, 140, 334, 216], 6, (210, 180, 130), (150, 120, 70))  # rope (filled)
    ring(im, [286, 212, 366, 302], (224, 196, 146), (150, 116, 66), inner=0.5)  # noose loop
    spec(im, 306, 236, 10, 7)
    return finish(im)


ICONS = {
    "catch": catch, "maze-muncher": maze, "nibbler": nibbler, "road-hopper": road,
    "block-drop": block, "flipper-frenzy": flipper, "putt-pal": putt,
    "three-in-a-row": ttt, "rock-paper-scissors": rps, "four-up": fourup,
    "draughts": draughts, "fleet-hunt": fleet, "word-gallows": gallows,
}


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, fn in ICONS.items():
        fn().save(os.path.join(OUT, f"{name}.png"))
    print(f"wrote {len(ICONS)} polished game icons to", os.path.normpath(OUT))


if __name__ == "__main__":
    main()
