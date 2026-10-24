#!/usr/bin/env python3
"""
Word Gallows — notebook/doodle gallows. ORIGINAL owned art (Pillow, in-repo).

Hand-drawn graphite line art on a TRANSPARENT background so it sits on the ruled
notebook page like a doodle. Overwrites the stage sprites in-place (same filenames
the game already requires):
  stage0..stage6.png  empty gallows -> fully hanged (one body part per wrong guess)
  win.png             the figure escaped, arms raised

Full rights, no third-party assets. Regenerate: python tools/art/gen_gallows_notebook.py
"""
import os
import random
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "arcade", "gallows")
W, H = 600, 720
CLEAR = (0, 0, 0, 0)
INK = (46, 52, 64, 255)      # graphite
INK2 = (70, 78, 92, 220)     # lighter sketch pass
RED = (178, 59, 59, 255)

HEADC = (402, 212)
HEAD_R = 34


def jline(d, x0, y0, x1, y1, col=INK, w=6):
    """A slightly hand-drawn line: two offset strokes."""
    for k in range(2):
        jx = random.randint(-2, 2); jy = random.randint(-2, 2)
        c = col if k == 0 else INK2
        d.line([(x0 + jx, y0 + jy), (x1 + jx, y1 + jy)], fill=c, width=w - k * 2)


def jcircle(d, cx, cy, r, col=INK, w=6):
    for k in range(2):
        o = k * 2
        d.ellipse([cx - r + o, cy - r + o, cx + r - o, cy + r - o], outline=col if k == 0 else INK2, width=w - k * 2)


def gallows(d):
    jline(d, 80, 662, 330, 662, INK, 8)      # ground
    jline(d, 140, 662, 140, 96, INK, 8)      # post
    jline(d, 136, 100, 420, 100, INK, 8)     # top beam
    jline(d, 150, 100, 190, 150, INK, 5)     # brace
    jline(d, 402, 104, 402, HEADC[1] - HEAD_R, INK, 5)  # rope


def figure(d, parts):
    cx, cy = HEADC
    if parts >= 1: jcircle(d, cx, cy, HEAD_R, INK, 6)                 # head
    if parts >= 2: jline(d, cx, cy + HEAD_R, cx, cy + HEAD_R + 120, INK, 6)  # body
    bodymid = cy + HEAD_R + 50
    if parts >= 3: jline(d, cx, bodymid, cx - 52, bodymid + 54, INK, 6)      # left arm
    if parts >= 4: jline(d, cx, bodymid, cx + 52, bodymid + 54, INK, 6)      # right arm
    legtop = cy + HEAD_R + 120
    if parts >= 5: jline(d, cx, legtop, cx - 46, legtop + 78, INK, 6)        # left leg
    if parts >= 6: jline(d, cx, legtop, cx + 46, legtop + 78, INK, 6)        # right leg


def stage(n) -> Image.Image:
    random.seed(100 + n)
    img = Image.new("RGBA", (W, H), CLEAR)
    d = ImageDraw.Draw(img)
    gallows(d)
    figure(d, n)
    if n >= 6:  # X eyes on full hang
        d.line([(HEADC[0] - 16, HEADC[1] - 6), (HEADC[0] - 6, HEADC[1] + 4)], fill=RED, width=4)
        d.line([(HEADC[0] - 16, HEADC[1] + 4), (HEADC[0] - 6, HEADC[1] - 6)], fill=RED, width=4)
        d.line([(HEADC[0] + 6, HEADC[1] - 6), (HEADC[0] + 16, HEADC[1] + 4)], fill=RED, width=4)
        d.line([(HEADC[0] + 6, HEADC[1] + 4), (HEADC[0] + 16, HEADC[1] - 6)], fill=RED, width=4)
    return img


def win() -> Image.Image:
    random.seed(7)
    img = Image.new("RGBA", (W, H), CLEAR)
    d = ImageDraw.Draw(img)
    jline(d, 80, 662, 330, 662, INK, 8)  # ground only (escaped the gallows)
    cx, cy = 230, 300
    jcircle(d, cx, cy, HEAD_R, INK, 6)
    jline(d, cx, cy + HEAD_R, cx, cy + HEAD_R + 120, INK, 6)          # body
    mid = cy + HEAD_R + 40
    jline(d, cx, mid, cx - 56, mid - 60, INK, 6)                      # arms up
    jline(d, cx, mid, cx + 56, mid - 60, INK, 6)
    legtop = cy + HEAD_R + 120
    jline(d, cx, legtop, cx - 44, legtop + 80, INK, 6)
    jline(d, cx, legtop, cx + 44, legtop + 80, INK, 6)
    # smile
    d.arc([cx - 16, cy - 6, cx + 16, cy + 18], 20, 160, fill=INK, width=4)
    return img


def main():
    os.makedirs(OUT, exist_ok=True)
    for n in range(7):
        stage(n).save(os.path.join(OUT, f"stage{n}.png"))
    win().save(os.path.join(OUT, "win.png"))
    print("wrote notebook stage0..6 + win to", os.path.normpath(OUT))


if __name__ == "__main__":
    main()
