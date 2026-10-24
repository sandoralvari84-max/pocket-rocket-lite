#!/usr/bin/env python3
"""Assemble a small draughts board from the real tiles to eyeball the look."""
import os
import sys
from PIL import Image

HERE = os.path.dirname(__file__)
D = os.path.join(HERE, "..", "..", "assets", "arcade", "draughts")
N, CELL = 4, 90


def load(n):
    return Image.open(os.path.join(D, n)).convert("RGBA").resize((CELL, CELL), Image.NEAREST)


def main():
    light, dark = load("square_light.png"), load("square_dark.png")
    ma, mc = load("man_amber.png"), load("man_cyan.png")
    ka, kc = load("king_amber.png"), load("king_cyan.png")
    out = Image.new("RGBA", (N * CELL, N * CELL), (0, 0, 0, 255))
    for r in range(N):
        for c in range(N):
            out.alpha_composite(dark if (r + c) % 2 else light, (c * CELL, r * CELL))
    place = {(0, 1): mc, (0, 3): kc, (1, 0): mc, (3, 0): ma, (3, 2): ka, (2, 3): ma}
    for (r, c), p in place.items():
        out.alpha_composite(p, (c * CELL, r * CELL))
    dest = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "draughts_preview.png")
    out.convert("RGB").save(dest)
    print(dest)


if __name__ == "__main__":
    main()
