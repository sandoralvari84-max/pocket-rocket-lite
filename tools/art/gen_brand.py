#!/usr/bin/env python3
"""
Pocket Rocket brand emblem — ORIGINAL owned art (Pillow). A stylised rocket in a
broken amber/cyan ring (the brand-board motif), transparent background, 240px.
Used on the home/chat hero and onboarding. Regenerate: python tools/art/gen_brand.py
"""
import math
import os
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "brand")
S = 240
C = S // 2
AMBER = (255, 152, 16, 255)
AMBER_HI = (255, 200, 110, 255)
AMBER_DK = (200, 104, 8, 255)
CYAN = (0, 229, 255, 255)
WHITE = (240, 244, 250, 255)
INK = (14, 20, 30, 255)
CLEAR = (0, 0, 0, 0)


def emblem() -> Image.Image:
    img = Image.new("RGBA", (S, S), CLEAR)
    # soft glow
    glow = Image.new("RGBA", (S, S), CLEAR)
    dg = ImageDraw.Draw(glow)
    dg.ellipse([30, 30, S - 30, S - 30], outline=(255, 152, 16, 110), width=18)
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(12)))
    d = ImageDraw.Draw(img)
    # broken ring: amber arc (top-right) + cyan arc (bottom-left)
    box = [26, 26, S - 26, S - 26]
    d.arc(box, -70, 120, fill=AMBER, width=10)
    d.arc(box, 130, 250, fill=CYAN, width=10)

    # rocket, tilted ~ -45° (nose up-right). Build upright around origin then rotate.
    r = Image.new("RGBA", (S, S), CLEAR)
    rd = ImageDraw.Draw(r)
    bx = C
    # body
    rd.polygon([(bx, 56), (bx + 26, 104), (bx + 22, 150), (bx - 22, 150), (bx - 26, 104)],
               fill=AMBER, outline=INK, width=3)
    rd.polygon([(bx, 56), (bx + 26, 104), (bx + 6, 104), (bx - 2, 70)], fill=AMBER_HI)   # nose light
    rd.polygon([(bx - 22, 150), (bx + 22, 150), (bx + 16, 150), (bx - 16, 150)], fill=AMBER_DK)
    # window
    rd.ellipse([bx - 14, 92, bx + 14, 120], fill=CYAN, outline=INK, width=3)
    rd.ellipse([bx - 6, 96, bx + 6, 108], fill=WHITE)
    # fins
    rd.polygon([(bx - 26, 118), (bx - 46, 158), (bx - 22, 150)], fill=AMBER_DK, outline=INK)
    rd.polygon([(bx + 26, 118), (bx + 46, 158), (bx + 22, 150)], fill=AMBER_DK, outline=INK)
    # flame
    rd.polygon([(bx - 12, 150), (bx, 196), (bx + 12, 150)], fill=(255, 196, 70, 255))
    rd.polygon([(bx - 7, 150), (bx, 178), (bx + 7, 150)], fill=WHITE)
    r = r.rotate(-45, resample=Image.BICUBIC, center=(C, C))
    img.alpha_composite(r)

    # a couple of sparkle stars
    for (sx, sy, sr) in [(188, 70, 4), (62, 170, 5), (176, 180, 3)]:
        d.line([(sx - sr, sy), (sx + sr, sy)], fill=WHITE, width=2)
        d.line([(sx, sy - sr), (sx, sy + sr)], fill=WHITE, width=2)
    return img


def main():
    os.makedirs(OUT, exist_ok=True)
    emblem().save(os.path.join(OUT, "emblem.png"))
    print("wrote emblem to", os.path.normpath(OUT))


if __name__ == "__main__":
    main()
