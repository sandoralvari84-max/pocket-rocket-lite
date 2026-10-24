#!/usr/bin/env python3
"""Assemble a Fleet Hunt board from the real tiles to eyeball the naval look.
Asset check (real tiles, real placement), not an in-game run."""
import os
import sys
from PIL import Image

HERE = os.path.dirname(__file__)
F = os.path.join(HERE, "..", "..", "assets", "arcade", "fleet")
N, CELL = 6, 64


def load(n, w=CELL, h=CELL):
    return Image.open(os.path.join(F, n)).convert("RGBA").resize((w, h), Image.NEAREST)


def main():
    water = [load("water_0.png"), load("water_1.png")]
    out = Image.new("RGBA", (N * CELL, N * CELL), (10, 24, 46, 255))
    for r in range(N):
        for c in range(N):
            out.alpha_composite(water[(r + c) % 2], (c * CELL, r * CELL))
    # ships: a 3-cell cruiser (row 1, cols 1-3) and a 2-cell destroyer (col 4, rows 3-4 vertical)
    s3 = Image.open(os.path.join(F, "ship3.png")).convert("RGBA").resize((3 * CELL, CELL), Image.NEAREST)
    out.alpha_composite(s3, (1 * CELL, 1 * CELL))
    s2 = Image.open(os.path.join(F, "ship2.png")).convert("RGBA").resize((2 * CELL, CELL), Image.NEAREST).rotate(-90, expand=True)
    out.alpha_composite(s2, (4 * CELL, 3 * CELL))
    # markers
    out.alpha_composite(load("hit.png"), (2 * CELL, 1 * CELL))
    out.alpha_composite(load("miss.png"), (0 * CELL, 4 * CELL))
    out.alpha_composite(load("miss.png"), (5 * CELL, 0 * CELL))
    out.alpha_composite(load("sunk.png"), (4 * CELL, 3 * CELL))
    dest = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "fleet_preview.png")
    out.convert("RGB").save(dest)
    print(dest)


if __name__ == "__main__":
    main()
