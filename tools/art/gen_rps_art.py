#!/usr/bin/env python3
"""
Rock-Paper-Scissors HAND tokens (rock = fist, paper = open hand, scissors = V).
Drawn PROPERLY as a single UNIFIED silhouette: palm + fingers + thumb are unioned
into one mask (ImageChops.lighter), filled with a warm skin gradient, then given ONE
continuous outline (dilate − mask). No stacked capsules with visible seams, so the
thumb reads as part of the hand instead of a broken add-on. Rounded fingertips come
from capsule masks. Soft inner shade + gloss + crease lines + amber wrist cuff.
Supersampled (240) → 120 LANCZOS. Pillow, 100% owned.

Regenerate: python tools/art/gen_rps_art.py
"""
import os
import sys
import math
from PIL import Image, ImageDraw, ImageChops, ImageFilter
sys.path.insert(0, os.path.dirname(__file__))
from polish import P  # noqa: E402 (glow/spec/cuff finish helpers)

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "arcade", "rps")
W = 240

SKIN_HI = (255, 227, 196)
SKIN = (238, 190, 148)
SKIN_DK = (196, 142, 104)
CREASE = (176, 120, 86, 150)
AMBER_HI = (255, 196, 110)
AMBER = (255, 152, 0)            # brand amber EXACTLY #FF9800
OUT_C = (22, 28, 40, 255)


# ---- silhouette machinery -------------------------------------------------
def _blank():
    return Image.new("L", (W, W), 0)


def rr_mask(box, r):
    m = _blank(); ImageDraw.Draw(m).rounded_rectangle(box, radius=r, fill=255); return m


def cap_mask(w, h, angle, cx, cy):
    """A rounded capsule (stadium), rotated, placed centred at (cx,cy)."""
    c = Image.new("L", (w, h), 0)
    ImageDraw.Draw(c).rounded_rectangle([0, 0, w - 1, h - 1], radius=w // 2, fill=255)
    if angle:
        c = c.rotate(angle, expand=True, resample=Image.BICUBIC)
    m = _blank(); m.paste(c, (int(cx - c.width / 2), int(cy - c.height / 2)), c); return m


def union(masks):
    m = _blank()
    for x in masks:
        m = ImageChops.lighter(m, x)
    return m


def vgrad(top, bot):
    g = Image.new("RGBA", (W, W)); px = g.load()
    for y in range(W):
        t = y / (W - 1)
        c = (int(top[0] + (bot[0] - top[0]) * t), int(top[1] + (bot[1] - top[1]) * t),
             int(top[2] + (bot[2] - top[2]) * t), 255)
        for x in range(W):
            px[x, y] = c
    return g


def render(mask, creases=()):
    """Fill the unified silhouette with skin + one clean outline + shade + gloss."""
    im, d = P.canvas(W)
    P.glow(im, 120, 120, 84, (255, 180, 90), 26)
    # contact shadow on the surface
    sh = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse([52, 198, 188, 226], fill=(0, 0, 0, 95))
    im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(10)))
    cuff(im)
    # fill with gradient through the silhouette mask
    im.alpha_composite(Image.composite(vgrad(SKIN_HI, SKIN), Image.new("RGBA", (W, W), (0, 0, 0, 0)), mask))
    # soft bottom inner-shade for volume
    shade = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    ImageDraw.Draw(shade).ellipse([40, 150, 200, 260], fill=SKIN_DK + (120,))
    im.alpha_composite(Image.composite(shade.filter(ImageFilter.GaussianBlur(14)), Image.new("RGBA", (W, W), (0, 0, 0, 0)), mask))
    # single continuous outline = dilate(mask) − mask
    outer = mask.filter(ImageFilter.MaxFilter(7))
    ring = ImageChops.subtract(outer, mask)
    oc = Image.new("RGBA", (W, W), OUT_C[:3] + (0,)); oc.putalpha(ring)
    im.alpha_composite(oc)
    # crease lines (finger separations / folds), clipped to the silhouette
    if creases:
        cl = Image.new("RGBA", (W, W), (0, 0, 0, 0)); cd = ImageDraw.Draw(cl)
        for (x0, y0, x1, y1) in creases:
            cd.line([(x0, y0), (x1, y1)], fill=CREASE, width=4)
        im.alpha_composite(Image.composite(cl, Image.new("RGBA", (W, W), (0, 0, 0, 0)), mask))
    # subtle sheen high on the knuckles (small + soft, not a bright smudge)
    P.spec(im, 102, 96, 13, 8, 110)
    return P.finish(im, 120)


def cuff(im):
    P.rr_grad(im, [70, 198, 170, 228], 13, AMBER_HI, AMBER, outline=OUT_C, ow=5)


# ---- ONE hand, three poses: shared palm + thumb; only the fingers change -----
# Palm is a rounded block; fingers are vertical rounded capsules whose bases tuck
# BEHIND the palm (hidden) so extended fingers rise cleanly from the top edge, and
# curled fingers read as knuckle bumps. The thumb is ONE shape in every pose: a short
# capsule on the UPPER-LEFT of the palm, tip pointing up-and-out (never hanging down).
PALM_BOX = [80, 128, 172, 206]
PALM_TOP = 128
PALM_BASE = 150   # finger/knuckle bases live here, tucked under the palm

def _palm():
    return rr_mask(PALM_BOX, 30)

def _thumb():
    # short capsule, rotated CCW so the tip points up-left; base sits inside the palm
    return cap_mask(30, 66, 36, 72, 133)

def _finger(cx, topy, w=27):
    h = PALM_BASE - topy
    return cap_mask(w, h, 0, cx, (topy + PALM_BASE) / 2)

def _knuckle(cx):
    # a short curled-finger bump that peeks just above the palm's top edge
    return cap_mask(27, 52, 0, cx, PALM_TOP - 4)


def rock():
    m = union([_palm(), _thumb()] + [_knuckle(x) for x in (92, 118, 144, 168)])
    creases = [(105, 110, 105, 128), (131, 110, 131, 128), (157, 110, 157, 128)]
    return render(m, creases)


def paper():
    fingers = [_finger(94, 66, 27), _finger(120, 50, 29), _finger(146, 64, 27), _finger(168, 82, 23)]
    m = union([_palm(), _thumb(), *fingers])
    creases = [(107, 128, 107, 150), (133, 128, 133, 150), (157, 128, 157, 150)]
    return render(m, creases)


def scissors():
    # index + middle extended in a tighter V; ring + pinky curled (knuckle bumps)
    m = union([_palm(), _thumb(), _finger(113, 56, 26), _finger(135, 52, 26), _knuckle(152), _knuckle(171)])
    creases = [(124, 128, 124, 150)]
    return render(m, creases)


def main():
    os.makedirs(OUT, exist_ok=True)
    rock().save(os.path.join(OUT, "rock.png"))
    paper().save(os.path.join(OUT, "paper.png"))
    scissors().save(os.path.join(OUT, "scissors.png"))
    print("wrote unified-silhouette rock, paper, scissors to", os.path.normpath(OUT))


if __name__ == "__main__":
    main()
