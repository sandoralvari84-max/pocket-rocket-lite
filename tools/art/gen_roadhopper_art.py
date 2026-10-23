# Pocket Rocket — Road Hopper owned art set (v3, Frogger-genre).
# Original work (Pillow). Own period palette: arcade greens/asphalt/water.
# Draw at 16px base, upscale NEAREST x6. Cars side-view; truck is 2 cells wide.
import os
from PIL import Image, ImageDraw

OUT = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "assets", "arcade", "roadhopper"))
os.makedirs(OUT, exist_ok=True)
S, UP, TR = 16, 6, (0, 0, 0, 0)

INK   = (10, 14, 22, 255)
# hopper
LIME  = (139, 212, 80, 255)
LIMED = (86, 150, 44, 255)
LIMEH = (191, 240, 150, 255)
WHITE = (243, 239, 230, 255)
# tiles
GRASS = (46, 120, 60, 255); GRASS2 = (60, 146, 74, 255); GRASSD = (30, 84, 42, 255)
ROAD  = (40, 44, 52, 255);  ROADL = (120, 128, 100, 255); ROADD = (26, 29, 35, 255)
WATER = (40, 96, 168, 255);  WATERH = (92, 160, 224, 255); WATERD = (26, 66, 120, 255)
# vehicles
RED   = (224, 86, 76, 255);  REDD = (150, 48, 42, 255)
BLUE  = (70, 150, 224, 255);  BLUED = (40, 92, 150, 255)
PURP  = (150, 100, 224, 255); PURPD = (96, 60, 150, 255)
AMBER = (255, 152, 16, 255);  AMBERD = (184, 107, 7, 255)
GLASS = (150, 220, 235, 255)

def tile():
    im = Image.new("RGBA", (S, S), TR); return im, ImageDraw.Draw(im)
def tilew(w):
    im = Image.new("RGBA", (w, S), TR); return im, ImageDraw.Draw(im)
def save(im, n):
    im.resize((im.width * UP, im.height * UP), Image.NEAREST).save(os.path.join(OUT, n + ".png"))

# ---- hopper: top-down critter facing up, idle + hop(squash) -----------------
def hopper(name, hop):
    im, d = tile()
    if hop:  # stretched vertically (mid-jump), legs tucked
        d.ellipse([4, 1, 11, 13], fill=LIMED)
        d.ellipse([5, 2, 10, 12], fill=LIME)
        d.ellipse([5, 3, 8, 6], fill=LIMEH)
        for ex in (6, 9):
            d.rectangle([ex - 1, 3, ex, 4], fill=WHITE); d.point((ex, 4), fill=INK)
        d.point((3, 3), fill=LIME); d.point((12, 3), fill=LIME)  # arms up
    else:    # squat idle, legs out
        d.ellipse([3, 4, 12, 13], fill=LIMED)
        d.ellipse([4, 5, 11, 12], fill=LIME)
        d.ellipse([5, 6, 9, 9], fill=LIMEH)
        for ex in (6, 10):
            d.rectangle([ex - 1, 6, ex, 7], fill=WHITE); d.point((ex, 7), fill=INK)
        for lx in (2, 13):  # splayed feet
            d.rectangle([lx, 11, lx + 1, 13], fill=LIMED)
    save(im, name)
hopper("hopper_idle", False)
hopper("hopper_hop", True)

# ---- side-view car (16x16): body, cabin, windows, wheels --------------------
def car(name, body, dark):
    im, d = tile()
    d.rectangle([1, 7, 14, 12], fill=body)            # chassis
    d.rectangle([4, 3, 11, 7], fill=body)             # cabin
    d.rectangle([5, 4, 10, 6], fill=GLASS)            # windscreen
    d.line([1, 12, 14, 12], fill=dark)                # shadow underline
    d.rectangle([13, 8, 14, 9], fill=(255, 236, 150, 255))  # headlight
    for wx in (4, 11):                                # wheels
        d.ellipse([wx - 2, 11, wx + 1, 14], fill=INK)
        d.point((wx - 1, 12), fill=(90, 90, 90, 255))
    save(im, name)
car("car_red", RED, REDD)
car("car_blue", BLUE, BLUED)
car("bug", PURP, PURPD)

# ---- truck: 2 cells wide (32x16) --------------------------------------------
def truck():
    im, d = tilew(32)
    d.rectangle([1, 5, 20, 12], fill=(210, 210, 214, 255))   # box trailer
    d.rectangle([1, 5, 20, 12], outline=(120, 120, 126, 255))
    d.rectangle([20, 6, 30, 12], fill=AMBER)                 # cab
    d.rectangle([24, 7, 29, 9], fill=GLASS)                  # cab window
    d.line([1, 12, 30, 12], fill=AMBERD)
    for wx in (6, 15, 26):
        d.ellipse([wx - 2, 11, wx + 1, 14], fill=INK)
    save(im, "truck")
truck()

# ---- lane tiles: grass / road / water (strong colour-coding) ----------------
def grass():
    im, d = tile()
    d.rectangle([0, 0, 15, 15], fill=GRASS)
    for (x, y) in ((3, 4), (10, 7), (6, 11), (13, 2)):
        d.point((x, y), fill=GRASS2); d.point((x, y + 1), fill=GRASSD)
    save(im, "grass")
def road():
    im, d = tile()
    d.rectangle([0, 0, 15, 15], fill=ROAD)
    d.rectangle([0, 0, 15, 0], fill=ROADD)
    save(im, "road")
def road_line():  # road tile carrying a dashed centre marker
    im, d = tile()
    d.rectangle([0, 0, 15, 15], fill=ROAD)
    d.rectangle([5, 7, 10, 8], fill=ROADL)
    save(im, "road_line")
def water():
    im, d = tile()
    d.rectangle([0, 0, 15, 15], fill=WATER)
    d.line([2, 4, 7, 4], fill=WATERH); d.line([9, 10, 13, 10], fill=WATERH)
    d.line([0, 0, 15, 0], fill=WATERD)
    save(im, "water")
grass(); road(); road_line(); water()

# ---- contact sheet ----------------------------------------------------------
names = ["hopper_idle", "hopper_hop", "car_red", "car_blue", "bug",
         "grass", "road", "road_line", "water"]
cell = S * UP + 8
cols = 5
rows = (len(names) + cols - 1) // cols + 1
sheet = Image.new("RGBA", (cols * cell + 8, rows * cell + 8), (60, 66, 76, 255))
for i, n in enumerate(names):
    t = Image.open(os.path.join(OUT, n + ".png")).convert("RGBA")
    sheet.alpha_composite(t, (8 + (i % cols) * cell, 8 + (i // cols) * cell))
tk = Image.open(os.path.join(OUT, "truck.png")).convert("RGBA")  # wide, own row
sheet.alpha_composite(tk, (8, 8 + ((len(names) // cols) + 1) * cell))
sheet.save(os.path.join(os.path.dirname(__file__), "roadhopper_contact_sheet.png"))
print("wrote roadhopper art ->", OUT)
