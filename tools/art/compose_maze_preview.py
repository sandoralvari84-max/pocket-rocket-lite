#!/usr/bin/env python3
"""Stitch the generated autotiles into a sample maze so the look can be eyeballed.
This is an ASSET check (composites real tiles with the real mask logic), not an
in-game run. Output: a PNG path printed to stdout."""
import os
import sys
from PIL import Image

HERE = os.path.dirname(__file__)
MAZE = os.path.join(HERE, "..", "..", "assets", "arcade", "maze")

GRID = [
    "#############",
    "#o..#...#..o#",
    "#.#.#.#.#.#.#",
    "#...........#",
    "#.#.#.#.#.#.#",
    "#.....#.....#",
    "#.##.###.##.#",
    "#.#...#...#.#",
]
ROWS, COLS = len(GRID), len(GRID[0])
CELL = 48  # preview cell px


def is_wall(r, c):
    if r < 0 or c < 0 or r >= ROWS or c >= COLS:
        return True
    return GRID[r][c] == "#"


def mask(r, c):
    m = 0
    if is_wall(r - 1, c): m |= 1   # N
    if is_wall(r, c + 1): m |= 2   # E
    if is_wall(r + 1, c): m |= 4   # S
    if is_wall(r, c - 1): m |= 8   # W
    return m


def main():
    out = Image.new("RGBA", (COLS * CELL, ROWS * CELL), (9, 13, 20, 255))
    walls = {m: Image.open(os.path.join(MAZE, f"wall_{m:02d}.png")).resize((CELL, CELL), Image.NEAREST) for m in range(16)}
    floors = [Image.open(os.path.join(MAZE, f"floor_{v}.png")).resize((CELL, CELL), Image.NEAREST) for v in range(3)]
    pellet = Image.open(os.path.join(MAZE, "pellet.png")).resize((CELL // 2, CELL // 2), Image.NEAREST)
    power = Image.open(os.path.join(MAZE, "power_0.png")).resize((CELL, CELL), Image.NEAREST)
    for r in range(ROWS):
        for c in range(COLS):
            x, y = c * CELL, r * CELL
            ch = GRID[r][c]
            out.alpha_composite(floors[(r * COLS + c) % 3], (x, y))
            if ch == "#":
                out.alpha_composite(walls[mask(r, c)], (x, y))
            elif ch == ".":
                out.alpha_composite(pellet, (x + CELL // 4, y + CELL // 4))
            elif ch == "o":
                out.alpha_composite(power, (x, y))
    dest = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "maze_preview.png")
    out.convert("RGB").save(dest)
    print(dest)


if __name__ == "__main__":
    main()
