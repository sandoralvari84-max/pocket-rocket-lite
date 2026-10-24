#!/usr/bin/env python3
"""
Putt Pal — miniature-golf texture tiles. ORIGINAL owned art (Pillow, in-repo).

Small tileable textures used with <ImageBackground resizeMode="repeat"> to fill
the fairway / hazards (the collision rects are unchanged):
  grass.png  48px  mown fairway (two-tone stripe + blade dapple)
  water.png  48px  pond (ripple arcs)
  sand.png   48px  bunker (speckled)
  wood.png   48px  rail/obstacle (plank grain)

Full rights, no third-party assets. Regenerate: python tools/art/gen_putt_art.py
"""
import os
import random
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "arcade", "putt")
S = 48


def grass() -> Image.Image:
    img = Image.new("RGBA", (S, S), (46, 125, 50, 255))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, S, S // 2], fill=(52, 137, 59, 255))   # mow stripe
    random.seed(1)
    for _ in range(60):
        x, y = random.randrange(S), random.randrange(S)
        d.line([(x, y), (x, y - 3)], fill=(40, 110, 44, 255), width=1)  # blades
    return img


def water() -> Image.Image:
    img = Image.new("RGBA", (S, S), (47, 111, 178, 255))
    d = ImageDraw.Draw(img)
    for y in range(6, S, 14):
        for x in range(-6, S, 20):
            d.arc([x, y, x + 16, y + 8], 200, 340, fill=(120, 175, 220, 255), width=2)
    return img


def sand() -> Image.Image:
    img = Image.new("RGBA", (S, S), (217, 194, 126, 255))
    d = ImageDraw.Draw(img)
    random.seed(2)
    for _ in range(90):
        x, y = random.randrange(S), random.randrange(S)
        c = (184, 155, 82, 255) if random.random() < 0.5 else (236, 218, 160, 255)
        d.point((x, y), fill=c)
    return img


def wood() -> Image.Image:
    img = Image.new("RGBA", (S, S), (156, 107, 63, 255))
    d = ImageDraw.Draw(img)
    for y in range(0, S, 8):
        d.line([(0, y), (S, y + 1)], fill=(120, 80, 46, 255), width=1)
    for y in range(4, S, 8):
        d.line([(0, y), (S, y)], fill=(176, 126, 78, 255), width=1)
    return img


def main():
    os.makedirs(OUT, exist_ok=True)
    grass().save(os.path.join(OUT, "grass.png"))
    water().save(os.path.join(OUT, "water.png"))
    sand().save(os.path.join(OUT, "sand.png"))
    wood().save(os.path.join(OUT, "wood.png"))
    print("wrote grass, water, sand, wood to", os.path.normpath(OUT))


if __name__ == "__main__":
    main()
