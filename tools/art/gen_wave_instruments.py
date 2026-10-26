#!/usr/bin/env python3
"""
Voice instrument strips — the companion's "face". A full redesign of the speak window:
instead of one flat line, the bar stacks THREE seamless, tileable strips that scroll at
different speeds (parallax depth) behind the CRT glass. All strips are rendered in WHITE
with the glow carried by ALPHA, so React-Native `tintColor` can recolour them per persona
AND per task-state (amber / cyan / violet / gold / red) without regenerating anything.

Layers (per persona, same engine, distinct waveform character):
  wv_depth.png          shared soft low-freq swell — ambient depth, heavy blur, no core
  wv_main_<persona>.png the signature waveform (glow body)
  wv_core_<persona>.png the same path as a thin white-hot wire (bright centre)

Sentinel = crisp oscilloscope composite (alert, technical).
Nova     = soft rounded swell + gentle ripple (calm, breathing).

Seamless: every component is sin(2*pi*k*x/W) with INTEGER k, so value at x=W equals x=0.
Drawn at 3x supersample + Gaussian-blurred glow, then LANCZOS down. Pillow, owned.
Run: python tools/art/gen_wave_instruments.py
"""
import os
import math
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "assets", "ui"))
os.makedirs(OUT, exist_ok=True)
W, H = 1200, 220
MID = H / 2
WHITE = (255, 255, 255)


def strip(points, *, glow_w, line_w, blur, core=False, core_w=2.0, glow_a=150):
    """Render a white wave strip: soft glow underlay + crisp line (+ optional hot core)."""
    ss = 3
    w, h = W * ss, H * ss
    pts = [(x * ss, y * ss) for (x, y) in points]
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    g = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(g).line(pts, fill=WHITE + (glow_a,), width=int(glow_w * ss), joint="curve")
    im.alpha_composite(g.filter(ImageFilter.GaussianBlur(blur * ss)))
    d = ImageDraw.Draw(im)
    d.line(pts, fill=WHITE + (235,), width=int(line_w * ss), joint="curve")
    if core:
        d.line(pts, fill=WHITE + (255,), width=max(1, int(core_w * ss)), joint="curve")
    return im.resize((W, H), Image.LANCZOS)


def sample(fn, n=2400):
    """Sample y=fn(x) over [0,W] at high density for smooth curves."""
    return [(W * i / n, fn(W * i / n)) for i in range(n + 1)]


# ---- signature waveforms (all seamless: integer cycles over W) ----

def f_depth(x):
    # Big slow swell + a half-rate under-roll. Ambient, wide.
    t = x / W
    return MID - H * 0.20 * (math.sin(2 * math.pi * 1 * t) + 0.35 * math.sin(2 * math.pi * 2 * t + 1.1))


def f_sentinel(x):
    # Oscilloscope composite: fundamental + 3rd + a touch of 7th -> lively, "technical".
    t = x / W
    y = (math.sin(2 * math.pi * 6 * t)
         + 0.42 * math.sin(2 * math.pi * 18 * t + 0.6)
         + 0.16 * math.sin(2 * math.pi * 42 * t))
    return MID - H * 0.30 * (y / 1.58)


def f_nova(x):
    # Soft rounded breathing: a dominant low swell + gentle ripple, no sharp edges.
    t = x / W
    y = (math.sin(2 * math.pi * 3 * t)
         + 0.30 * math.sin(2 * math.pi * 6 * t + 0.9)
         + 0.12 * math.sin(2 * math.pi * 9 * t + 2.0))
    return MID - H * 0.30 * (y / 1.42)


def main():
    # Fine, clean strokes — a precise signal trace, not a fat rope (matches the mockup).
    strip(sample(f_depth), glow_w=22, line_w=5.0, blur=13, glow_a=105).save(os.path.join(OUT, "wv_depth.png"))

    strip(sample(f_sentinel), glow_w=9, line_w=2.4, blur=5, glow_a=135).save(os.path.join(OUT, "wv_main_sentinel.png"))
    strip(sample(f_sentinel), glow_w=5, line_w=1.3, blur=2.4, core=True, core_w=0.9, glow_a=190).save(os.path.join(OUT, "wv_core_sentinel.png"))

    strip(sample(f_nova), glow_w=12, line_w=3.2, blur=7, glow_a=135).save(os.path.join(OUT, "wv_main_nova.png"))
    strip(sample(f_nova), glow_w=7, line_w=1.7, blur=3, core=True, core_w=1.1, glow_a=190).save(os.path.join(OUT, "wv_core_nova.png"))

    print("wrote wv_depth / wv_main_* / wv_core_* to", OUT)


if __name__ == "__main__":
    main()
