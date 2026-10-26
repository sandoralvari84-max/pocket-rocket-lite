#!/usr/bin/env python3
"""
Rock-Paper-Scissors — HAND GESTURE tokens (rock = fist, paper = flat hand,
scissors = two-finger V). Chunky, stylised, readable cartoon hands with the shared
"Pocket Rocket nostalgia" finish (soft skin gradient, warm glow, glossy highlight,
amber wrist cuff for brand). Supersampled 2x -> 1x LANCZOS. Same filenames/sizes
(120px) so the game needs no asset-path change. Pillow, 100% owned.

Regenerate: python tools/art/gen_rps_art.py
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFilter
sys.path.insert(0, os.path.dirname(__file__))
from polish import P  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "arcade", "rps")

# Warm cartoon skin ramp + brand amber wrist cuff.
SKIN_HI = (255, 227, 196)
SKIN = (241, 193, 150)
SKIN_DK = (198, 146, 108)
CREASE = (196, 142, 104, 170)
AMBER_HI = (255, 196, 110)
AMBER = (255, 152, 0)          # brand amber EXACTLY #FF9800
OUT_C = (20, 26, 38, 255)


def shadow(im, box, a=95):
    g = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ImageDraw.Draw(g).ellipse(box, fill=(0, 0, 0, a))
    im.alpha_composite(g.filter(ImageFilter.GaussianBlur(10)))


def capsule(w, h, angle, hi=SKIN_HI, base=SKIN):
    """A vertical stadium (rounded both ends) with skin gradient + outline, rotated."""
    cap = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    P.rr_grad(cap, [0, 0, w - 1, h - 1], w // 2, hi, base, outline=OUT_C, ow=5)
    if angle:
        cap = cap.rotate(angle, expand=True, resample=Image.BICUBIC)
    return cap


def place(im, sprite, cx, cy):
    """alpha-composite `sprite` centred at (cx, cy) on `im`."""
    im.alpha_composite(sprite, (int(cx - sprite.width / 2), int(cy - sprite.height / 2)))


def cuff(im):
    """Amber wrist band at the bottom — brand accent, shared by both hands."""
    P.rr_grad(im, [70, 196, 170, 226], 12, AMBER_HI, AMBER, outline=OUT_C, ow=5)


def rock():
    """A fist seen from the back — four curled knuckles, thumb across the front."""
    W = 240
    im, d = P.canvas(W)
    P.glow(im, 120, 130, 78, (255, 180, 90), 30)
    shadow(im, [52, 198, 188, 224])
    cuff(im)
    # back of the hand
    P.rr_grad(im, [60, 104, 180, 206], 34, SKIN_HI, SKIN, outline=OUT_C, ow=6)
    # four curled fingers along the top edge
    for x in (66, 94, 122, 150):
        P.rr_grad(im, [x, 84, x + 26, 132], 13, SKIN_HI, SKIN, outline=OUT_C, ow=4)
        d.line([(x + 3, 112), (x + 23, 112)], fill=CREASE, width=3)
    # thumb folded across the front (lower-left)
    place(im, capsule(40, 96, 62), 92, 158)
    P.spec(im, 96, 118, 20, 12)
    return P.finish(im, 120)


def paper():
    """A flat open hand, four fingers up + thumb out."""
    W = 240
    im, d = P.canvas(W)
    P.glow(im, 120, 120, 80, (255, 180, 90), 28)
    shadow(im, [54, 198, 186, 224])
    cuff(im)
    # palm
    P.rr_grad(im, [70, 116, 170, 206], 30, SKIN_HI, SKIN, outline=OUT_C, ow=6)
    # thumb out to the left
    place(im, capsule(34, 96, -58), 70, 150)
    # four fingers, gently fanned (index .. pinky); middle tallest
    place(im, capsule(28, 128, 7), 92, 92)
    place(im, capsule(30, 150, 2), 118, 74)
    place(im, capsule(28, 134, -4), 144, 86)
    place(im, capsule(24, 108, -13), 166, 104)
    P.spec(im, 104, 140, 22, 13)
    return P.finish(im, 120)


def scissors():
    """A fist with index + middle fingers extended in a V."""
    W = 240
    im, d = P.canvas(W)
    P.glow(im, 120, 120, 80, (255, 180, 90), 28)
    shadow(im, [56, 198, 184, 224])
    cuff(im)
    # fist / palm base
    P.rr_grad(im, [72, 126, 168, 206], 30, SKIN_HI, SKIN, outline=OUT_C, ow=6)
    # curled ring + pinky knuckles across the front
    for x in (120, 146):
        P.rr_grad(im, [x, 120, x + 24, 150], 10, SKIN_HI, SKIN, outline=OUT_C, ow=4)
    # thumb holding the folded fingers
    place(im, capsule(30, 70, 70), 150, 150)
    # the two extended fingers, splayed into a V
    place(im, capsule(28, 140, 19), 100, 92)
    place(im, capsule(28, 150, -17), 134, 86)
    P.spec(im, 108, 150, 20, 12)
    return P.finish(im, 120)


def main():
    os.makedirs(OUT, exist_ok=True)
    rock().save(os.path.join(OUT, "rock.png"))
    paper().save(os.path.join(OUT, "paper.png"))
    scissors().save(os.path.join(OUT, "scissors.png"))
    print("wrote hand-gesture rock, paper, scissors to", os.path.normpath(OUT))


if __name__ == "__main__":
    main()
