#!/usr/bin/env python3
"""
Maze Muncher premium tile set — ORIGINAL owned art (Pillow, in-repo).

Autotiling: one wall tile per 4-neighbour mask (N=1, E=2, S=4, W=8; a set bit
means that neighbour is ALSO a wall). Exposed edges (neighbour = floor) are
inset and get a cyan bevel; connected edges fill flush to the tile boundary so
adjacent walls merge into continuous ribbons. A corner is rounded only when both
of its edges are exposed — the classic arcade-maze look.

Also emits 3 subtle floor variants so corridors aren't dead flat.

Palette matches the existing owned set (navy body + cyan bevel on the app
palette). Drawn at 120px to match the current sprites. Full rights, no
third-party assets. Regenerate: python tools/art/gen_maze_tiles.py
"""
import os
from PIL import Image, ImageDraw

SIZE = 120
OUT = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "arcade", "maze")

# palette
NAVY_DEEP = (10, 16, 30, 255)     # outer/body shadow
NAVY = (22, 32, 58, 255)          # wall body
NAVY_HI = (34, 48, 82, 255)       # body top light
CYAN = (0, 229, 255, 255)         # bevel
CYAN_DIM = (0, 120, 150, 255)     # bevel shadow
FLOOR = (9, 13, 20, 255)          # corridor base
FLOOR_HINT = (16, 22, 34, 255)    # faint decoration
CLEAR = (0, 0, 0, 0)

M = 16          # inset for exposed edges (px)
R = 30          # rounded-corner radius (px)
BEVEL = 7       # bevel line thickness (px)
BI = M + 2      # bevel inset from the body edge


def wall_tile(mask: int) -> Image.Image:
    N = bool(mask & 1)
    E = bool(mask & 2)
    S = bool(mask & 4)
    Wn = bool(mask & 8)

    img = Image.new("RGBA", (SIZE, SIZE), CLEAR)
    d = ImageDraw.Draw(img)

    x0 = 0 if Wn else M
    x1 = SIZE if E else SIZE - M
    y0 = 0 if N else M
    y1 = SIZE if S else SIZE - M

    # body: rounded rect, then square off the corners that should connect.
    d.rounded_rectangle([x0, y0, x1 - 1, y1 - 1], radius=R, fill=NAVY)

    # A corner stays rounded only if BOTH its edges are exposed (floor). Square
    # off every other corner by painting an R x R navy patch over it.
    def square(cx0, cy0):
        d.rectangle([cx0, cy0, cx0 + R, cy0 + R], fill=NAVY)

    if not (N and Wn is False):  # top-left rounded iff N floor AND W floor
        pass
    # explicit, readable corner handling:
    tl = (not N) and (not Wn)
    tr = (not N) and (not E)
    bl = (not S) and (not Wn)
    br = (not S) and (not E)
    if not tl:
        square(x0, y0)
    if not tr:
        square(x1 - R, y0)
    if not bl:
        square(x0, y1 - R)
    if not br:
        square(x1 - R, y1 - R)

    # subtle top light band for depth (only the exposed top region)
    if not N:
        d.rounded_rectangle([x0 + 3, y0 + 2, x1 - 4, y0 + 12], radius=6, fill=NAVY_HI)

    # cyan bevel along EXPOSED edges, inset from the body edge.
    def hline(xa, xb, y, col, t=BEVEL):
        d.rounded_rectangle([xa, y - t // 2, xb, y + t // 2], radius=t // 2, fill=col)

    def vline(ya, yb, x, col, t=BEVEL):
        d.rounded_rectangle([x - t // 2, ya, x + t // 2, yb], radius=t // 2, fill=col)

    pad = R - 4  # keep bevel clear of rounded corners
    if not N:  # top exposed
        xa = x0 + (pad if tl else 2)
        xb = x1 - (pad if tr else 2)
        hline(xa, xb, y0 + BI, CYAN)
    if not S:  # bottom exposed
        xa = x0 + (pad if bl else 2)
        xb = x1 - (pad if br else 2)
        hline(xa, xb, y1 - BI, CYAN_DIM)
    if not Wn:  # left exposed
        ya = y0 + (pad if tl else 2)
        yb = y1 - (pad if bl else 2)
        vline(ya, yb, x0 + BI, CYAN)
    if not E:  # right exposed
        ya = y0 + (pad if tr else 2)
        yb = y1 - (pad if br else 2)
        vline(ya, yb, x1 - BI, CYAN_DIM)

    # arcs to round the bevel across both-exposed corners
    def arc(box, start, end, col):
        d.arc(box, start, end, fill=col, width=BEVEL)

    a = BI
    if tl:
        arc([x0 + a, y0 + a, x0 + a + 2 * (R - BI), y0 + a + 2 * (R - BI)], 180, 270, CYAN)
    if tr:
        arc([x1 - a - 2 * (R - BI), y0 + a, x1 - a, y0 + a + 2 * (R - BI)], 270, 360, CYAN)
    if bl:
        arc([x0 + a, y1 - a - 2 * (R - BI), x0 + a + 2 * (R - BI), y1 - a], 90, 180, CYAN_DIM)
    if br:
        arc([x1 - a - 2 * (R - BI), y1 - a - 2 * (R - BI), x1 - a, y1 - a], 0, 90, CYAN_DIM)

    return img


def floor_tile(variant: int) -> Image.Image:
    img = Image.new("RGBA", (SIZE, SIZE), FLOOR)
    d = ImageDraw.Draw(img)
    if variant == 1:
        d.rectangle([SIZE // 2 - 3, SIZE // 2 - 3, SIZE // 2 + 3, SIZE // 2 + 3], fill=FLOOR_HINT)
    elif variant == 2:
        d.line([18, 18, 30, 18], fill=FLOOR_HINT, width=3)
        d.line([18, 18, 18, 30], fill=FLOOR_HINT, width=3)
    return img


def main():
    os.makedirs(OUT, exist_ok=True)
    for mask in range(16):
        wall_tile(mask).save(os.path.join(OUT, f"wall_{mask:02d}.png"))
    for v in range(3):
        floor_tile(v).save(os.path.join(OUT, f"floor_{v}.png"))
    print(f"wrote 16 wall_* + 3 floor_* tiles to {os.path.normpath(OUT)}")


if __name__ == "__main__":
    main()
