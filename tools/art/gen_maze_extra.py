# Pocket Rocket — Maze Muncher OVERHAUL art (owned, Pillow). ADDS new sprites for
# the 2026-10 overhaul; does NOT touch the existing muncher/ghost/wall/floor set
# produced by gen_maze_art.py + gen_maze_tiles.py.
#
# New art (all written to assets/arcade/maze/, 24px base x5 = 120px nearest, to
# match the existing pixel style unless noted):
#   ghost_hunter_0/1   — relentless mini-boss ghost (crimson, spiked, angry)
#   ghost_eyes         — eaten-ghost "eyes returning home" state
#   fruit_0/1/2        — bonus fruit (cherry / lemon / star)
#   item_dash          — speed-dash power-up
#   item_freeze        — freeze power-up
#   item_life          — +1 life power-up
#   item_double        — double-points power-up
#   gate               — moving-gate barrier (closed state; open = floor)
#
# Brand amber EXACTLY #FF9800, cyan #00E5FF. Owned, no third-party assets.
# Regenerate: python tools/art/gen_maze_extra.py
import os
from PIL import Image, ImageDraw

OUT = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "assets", "arcade", "maze"))
os.makedirs(OUT, exist_ok=True)
S, UP, TR = 24, 5, (0, 0, 0, 0)

INK = (12, 16, 22, 255)
AMBER = (255, 152, 0, 255); AMBER_H = (255, 198, 112, 255); AMBER_D = (184, 107, 7, 255)
CYAN = (0, 229, 255, 255); CYAN_H = (150, 244, 255, 255); CYAN_D = (5, 151, 168, 255)
WHITE = (243, 239, 230, 255)
CRIMSON = (214, 40, 66, 255); CRIMSON_H = (255, 120, 140, 255); CRIMSON_D = (150, 20, 44, 255)

def tile(w=S, h=S):
    im = Image.new("RGBA", (w, h), TR); return im, ImageDraw.Draw(im)
def save(im, n):
    im.resize((im.width * UP, im.height * UP), Image.NEAREST).save(os.path.join(OUT, n + ".png"))

# ---- Hunter ghost: crimson, domed, SPIKED skirt, angry glowing eyes ----------
def hunter(name, body, hi, dk, frame):
    im, d = tile()
    d.ellipse([1, 0, 22, 19], fill=dk)                       # dark halo/outline
    d.ellipse([2, 1, 21, 18], fill=body)                     # dome
    d.rectangle([2, 9, 21, 20], fill=body)
    d.ellipse([4, 3, 11, 10], fill=hi)                       # sheen
    d.line([2, 9, 2, 19], fill=dk); d.line([21, 9, 21, 19], fill=dk)
    # spiked skirt (sharp, menacing), two phases
    d.rectangle([2, 18, 21, 23], fill=body)
    spikes = [(2, 4), (5, 7), (8, 10), (11, 13), (14, 16), (17, 19), (20, 22)]
    shift = 0 if frame == 0 else 1
    for (a, b) in spikes:
        d.polygon([(a - shift, 18), (b - shift, 18), ((a + b) // 2 - shift, 23)], fill=TR)
    # angry eyes (red glow) + down-slanted brow
    for ex in (6, 13):
        d.ellipse([ex, 6, ex + 5, 12], fill=WHITE, outline=INK)
        d.ellipse([ex + 2, 8, ex + 4, 11], fill=(230, 30, 40, 255))
    d.line([6, 5, 10, 7], fill=INK, width=1)                 # brow L
    d.line([17, 5, 13, 7], fill=INK, width=1)                # brow R
    save(im, name)
for f in (0, 1): hunter(f"ghost_hunter_{f}", CRIMSON, CRIMSON_H, CRIMSON_D, f)

# ---- eaten-ghost eyes (travels home) -----------------------------------------
def eyes():
    im, d = tile()
    for ex in (6, 13):
        d.ellipse([ex, 7, ex + 5, 14], fill=WHITE, outline=INK)
        d.ellipse([ex + 2, 10, ex + 4, 13], fill=(30, 90, 220, 255))
    save(im, "ghost_eyes")
eyes()

# ---- fruit (bonus) -----------------------------------------------------------
def fruit_cherry():
    im, d = tile()
    d.line([12, 4, 8, 11], fill=(90, 150, 60, 255), width=1)
    d.line([12, 4, 16, 11], fill=(90, 150, 60, 255), width=1)
    d.ellipse([4, 11, 12, 19], fill=(60, 10, 14, 255))
    d.ellipse([5, 12, 11, 18], fill=(210, 40, 56, 255))
    d.ellipse([6, 13, 8, 15], fill=(255, 150, 160, 255))
    d.ellipse([12, 11, 20, 19], fill=(60, 10, 14, 255))
    d.ellipse([13, 12, 19, 18], fill=(210, 40, 56, 255))
    d.ellipse([14, 13, 16, 15], fill=(255, 150, 160, 255))
    save(im, "fruit_0")
def fruit_lemon():
    im, d = tile()
    d.ellipse([4, 7, 20, 17], fill=(150, 120, 10, 255))
    d.ellipse([5, 8, 19, 16], fill=(255, 201, 77, 255))
    d.ellipse([7, 9, 12, 12], fill=(255, 235, 170, 255))
    save(im, "fruit_1")
def fruit_star():
    im, d = tile()
    pts = [(12, 3), (14, 9), (21, 9), (15, 13), (17, 20), (12, 16), (7, 20), (9, 13), (3, 9), (10, 9)]
    d.polygon(pts, fill=AMBER_D)
    pts2 = [(12, 5), (13.5, 9.5), (19, 9.5), (14.5, 13), (16, 18), (12, 15), (8, 18), (9.5, 13), (5, 9.5), (10.5, 9.5)]
    d.polygon([(int(x), int(y)) for x, y in pts2], fill=AMBER)
    d.ellipse([10, 8, 14, 12], fill=AMBER_H)
    save(im, "fruit_2")
fruit_cherry(); fruit_lemon(); fruit_star()

# ---- power-up discs (glyph on a glossy disc) ---------------------------------
def disc(d, base, rim, hi):
    d.ellipse([2, 2, 21, 21], fill=rim)
    d.ellipse([3, 3, 20, 20], fill=base)
    d.pieslice([5, 4, 16, 14], 160, 300, fill=hi)

def item_dash():
    im, d = tile(); disc(d, AMBER, AMBER_D, AMBER_H)
    for ox in (8, 12):                                        # double chevron >>
        d.line([ox, 8, ox + 4, 12], fill=INK, width=2)
        d.line([ox + 4, 12, ox, 16], fill=INK, width=2)
    save(im, "item_dash")
def item_freeze():
    im, d = tile(); disc(d, CYAN, CYAN_D, CYAN_H)
    cx = 12
    for ang in range(0, 180, 60):                             # snowflake spokes
        import math
        dx = int(6 * math.cos(math.radians(ang))); dy = int(6 * math.sin(math.radians(ang)))
        d.line([cx - dx, cx - dy, cx + dx, cx + dy], fill=INK, width=1)
    d.line([cx, 6, cx, 18], fill=INK, width=1)
    save(im, "item_freeze")
def item_life():
    im, d = tile(); disc(d, AMBER, AMBER_D, AMBER_H)
    d.pieslice([6, 6, 18, 18], 20, 340, fill=INK)             # mini muncher silhouette
    save(im, "item_life")
def item_double():
    im, d = tile(); disc(d, AMBER, AMBER_D, AMBER_H)
    d.line([7, 9, 10, 9], fill=INK, width=2)                  # "x2"
    d.line([7, 9, 7, 15], fill=INK, width=2)
    d.line([13, 9, 16, 9], fill=INK, width=2)
    d.line([16, 9, 16, 12], fill=INK, width=2)
    d.line([16, 12, 13, 12], fill=INK, width=2)
    d.line([13, 12, 13, 15], fill=INK, width=2)
    d.line([13, 15, 16, 15], fill=INK, width=2)
    save(im, "item_double")
item_dash(); item_freeze(); item_life(); item_double()

# ---- moving gate (closed barrier; amber-cyan energy bar) ----------------------
def gate():
    im, d = tile()
    d.rounded_rectangle([2, 9, 21, 14], radius=2, fill=CYAN_D)
    d.rounded_rectangle([3, 10, 20, 13], radius=2, fill=CYAN)
    for x in range(5, 20, 4):
        d.line([x, 10, x, 13], fill=AMBER, width=1)
    save(im, "gate")
gate()

print("wrote maze overhaul extras ->", OUT)
