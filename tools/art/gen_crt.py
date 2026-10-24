#!/usr/bin/env python3
"""
CRT console display overlays — ORIGINAL owned art (Pillow). Restrained, per
docs/CRT_CONSOLE_DESIGN.md: a shared display treatment so every screen reads as one
machine. LOW intensity — must not hurt readability or touch.

  scanlines.png  6px tile  faint dark horizontal line every 3px (overlay, repeat)
  vignette.png   360x740   soft edge darkening + corner falloff (overlay, stretch)

Regenerate: python tools/art/gen_crt.py
"""
import os
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "crt")


def scanlines() -> Image.Image:
    # 6x6 tile: one faint dark line per 3px → gentle CRT raster.
    im = Image.new("RGBA", (6, 6), (0, 0, 0, 0))
    px = im.load()
    for y in range(6):
        a = 46 if (y % 3 == 0) else 0
        for x in range(6):
            px[x, y] = (0, 0, 0, a)
    return im


def vignette() -> Image.Image:
    w, h = 360, 740
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = im.load()
    for y in range(h):
        for x in range(w):
            # distance to nearest edge, normalized; darken only near the edges
            ex = min(x, w - 1 - x) / (w * 0.5)
            ey = min(y, h - 1 - y) / (h * 0.5)
            edge = min(ex, ey)              # 0 at edge, 1 at center
            d = max(0.0, 0.5 - edge) / 0.5  # only the outer ~half of the margin
            a = int(d * d * 120)            # soft, max ~120 at the very corner/edge
            px[x, y] = (4, 7, 11, a)
    return im


def main():
    os.makedirs(OUT, exist_ok=True)
    scanlines().save(os.path.join(OUT, "scanlines.png"))
    vignette().save(os.path.join(OUT, "vignette.png"))
    print("wrote scanlines + vignette to", os.path.normpath(OUT))


if __name__ == "__main__":
    main()
