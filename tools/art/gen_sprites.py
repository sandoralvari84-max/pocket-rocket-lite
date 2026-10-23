# Pocket Rocket — original owned sprite generator (v3 lane-2 pipeline).
# Hand-authored pixel matrices -> crisp nearest-neighbour PNGs.
# Everything produced here is original work, full rights, no attribution owed.
# Run:  python tools/art/gen_sprites.py   (from the project root)
import os
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "arcade", "original")
OUT = os.path.normpath(OUT)
os.makedirs(OUT, exist_ok=True)

# ---- palette ----------------------------------------------------------------
PAL = {
    ".": (0, 0, 0, 0),            # transparent
    "o": (14, 20, 27, 255),       # outline / near-black
    "h": (202, 214, 226, 255),    # hull light
    "s": (124, 138, 154, 255),    # hull shadow
    "c": (0, 229, 255, 255),      # cockpit cyan
    "a": (255, 152, 16, 255),     # amber
    "r": (184, 107, 7, 255),      # amber dark
    "w": (243, 239, 230, 255),    # highlight white
}

def mirror(half):
    """half = list of strings (left columns incl. the centre col at the end)."""
    rows = []
    for h in half:
        rows.append(h + h[:-1][::-1])
    return rows

def render(name, rows, scale=8):
    w = len(rows[0]); hgt = len(rows)
    img = Image.new("RGBA", (w, hgt), (0, 0, 0, 0))
    px = img.load()
    for y, row in enumerate(rows):
        assert len(row) == w, f"{name} row {y} width {len(row)} != {w}"
        for x, ch in enumerate(row):
            px[x, y] = PAL[ch]
    big = img.resize((w * scale, hgt * scale), Image.NEAREST)
    img.save(os.path.join(OUT, f"{name}@1x.png"))
    big.save(os.path.join(OUT, f"{name}.png"))
    print(f"{name}: {w}x{hgt} -> {w*scale}x{hgt*scale}")

# ---- fighter (upward-facing arcade craft), 13 wide x 15 tall ----------------
# left half incl. centre column (7 chars); mirrored to 13.
SHIP_L = [
    "......o",   # nose
    ".....oh",
    ".....oh",
    "....ohc",   # cockpit opens
    "....ohc",
    "...ohhc",
    "...ohhc",
    "..ohhhc",
    ".ohhhhc",
    "ohhhhsc",   # widest wing
    ".shhhsc",
    "..shhac",   # engine amber begins
    "...srac",
    "....rac",   # thrusters
    ".....ra",   # flame
]
render("ship_fighter", mirror(SHIP_L), scale=8)

# ---- energy pod collectible, 9 wide x 9 tall --------------------------------
POD_L = [
    "...oo",
    ".occa",
    "occwa",
    "ocwaa",
    "ocaar",
]
# that is 5 rows; build an odd 9x9 symmetric both axes from a quarter is overkill —
# author full 9 rows explicitly instead for control.
POD = [
    "...ooo...",
    "..occca..",
    ".occwaar.",
    "occwwaar.",
    "ocwwaaar.",  # will fix symmetry below if needed
    "occaaaar.",
    ".occaaar.",
    "..occar..",
    "...ooo...",
]
# simpler, clean, horizontally symmetric orb:
POD = [
    "...ooo...",
    "..oaaao..",
    ".oawwaao.",
    "oawwaaaro",
    "oawaaaaro",
    "oaaaaaaro",
    ".oaaaaro.",
    "..oaaro..",
    "...oro...",
]
render("pod", POD, scale=10)

print("OK ->", OUT)
