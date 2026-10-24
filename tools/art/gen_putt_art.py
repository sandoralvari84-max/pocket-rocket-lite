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


def main():
    os.makedirs(OUT, exist_ok=True)
    grass().save(os.path.join(OUT, "grass.png"))
    water().save(os.path.join(OUT, "water.png"))
    sand().save(os.path.join(OUT, "sand.png"))
    wood().save(os.path.join(OUT, "wood.png"))
    hedge().save(os.path.join(OUT, "hedge.png"))
    cup().save(os.path.join(OUT, "cup.png"))
    flag().save(os.path.join(OUT, "flag.png"))
    print("wrote grass, water, sand, wood, hedge, cup, flag to", os.path.normpath(OUT))


if __name__ == "__main__":
    main()
