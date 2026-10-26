#!/usr/bin/env python3
"""
Flipper Frenzy — THREE table design blueprints (not game assets; review mockups).
Top-down schematic of each playfield: flippers, slings, plunger lane, themed features
with point values, ball-flow arrows, and the hidden tunnel. One PNG per theme.
Run: python tools/art/gen_flipper_tables.py
"""
import os, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUT = os.environ.get("FLIPPER_OUT", os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "tools", "art", "flipper_designs")))
os.makedirs(OUT, exist_ok=True)
W, H = 520, 880

def font(sz):
    try: return ImageFont.load_default(size=sz)
    except TypeError: return ImageFont.load_default()
F, FB, FS = font(22), font(26), font(17)

def arrow(d, pts, col, w=4):
    d.line(pts, fill=col, width=w, joint="curve")
    (x0, y0), (x1, y1) = pts[-2], pts[-1]
    ang = math.atan2(y1 - y0, x1 - x0)
    for a in (ang + 2.5, ang - 2.5):
        d.line([(x1, y1), (x1 - 15 * math.cos(a), y1 - 15 * math.sin(a))], fill=col, width=w)

def text_c(d, x, y, s, fnt, col):
    bb = d.textbbox((0, 0), s, font=fnt); d.text((x - (bb[2] - bb[0]) / 2, y - (bb[3] - bb[1]) / 2), s, fill=col, font=fnt)

def peg(d, x, y, r, fill, label, pts, acc, ink):
    d.ellipse([x - r, y - r, x + r, y + r], fill=fill, outline=ink, width=3)
    text_c(d, x, y - 2, label, FS, ink)
    if pts: text_c(d, x, y + r + 12, pts, FS, acc)

def table(name, sub, bg0, bg1, acc, acc2, feats, tunnel, flow):
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    # cabinet body (rounded, arched top)
    for i in range(H):
        t = i / H; c = tuple(int(bg0[k] + (bg1[k] - bg0[k]) * t) for k in range(3))
        d.line([(0, i), (W, i)], fill=c + (255,))
    d.rounded_rectangle([10, 10, W - 10, H - 10], 60, outline=acc + (255,), width=5)
    d.arc([30, 18, W - 30, 230], 180, 360, fill=acc + (160,), width=4)
    # title
    text_c(d, W / 2, 70, name, FB, acc); text_c(d, W / 2, 104, sub, FS, (210, 214, 222))
    ink = (235, 240, 248)
    # plunger lane (right)
    d.rounded_rectangle([W - 60, 150, W - 26, H - 120], 16, outline=(150, 160, 175), width=3)
    text_c(d, W - 43, H - 150, "⇡", F, acc2); text_c(d, W - 43, 168, "PLUNGE", FS, (170, 178, 190))
    # slingshots + flippers + drain
    d.polygon([(70, H - 210), (150, H - 150), (90, H - 120)], outline=acc2 + (255,), width=3)
    d.polygon([(W - 120, H - 210), (W - 200, H - 150), (W - 140, H - 120)], outline=acc2 + (255,), width=3)
    text_c(d, 108, H - 165, "SLING", FS, acc2); text_c(d, W - 158, H - 165, "SLING", FS, acc2)
    d.line([(150, H - 95), (235, H - 55)], fill=ink, width=12)       # left flipper
    d.line([(W - 150, H - 95), (W - 235, H - 55)], fill=ink, width=12)  # right flipper
    text_c(d, W / 2, H - 45, "DRAIN", FS, (200, 90, 86))
    d.line([(235, H - 50), (W - 235, H - 50)], fill=(200, 90, 86, 150), width=2)
    # features
    for (x, y, r, label, pts) in feats:
        peg(d, x, y, r, (bg1[0] + 18, bg1[1] + 18, bg1[2] + 18, 255), label, pts, acc, ink)
    # hidden tunnel
    (tx, ty, ex, ey, tlab) = tunnel
    d.ellipse([tx - 16, ty - 16, tx + 16, ty + 16], fill=(8, 8, 10, 255), outline=acc2 + (255,), width=3)
    d.ellipse([ex - 16, ey - 16, ex + 16, ey + 16], fill=(8, 8, 10, 255), outline=acc2 + (255,), width=3)
    seg = [(tx, ty)]
    for k in range(1, 7):
        f = k / 7; mx = tx + (ex - tx) * f + 40 * math.sin(f * math.pi); my = ty + (ey - ty) * f
        seg.append((mx, my))
    for k in range(0, len(seg) - 1, 1):
        if k % 2 == 0: d.line([seg[k], seg[k + 1]], fill=acc2 + (255,), width=3)
    text_c(d, (tx + ex) / 2 + 30, (ty + ey) / 2 - 18, tlab, FS, acc2)
    # ball flow arrows
    for pts in flow:
        arrow(d, pts, (acc[0], acc[1], acc[2], 220), 4)
    im.save(os.path.join(OUT, name.lower().replace(" ", "_") + ".png"))


def main():
    # ---- SENTINEL STATION (space · amber/cyan) ----
    table("SENTINEL STATION", "power the reactor · ride the wormhole out", (18, 16, 46), (40, 30, 92), (255, 170, 60), (90, 210, 255),
          feats=[(150, 300, 30, "METEOR", "100"), (330, 250, 30, "METEOR", "100"), (290, 360, 34, "REACTOR\n3-DROP", "LOCK"),
                 (110, 470, 26, "ORBIT\nLANE", "25/rev"), (W - 150, 300, 34, "WORMHOLE\nSCOOP", "MODE")],
          tunnel=(200, 560, 420, 430, "WARP CONDUIT → right upper flipper"),
          flow=[[(470, 180), (420, 300), (330, 250)], [(150, 300), (120, 470), (130, 600)], [(390, 330), (430, 470), (430, 600)]])
    # ---- HAUNTED KEEP (gothic · violet/green) ----
    table("HAUNTED KEEP", "ring the bells · descend the crypt", (16, 14, 30), (30, 24, 52), (150, 240, 160), (210, 160, 255),
          feats=[(290, 250, 34, "PORTCULLIS\nGATE", "2K"), (150, 320, 28, "BELL", "500"), (390, 330, 28, "BELL", "500"),
                 (120, 480, 26, "GHOST\nBUMPERS", "100"), (W - 150, 300, 32, "CRYPT\nSCOOP", "LOCK")],
          tunnel=(210, 560, 410, 440, "CRYPT PASSAGE → left outlane save"),
          flow=[[(470, 180), (420, 300), (290, 260)], [(150, 320), (130, 480), (140, 610)]])
    # ---- THE GRAND MACHINE (retro-arcade eras · magenta/cyan neon) ----
    table("THE GRAND MACHINE", "collect era tokens · boot the machine", (20, 14, 34), (36, 20, 58), (255, 90, 210), (90, 220, 255),
          feats=[(120, 250, 26, "8-BIT\nRAMP", "tok"), (210, 220, 26, "16-BIT\nRAMP", "tok"), (300, 220, 26, "ARCADE\nRAMP", "tok"),
                 (380, 250, 26, "FUTURE\nRAMP", "tok"), (250, 400, 32, "TOKEN\nREEL", "LOCK"), (W - 150, 300, 30, "MACHINE\nSCOOP", "MODE")],
          tunnel=(180, 560, 420, 440, "GLITCH WARP → random era (free token)"),
          flow=[[(470, 180), (430, 300), (380, 250)], [(120, 250), (160, 400), (160, 600)]])
    print("wrote 3 table blueprints to", OUT)


if __name__ == "__main__":
    main()
