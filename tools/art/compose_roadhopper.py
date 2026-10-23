# Road Hopper integration check: real owned sprites on the real lane layout at
# the real device CELL. Mirrors road-hopper.tsx (water goal / road / grass start,
# 1-wide cars, 2-wide truck, hopper at start). Asset check, NOT an in-game run.
import os
from PIL import Image

AST = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "assets", "arcade", "roadhopper"))
COLS, ROWS = 9, 9
CELL = min((411 - 24) // COLS, int(867 * 0.52) // ROWS)  # same formula as the tsx

def load(n, w=1):
    im = Image.open(os.path.join(AST, n + ".png")).convert("RGBA")
    tw, th = w * CELL, CELL
    s = min(tw / im.width, th / im.height)  # contain
    im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    return im

board = Image.new("RGBA", (CELL * COLS, CELL * ROWS), (5, 7, 15, 255))
grass, road, water = load("grass"), load("road"), load("water")
for r in range(ROWS):
    tile = water if r == 0 else grass if r == ROWS - 1 else road
    for c in range(COLS):
        board.alpha_composite(tile, (c * CELL, r * CELL))

def place(sprite, col, row, w=1):
    x = col * CELL + (w * CELL - sprite.width) // 2
    y = row * CELL + (CELL - sprite.height) // 2
    board.alpha_composite(sprite, (x, y))

place(load("car_red"), 1, 1)
place(load("truck", 2), 3, 2, 2)      # 2-wide
place(load("bug"), 6, 3)
place(load("car_blue"), 2, 4)
place(load("car_red"), 5, 5)
place(load("bug"), 7, 6)
place(load("car_blue"), 1, 7)
place(load("hopper_idle"), 4, 8)       # start row

out = os.path.join(os.path.dirname(__file__), "roadhopper_ingame_preview.png")
board.convert("RGB").save(out)
print(f"CELL={CELL} board={CELL*COLS}x{CELL*ROWS} -> {out}")
