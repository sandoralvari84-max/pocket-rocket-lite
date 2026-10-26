#!/usr/bin/env python3
"""
Tool tile icons — monochrome WHITE line glyphs in the same grammar as the nav icons,
so the Tools page reads as one consistent line-icon set (the app tints each by its
section accent, amber/cyan). Replaces the emoji glyphs. One PNG per tool route.

Drawn at 4x then LANCZOS to 96px. Pillow, owned.
Regenerate: python tools/art/gen_tool_icons.py
"""
import math
import os
from PIL import Image, ImageDraw

OUT = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "assets", "ui", "tools"))
os.makedirs(OUT, exist_ok=True)

SS = 4
N = 96
WS = N * SS
S = WS / 24.0
W = int(1.7 * S)
WHITE = (245, 248, 255, 255)


def P(x, y): return (x * S, y * S)
def new():
    im = Image.new("RGBA", (WS, WS), (0, 0, 0, 0)); return im, ImageDraw.Draw(im)
def save(im, name): im.resize((N, N), Image.LANCZOS).save(os.path.join(OUT, name + ".png"))


def cap(d, x, y, w=W):
    r = w / 2; cx, cy = x * S, y * S
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=WHITE)


def line(d, pts, w=W, caps=True, close=False):
    p = [P(x, y) for (x, y) in pts]
    if close: p = p + [p[0]]
    d.line(p, fill=WHITE, width=w, joint="curve")
    if caps:
        ends = p if close else [pts[0], pts[-1]]
        for pt in (ends if close else [pts[0], pts[-1]]):
            x, y = pt; cap(d, x, y, w)


def rrect(d, x0, y0, x1, y1, rad, w=W):
    d.rounded_rectangle([P(x0, y0), P(x1, y1)], radius=rad * S, outline=WHITE, width=w)


def circle(d, cx, cy, r, w=W, fill=False):
    bb = [P(cx - r, cy - r), P(cx + r, cy + r)]
    d.ellipse(bb, fill=WHITE) if fill else d.ellipse(bb, outline=WHITE, width=w)


def arc(d, cx, cy, r, a0, a1, w=W, caps=True):
    d.arc([P(cx - r, cy - r), P(cx + r, cy + r)], a0, a1, fill=WHITE, width=w)
    if caps:
        for a in (a0, a1):
            cap(d, cx + r * math.cos(math.radians(a)), cy + r * math.sin(math.radians(a)), w)


def poly(d, pts, w=W):
    line(d, pts, w=w, close=True)


# ---- icons (24x24) ----
def mic():
    im, d = new(); rrect(d, 9, 3, 15, 14, 3); arc(d, 12, 11, 6, 0, 180); line(d, [(12, 17), (12, 21)]); line(d, [(8.5, 21), (15.5, 21)], w=int(W * .9)); return im

def chip():  # memory
    im, d = new(); rrect(d, 6, 6, 18, 18, 2.2); rrect(d, 9.5, 9.5, 14.5, 14.5, 1)
    for x in (9, 12, 15):
        line(d, [(x, 3.5), (x, 6)], w=int(W * .8)); line(d, [(x, 18), (x, 20.5)], w=int(W * .8))
    for y in (9, 12, 15):
        line(d, [(3.5, y), (6, y)], w=int(W * .8)); line(d, [(18, y), (20.5, y)], w=int(W * .8))
    return im

def cap_grad():  # experts — mortarboard
    im, d = new(); poly(d, [(12, 5), (21, 9.5), (12, 14), (3, 9.5)]); line(d, [(12, 14), (12, 18)]); arc(d, 12, 18, 4, 0, 180); line(d, [(21, 9.5), (21, 15)], w=int(W * .8)); return im

def book():  # reader — open book
    im, d = new()
    line(d, [(12, 6.5), (12, 18.5)])                               # spine
    line(d, [(12, 6.5), (4.5, 7.6), (4.5, 17.2), (12, 18.5)])      # left page
    line(d, [(12, 6.5), (19.5, 7.6), (19.5, 17.2), (12, 18.5)])    # right page
    return im

def apple():  # diet
    im, d = new(); circle(d, 9.3, 14, 5.2); circle(d, 14.7, 14, 5.2); line(d, [(12, 8.5), (12, 5)]); arc(d, 15, 5, 3, 110, 200, w=int(W * .8)); return im

def dumbbell():  # fitness
    im, d = new(); line(d, [(7.5, 12), (16.5, 12)]); line(d, [(5, 9, ), (5, 15)]); line(d, [(7.5, 8.5), (7.5, 15.5)]); line(d, [(16.5, 8.5), (16.5, 15.5)]); line(d, [(19, 9), (19, 15)]); return im

def drop():  # water
    im, d = new(); arc(d, 12, 14, 5, -35, 215); line(d, [(12 + 5 * math.cos(math.radians(-35)), 14 + 5 * math.sin(math.radians(-35))), (12, 3.5)]); line(d, [(12, 3.5), (12 + 5 * math.cos(math.radians(215)), 14 + 5 * math.sin(math.radians(215)))]); return im

def moon():  # sleep
    im, d = new(); arc(d, 12, 12, 8, 55, 305); arc(d, 15.5, 12, 7.5, 128, 232); return im

def ruler():  # measure
    im, d = new(); rrect(d, 4, 8, 20, 16, 1.6)
    for x in (7, 10, 13, 16):
        line(d, [(x, 8), (x, 11.5)], w=int(W * .75))
    return im

def coins():  # budget
    im, d = new(); circle(d, 10, 14.5, 5); arc(d, 14, 9.5, 5, -35, 215); line(d, [(10, 11.5), (10, 17.5)], w=int(W * .7)); return im

def cart():  # grocery
    im, d = new(); line(d, [(3, 4), (5.5, 4), (8, 15), (18, 15), (20, 7.5), (6.5, 7.5)]); circle(d, 9, 19, 1.4); circle(d, 17, 19, 1.4); return im

def plate():  # meals — fork + knife
    im, d = new()
    for x in (8, 10, 12):
        line(d, [(x, 4), (x, 9)], w=int(W * .8))   # fork tines
    arc(d, 10, 9, 2, 0, 180)                        # tine base
    line(d, [(10, 9), (10, 20)])                    # fork handle
    line(d, [(16, 4), (16, 20)])                    # knife
    poly(d, [(16, 4), (17.8, 7.5), (16, 12)])       # blade
    return im

def chefhat():  # recipes
    im, d = new(); arc(d, 8.5, 9, 3.6, 70, 300); arc(d, 15.5, 9, 3.6, 240, 110); arc(d, 12, 8.5, 3.6, 180, 360); rrect(d, 7.5, 11, 16.5, 20, 1.4); line(d, [(7.5, 15.5), (16.5, 15.5)], w=int(W * .7)); return im

def calendar():  # calendar
    im, d = new(); rrect(d, 4, 5.5, 20, 20, 2); line(d, [(4, 10), (20, 10)]); line(d, [(8, 3.5), (8, 7)], w=int(W * .9)); line(d, [(16, 3.5), (16, 7)], w=int(W * .9))
    for (x, y) in [(9, 14), (12, 14), (15, 14), (9, 17), (12, 17)]:
        cap(d, x, y, int(W * .9))
    return im

def flame():  # habits
    im, d = new(); line(d, [(12, 3), (16, 9), (17, 13.5)]); arc(d, 12, 14.5, 6, -70, 250); arc(d, 12, 16, 2.6, -90, 270, w=int(W * .8)); return im

def timer():  # timer
    im, d = new(); circle(d, 12, 14, 7); line(d, [(12, 14), (12, 9.5)]); line(d, [(9.5, 3.5), (14.5, 3.5)]); line(d, [(12, 3.5), (12, 7)]); line(d, [(18, 8.5), (19.5, 7)], w=int(W * .8)); return im

def convert():  # converter
    im, d = new(); arc(d, 12, 12, 7, 200, 20, caps=False); line(d, [(17.5, 6.5), (19, 9), (16.3, 9.6)]); arc(d, 12, 12, 7, 20, 200, caps=False); line(d, [(6.5, 17.5), (5, 15), (7.7, 14.4)]); return im

def compass():  # travel
    im, d = new(); circle(d, 12, 12, 8); poly(d, [(12, 7), (14.5, 14.5), (12, 17), (9.5, 14.5)]); return im

def globe():  # translate — a world globe (languages)
    im, d = new()
    circle(d, 12, 12, 8.5)                                                    # globe
    d.line([P(3.6, 12), P(20.4, 12)], fill=WHITE, width=int(W * 0.8))         # equator
    d.ellipse([P(8.2, 3.6), P(15.8, 20.4)], outline=WHITE, width=int(W * 0.75))  # meridian
    return im


ICONS = {
    "notes": mic, "memory": chip, "experts": cap_grad, "notifs": book,
    "diet": apple, "fitness": dumbbell, "water": drop, "sleep": moon, "measure": ruler,
    "budget": coins, "grocery": cart, "meals": plate, "recipes": chefhat, "calendar": calendar,
    "habits": flame, "timer": timer, "convert": convert, "travel": compass,
    "translate": globe,
}


def main():
    for name, fn in ICONS.items():
        save(fn(), name)
    print("wrote", len(ICONS), "tool icons to", OUT)


if __name__ == "__main__":
    main()
