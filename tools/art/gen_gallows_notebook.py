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


def win_run(frame: int) -> Image.Image:
    """Freed stickman mid-stride, facing right, leaning into the run.

    Two alternating gait frames (frame 0/1) with trailing pencil dust so the
    game can flip between them while sliding the sprite off the page. No gallows
    and no ground line here: only the figure moves, leaving the page clear.
    Same jittered graphite strokes as the stages so it reads hand-drawn.
    """
    random.seed(70 + frame)
    img = Image.new("RGBA", (W, H), CLEAR)
    d = ImageDraw.Draw(img)
    cx, cy = 230, 300
    r = HEAD_R
    jcircle(d, cx, cy, r, INK, 6)                                     # head
    # happy open mouth, shifted toward the direction of travel
    d.arc([cx - 10, cy - 4, cx + 22, cy + 20], 20, 160, fill=INK, width=4)

    hipx, hipy = cx + 22, cy + r + 118                               # hip (body leans forward/right)
    jline(d, cx, cy + r, hipx, hipy, INK, 6)                          # torso
    shx, shy = cx + 7, cy + r + 34                                    # shoulder

    if frame == 0:
        kneeF, footF = (hipx + 46, hipy + 40), (hipx + 78, hipy + 76)  # front leg reaching
        kneeB, footB = (hipx - 40, hipy + 36), (hipx - 72, hipy + 70)  # back leg trailing
        elbF, handF = (shx + 34, shy + 20), (shx + 22, shy + 54)       # front arm down/back
        elbB, handB = (shx - 32, shy + 8),  (shx - 60, shy - 10)       # back arm up/back
    else:
        kneeF, footF = (hipx + 20, hipy + 46), (hipx + 40, hipy + 84)  # front leg under body
        kneeB, footB = (hipx + 4,  hipy + 40), (hipx - 30, hipy + 74)  # back leg lifting
        elbF, handF = (shx + 30, shy - 6),  (shx + 58, shy - 20)       # front arm up/forward
        elbB, handB = (shx - 30, shy + 22), (shx - 46, shy + 48)       # back arm down

    # legs + arms as two jointed strokes each
    jline(d, hipx, hipy, kneeF[0], kneeF[1], INK, 6); jline(d, kneeF[0], kneeF[1], footF[0], footF[1], INK, 6)
    jline(d, hipx, hipy, kneeB[0], kneeB[1], INK, 6); jline(d, kneeB[0], kneeB[1], footB[0], footB[1], INK, 6)
    jline(d, shx, shy, elbF[0], elbF[1], INK, 6);     jline(d, elbF[0], elbF[1], handF[0], handF[1], INK, 6)
    jline(d, shx, shy, elbB[0], elbB[1], INK, 6);     jline(d, elbB[0], elbB[1], handB[0], handB[1], INK, 6)

    # trailing dust / speed lines behind the runner (to the left)
    base = hipy + 60
    for i in range(3):
        y = base - i * 26 + (4 if frame else 0)
        jline(d, cx - 72 - i * 16, y, cx - 118 - i * 20, y, INK2, 4)
    return img


def main():
    os.makedirs(OUT, exist_ok=True)
    for n in range(7):
        stage(n).save(os.path.join(OUT, f"stage{n}.png"))
    win().save(os.path.join(OUT, "win.png"))
    win_run(0).save(os.path.join(OUT, "win_run1.png"))
    win_run(1).save(os.path.join(OUT, "win_run2.png"))
    print("wrote notebook stage0..6 + win + win_run1/2 to", os.path.normpath(OUT))


if __name__ == "__main__":
    main()
