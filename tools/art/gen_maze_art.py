# Pocket Rocket — Maze Muncher owned art (v3.2 polish pass).
# 24px base, consistent dark outline + shading. Same filenames/structure as v1
# (muncher closed+4 dirs, ghost_<colour>_0/1, ghost_fright_0/1, wall, floor,
# pellet, power_0/1) so the game needs no code change. Pillow, owned.
import os
from PIL import Image, ImageDraw

OUT = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "assets", "arcade", "maze"))
os.makedirs(OUT, exist_ok=True)
S, UP, TR = 24, 5, (0, 0, 0, 0)

INK = (12, 16, 22, 255)
AMBER = (255, 152, 0, 255); AMBER_H = (255, 198, 112, 255); AMBER_D = (184, 107, 7, 255)
CYAN = (0, 229, 255, 255); CYAN_D = (5, 151, 168, 255)
WHITE = (243, 239, 230, 255)
WALL_F = (22, 34, 58, 255); WALL_E = (54, 130, 200, 255); WALL_H = (96, 206, 255, 255); WALL_DK = (9, 16, 30, 255)
FLOOR = (9, 13, 20, 255); FLOOR_DOT = (20, 28, 42, 255)
FRIGHT = (44, 86, 190, 255); FRIGHT_H = (130, 165, 245, 255)

def tile(w=S, h=S):
    im = Image.new("RGBA", (w, h), TR); return im, ImageDraw.Draw(im)
def save(im, n):
    im.resize((im.width * UP, im.height * UP), Image.NEAREST).save(os.path.join(OUT, n + ".png"))

# ---- muncher: amber disc, directional mouth, chomp + closed -----------------
MOUTH = {"r": (32, 328), "d": (122, 58), "l": (212, 148), "u": (302, 238)}
EYE = {"r": (14, 7), "d": (14, 7), "l": (9, 7), "u": (14, 13), None: (14, 7)}
def muncher(name, mouth):
    im, d = tile()
    d.ellipse([1, 1, 22, 22], fill=AMBER_D)                 # outline ring
    if mouth: d.pieslice([2, 2, 21, 21], MOUTH[mouth][0], MOUTH[mouth][1], fill=AMBER)
    else:     d.ellipse([2, 2, 21, 21], fill=AMBER)
    d.pieslice([4, 4, 14, 14], 160, 280, fill=AMBER_H)      # top-left sheen
    ex, ey = EYE.get(mouth, (14, 7))
    d.ellipse([ex, ey, ex + 2, ey + 2], fill=INK)
    save(im, name)
muncher("muncher_closed", None)
for dirn in ("r", "l", "u", "d"): muncher(f"muncher_{dirn}", dirn)

# ---- ghost: domed, shaded body, wavy skirt (2 frames), eyes -----------------
def ghost(name, body, hi, dk, frame, eyes=True, wavy=False):
    im, d = tile()
    d.ellipse([2, 1, 21, 18], fill=body)                    # dome
    d.rectangle([2, 9, 21, 20], fill=body)
    d.ellipse([4, 3, 11, 10], fill=hi)                      # sheen
    d.line([2, 9, 2, 19], fill=dk); d.line([21, 9, 21, 19], fill=dk)  # side shade
    # skirt: wavy feet, two phases
    d.rectangle([2, 18, 21, 23], fill=body)
    notch = [4, 10, 16] if frame == 0 else [7, 13, 1, 19]
    for nx in notch:
        d.polygon([(nx, 23), (nx + 3, 23), (nx + 1, 19)], fill=TR)
    if eyes:
        for ex in (6, 13):
            d.ellipse([ex, 6, ex + 5, 12], fill=WHITE, outline=INK)
            d.ellipse([ex + 2, 8, ex + 4, 11], fill=INK)
    if wavy:
        for mx in range(4, 19, 3):
            d.line([mx, 15, mx + 1, 16], fill=WHITE); d.line([mx + 1, 16, mx + 2, 15], fill=WHITE)
    save(im, name)

GHOSTS = {
    "rose": ((224, 86, 120, 255), (255, 158, 186, 255), (170, 54, 86, 255)),
    "teal": ((40, 200, 190, 255), (156, 246, 240, 255), (24, 140, 134, 255)),
    "amber": (AMBER, AMBER_H, AMBER_D),
    "lime": ((150, 210, 90, 255), (206, 246, 162, 255), (104, 156, 56, 255)),
}
for cname, (body, hi, dk) in GHOSTS.items():
    for f in (0, 1): ghost(f"ghost_{cname}_{f}", body, hi, dk, f)
for f in (0, 1): ghost(f"ghost_fright_{f}", FRIGHT, FRIGHT_H, (28, 58, 130, 255), f, eyes=False, wavy=True)

# ---- wall: navy block, cyan bevel, inner line -------------------------------
def wall():
    im, d = tile()
    d.rectangle([0, 0, 23, 23], fill=WALL_F, outline=WALL_DK)
    d.rectangle([1, 1, 22, 22], outline=WALL_E)
    d.line([1, 1, 22, 1], fill=WALL_H); d.line([1, 1, 1, 22], fill=WALL_H)
    d.line([22, 2, 22, 22], fill=WALL_DK); d.line([2, 22, 22, 22], fill=WALL_DK)
    save(im, "wall")
wall()

def floor():
    im, d = tile(); d.rectangle([0, 0, 23, 23], fill=FLOOR); d.rectangle([11, 11, 12, 12], fill=FLOOR_DOT); save(im, "floor")
floor()

def pellet():
    im, d = tile(); d.ellipse([9, 9, 14, 14], fill=AMBER); d.ellipse([10, 10, 12, 12], fill=AMBER_H); save(im, "pellet")
pellet()

def power(frame):
    im, d = tile(); r = 7 if frame == 0 else 9; c = 12
    d.ellipse([c - r, c - r, c + r - 1, c + r - 1], fill=CYAN_D)
    d.ellipse([c - r + 2, c - r + 2, c + r - 3, c + r - 3], fill=CYAN)
    d.ellipse([c - 3, c - 4, c, c - 1], fill=WHITE)
    save(im, f"power_{frame}")
power(0); power(1)

names = ["muncher_closed", "muncher_r", "muncher_l", "muncher_u", "muncher_d",
         "ghost_rose_0", "ghost_teal_0", "ghost_amber_0", "ghost_lime_0",
         "ghost_fright_0", "wall", "floor", "pellet", "power_0", "power_1"]
cols = 5; cw = S * UP + 8; rows = (len(names) + cols - 1) // cols
sheet = Image.new("RGBA", (cols * cw + 8, rows * cw + 8), (40, 46, 56, 255))
for i, n in enumerate(names):
    t = Image.open(os.path.join(OUT, n + ".png")).convert("RGBA")
    sheet.alpha_composite(t, (8 + (i % cols) * cw, 8 + (i // cols) * cw))
sheet.save(os.path.join(os.path.dirname(__file__), "maze_v2_sheet.png"))
print("wrote maze v3.2 ->", OUT)
