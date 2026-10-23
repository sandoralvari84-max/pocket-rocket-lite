# Pocket Rocket — Fleet Hunt owned naval sprites (v3). Ships + hit/miss FX.
# Pillow, owned. Ships drawn horizontal; vertical handled by rotation in RN.
import os
from PIL import Image, ImageDraw

OUT = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "assets", "arcade", "fleet"))
os.makedirs(OUT, exist_ok=True)
S, UP, TR = 16, 6, (0, 0, 0, 0)

HULL, HULLD, HULLL = (107, 114, 128, 255), (56, 62, 78, 255), (150, 160, 174, 255)
DECK = (90, 98, 112, 255)
GUN = (40, 44, 52, 255)
AMBER = (255, 152, 16, 255)
YELLOW = (255, 224, 120, 255)
RED = (255, 82, 71, 255)
REDD = (184, 50, 41, 255)
CYAN = (0, 229, 255, 255)
WHITE = (243, 239, 230, 255)
SMOKE = (70, 78, 92, 255)

def canvas(w):
    im = Image.new("RGBA", (w, S), TR); return im, ImageDraw.Draw(im)
def save(im, n):
    im.resize((im.width * UP, S * UP), Image.NEAREST).save(os.path.join(OUT, n + ".png"))

def ship(length, name):
    w = length * S
    im, d = canvas(w)
    top, bot = 7, 12
    d.polygon([(2, bot), (w - 3, bot), (w - 6, top), (5, top)], fill=HULL)   # hull trapezoid
    d.polygon([(w - 6, top), (w - 3, bot), (w - 1, (top + bot)//2)], fill=HULLL)  # pointed bow (right)
    d.line([5, top, w - 6, top], fill=HULLL)                                 # deck highlight
    d.line([2, bot, w - 3, bot], fill=HULLD)                                 # waterline shadow
    # superstructure + a gun, centred
    cx = w // 2
    d.rectangle([cx - 3, top - 3, cx + 1, top], fill=DECK)
    d.rectangle([cx - 2, top - 5, cx, top - 3], fill=HULLL)                  # bridge
    d.line([cx + 1, top - 2, cx + 5, top - 2], fill=GUN)                     # gun barrel
    save(im, name)

ship(3, "ship3")
ship(2, "ship2")

def hit():  # explosion burst for a struck cell
    im, d = canvas(S)
    for (a, b) in [(2, 8), (8, 2), (13, 7), (7, 13), (4, 4), (12, 12), (12, 4), (4, 12)]:
        d.line([8, 8, a, b], fill=AMBER, width=1)
    d.ellipse([4, 4, 11, 11], fill=RED)
    d.ellipse([5, 5, 10, 10], fill=AMBER)
    d.ellipse([6, 6, 9, 9], fill=YELLOW)
    save(im, "hit")

def miss():  # water splash ring for a miss
    im, d = canvas(S)
    d.ellipse([3, 3, 12, 12], outline=CYAN, width=1)
    d.ellipse([6, 6, 9, 9], outline=WHITE, width=1)
    for (x, y) in ((2, 2), (13, 3), (3, 13), (12, 12)):
        d.point((x, y), fill=CYAN)
    save(im, "miss")

def sunk():  # burning/sinking tile overlay for a sunk ship cell
    im, d = canvas(S)
    d.rectangle([1, 7, 14, 13], fill=REDD)
    d.rectangle([1, 7, 14, 8], fill=RED)
    for (x, y) in ((4, 5), (8, 3), (11, 5)):            # smoke puffs
        d.ellipse([x - 1, y - 1, x + 1, y + 1], fill=SMOKE)
    d.line([6, 7, 9, 2], fill=AMBER, width=1)            # flame
    save(im, "sunk")

hit(); miss(); sunk()

# contact sheet
sheet = Image.new("RGBA", (3 * S * UP + 32, 2 * S * UP + 24, ), (28, 34, 44, 255))
y = 8
for n in ("ship3", "ship2"):
    t = Image.open(os.path.join(OUT, n + ".png")).convert("RGBA")
    sheet.alpha_composite(t, (8, y)); y += S * UP + 8
x = 8
for n in ("hit", "miss", "sunk"):
    t = Image.open(os.path.join(OUT, n + ".png")).convert("RGBA")
    sheet.alpha_composite(t, (3 * S * UP + 16, 8)) if False else None
# simpler: place FX in a row at bottom-right area
fx = Image.new("RGBA", (3 * (S * UP) + 16, S * UP + 16), (28, 34, 44, 255))
for i, n in enumerate(("hit", "miss", "sunk")):
    t = Image.open(os.path.join(OUT, n + ".png")).convert("RGBA")
    fx.alpha_composite(t, (8 + i * (S * UP + 4), 8))
fx.save(os.path.join(os.path.dirname(__file__), "fleet_fx_sheet.png"))
sheet.save(os.path.join(os.path.dirname(__file__), "fleet_ships_sheet.png"))
print("wrote fleet art ->", OUT)
