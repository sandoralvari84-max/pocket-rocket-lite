#!/usr/bin/env python3
"""
Dot Catcher (now a space shooter) — enemy craft + plasma bolt. ORIGINAL owned art.

Matches the existing catch ship/orb palette (cool steel hull, amber accents, dark
outline). Enemies descend; the ship shoots the bolt upward; orbs stay the helpful
pickup drawn by gen_catch_art.py.

  drone.png    120px  small fast scout (level 1+)
  gunship.png  120px  heavier craft, two cannons (higher levels)
  bolt.png      64px  player plasma bolt (vertical)

Drawn at native size (no upscaling -> no blur). Full rights, no third-party assets.
Regenerate: python tools/art/gen_catch_shooter.py
"""
import os
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "arcade", "catch")
S = 120
CLEAR = (0, 0, 0, 0)

FOE = (196, 86, 72, 255)       # warm-red hostile hull
FOE_HI = (236, 140, 120, 255)
FOE_DK = (120, 44, 38, 255)
STEEL = (120, 132, 150, 255)
STEEL_DK = (70, 80, 96, 255)
GLASS = (180, 240, 255, 255)
AMBER = (255, 152, 16, 255)
CYAN = (0, 229, 255, 255)
OUTLINE = (16, 24, 36, 255)


def drone() -> Image.Image:
    img = Image.new("RGBA", (S, S), CLEAR)
    d = ImageDraw.Draw(img)
    cx = S // 2
    # downward-pointing scout: swept wings, nose at the bottom (it dives at you)
    d.polygon([(cx, S - 18), (S - 20, 46), (cx + 18, 40), (cx - 18, 40), (20, 46)],
              fill=FOE, outline=OUTLINE)
    d.line([(cx, S - 22), (S - 24, 48)], fill=FOE_HI, width=3)
    d.line([(cx, S - 22), (24, 48)], fill=FOE_HI, width=3)
    # cockpit eye
    d.ellipse([cx - 13, 44, cx + 13, 70], fill=GLASS, outline=OUTLINE, width=2)
    d.ellipse([cx - 5, 52, cx + 5, 64], fill=FOE_DK)
    # engine pods on top
    for tx in (cx - 22, cx + 22):
        d.rectangle([tx - 6, 30, tx + 6, 44], fill=STEEL_DK, outline=OUTLINE)
        d.ellipse([tx - 5, 24, tx + 5, 34], fill=CYAN)
    return img


def gunship() -> Image.Image:
    img = Image.new("RGBA", (S, S), CLEAR)
    d = ImageDraw.Draw(img)
    cx = S // 2
    # broad heavy hull
    d.polygon([(cx, S - 14), (S - 12, 60), (S - 30, 36), (30, 36), (12, 60)],
              fill=STEEL, outline=OUTLINE)
    d.polygon([(cx, S - 18), (S - 20, 60), (20, 60)], fill=FOE, outline=OUTLINE)
    d.line([(30, 40), (S - 30, 40)], fill=FOE_HI, width=3)
    # twin cannons pointing down
    for tx in (cx - 30, cx + 30):
        d.rectangle([tx - 5, 56, tx + 5, S - 20], fill=STEEL_DK, outline=OUTLINE)
        d.ellipse([tx - 6, S - 26, tx + 6, S - 14], fill=AMBER)
    # cockpit
    d.ellipse([cx - 14, 42, cx + 14, 66], fill=GLASS, outline=OUTLINE, width=2)
    return img


def bolt() -> Image.Image:
    s = 64
    img = Image.new("RGBA", (s, s), CLEAR)
    glow = Image.new("RGBA", (s, s), CLEAR)
    dg = ImageDraw.Draw(glow)
    dg.ellipse([s // 2 - 12, 6, s // 2 + 12, s - 6], fill=(0, 220, 255, 150))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(6)))
    d = ImageDraw.Draw(img)
    cx = s // 2
    d.rounded_rectangle([cx - 5, 6, cx + 5, s - 6], radius=5, fill=CYAN, outline=(0, 90, 110, 255))
    d.rounded_rectangle([cx - 2, 10, cx + 2, s - 10], radius=2, fill=(230, 250, 255, 255))
    return img


def main():
    os.makedirs(OUT, exist_ok=True)
    drone().save(os.path.join(OUT, "drone.png"))
    gunship().save(os.path.join(OUT, "gunship.png"))
    bolt().save(os.path.join(OUT, "bolt.png"))
    print("wrote drone, gunship, bolt to", os.path.normpath(OUT))


if __name__ == "__main__":
    main()
