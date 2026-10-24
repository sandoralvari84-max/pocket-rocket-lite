#!/usr/bin/env python3
"""
Draughts — premium board + pieces. ORIGINAL owned art (Pillow, in-repo).

A warm wooden board with dimensional, shaded checker pieces:
  square_light.png / square_dark.png  120px wood tiles with subtle grain
  man_amber.png  / man_cyan.png        shaded checker (highlight, rim, groove, drop shadow)
  king_amber.png / king_cyan.png       same + a gold crown emblem

Drawn at the native 120 px square size (no upscaling → no blur).
Full rights, no third-party assets. Regenerate: python tools/art/gen_draughts_art.py
"""
import os
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "arcade", "draughts")
S = 120
CLEAR = (0, 0, 0, 0)

# wood palette
LIGHT = (201, 168, 118, 255)
LIGHT_GRAIN = (214, 184, 136, 255)
LIGHT_DK = (182, 150, 100, 255)
DARK = (74, 50, 34, 255)
DARK_GRAIN = (88, 60, 42, 255)
DARK_DK = (58, 38, 26, 255)


def square(light: bool) -> Image.Image:
    base, grain, edge = (LIGHT, LIGHT_GRAIN, LIGHT_DK) if light else (DARK, DARK_GRAIN, DARK_DK)
    img = Image.new("RGBA", (S, S), base)
    d = ImageDraw.Draw(img)
    # horizontal wood grain streaks
    for y in range(6, S, 11):
        col = grain if (y // 11) % 2 == 0 else edge
        d.line([(0, y), (S, y + 2)], fill=col, width=2)
    # soft inner bevel
    d.rectangle([0, 0, S - 1, S - 1], outline=edge, width=2)
    d.line([(0, 0), (S, 0)], fill=(255, 255, 255, 36), width=2)
    return img


def _disc(base, hi, sh, rim):
    """A shaded checker disc with a soft drop shadow, on a transparent 120px tile."""
    img = Image.new("RGBA", (S, S), CLEAR)
    # drop shadow
    sh_layer = Image.new("RGBA", (S, S), CLEAR)
    ds = ImageDraw.Draw(sh_layer)
    ds.ellipse([18, 26, S - 14, S - 8], fill=(0, 0, 0, 110))
    sh_layer = sh_layer.filter(ImageFilter.GaussianBlur(5))
    img.alpha_composite(sh_layer)
    d = ImageDraw.Draw(img)
    cx, cy, r = S // 2, S // 2 - 4, 44
    # body + rim
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=base, outline=rim, width=4)
    # bottom-right shadow crescent
    d.ellipse([cx - r + 8, cy - r + 12, cx + r, cy + r], fill=sh)
    d.ellipse([cx - r, cy - r, cx + r - 6, cy + r - 10], fill=base)
    # top-left highlight
    d.ellipse([cx - r + 10, cy - r + 8, cx - 2, cy - 2], fill=hi)
    d.ellipse([cx - r + 14, cy - r + 12, cx + r - 18, cy + r - 22], fill=base)
    # engraved groove ring
    d.ellipse([cx - 26, cy - 26, cx + 26, cy + 26], outline=rim, width=3)
    return img, d, (cx, cy)


def man(base, hi, sh, rim):
    img, _d, _c = _disc(base, hi, sh, rim)
    return img


def king(base, hi, sh, rim):
    img, d, (cx, cy) = _disc(base, hi, sh, rim)
    gold, gold_dk = (255, 212, 96, 255), (190, 150, 40, 255)
    # crown: three points on a band
    band_y = cy + 10
    d.rectangle([cx - 22, band_y, cx + 22, band_y + 8], fill=gold, outline=gold_dk)
    pts_x = [cx - 22, cx - 7, cx + 7, cx + 22]
    peaks = [cx - 15, cx, cx + 15]
    tri = []
    base_y = band_y
    for i, px in enumerate(peaks):
        d.polygon([(pts_x[i], base_y), (px, base_y - 22), (pts_x[i + 1], base_y)], fill=gold, outline=gold_dk)
        tri.append(px)
    for px in tri:
        d.ellipse([px - 4, band_y - 30, px + 4, band_y - 22], fill=gold, outline=gold_dk)
    return img


def main():
    os.makedirs(OUT, exist_ok=True)
    square(True).save(os.path.join(OUT, "square_light.png"))
    square(False).save(os.path.join(OUT, "square_dark.png"))
    AMBER = ((255, 152, 16, 255), (255, 206, 120, 255), (188, 104, 8, 255), (70, 34, 0, 255))
    CYAN = ((0, 200, 230, 255), (160, 242, 255, 255), (0, 120, 150, 255), (0, 48, 62, 255))
    man(*AMBER).save(os.path.join(OUT, "man_amber.png"))
    man(*CYAN).save(os.path.join(OUT, "man_cyan.png"))
    king(*AMBER).save(os.path.join(OUT, "king_amber.png"))
    king(*CYAN).save(os.path.join(OUT, "king_cyan.png"))
    print("wrote squares + man/king (amber/cyan) to", os.path.normpath(OUT))


if __name__ == "__main__":
    main()
