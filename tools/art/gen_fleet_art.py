#!/usr/bin/env python3
"""
Fleet Hunt — naval art, "Pocket Rocket nostalgia" polish (smooth gradient ocean,
chrome hulls, glowing markers). Smooth 2x->1x via shared helpers. Owned, Pillow.

v2 (2026-10-26): distinct ship TYPES (carrier/destroyer/cruiser/submarine/patrol),
a rotating radar-sweep sprite, drifting water caustics, and a table vignette — for
the mock-3D board overhaul. Old ship2/3/4 + water/hit/miss/sunk kept (unchanged
filenames) so nothing else breaks. Brand amber #FF9800, cyan #00E5FF.
"""
import math
import os
import sys
from PIL import Image, ImageDraw, ImageFilter, ImageOps
sys.path.insert(0, os.path.dirname(__file__))
from polish import P  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "arcade", "fleet")
S = 120
OCEAN_HI = (30, 70, 112); OCEAN_DK = (8, 22, 44); SWELL = (60, 110, 158, 200)
STEEL_HI = (176, 190, 206); STEEL = (104, 120, 138); STEEL_DK = (56, 68, 84)
DECK = (80, 94, 110); GUN = (36, 44, 56)
SUB_HI = (74, 90, 100); SUB_DK = (22, 30, 36)
AMBER = (255, 152, 0); CYAN = (0, 229, 255)


def water(variant):
    W = 240
    im, d = P.canvas(W)
    P.rr_grad(im, [0, 0, W, W], 0, OCEAN_HI, OCEAN_DK, outline=None)
    off = 32 if variant else 0
    for yy in range(24 + off, W, 68):
        for xx in range(-20, W, 52):
            d.arc([xx, yy, xx + 40, yy + 20], 200, 340, fill=SWELL, width=4)
    d.rectangle([0, 0, W - 1, W - 1], outline=(6, 16, 32, 120), width=4)
    return P.finish(im, 120)


def ship(cells):
    """Legacy length-keyed hull (kept so compose_fleet_preview.py still runs)."""
    w, h = cells * S * 2, S * 2
    im, d = P.canvas_wh(w, h)
    pad = 20; y0, y1 = 64, h - 64; midy = (y0 + y1) // 2
    pts = [(pad, y0), (w - pad - 60, y0), (w - pad, midy), (w - pad - 60, y1), (pad, y1)]
    P.poly_grad(im, pts, STEEL_HI, STEEL_DK)
    d.line([(pad + 12, y0 + 10), (w - pad - 76, y0 + 10)], fill=(210, 222, 236, 255), width=6)
    cx = w // 2
    P.rr_grad(im, [cx - 52, y0 - 36, cx + 20, y0 + 24], 8, (150, 166, 182), STEEL_DK)
    P.rr_grad(im, [cx - 40, y0 - 64, cx - 12, y0 - 36], 6, STEEL_HI, STEEL_DK)
    for i in range(cells):
        gx = int((i + 0.5) * S * 2)
        P.ell_grad(im, [gx - 24, midy - 24, gx + 24, midy + 24], (90, 102, 118), GUN)
        d.rectangle([gx + 16, midy - 6, gx + 52, midy + 6], fill=GUN + (255,))
    return P.finish(im, (cells * S, S))


# ---------------------------------------------------------------------------
# v2 ship TYPES — each horizontal, bow to the right, drawn at 2x then LANCZOS.
# ---------------------------------------------------------------------------
def _hull(im, d, w, h, hi, dk, bow=60, top=0.40, bot=0.72):
    y0, y1 = int(h * top), int(h * bot); pad = 18
    pts = [(pad, y0), (w - pad - bow, y0), (w - pad, (y0 + y1) // 2), (w - pad - bow, y1), (pad, y1)]
    P.poly_grad(im, pts, hi, dk)
    d.line([(pad + 12, y0 + 8), (w - pad - bow - 6, y0 + 8)], fill=(214, 226, 240, 255), width=6)
    d.line([(pad + 6, y1 - 4), (w - pad - bow, y1 - 4)], fill=(20, 30, 44, 160), width=8)
    return y0, y1, (y0 + y1) // 2


def _mast(im, d, x, top_y, col):
    d.line([(x, top_y), (x, top_y - 42)], fill=(120, 136, 152, 255), width=6)
    P.glow(im, x, top_y - 42, 16, col, 170)
    d.ellipse([x - 8, top_y - 50, x + 8, top_y - 34], fill=col + (255,))


def warship(cells, turrets, funnels):
    w, h = cells * S * 2, S * 2
    im, d = P.canvas_wh(w, h)
    y0, y1, midy = _hull(im, d, w, h, STEEL_HI, STEEL_DK)
    cx = w // 2
    P.rr_grad(im, [cx - 66, y0 - 44, cx + 28, y0 + 18], 10, (150, 166, 182), STEEL_DK)
    _mast(im, d, cx - 34, y0 - 44, CYAN)
    for i in range(funnels):
        fx = cx + 14 + i * 40
        P.rr_grad(im, [fx, y0 - 50, fx + 26, y0 + 2], 6, (120, 134, 150), GUN)
    span = w - 2 * 40
    for i in range(turrets):
        gx = int(40 + (i + 0.5) * span / turrets)
        P.ell_grad(im, [gx - 24, midy - 24, gx + 24, midy + 24], (96, 108, 124), GUN)
        d.rectangle([gx + 14, midy - 6, gx + 52, midy + 6], fill=GUN + (255,))
    return P.finish(im, (cells * S, S))


def carrier():
    cells = 5; w, h = cells * S * 2, S * 2
    im, d = P.canvas_wh(w, h)
    y0, y1, midy = _hull(im, d, w, h, STEEL_HI, STEEL_DK, bow=46, top=0.44, bot=0.72)
    P.rr_grad(im, [30, y0 - 20, w - 70, y0 + 10], 10, (92, 104, 120), (54, 64, 78))
    for xx in range(60, w - 90, 56):
        d.rectangle([xx, midy - 3, xx + 32, midy + 3], fill=AMBER + (255,))
    d.line([(32, y0 - 18), (w - 72, y0 - 18)], fill=CYAN + (200,), width=4)
    ix = int(w * 0.66)
    P.rr_grad(im, [ix, y0 - 58, ix + 56, y0 + 6], 8, (150, 166, 182), STEEL_DK)
    _mast(im, d, ix + 42, y0 - 58, AMBER)
    return P.finish(im, (cells * S, S))


def submarine():
    cells = 3; w, h = cells * S * 2, S * 2
    im, d = P.canvas_wh(w, h)
    y0, y1 = int(h * 0.50), int(h * 0.70)
    P.rr_grad(im, [20, y0, w - 20, y1], (y1 - y0) // 2, SUB_HI, SUB_DK)
    cx = w // 2
    P.rr_grad(im, [cx - 30, y0 - 40, cx + 30, y0 + 6], 10, (60, 74, 84), SUB_DK)
    d.line([(cx + 12, y0 - 40), (cx + 12, y0 - 70)], fill=(70, 84, 94, 255), width=5)
    P.glow(im, cx + 12, y0 - 70, 10, AMBER, 150)
    d.ellipse([cx + 6, y0 - 76, cx + 18, y0 - 64], fill=AMBER + (220,))
    d.line([(26, y1 - 4), (w - 26, y1 - 4)], fill=(18, 26, 32, 150), width=10)
    for xx in range(20, w - 20, 46):
        d.arc([xx, y1 - 10, xx + 34, y1 + 8], 200, 340, fill=(120, 150, 160, 90), width=3)
    return P.finish(im, (cells * S, S))


def patrol():
    cells = 2; w, h = cells * S * 2, S * 2
    im, d = P.canvas_wh(w, h)
    y0, y1, midy = _hull(im, d, w, h, STEEL_HI, STEEL_DK, bow=50, top=0.44, bot=0.70)
    cx = int(w * 0.42)
    P.rr_grad(im, [cx - 30, y0 - 32, cx + 18, y0 + 10], 8, (150, 166, 182), STEEL_DK)
    P.ell_grad(im, [cx + 22, midy - 18, cx + 58, midy + 18], (96, 108, 124), GUN)
    d.rectangle([cx + 46, midy - 5, cx + 84, midy + 5], fill=GUN + (255,))
    P.glow(im, cx - 24, y0 - 32, 12, CYAN, 170)
    d.ellipse([cx - 30, y0 - 38, cx - 18, y0 - 26], fill=CYAN + (255,))
    return P.finish(im, (cells * S, S))


def hit():
    W = 240
    im, d = P.canvas(W)
    cx = cy = W // 2
    P.glow(im, cx, cy, 92, (255, 120, 40), 160)
    for a in range(0, 360, 30):
        x = cx + int(math.cos(math.radians(a)) * 98); y = cy + int(math.sin(math.radians(a)) * 98)
        d.line([(cx, cy), (x, y)], fill=(255, 150, 60, 220), width=9)
    P.ell_grad(im, [cx - 80, cy - 80, cx + 80, cy + 80], (255, 170, 70), (200, 70, 30), outline=None)
    P.ell_grad(im, [cx - 42, cy - 42, cx + 42, cy + 42], (255, 244, 170), (255, 150, 50), outline=None)
    P.spec(im, cx - 16, cy - 18, 16, 12)
    return P.finish(im, 120)


def miss():
    W = 240
    im, d = P.canvas(W)
    cx = cy = W // 2
    P.glow(im, cx, cy, 70, (120, 210, 255), 70)
    for rad, col in [(68, (120, 210, 255, 170)), (48, (200, 240, 255, 210)), (26, (255, 255, 255, 240))]:
        d.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], outline=col, width=8)
    return P.finish(im, 120)


def sunk():
    W = 240
    im, d = P.canvas(W)
    cx = cy = W // 2
    P.glow(im, cx, cy - 10, 70, (255, 120, 40), 110)
    P.poly_grad(im, [(cx - 72, cy + 48), (cx - 60, cy - 8), (cx + 60, cy - 8), (cx + 72, cy + 48)], (70, 60, 58), (34, 28, 28))
    for fx, fh, c0, c1 in [(-32, 60, (255, 180, 70), (230, 90, 30)), (4, 84, (255, 160, 60), (220, 70, 24)), (40, 52, (255, 210, 110), (230, 120, 40))]:
        P.poly_grad(im, [(cx + fx - 16, cy - 8), (cx + fx, cy - 8 - fh), (cx + fx + 16, cy - 8)], c0, c1, outline=None)
    return P.finish(im, 120)


def radar_sweep():
    """A fading cyan wedge + range rings; the game rotates it over the enemy chart."""
    W = 480
    im, d = P.canvas(W)
    cx = cy = W // 2
    for rr in (int(W * 0.24), int(W * 0.36), int(W * 0.48)):
        d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], outline=(0, 229, 255, 45), width=3)
    d.line([(cx, 0), (cx, W)], fill=(0, 229, 255, 30), width=2)
    d.line([(0, cy), (W, cy)], fill=(0, 229, 255, 30), width=2)
    wedge = Image.new("RGBA", (W, W), (0, 0, 0, 0)); wd = ImageDraw.Draw(wedge)
    r = int(W * 0.48)
    for a in range(0, 64):
        alpha = int(130 * (1 - a / 64.0))
        wd.pieslice([cx - r, cy - r, cx + r, cy + r], -a - 1, -a, fill=(0, 229, 255, alpha))
    im.alpha_composite(wedge)
    d.line([(cx, cy), (cx + r, cy)], fill=(190, 248, 255, 235), width=4)
    return P.finish(im, 240)


def water_caustics():
    """Faint drifting light ripples — one stretched overlay, animated in-game."""
    W = 480
    im, _ = P.canvas(W)
    g = Image.new("RGBA", (W, W), (0, 0, 0, 0)); gd = ImageDraw.Draw(g)
    for yy in range(20, W, 70):
        for xx in range(-30, W, 92):
            gd.arc([xx, yy, xx + 74, yy + 34], 200, 340, fill=(150, 200, 230, 70), width=5)
    im.alpha_composite(g.filter(ImageFilter.GaussianBlur(4)))
    return P.finish(im, 240)


def vignette():
    """Transparent centre fading to dark edges — the table/sea framing."""
    W = 256
    base = Image.new("RGBA", (W, W), (0, 0, 0, 255))
    m = Image.new("L", (W, W), 0)
    ImageDraw.Draw(m).ellipse([int(W * 0.06), int(W * 0.06), int(W * 0.94), int(W * 0.94)], fill=255)
    m = m.filter(ImageFilter.GaussianBlur(int(W * 0.16)))
    inv = ImageOps.invert(m)
    base.putalpha(inv.point(lambda a: int(a * 0.72)))
    return base


def main():
    os.makedirs(OUT, exist_ok=True)
    water(0).save(os.path.join(OUT, "water_0.png"))
    water(1).save(os.path.join(OUT, "water_1.png"))
    # legacy length-keyed hulls (kept for the preview script / backward safety)
    ship(2).save(os.path.join(OUT, "ship2.png"))
    ship(3).save(os.path.join(OUT, "ship3.png"))
    ship(4).save(os.path.join(OUT, "ship4.png"))
    # v2 ship types
    carrier().save(os.path.join(OUT, "carrier.png"))
    warship(4, 3, 2).save(os.path.join(OUT, "destroyer.png"))
    warship(3, 2, 1).save(os.path.join(OUT, "cruiser.png"))
    submarine().save(os.path.join(OUT, "submarine.png"))
    patrol().save(os.path.join(OUT, "patrol.png"))
    # markers + fx
    hit().save(os.path.join(OUT, "hit.png"))
    miss().save(os.path.join(OUT, "miss.png"))
    sunk().save(os.path.join(OUT, "sunk.png"))
    radar_sweep().save(os.path.join(OUT, "radar_sweep.png"))
    water_caustics().save(os.path.join(OUT, "water_caustics.png"))
    vignette().save(os.path.join(OUT, "vignette.png"))
    print("wrote fleet art (v2) to", os.path.normpath(OUT))


if __name__ == "__main__":
    main()
