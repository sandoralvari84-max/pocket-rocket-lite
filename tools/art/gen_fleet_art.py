#!/usr/bin/env python3
"""
Fleet Hunt — premium naval art set. ORIGINAL owned art (Pillow, in-repo).

A deliberate Battleship look on a deep-ocean palette:
  water_0/1.png  ocean cells with subtle swell (two variants for grid variation)
  ship2.png      2-cell destroyer  (240x120, 2:1)   steel hull + deck + turret
  ship3.png      3-cell cruiser    (360x120, 3:1)   steel hull + bridge + guns
  hit.png        explosion marker  (120x120)        orange/yellow fireball + debris
  miss.png       splash marker     (120x120)        white/cyan ripple rings
  sunk.png       sunk marker       (120x120)        charred hull + flame + smoke

Drawn at native display size (120px cell) so nothing is upscaled/blurred.
Full rights, no third-party assets. Regenerate: python tools/art/gen_fleet_art.py
"""
import math
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "arcade", "fleet")
S = 120  # cell size

OCEAN_DEEP = (10, 24, 46, 255)
OCEAN_HI = (26, 62, 100, 255)
SWELL = (36, 80, 124, 255)
STEEL_DK = (54, 66, 80, 255)
STEEL = (96, 112, 128, 255)
STEEL_HI = (150, 166, 182, 255)
DECK = (70, 84, 98, 255)
GUN = (40, 48, 58, 255)
OUTLINE = (18, 24, 32, 255)
CLEAR = (0, 0, 0, 0)


def water(variant: int) -> Image.Image:
    img = Image.new("RGBA", (S, S), OCEAN_DEEP)
    d = ImageDraw.Draw(img)
    for y in range(S):
        t = y / S
        col = tuple(int(OCEAN_DEEP[i] + (OCEAN_HI[i] - OCEAN_DEEP[i]) * (1 - t)) for i in range(3)) + (255,)
        d.line([(0, y), (S, y)], fill=col)
    off = 16 if variant else 0
    for yy in range(12 + off, S, 34):
        for xx in range(-10, S, 26):
            d.arc([xx, yy, xx + 20, yy + 10], 200, 340, fill=SWELL, width=2)
    d.rectangle([0, 0, S - 1, S - 1], outline=(8, 20, 38, 255), width=2)
    return img


def ship(cells: int) -> Image.Image:
    w, h = cells * S, S
    img = Image.new("RGBA", (w, h), CLEAR)
    d = ImageDraw.Draw(img)
    pad = 10
    y0, y1 = 32, h - 32
    midy = (y0 + y1) // 2
    # pointed-bow hull (bow at right)
    pts = [(pad, y0), (w - pad - 30, y0), (w - pad, midy), (w - pad - 30, y1), (pad, y1)]
    d.polygon(pts, fill=STEEL, outline=OUTLINE)
    d.line([(pad, y1 - 3), (w - pad - 30, y1 - 3)], fill=STEEL_DK, width=5)   # waterline shadow
    d.line([(pad + 6, y0 + 5), (w - pad - 38, y0 + 5)], fill=STEEL_HI, width=3)  # deck highlight
    cx = w // 2
    d.rectangle([cx - 26, y0 - 18, cx + 10, y0 + 12], fill=DECK, outline=OUTLINE)   # bridge
    d.rectangle([cx - 20, y0 - 32, cx - 6, y0 - 18], fill=STEEL_HI, outline=OUTLINE)  # funnel/mast
    for i in range(cells):
        gx = int((i + 0.5) * S)
        d.ellipse([gx - 12, midy - 12, gx + 12, midy + 12], fill=GUN, outline=OUTLINE)   # turret
        d.rectangle([gx + 8, midy - 3, gx + 26, midy + 3], fill=GUN, outline=OUTLINE)     # barrel
    return img


def hit() -> Image.Image:
    img = Image.new("RGBA", (S, S), CLEAR)
    d = ImageDraw.Draw(img)
    cx = cy = S // 2
    for a in range(0, 360, 45):
        x = cx + int(math.cos(math.radians(a)) * 50)
        y = cy + int(math.sin(math.radians(a)) * 50)
        d.line([(cx, cy), (x, y)], fill=(255, 120, 40, 220), width=5)
    for rad, col in [(40, (255, 92, 40, 235)), (30, (255, 150, 40, 245)), (18, (255, 224, 120, 255))]:
        d.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], fill=col)
    return img


def miss() -> Image.Image:
    img = Image.new("RGBA", (S, S), CLEAR)
    d = ImageDraw.Draw(img)
    cx = cy = S // 2
    for rad, col in [(34, (120, 210, 255, 160)), (24, (200, 240, 255, 200)), (13, (255, 255, 255, 230))]:
        d.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], outline=col, width=4)
    return img


def sunk() -> Image.Image:
    img = Image.new("RGBA", (S, S), CLEAR)
    d = ImageDraw.Draw(img)
    cx = cy = S // 2
    d.polygon([(cx - 36, cy + 24), (cx - 30, cy - 4), (cx + 30, cy - 4), (cx + 36, cy + 24)],
              fill=(40, 30, 30, 255), outline=OUTLINE)
    for fx, fh, col in [(-16, 30, (255, 150, 40, 230)), (2, 42, (255, 90, 30, 235)), (20, 26, (255, 200, 90, 220))]:
        d.polygon([(cx + fx - 8, cy - 4), (cx + fx, cy - 4 - fh), (cx + fx + 8, cy - 4)], fill=col)
    d.ellipse([cx - 30, cy - 34, cx - 14, cy - 18], fill=(70, 74, 82, 200))  # smoke
    d.ellipse([cx + 8, cy - 40, cx + 26, cy - 22], fill=(70, 74, 82, 180))
    return img


def main():
    os.makedirs(OUT, exist_ok=True)
    water(0).save(os.path.join(OUT, "water_0.png"))
    water(1).save(os.path.join(OUT, "water_1.png"))
    ship(2).save(os.path.join(OUT, "ship2.png"))
    ship(3).save(os.path.join(OUT, "ship3.png"))
    ship(4).save(os.path.join(OUT, "ship4.png"))
    hit().save(os.path.join(OUT, "hit.png"))
    miss().save(os.path.join(OUT, "miss.png"))
    sunk().save(os.path.join(OUT, "sunk.png"))
    print("wrote water_0/1, ship2/3, hit, miss, sunk to", os.path.normpath(OUT))


if __name__ == "__main__":
    main()
