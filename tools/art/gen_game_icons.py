#!/usr/bin/env python3
"""
Game card icons — one cohesive 120px icon per registered game, ORIGINAL owned art
(Pillow). Each uses the game's own visual language (not a new identity): a pac
shape for Maze Muncher, a snake+apple for Nibbler, a warship for Fleet Hunt, etc.
Transparent background — the card tile provides the frame.

Regenerate: python tools/art/gen_game_icons.py
"""
import math
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "arcade", "icons")
S = 120
C = S // 2
CLEAR = (0, 0, 0, 0)
AMBER = (255, 170, 40, 255)
AMBER2 = (255, 206, 120, 255)
CYAN = (0, 229, 255, 255)
GREEN = (95, 209, 107, 255)
RED = (255, 90, 80, 255)
STEEL = (150, 166, 182, 255)
INK = (16, 22, 32, 255)
WHITE = (236, 240, 246, 255)


def new():
    im = Image.new("RGBA", (S, S), CLEAR)
    return im, ImageDraw.Draw(im)


def catch():  # ship + falling dot
    im, d = new()
    d.ellipse([C - 10, 16, C + 10, 36], fill=CYAN, outline=INK, width=2)
    d.ellipse([C - 5, 21, C + 5, 31], fill=AMBER)
    d.polygon([(C, 58), (S - 26, 86), (26, 86)], fill=(80, 150, 210, 255), outline=INK)
    d.polygon([(C, 70), (C + 10, 86), (C - 10, 86)], fill=(180, 240, 255, 255))
    for tx in (C - 14, C + 14):
        d.polygon([(tx - 5, 86), (tx, 100), (tx + 5, 86)], fill=AMBER)
    return im


def maze():  # pac shape
    im, d = new()
    d.pieslice([24, 24, 96, 96], 35, 325, fill=AMBER, outline=INK, width=2)
    d.ellipse([60, 44, 72, 56], fill=INK)
    return im


def nibbler():  # snake segments + apple
    im, d = new()
    for i, x in enumerate((26, 48, 70)):
        g = (67 + i * 12, 200 + i * 5, 80 + i * 10, 255)
        d.rounded_rectangle([x, 60, x + 20, 80], 6, fill=GREEN, outline=INK, width=2)
    d.ellipse([74, 36, 100, 62], fill=RED, outline=INK, width=2)  # apple
    d.line([(87, 36), (90, 26)], fill=(90, 150, 60, 255), width=3)
    return im


def road():  # car + lane
    im, d = new()
    d.rectangle([C - 4, 20, C + 4, 100], fill=(255, 221, 128, 160))  # lane line
    d.rounded_rectangle([34, 40, 86, 86], 10, fill=RED, outline=INK, width=2)
    d.rounded_rectangle([42, 48, 78, 62], 4, fill=(180, 230, 255, 255))
    for cx in (46, 74):
        for cy in (40, 86):
            d.ellipse([cx - 7, cy - 7, cx + 7, cy + 7], fill=INK)
    return im


def block():  # T tetromino
    im, d = new()
    cells = [(0, 0), (1, 0), (2, 0), (1, 1)]
    u = 26
    ox, oy = C - int(1.5 * u), C - u
    for (x, y) in cells:
        X, Y = ox + x * u, oy + y * u
        d.rounded_rectangle([X, Y, X + u - 3, Y + u - 3], 4, fill=(179, 107, 226, 255), outline=INK, width=2)
    return im


def flipper():  # bumper + ball
    im, d = new()
    d.ellipse([24, 24, 96, 96], fill=(34, 40, 52, 255), outline=STEEL, width=4)
    d.ellipse([40, 40, 80, 80], fill=CYAN)
    d.ellipse([52, 50, 70, 68], fill=WHITE)
    d.ellipse([86, 86, 104, 104], fill=STEEL, outline=INK, width=2)  # ball
    return im


def putt():  # flag + hole
    im, d = new()
    d.ellipse([34, 78, 86, 98], fill=(10, 42, 18, 255), outline=(40, 120, 60, 255), width=3)  # cup
    d.rectangle([58, 24, 62, 86], fill=WHITE)  # pole
    d.polygon([(62, 26), (92, 36), (62, 48)], fill=RED)  # pennant
    return im


def ttt():  # # grid + X O
    im, d = new()
    for x in (52, 72):
        d.line([(x, 28), (x, 92)], fill=(90, 120, 170, 255), width=3)
    for y in (52, 72):
        d.line([(28, y), (92, y)], fill=(90, 120, 170, 255), width=3)
    d.line([(32, 32), (46, 46)], fill=AMBER, width=5); d.line([(46, 32), (32, 46)], fill=AMBER, width=5)  # X
    d.ellipse([78, 78, 92, 92], outline=CYAN, width=5)  # O
    return im


def rps():  # scissors
    im, d = new()
    d.line([(C, 64), (96, 24)], fill=STEEL, width=8)
    d.line([(C, 64), (24, 24)], fill=STEEL, width=8)
    d.ellipse([44, 70, 66, 92], outline=AMBER, width=6)
    d.ellipse([58, 70, 80, 92], outline=CYAN, width=6)
    return im


def fourup():  # 2x2 discs in frame
    im, d = new()
    d.rounded_rectangle([24, 24, 96, 96], 10, fill=(31, 41, 64, 255), outline=(48, 64, 106, 255), width=3)
    cols = [[AMBER, CYAN], [CYAN, AMBER]]
    for r in range(2):
        for c in range(2):
            cx, cy = 44 + c * 32, 44 + r * 32
            d.ellipse([cx - 13, cy - 13, cx + 13, cy + 13], fill=cols[r][c])
    return im


def draughts():  # crowned checker
    im, d = new()
    d.ellipse([26, 40, 94, 100], fill=(40, 48, 60, 150))  # shadow
    d.ellipse([28, 34, 92, 94], fill=AMBER, outline=INK, width=3)
    d.ellipse([40, 46, 80, 82], outline=(188, 104, 8, 255), width=3)
    band = 56
    d.rectangle([44, band, 76, band + 7], fill=AMBER2)
    for px in (50, 60, 70):
        d.polygon([(px - 6, band), (px, band - 16), (px + 6, band)], fill=AMBER2, outline=INK)
    return im


def fleet():  # warship on wave
    im, d = new()
    d.arc([10, 86, 60, 106], 200, 340, fill=CYAN, width=3)
    d.arc([60, 86, 110, 106], 200, 340, fill=CYAN, width=3)
    d.polygon([(24, 58), (86, 58), (100, 74), (20, 74)], fill=STEEL, outline=INK, width=2)  # hull
    d.rectangle([48, 42, 72, 58], fill=(70, 84, 98, 255), outline=INK)  # bridge
    d.ellipse([54, 60, 66, 72], fill=INK)  # turret
    return im


def gallows():  # gallows + noose
    im, d = new()
    wood = (150, 103, 60, 255)
    d.rectangle([30, 92, 78, 100], fill=wood, outline=INK)  # base
    d.rectangle([38, 24, 48, 96], fill=wood, outline=INK)   # post
    d.rectangle([38, 24, 86, 32], fill=wood, outline=INK)   # beam
    d.line([(81, 32), (81, 52)], fill=(210, 180, 130, 255), width=4)  # rope
    d.ellipse([70, 52, 92, 74], outline=(210, 180, 130, 255), width=4)  # noose
    return im


ICONS = {
    "catch": catch, "maze-muncher": maze, "nibbler": nibbler, "road-hopper": road,
    "block-drop": block, "flipper-frenzy": flipper, "putt-pal": putt,
    "three-in-a-row": ttt, "rock-paper-scissors": rps, "four-up": fourup,
    "draughts": draughts, "fleet-hunt": fleet, "word-gallows": gallows,
}


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, fn in ICONS.items():
        fn().save(os.path.join(OUT, f"{name}.png"))
    print(f"wrote {len(ICONS)} game icons to", os.path.normpath(OUT))


if __name__ == "__main__":
    main()
