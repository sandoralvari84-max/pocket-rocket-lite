# Integration check: composite the REAL maze sprites onto the REAL validated
# grid at the REAL device cell size the game computes. Mirrors maze-muncher.tsx
# render order (floor -> walls -> pellets -> power -> ghosts -> muncher).
# This verifies alignment / transparency / scale / contrast. It is NOT a claim
# that the app was run; on-device verification is the EAS build.
import os
from PIL import Image

AST = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "assets", "arcade", "maze"))
LAYOUT = [
    "#############", "#o..#...#..o#", "#.#.#.#.#.#.#", "#...........#",
    "#.#.#.#.#.#.#", "#.....#.....#", "#.##.###.##.#", "#.#...#...#.#",
    "#.#.#...#.#.#", "#...#.#.#...#", "#.#.#.#.#.#.#", "#.....#.....#",
    "#.#.#.#.#.#.#", "#o..#.P.#..o#", "#############",
]
ROWS, COLS = len(LAYOUT), len(LAYOUT[0])
# device model: Pixel-ish W=411 H=867, same formula as the tsx
CELL = max(16, min((411 - 8) // COLS, (867 - 212) // ROWS))

def load(n, size):
    return Image.open(os.path.join(AST, n + ".png")).convert("RGBA").resize((size, size), Image.LANCZOS)

board = Image.new("RGBA", (CELL * COLS, CELL * ROWS), (9, 13, 20, 255))
floor = load("floor", CELL); wall = load("wall", CELL)
pellet = load("pellet", round(CELL * 0.4)); power = load("power_0", round(CELL * 0.9))

# homes = 4 open cells nearest centre (same rule as buildMaze)
cr, cc = ROWS // 2, COLS // 2
open_cells, P = [], None
for r in range(ROWS):
    for c in range(COLS):
        ch = LAYOUT[r][c]
        if ch == "P": P = (r, c)
        if ch != "#": open_cells.append((r, c))
homes = sorted([p for p in open_cells if p != P], key=lambda p: (p[0]-cr)**2 + (p[1]-cc)**2)[:4]
ghosts = [load(f"ghost_{col}_0", CELL) for col in ("rose", "teal", "lime", "amber")]
muncher = load("muncher_l", CELL)

for r in range(ROWS):
    for c in range(COLS):
        board.alpha_composite(floor, (c * CELL, r * CELL))
for r in range(ROWS):
    for c in range(COLS):
        ch = LAYOUT[r][c]
        x, y = c * CELL, r * CELL
        if ch == "#":
            board.alpha_composite(wall, (x, y))
        elif ch == ".":
            board.alpha_composite(pellet, (x + (CELL - pellet.width)//2, y + (CELL - pellet.height)//2))
        elif ch == "o":
            board.alpha_composite(power, (x + (CELL - power.width)//2, y + (CELL - power.height)//2))
for i, (r, c) in enumerate(homes):
    board.alpha_composite(ghosts[i], (c * CELL, r * CELL))
board.alpha_composite(muncher, (P[1] * CELL, P[0] * CELL))

out = os.path.join(os.path.dirname(__file__), "maze_ingame_preview.png")
board.convert("RGB").save(out)
print(f"CELL={CELL} board={CELL*COLS}x{CELL*ROWS} -> {out}")
