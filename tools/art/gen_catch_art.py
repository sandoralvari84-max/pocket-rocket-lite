#!/usr/bin/env python3
"""
Dot Catcher — player ship + collectible. ORIGINAL owned art (Pillow, in-repo).

A sleek arcade catcher craft and a glowing energy orb, space theme:
  ship.png   120px  catcher ship (wings, cockpit, twin thrusters, open scoop)
  orb.png    120px  energy orb (cyan halo + amber core + sparkle)
  star_s/m/l.png     tiny star dots for the starfield (3 sizes)

Drawn at native 120 px (no upscaling → no blur).
Full rights, no third-party assets. Regenerate: python tools/art/gen_catch_art.py
"""
import os
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "arcade", "catch")
S = 120
CLEAR = (0, 0, 0, 0)

HULL = (80, 150, 210, 255)
HULL_HI = (150, 205, 245, 255)
HULL_DK = (40, 86, 130, 255)
GLASS = (180, 240, 255, 255)
AMBER = (255, 152, 16, 255)
OUTLINE = (16, 24, 36, 255)


def ship() -> Image.Image:
    img = Image.new("RGBA", (S, S), CLEAR)
    d = ImageDraw.Draw(img)
    cx = S // 2
    # open catcher scoop (wide U) — matches the wide paddle hitbox
    d.arc([14, 30, S - 14, S - 6], 200, 340, fill=HULL_DK, width=10)
    # main hull: swept wing body
    d.polygon([(cx, 20), (S - 16, 70), (S - 28, 92), (28, 92), (16, 70)], fill=HULL, outline=OUTLINE)
    # wing highlights
    d.line([(cx, 24), (S - 22, 70)], fill=HULL_HI, width=3)
    d.line([(cx, 24), (22, 70)], fill=HULL_HI, width=3)
    # cockpit glass
    d.polygon([(cx, 40), (cx + 16, 66), (cx - 16, 66)], fill=GLASS, outline=OUTLINE)
    # twin thrusters with amber flame
    for tx in (cx - 20, cx + 20):
        d.rectangle([tx - 7, 86, tx + 7, 98], fill=HULL_DK, outline=OUTLINE)
        d.polygon([(tx - 6, 98), (tx, 112), (tx + 6, 98)], fill=AMBER)
    return img


def orb() -> Image.Image:
    img = Image.new("RGBA", (S, S), CLEAR)
    glow = Image.new("RGBA", (S, S), CLEAR)
    dg = ImageDraw.Draw(glow)
    dg.ellipse([16, 16, S - 16, S - 16], fill=(0, 200, 230, 150))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(9)))
    d = ImageDraw.Draw(img)
    cx = cy = S // 2
    d.ellipse([30, 30, S - 30, S - 30], fill=(0, 196, 228, 255), outline=(0, 90, 110, 255), width=3)
    d.ellipse([42, 42, S - 42, S - 42], fill=AMBER)
    d.ellipse([52, 50, 72, 68], fill=(255, 240, 200, 255))  # sparkle highlight
    return img


def star(sz: int) -> Image.Image:
    img = Image.new("RGBA", (sz * 2 + 4, sz * 2 + 4), CLEAR)
    d = ImageDraw.Draw(img)
    c = sz + 2
    d.ellipse([c - sz, c - sz, c + sz, c + sz], fill=(235, 242, 255, 235))
    return img


def main():
    os.makedirs(OUT, exist_ok=True)
    ship().save(os.path.join(OUT, "ship.png"))
    orb().save(os.path.join(OUT, "orb.png"))
    star(3).save(os.path.join(OUT, "star_s.png"))
    star(5).save(os.path.join(OUT, "star_m.png"))
    star(8).save(os.path.join(OUT, "star_l.png"))
    print("wrote ship, orb, star_s/m/l to", os.path.normpath(OUT))


if __name__ == "__main__":
    main()
