#!/usr/bin/env python3
"""
Nav-bar icons — monochrome WHITE line glyphs matching the approved mockup's clean
stroked icon set (chat / gamepad / wrench / books / gear, + radio & mic for the
greyed "SOON" keys). Rendered white on transparent so the app tints them per state
(amber when active, faint grey when not) — no baked colour.

Drawn at 4x then LANCZOS to 96px. Pillow, owned.
Regenerate: python tools/art/gen_nav_icons.py
"""
import math
import os
from PIL import Image, ImageDraw

OUT = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "assets", "ui", "nav"))
os.makedirs(OUT, exist_ok=True)

SS = 4                   # supersample (render 96*4, downscale)
N = 96
WS = N * SS
S = WS / 24.0            # mockup uses a 24x24 viewBox
W = int(1.7 * S)         # stroke width ~ mockup stroke-width 1.7
WHITE = (245, 248, 255, 255)


def P(x, y):
    return (x * S, y * S)


def cap(d, x, y, w=W):
    r = w / 2
    cx, cy = x * S, y * S
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=WHITE)


def stroke(d, pts, w=W, caps=True):
    p = [P(x, y) for (x, y) in pts]
    d.line(p, fill=WHITE, width=w, joint="curve")
    if caps:
        for (x, y) in (pts[0], pts[-1]):
            cap(d, x, y, w)


def rrect(d, x0, y0, x1, y1, rad, w=W):
    d.rounded_rectangle([P(x0, y0), P(x1, y1)], radius=rad * S, outline=WHITE, width=w)


def circle(d, cx, cy, r, w=W, fill=False):
    bb = [P(cx - r, cy - r), P(cx + r, cy + r)]
    if fill:
        d.ellipse(bb, fill=WHITE)
    else:
        d.ellipse(bb, outline=WHITE, width=w)


def arc(d, cx, cy, r, a0, a1, w=W):
    bb = [P(cx - r, cy - r), P(cx + r, cy + r)]
    d.arc(bb, a0, a1, fill=WHITE, width=w)
    for a in (a0, a1):
        cap(d, cx + r * math.cos(math.radians(a)), cy + r * math.sin(math.radians(a)), w)


def new():
    im = Image.new("RGBA", (WS, WS), (0, 0, 0, 0))
    return im, ImageDraw.Draw(im)


def save(im, name):
    im.resize((N, N), Image.LANCZOS).save(os.path.join(OUT, name + ".png"))


def chat():
    im, d = new()
    rrect(d, 3.5, 3.5, 20.5, 15.5, 4.5)              # speech bubble
    stroke(d, [(8.5, 15), (5, 20), (12, 15.5)])      # tail
    return im


def games():
    im, d = new()
    rrect(d, 2.5, 8, 21.5, 16.5, 4.2)                # gamepad body
    stroke(d, [(7, 10.6), (7, 13.6)])                 # d-pad |
    stroke(d, [(5.5, 12.1), (8.5, 12.1)])             # d-pad —
    circle(d, 15.8, 11, 0.4, fill=True)               # button
    circle(d, 18.2, 13.2, 0.4, fill=True)             # button
    return im


def tools():
    im, d = new()
    stroke(d, [(5.5, 19), (14, 10.5)])                # handle
    arc(d, 16.3, 8, 3.2, -35, 210)                    # wrench head
    return im


def books():
    im, d = new()
    rrect(d, 3.5, 5, 10.5, 19.5, 1.6)                 # left book
    rrect(d, 12.5, 5, 20.5, 19.5, 1.6)                # right book
    stroke(d, [(7, 5.4), (7, 19.1)], w=int(W * 0.7))  # spine hint
    return im


def settings():
    im, d = new()
    circle(d, 12, 12, 3)                               # hub
    for i in range(8):                                 # teeth
        a = math.radians(i * 45)
        stroke(d, [(12 + 7.0 * math.cos(a), 12 + 7.0 * math.sin(a)),
                   (12 + 9.4 * math.cos(a), 12 + 9.4 * math.sin(a))], w=int(W * 1.1))
    circle(d, 12, 12, 7.6)                             # rim
    return im


def radio():
    im, d = new()
    circle(d, 12, 13.5, 6.6)                           # dial
    circle(d, 12, 13.5, 1.8, fill=True)                # centre
    stroke(d, [(12, 7), (12, 3)])                      # antenna
    stroke(d, [(8, 3), (16, 3)])                       # top bar
    return im


def mic():
    im, d = new()
    rrect(d, 9, 3, 15, 14, 3)                          # capsule
    arc(d, 12, 11, 6, 0, 180)                          # cradle
    stroke(d, [(12, 17), (12, 21)])                    # stem
    stroke(d, [(8.5, 21), (15.5, 21)], w=int(W * 0.9)) # foot
    return im


def main():
    save(chat(), "chat")
    save(games(), "games")
    save(tools(), "tools")
    save(books(), "library")
    save(settings(), "settings")
    save(radio(), "radio")
    save(mic(), "dictaphone")
    print("wrote chat/games/tools/library/settings/radio/dictaphone to", OUT)


if __name__ == "__main__":
    main()
