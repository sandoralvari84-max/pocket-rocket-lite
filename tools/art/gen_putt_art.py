#!/usr/bin/env python3
"""
Putt Pal — premium miniature-golf art. ORIGINAL owned art (Pillow, in-repo).

Inspired by the look/level of 90s 3D mini-golf (rippling caustic water, mown turf,
wooden plank bridges, hedged borders, red rails) — NOT copied from any title.

Tileable textures (used with <ImageBackground resizeMode="repeat">; collision rects
unchanged):
  grass.png  64px  mown turf (two-tone stripes + fine blade grain)
  water.png  64px  pond with seamless sine-interference caustics + specular
  sand.png   64px  bunker (warm stipple + faint ripples)
  wood.png   64px  bridge planks (grain + seams + highlight)
  hedge.png  64px  clipped hedge border
Sprites:
  cup.png    48px  hole cup (rim + inner shadow)
  flag.png   40x60 flagstick + pennant

Pure per-pixel math where it buys realism; everything tiles. Full rights, no
third-party assets. Regenerate: python tools/art/gen_putt_art.py
"""
import math
import os
import random
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "arcade", "putt")
S = 64
TAU = math.pi * 2


def _clamp(v):
    return 0 if v < 0 else 255 if v > 255 else int(v)


def grass() -> Image.Image:
    img = Image.new("RGBA", (S, S))
    px = img.load()
    random.seed(11)
    grain = [[random.uniform(-10, 10) for _ in range(S)] for _ in range(S)]
    for y in range(S):
        for x in range(S):
            band = math.sin((x + y) / 10.0)   # diagonal mown bands
            r = 46 + band * 4
            g = 128 + band * 10 + grain[y][x]
            b = 50 + band * 3
            if grain[y][x] > 8:
                r += 6; g += 14; b += 4
            px[x, y] = (_clamp(r), _clamp(g), _clamp(b), 255)
    return img


def water() -> Image.Image:
    img = Image.new("RGBA", (S, S))
    px = img.load()
    for y in range(S):
        for x in range(S):
            u = x / S; v = y / S
            c = (math.sin(TAU * 2 * u) + math.sin(TAU * 3 * v)
                 + math.sin(TAU * 2 * (u + v)) + math.sin(TAU * 3 * (u - v)))
            c = (c + 4) / 8.0
            r = 30 + c * 70
            g = 90 + c * 110
            b = 150 + c * 80
            if c > 0.82:
                r += 60; g += 50; b += 30
            px[x, y] = (_clamp(r), _clamp(g), _clamp(b), 255)
    return img


def sand() -> Image.Image:
    img = Image.new("RGBA", (S, S))
    px = img.load()
    random.seed(7)
    for y in range(S):
        for x in range(S):
            ripple = math.sin((x * 0.6 + y * 0.3)) * 6
            base = 206 + ripple
            n = random.uniform(-14, 14)
            px[x, y] = (_clamp(base + n + 10), _clamp(base + n - 6), _clamp(base + n - 70), 255)
    return img


def wood() -> Image.Image:
    img = Image.new("RGBA", (S, S), (150, 102, 60, 255))
    d = ImageDraw.Draw(img)
    plank_h = 16
    random.seed(3)
    for py in range(0, S, plank_h):
        shade = random.randint(-10, 10)
        d.rectangle([0, py, S, py + plank_h - 1], fill=(150 + shade, 102 + shade, 60 + shade, 255))
        for gy in range(py + 2, py + plank_h - 1, 3):
            d.line([(0, gy), (S, gy + random.randint(-1, 1))], fill=(126, 82, 46, 255), width=1)
        d.line([(0, py), (S, py)], fill=(96, 60, 32, 255), width=2)
        d.line([(0, py + 1), (S, py + 1)], fill=(184, 134, 86, 255), width=1)
    return img


def hedge() -> Image.Image:
    img = Image.new("RGBA", (S, S), (28, 74, 34, 255))
    d = ImageDraw.Draw(img)
    random.seed(5)
    for _ in range(90):
        x = random.randrange(S); y = random.randrange(S)
        rr = random.randint(4, 8)
        tone = random.choice([(22, 60, 28), (40, 96, 44), (34, 84, 38), (48, 110, 52)])
        for dx in (0, -S, S):
            d.ellipse([x + dx - rr, y - rr, x + dx + rr, y + rr], fill=tone + (255,))
    return img.filter(ImageFilter.GaussianBlur(0.4))


def cup() -> Image.Image:
    s = 48
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([3, 3, s - 3, s - 3], fill=(26, 70, 32, 255))
    d.ellipse([9, 9, s - 9, s - 9], fill=(10, 16, 12, 255), outline=(6, 10, 8, 255), width=2)
    d.ellipse([13, 12, s - 13, s - 16], fill=(4, 8, 6, 255))
    d.arc([10, 10, s - 10, s - 8], 40, 140, fill=(70, 120, 80, 255), width=2)
    return img


def flag() -> Image.Image:
    w, h = 40, 60
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rectangle([8, 4, 11, h - 6], fill=(220, 214, 198, 255), outline=(150, 146, 134, 255))
    d.ellipse([6, 1, 13, 8], fill=(240, 236, 224, 255))
    d.polygon([(11, 6), (38, 12), (34, 16), (38, 22), (11, 22)], fill=(224, 70, 60, 255), outline=(150, 36, 30, 255))
    d.polygon([(11, 7), (24, 10), (11, 13)], fill=(255, 120, 108, 255))
    d.ellipse([2, h - 10, 18, h - 2], fill=(0, 0, 0, 90))
    return img


AMBER = (255, 152, 0)   # brand amber #FF9800 — EXACT
CYAN = (0, 229, 255)    # brand cyan  #00E5FF


def dunes() -> Image.Image:
    """Desert fairway base — warm sand with low rolling dune shading (tileable)."""
    img = Image.new("RGBA", (S, S))
    px = img.load()
    random.seed(23)
    grain = [[random.uniform(-9, 9) for _ in range(S)] for _ in range(S)]
    for y in range(S):
        for x in range(S):
            # two low-frequency bands whose periods divide S so the tile wraps
            dune = math.sin(TAU * 1 * x / S) * 7 + math.sin(TAU * 2 * (x + y) / S) * 4
            r = 196 + dune + grain[y][x]
            g = 168 + dune * 0.8 + grain[y][x]
            b = 112 + dune * 0.5 + grain[y][x] * 0.6
            px[x, y] = (_clamp(r), _clamp(g), _clamp(b), 255)
    return img


def neon() -> Image.Image:
    """Clockwork / neon fairway — dark deck with a cyan grid + amber nodes (tileable)."""
    img = Image.new("RGBA", (S, S), (16, 22, 32, 255))
    d = ImageDraw.Draw(img)
    step = 16
    # faint inner gradient dapple
    px = img.load()
    for y in range(S):
        for x in range(S):
            v = (math.sin(TAU * x / S) + math.sin(TAU * y / S)) * 4
            r, g, b, _ = px[x, y]
            px[x, y] = (_clamp(r + v), _clamp(g + v + 2), _clamp(b + v + 6), 255)
    for g in range(0, S + 1, step):          # grid lines (wrap at 0/S)
        d.line([(g % S, 0), (g % S, S)], fill=(0, 120, 150, 150), width=1)
        d.line([(0, g % S), (S, g % S)], fill=(0, 120, 150, 150), width=1)
    for gx in range(0, S, step):             # amber nodes at intersections
        for gy in range(0, S, step):
            d.ellipse([gx - 2, gy - 2, gx + 2, gy + 2], fill=AMBER + (210,))
    return img


def metal() -> Image.Image:
    """Clockwork wall — brushed steel plate with rivets + amber top highlight (tileable)."""
    img = Image.new("RGBA", (S, S), (84, 96, 110, 255))
    d = ImageDraw.Draw(img)
    random.seed(31)
    for y in range(S):                        # horizontal brushed grain
        shade = int(math.sin(TAU * y / 8) * 6) + random.randint(-5, 5)
        d.line([(0, y), (S, y)], fill=(_clamp(96 + shade), _clamp(108 + shade), _clamp(124 + shade), 255))
    for ry in (8, S - 8):                      # rivet rows (wrap)
        for rx in range(8, S, 16):
            d.ellipse([rx - 3, ry - 3, rx + 3, ry + 3], fill=(150, 162, 176, 255), outline=(52, 60, 70, 255))
            d.ellipse([rx - 1, ry - 2, rx + 1, ry, ], fill=(210, 220, 230, 255))
    d.line([(0, 0), (S, 0)], fill=AMBER + (170,), width=1)   # amber lip highlight
    return img


def windmill() -> Image.Image:
    """Clockwork windmill — hub + 4 blades on a post (sprite, drawn centered, spun in app)."""
    ss, s = 240, 120                           # supersample then downscale
    img = Image.new("RGBA", (ss, ss), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx = cy = ss // 2
    for k in range(4):                          # four blades
        a = math.radians(90 * k)
        tipx, tipy = cx + math.cos(a) * 104, cy + math.sin(a) * 104
        lx, ly = cx + math.cos(a + 0.42) * 30, cy + math.sin(a + 0.42) * 30
        rx, ry = cx + math.cos(a - 0.10) * 54, cy + math.sin(a - 0.10) * 54
        col = AMBER if k % 2 == 0 else CYAN
        d.polygon([(cx, cy), (lx, ly), (tipx, tipy), (rx, ry)], fill=col + (255,), outline=(20, 26, 38, 255))
    d.ellipse([cx - 30, cy - 30, cx + 30, cy + 30], fill=(60, 70, 84, 255), outline=(20, 26, 38, 255), width=4)
    d.ellipse([cx - 14, cy - 14, cx + 14, cy + 14], fill=(176, 186, 200, 255))
    d.ellipse([cx - 6, cy - 6, cx + 6, cy + 6], fill=AMBER + (255,))
    return img.resize((s, s), Image.LANCZOS)


def blocker() -> Image.Image:
    """Moving blocker — chromed metal puck ringed in cyan (sprite)."""
    ss, s = 128, 56
    img = Image.new("RGBA", (ss, ss), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c = ss // 2
    d.ellipse([10, 10, ss - 10, ss - 10], fill=(70, 82, 96, 255), outline=(20, 26, 38, 255), width=6)
    d.ellipse([18, 18, ss - 18, ss - 18], outline=CYAN + (230,), width=7)   # cyan ring
    d.ellipse([34, 30, ss - 34, ss - 40], fill=(150, 162, 178, 255))        # top gloss
    d.ellipse([c - 7, c - 7, c + 7, c + 7], fill=(210, 220, 232, 255), outline=(52, 60, 70, 255))
    return img.resize((s, s), Image.LANCZOS)


def main():
    os.makedirs(OUT, exist_ok=True)
    grass().save(os.path.join(OUT, "grass.png"))
    water().save(os.path.join(OUT, "water.png"))
    sand().save(os.path.join(OUT, "sand.png"))
    wood().save(os.path.join(OUT, "wood.png"))
    hedge().save(os.path.join(OUT, "hedge.png"))
    cup().save(os.path.join(OUT, "cup.png"))
    flag().save(os.path.join(OUT, "flag.png"))
    # themed sets
    dunes().save(os.path.join(OUT, "dunes.png"))
    neon().save(os.path.join(OUT, "neon.png"))
    metal().save(os.path.join(OUT, "metal.png"))
    windmill().save(os.path.join(OUT, "windmill.png"))
    blocker().save(os.path.join(OUT, "blocker.png"))
    print("wrote grass, water, sand, wood, hedge, cup, flag,",
          "dunes, neon, metal, windmill, blocker to", os.path.normpath(OUT))


if __name__ == "__main__":
    main()
