#!/usr/bin/env python3
"""
CRT monitor interior for the voice scope — so the wave sits on a real screen, not a
black void. Tasteful + subtle: a cool vignette, a soft phosphor horizon band where the
wave rides, a faint grid, and fine scanlines. Neutral cool tone so it reads under both
the amber (Sentinel) and cyan (Nova) waves; persona colour still comes from the wave +
bloom on top. Opaque (fills the scope). Pillow, owned.
Run: python tools/art/gen_scope_bg.py
"""
import os
import math
from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "assets", "ui"))
os.makedirs(OUT, exist_ok=True)
W, H = 900, 240
MID = H / 2


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def main():
    CENTER = (13, 18, 26)   # slightly lit centre
    EDGE = (4, 6, 10)       # near-black edges
    im = Image.new("RGBA", (W, H), (0, 0, 0, 255))
    px = im.load()
    cx, cy = W / 2, H / 2
    maxd = math.hypot(cx, cy)
    for y in range(H):
        for x in range(W):
            d = math.hypot(x - cx, y - cy) / maxd       # 0 centre .. 1 corner
            v = min(1.0, d * 1.15)
            r, g, b = lerp(CENTER, EDGE, v)
            px[x, y] = (r, g, b, 255)

    # Soft phosphor horizon band where the wave baseline rides.
    band = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    bd = ImageDraw.Draw(band)
    bh = int(H * 0.30)
    bd.rectangle([0, int(MID - bh / 2), W, int(MID + bh / 2)], fill=(120, 165, 205, 26))
    im.alpha_composite(band.filter(ImageFilter.GaussianBlur(26)))

    # Faint grid — technical, but barely there.
    grid = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grid)
    for gx in range(0, W + 1, 48):
        gd.line([(gx, 0), (gx, H)], fill=(120, 150, 185, 12), width=1)
    for gy in range(0, H + 1, 40):
        gd.line([(0, gy), (W, gy)], fill=(120, 150, 185, 12), width=1)
    im.alpha_composite(grid)

    # Instrument detail — a scope reads as "complete" with a baseline, level ticks and
    # time divisions. Kept low-alpha so the wave stays the star.
    det = Image.new("RGBA", (W, H), (0, 0, 0, 0)); dd = ImageDraw.Draw(det)
    dd.line([(14, MID), (W - 14, MID)], fill=(140, 180, 215, 26), width=1)          # centre baseline
    for k in range(1, 6):                                                           # left-edge dB-ish level ticks
        up = int(MID - (k / 5) * (H * 0.34)); dn = int(MID + (k / 5) * (H * 0.34))
        w2 = 16 if k % 5 == 0 else 11
        dd.line([(10, up), (10 + w2, up)], fill=(140, 180, 215, 34), width=1)
        dd.line([(10, dn), (10 + w2, dn)], fill=(140, 180, 215, 34), width=1)
    for gx in range(24, W, 48):                                                     # time-division ticks on the baseline
        dd.line([(gx, MID - 5), (gx, MID + 5)], fill=(140, 180, 215, 40), width=1)
    im.alpha_composite(det)

    # Fine CRT scanlines.
    scan = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(scan)
    for y in range(0, H, 3):
        sd.line([(0, y), (W, y)], fill=(0, 0, 0, 46), width=1)
    im.alpha_composite(scan)

    # Oscilloscope graticule + numbered X/Y scales — reads as a real instrument.
    try:
        fnt = ImageFont.load_default(size=19)
    except TypeError:
        fnt = ImageFont.load_default()
    gr = Image.new("RGBA", (W, H), (0, 0, 0, 0)); gdd = ImageDraw.Draw(gr)
    DIVX, DIVY = W / 10.0, H / 6.0
    for i in range(1, 10):                                   # vertical graticule divisions
        x = int(i * DIVX); a = 26 if i == 5 else 14
        gdd.line([(x, 8), (x, H - 8)], fill=(120, 155, 190, a), width=1)
    for j in range(1, 6):                                    # horizontal graticule divisions
        y = int(j * DIVY); a = 26 if j == 3 else 14
        gdd.line([(10, y), (W - 10, y)], fill=(120, 155, 190, a), width=1)
    lab = (150, 188, 222, 120)
    for j, t in [(1, "+6"), (3, "0"), (5, "-6")]:            # Y scale (dB-ish), left edge
        gdd.text((16, int(j * DIVY) - 10), t, fill=lab, font=fnt)
    for i in [2, 4, 6, 8]:                                   # X scale (time divisions), bottom
        gdd.text((int(i * DIVX) - 6, H - 24), str(i), fill=lab, font=fnt)
    gdd.text((W - 44, 10), "dB", fill=(150, 188, 222, 90), font=fnt)
    gdd.text((W - 56, H - 24), "ms", fill=(150, 188, 222, 90), font=fnt)
    im.alpha_composite(gr)

    # A whisper of top glass sheen.
    sheen = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sheen).rectangle([0, 0, W, int(H * 0.16)], fill=(255, 255, 255, 10))
    im.alpha_composite(sheen.filter(ImageFilter.GaussianBlur(10)))

    im.convert("RGB").save(os.path.join(OUT, "scope_bg.png"))
    print("wrote scope_bg.png to", OUT)


if __name__ == "__main__":
    main()
