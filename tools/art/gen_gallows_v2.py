#!/usr/bin/env python3
"""
Word Gallows — crisp hi-res gallows scene. ORIGINAL owned art (Pillow, in-repo).

Drawn at 600x720 (5:6) so it stays sharp when shown large (the old 240px art
was blown up ~4x and looked blurry). A wooden gallows; each wrong guess adds one
body part of a light stick figure:
  stage0..stage6.png  empty gallows -> fully hanged
  win.png             the figure escaped, standing with arms raised

Full rights, no third-party assets. Regenerate: python tools/art/gen_gallows_v2.py
"""
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "arcade", "gallows")
W, H = 600, 720
CLEAR = (0, 0, 0, 0)
WOOD = (150, 103, 60, 255)
WOOD_DK = (108, 72, 40, 255)
WOOD_HI = (182, 132, 82, 255)
ROPE = (210, 180, 130, 255)
FIG = (232, 236, 242, 255)      # light stick figure (reads on dark bg)
FIG_DK = (120, 128, 140, 255)
OUTLINE = (18, 24, 32, 255)
HEAD = (402, 236)               # noose / head centre
HEAD_R = 36


def beam(d, x0, y0, x1, y1):
    d.rectangle([x0, y0, x1, y1], fill=WOOD, outline=OUTLINE, width=3)
    d.line([(x0 + 4, y0 + 4), (x1 - 4, y0 + 4)], fill=WOOD_HI, width=3)
    for y in range(y0 + 12, y1, 14):
        d.line([(x0 + 3, y), (x1 - 3, y)], fill=WOOD_DK, width=1)


def gallows(d):
    beam(d, 80, 650, 320, 690)    # base platform
    beam(d, 120, 90, 160, 672)    # vertical post
    beam(d, 120, 90, 430, 128)    # top beam
    d.line([(405, 128), (405, HEAD[1] - HEAD_R)], fill=ROPE, width=6)  # rope
    d.ellipse([HEAD[0] - HEAD_R, HEAD[1] - HEAD_R, HEAD[0] + HEAD_R, HEAD[1] + HEAD_R],
              outline=ROPE, width=6)  # noose loop


def figure(d, parts):
    cx, cy = HEAD
    body_top = cy + HEAD_R
    body_bot = body_top + 150
    if "head" in parts:
        d.ellipse([cx - HEAD_R + 4, cy - HEAD_R + 4, cx + HEAD_R - 4, cy + HEAD_R - 4],
                  fill=FIG, outline=OUTLINE, width=3)
    if "body" in parts:
        d.line([(cx, body_top), (cx, body_bot)], fill=FIG, width=10)
    if "larm" in parts:
        d.line([(cx, body_top + 26), (cx - 56, body_top + 74)], fill=FIG, width=9)
    if "rarm" in parts:
        d.line([(cx, body_top + 26), (cx + 56, body_top + 74)], fill=FIG, width=9)
    if "lleg" in parts:
        d.line([(cx, body_bot), (cx - 46, body_bot + 86)], fill=FIG, width=9)
    if "rleg" in parts:
        d.line([(cx, body_bot), (cx + 46, body_bot + 86)], fill=FIG, width=9)


STAGES = [
    [],
    ["head"],
    ["head", "body"],
    ["head", "body", "larm"],
    ["head", "body", "larm", "rarm"],
    ["head", "body", "larm", "rarm", "lleg"],
    ["head", "body", "larm", "rarm", "lleg", "rleg"],
]


def win_img():
    img = Image.new("RGBA", (W, H), CLEAR)
    d = ImageDraw.Draw(img)
    gallows(d)
    # a free figure standing on the platform, arms raised
    sx, sy = 210, 470
    d.ellipse([sx - 30, sy - 30, sx + 30, sy + 30], fill=FIG, outline=OUTLINE, width=3)
    d.line([(sx, sy + 30), (sx, sy + 150)], fill=FIG, width=10)
    d.line([(sx, sy + 56), (sx - 50, sy + 10)], fill=FIG, width=9)   # arms up
    d.line([(sx, sy + 56), (sx + 50, sy + 10)], fill=FIG, width=9)
    d.line([(sx, sy + 150), (sx - 40, sy + 230)], fill=FIG, width=9)
    d.line([(sx, sy + 150), (sx + 40, sy + 230)], fill=FIG, width=9)
    # smile
    d.arc([sx - 14, sy - 10, sx + 14, sy + 16], 20, 160, fill=OUTLINE, width=3)
    return img


def main():
    os.makedirs(OUT, exist_ok=True)
    for i, parts in enumerate(STAGES):
        img = Image.new("RGBA", (W, H), CLEAR)
        d = ImageDraw.Draw(img)
        gallows(d)
        figure(d, parts)
        img.save(os.path.join(OUT, f"stage{i}.png"))
    win_img().save(os.path.join(OUT, "win.png"))
    print("wrote stage0..6 + win to", os.path.normpath(OUT))


if __name__ == "__main__":
    main()
