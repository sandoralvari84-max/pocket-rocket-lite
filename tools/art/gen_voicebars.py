#!/usr/bin/env python3
"""
Voice-bar waveforms — two DISTINCT seamless, tileable strips scrolled continuously
behind the home voice meter (fluid motion = translateX of these, no stepping):

  wave4_amber.png  — Sentinel: an angular 4-point wave (crisp oscilloscope), amber
  ekg_cyan.png     — Nova: a gentle EKG / heartbeat trace, cyan

Each is seamlessly tileable left<->right (last point == first) so two copies scroll
forever with no seam. Drawn at 2x then LANCZOS for smooth anti-aliased lines, with a
soft glow underlay + bright white core. Pillow, owned.
Run: python tools/art/gen_voicebars.py
"""
import os
import math
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "assets", "ui"))
os.makedirs(OUT, exist_ok=True)
W, H = 1200, 160
MID = H / 2
AMBER = (255, 152, 0)
CYAN = (0, 229, 255)


def render(points, rgb, core=True, gw=11, lw=4.5):
    ss = 2
    w, h = W * ss, H * ss
    pts = [(x * ss, y * ss) for (x, y) in points]
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    g = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(g).line(pts, fill=rgb + (170,), width=int(gw * ss), joint="curve")
    im.alpha_composite(g.filter(ImageFilter.GaussianBlur(5 * ss)))
    d = ImageDraw.Draw(im)
    d.line(pts, fill=rgb + (255,), width=int(lw * ss), joint="curve")
    if core:
        d.line(pts, fill=(236, 250, 255, 235), width=max(1, int(1.6 * ss)), joint="curve")
    return im.resize((W, H), Image.LANCZOS)


def wave4():
    # Angular 4-point wave: linear zig-zag through peak/trough nodes (triangle wave).
    # Period chosen so the strip tiles exactly; crisp, "technical" feel for Sentinel.
    period = W / 8                       # 8 lobes across the strip (tileable)
    A = H * 0.30
    pts = []
    x = 0.0
    step = period / 2
    up = True
    while x <= W + 1:
        pts.append((x, MID - (A if up else -A)))
        # insert the zero-crossing midpoints so the line crosses the centre crisply
        x += step
        up = not up
    # ensure endpoints sit on the centre line for a clean tiling seam
    pts = [(0, MID)] + pts + [(W, MID)]
    return render(pts, AMBER)


def ekg():
    # Gentle heartbeat: flat baseline with a soft P–QRS–T complex each period.
    period = 240                         # 5 beats across the strip (1200 = 5*240, tileable)
    A = H * 0.34
    pts = []
    for b in range(W // period):
        x0 = b * period
        seg = [
            (x0 + 0, MID), (x0 + 58, MID),
            (x0 + 74, MID - A * 0.22),    # P bump
            (x0 + 90, MID), (x0 + 100, MID),
            (x0 + 108, MID + A * 0.30),   # Q dip
            (x0 + 117, MID - A),          # R spike
            (x0 + 126, MID + A * 0.42),   # S dip
            (x0 + 136, MID), (x0 + 156, MID),
            (x0 + 176, MID - A * 0.28),   # T bump
            (x0 + 198, MID), (x0 + period, MID),
        ]
        pts.extend(seg)
    return render(pts, CYAN, gw=12, lw=5)


def main():
    wave4().save(os.path.join(OUT, "wave4_amber.png"))
    ekg().save(os.path.join(OUT, "ekg_cyan.png"))
    print("wrote wave4_amber.png + ekg_cyan.png to", OUT)


if __name__ == "__main__":
    main()
