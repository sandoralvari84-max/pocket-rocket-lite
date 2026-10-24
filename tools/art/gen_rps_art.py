#!/usr/bin/env python3
"""
Rock-Paper-Scissors — hand tokens, "Pocket Rocket nostalgia" polish (smooth, shaded,
glossy chrome). Smooth 2x->1x via shared helpers. Same filenames/sizes. Pillow, owned.
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFilter
sys.path.insert(0, os.path.dirname(__file__))
from polish import P  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "arcade", "rps")
STEEL_HI = (224, 232, 242); STEEL = (150, 164, 182); STEEL_DK = (78, 90, 106)


def shadow(im, box, a=90):
    g = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ImageDraw.Draw(g).ellipse(box, fill=(0, 0, 0, a))
    im.alpha_composite(g.filter(ImageFilter.GaussianBlur(9)))


def rock():
    W = 240
    im, d = P.canvas(W)
    P.glow(im, 120, 130, 80, (150, 162, 180), 36)
    shadow(im, [52, 180, 192, 210])
    pts = [(40, 168), (32, 112), (80, 68), (148, 60), (200, 100), (208, 160), (172, 192), (88, 192)]
    P.poly_grad(im, pts, (190, 200, 214), (70, 80, 96))
    P.poly_grad(im, [(80, 68), (148, 60), (132, 116), (72, 112)], (210, 218, 230), (150, 160, 176), outline=None)
    P.spec(im, 108, 96, 26, 16)
    return P.finish(im, 120)


def paper():
    W = 240
    im, d = P.canvas(W)
    shadow(im, [48, 196, 196, 216], a=70)
    P.poly_grad(im, [(52, 32), (168, 32), (208, 72), (208, 208), (52, 208)], (248, 246, 236), (206, 204, 190))
    P.poly_grad(im, [(168, 32), (208, 72), (168, 72)], (210, 208, 194), (170, 168, 156))
    for y in (104, 132, 160):
        d.line([(76, y), (184, y)], fill=(150, 158, 150, 255), width=5)
    P.gloss(im, [52, 32, 208, 130])
    return P.finish(im, 120)


def scissors():
    W = 240
    im, d = P.canvas(W)
    P.glow(im, 120, 120, 80, STEEL, 34)
    shadow(im, [60, 196, 180, 214], a=70)
    P.poly_grad(im, [(120, 128), (196, 34), (210, 50), (140, 142)], STEEL_HI, STEEL_DK)
    P.poly_grad(im, [(120, 128), (44, 34), (30, 50), (100, 142)], STEEL_HI, STEEL_DK)
    d.ellipse([78, 146, 130, 200], outline=(255, 170, 40, 255), width=14)
    d.ellipse([110, 146, 162, 200], outline=(40, 224, 255, 255), width=14)
    P.ell_grad(im, [108, 112, 132, 136], STEEL_HI, STEEL_DK)  # pivot
    return P.finish(im, 120)


def main():
    os.makedirs(OUT, exist_ok=True)
    rock().save(os.path.join(OUT, "rock.png"))
    paper().save(os.path.join(OUT, "paper.png"))
    scissors().save(os.path.join(OUT, "scissors.png"))
    print("wrote polished rock, paper, scissors to", os.path.normpath(OUT))


if __name__ == "__main__":
    main()
