# Pocket Rocket — Maze Muncher owned art set (v3).
# Original work, drawn in-repo with Pillow primitives. Full rights, no attribution.
# Pixel-crisp: draw at 16px, upscale NEAREST x6 -> 96px tiles.
import os
from PIL import Image, ImageDraw

OUT = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "assets", "arcade", "maze"))
os.makedirs(OUT, exist_ok=True)
S = 16          # base tile
UP = 6          # upscale
TRANSP = (0, 0, 0, 0)

AMBER = (255, 152, 16, 255)
AMBER_D = (184, 107, 7, 255)
AMBER_HI = (255, 196, 110, 255)
CYAN = (0, 229, 255, 255)
CYAN_D = (5, 151, 168, 255)
NAVY = (18, 26, 40, 255)
WALL_FILL = (22, 34, 58, 255)
WALL_EDGE = (46, 120, 190, 255)
WALL_HI = (84, 196, 255, 255)
WALL_DK = (9, 16, 30, 255)
WHITE = (243, 239, 230, 255)
INK = (10, 14, 22, 255)
FLOOR = (9, 13, 20, 255)
FLOOR_DOT = (22, 30, 44, 255)
FRIGHT = (36, 74, 170, 255)
FRIGHT_HI = (120, 150, 240, 255)

def new():
    img = Image.new("RGBA", (S, S), TRANSP)
    return img, ImageDraw.Draw(img)

def save(img, name):
    img.resize((S * UP, S * UP), Image.NEAREST).save(os.path.join(OUT, name + ".png"))

# ---- muncher: round body, directional mouth wedge, chomp (open/closed) -------
MOUTH = {  # pieslice (start,end) clockwise FILL, leaving the wedge toward dir open
    "r": (34, 326), "d": (124, 56), "l": (214, 146), "u": (304, 236),
}
EYE = {"r": (10, 4), "d": (10, 4), "l": (5, 4), "u": (10, 9)}

def muncher(name, mouth=None):
    img, d = new()
    bb = [1, 1, 14, 14]
    d.ellipse(bb, fill=AMBER_D)                 # outline ring
    bb2 = [2, 2, 13, 13]
    if mouth:
        d.pieslice(bb2, MOUTH[mouth][0], MOUTH[mouth][1], fill=AMBER)
    else:
        d.ellipse(bb2, fill=AMBER)
    d.arc([3, 3, 9, 9], 180, 300, fill=AMBER_HI)  # subtle top highlight
    ex, ey = EYE.get(mouth or "r", (10, 4))
    d.rectangle([ex, ey, ex + 1, ey + 1], fill=INK)
    save(img, name)

muncher("muncher_closed", None)
for dirn in ("r", "l", "u", "d"):
    muncher(f"muncher_{dirn}", dirn)

# ---- ghost: domed top, skirt with wavy feet, eyes; 2 wobble frames -----------
def ghost(name, body, hi, frame, eyes=True, wavy_mouth=False):
    img, d = new()
    # dome
    d.ellipse([2, 1, 13, 12], fill=body)
    d.rectangle([2, 6, 13, 13], fill=body)
    # highlight sheen
    d.ellipse([3, 2, 7, 7], fill=hi)
    # skirt feet (wavy) - two frames alternate the foot phase
    feet = [2, 5, 8, 11] if frame == 0 else [3, 6, 9]
    d.rectangle([2, 12, 13, 13], fill=TRANSP)   # clear bottom row to carve feet
    d.rectangle([2, 11, 13, 12], fill=body)
    fw = 3
    for i in range(2, 14, 4):
        off = 0 if frame == 0 else 2
        d.polygon([(i, 12), (i + fw, 12), (i + fw // 2, 14)], fill=body) if (i + off) % 4 == 2 else None
    # simpler reliable skirt: draw full then notch triangles upward
    d.rectangle([2, 11, 13, 14], fill=body)
    notch = [3, 7, 11] if frame == 0 else [5, 9, 1]
    for nx in notch:
        d.polygon([(nx, 14), (nx + 2, 14), (nx + 1, 12)], fill=TRANSP)
    if eyes:
        for ex in (4, 9):
            d.ellipse([ex, 5, ex + 3, 9], fill=WHITE)
            d.rectangle([ex + 1, 7, ex + 2, 8], fill=INK)
    if wavy_mouth:
        for mx in range(3, 12, 2):
            d.point((mx, 10), fill=WHITE)
            d.point((mx + 1, 11), fill=WHITE)
    save(img, name)

GHOSTS = {
    "rose": ((224, 86, 120, 255), (255, 150, 180, 255)),
    "teal": ((40, 200, 190, 255), (150, 245, 240, 255)),
    "amber": (AMBER, AMBER_HI),
    "lime": ((150, 210, 90, 255), (205, 245, 160, 255)),
}
for cname, (body, hi) in GHOSTS.items():
    for f in (0, 1):
        ghost(f"ghost_{cname}_{f}", body, hi, f)
for f in (0, 1):
    ghost(f"ghost_fright_{f}", FRIGHT, FRIGHT_HI, f, eyes=False, wavy_mouth=True)

# ---- wall tile: navy block, bevel edge, inner line (reads as neon maze) ------
def wall():
    img, d = new()
    d.rectangle([0, 0, 15, 15], fill=WALL_FILL)
    d.rectangle([0, 0, 15, 15], outline=WALL_DK)
    d.rectangle([1, 1, 14, 14], outline=WALL_EDGE)
    d.line([1, 1, 14, 1], fill=WALL_HI)          # top highlight
    d.line([1, 1, 1, 14], fill=WALL_HI)          # left highlight
    save(img, "wall")
wall()

# ---- floor/background tile: near-black navy with faint center dot ------------
def floor():
    img, d = new()
    d.rectangle([0, 0, 15, 15], fill=FLOOR)
    d.point((8, 8), fill=FLOOR_DOT)
    save(img, "floor")
floor()

# ---- pellet + power orb (2 pulse frames) ------------------------------------
def pellet():
    img, d = new()
    d.rectangle([6, 6, 9, 9], fill=AMBER)
    d.point((7, 7), fill=AMBER_HI)
    save(img, "pellet")
pellet()

def power(frame):
    img, d = new()
    r = 5 if frame == 0 else 6
    cx = 8
    d.ellipse([cx - r, cx - r, cx + r - 1, cx + r - 1], fill=CYAN_D)
    d.ellipse([cx - r + 1, cx - r + 1, cx + r - 2, cx + r - 2], fill=CYAN)
    d.ellipse([cx - 2, cx - 3, cx, cx - 1], fill=WHITE)
    save(img, f"power_{frame}")
power(0); power(1)

# ---- contact sheet for review ------------------------------------------------
names = ["muncher_closed", "muncher_r", "muncher_l", "muncher_u", "muncher_d",
         "ghost_rose_0", "ghost_rose_1", "ghost_teal_0", "ghost_amber_0",
         "ghost_lime_0", "ghost_fright_0", "ghost_fright_1",
         "wall", "floor", "pellet", "power_0", "power_1"]
cols = 6
cell = S * UP + 8
rows = (len(names) + cols - 1) // cols
sheet = Image.new("RGBA", (cols * cell + 8, rows * cell + 8), (60, 66, 76, 255))
for i, n in enumerate(names):
    tile = Image.open(os.path.join(OUT, n + ".png")).convert("RGBA")
    x = 8 + (i % cols) * cell
    y = 8 + (i // cols) * cell
    sheet.alpha_composite(tile, (x, y))
sheet.save(os.path.join(os.path.dirname(__file__), "maze_contact_sheet.png"))
print("wrote", len(names), "sprites ->", OUT)
print("contact sheet:", os.path.join(os.path.dirname(__file__), "maze_contact_sheet.png"))
