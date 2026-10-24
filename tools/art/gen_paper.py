#!/usr/bin/env python3
"""
Notebook-paper art for the pen-and-paper games (Three in a Row, Word Gallows).
ORIGINAL owned art (Pillow, in-repo). Inspired by a ripped notebook page — not
copied from any title.

  paper.png   256px  tileable cream ruled paper (horizontal rule + margin line + grain)
  torn.png    256x28 a ragged torn-edge strip (place at the top of the sheet)

Full rights, no third-party assets. Regenerate: python tools/art/gen_paper.py
"""
import os
import random
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "arcade", "paper")

CREAM = (244, 238, 222, 255)
CREAM_DK = (232, 224, 204, 255)
RULE = (200, 212, 226, 255)     # faint blue rule (opaque so paper has no alpha holes)
MARGIN = (224, 180, 180, 255)   # pink margin line


def paper() -> Image.Image:
    s = 256
    img = Image.new("RGBA", (s, s), CREAM)
    px = img.load()
    random.seed(21)
    # subtle paper grain
    for y in range(s):
        for x in range(s):
            n = random.randint(-6, 6)
            r, g, b, a = px[x, y]
            px[x, y] = (r + n, g + n, b + n - 2, 255)
    d = ImageDraw.Draw(img)
    # horizontal ruled lines every 32px (tiles cleanly)
    for y in range(0, s, 32):
        d.line([(0, y), (s, y)], fill=RULE, width=1)
    # a couple of faint smudges for warmth
    for _ in range(6):
        x = random.randrange(s); y = random.randrange(s); rr = random.randint(10, 24)
        d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=(238, 231, 213, 255))
    return img.filter(ImageFilter.GaussianBlur(0.3))


def torn() -> Image.Image:
    w, h = 256, 28
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    random.seed(4)
    # ragged bottom edge of cream paper with a soft shadow above the tear
    pts = [(0, h)]
    x = 0
    while x <= w:
        y = random.randint(2, h - 4)
        pts.append((x, y))
        x += random.randint(6, 14)
    pts.append((w, h))
    d.polygon(pts, fill=CREAM)
    # thin darker fibre line along the tear
    d.line(pts[1:-1], fill=CREAM_DK, width=1)
    return img


def main():
    os.makedirs(OUT, exist_ok=True)
    paper().save(os.path.join(OUT, "paper.png"))
    torn().save(os.path.join(OUT, "torn.png"))
    print("wrote paper, torn to", os.path.normpath(OUT))


if __name__ == "__main__":
    main()
