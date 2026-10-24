#!/usr/bin/env python3
"""
Nibbler — textured field tiles. ORIGINAL owned art (Pillow, in-repo).

A subtle dark-grass ground with a diamond scale lattice so the arena reads as a
designed field, not a flat black box:
  field_0.png / field_1.png   two checker variants (by r+c)

Drawn at the native cell size. Full rights, no third-party assets.
Regenerate: python tools/art/gen_nibbler_field.py
"""
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "arcade", "nibbler")
S = 96


def field(dark: bool) -> Image.Image:
    base = (10, 24, 16, 255) if dark else (13, 29, 20, 255)
    lat = (20, 40, 28, 255) if dark else (24, 46, 32, 255)
    img = Image.new("RGBA", (S, S), base)
    d = ImageDraw.Draw(img)
    # diamond scale lattice
    step = 24
    for i in range(-1, S // step + 2):
        d.line([(i * step, 0), (i * step + S, S)], fill=lat, width=1)
        d.line([(i * step, S), (i * step + S, 0)], fill=lat, width=1)
    d.rectangle([0, 0, S - 1, S - 1], outline=(6, 16, 10, 255), width=1)
    return img


def main():
    os.makedirs(OUT, exist_ok=True)
    field(True).save(os.path.join(OUT, "field_0.png"))
    field(False).save(os.path.join(OUT, "field_1.png"))
    print("wrote field_0/1 to", os.path.normpath(OUT))


if __name__ == "__main__":
    main()
