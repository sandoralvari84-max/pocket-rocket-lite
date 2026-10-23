# Pocket Rocket — Road Hopper owned art (v3.2 polish pass).
# Higher-res 24px base, consistent dark outline + top-left light / bottom-right
# shadow, richer detail (windows, wheels+hubs, headlights). Same filenames +
# aspect ratios as before so the game needs no code change. Pillow, owned.
import os
from PIL import Image, ImageDraw

OUT = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "assets", "arcade", "roadhopper"))
os.makedirs(OUT, exist_ok=True)
S, UP, TR = 24, 5, (0, 0, 0, 0)

INK   = (12, 16, 22, 255)      # universal dark outline
GLASS = (150, 214, 232, 255); GLASS_D = (96, 158, 184, 255)
HEAD  = (255, 236, 150, 255); TAIL = (230, 70, 60, 255)
TIRE  = (24, 26, 32, 255);  HUB = (120, 128, 140, 255)
# hopper (lime critter)
LIME = (120, 200, 72, 255); LIME_H = (176, 230, 130, 255); LIME_D = (74, 140, 44, 255)
WHITE = (243, 239, 230, 255)
# vehicle colour ramps: (base, highlight, shadow)
RED  = ((214, 64, 58, 255),  (240, 120, 110, 255), (150, 40, 36, 255))
BLUE = ((66, 138, 214, 255), (130, 190, 240, 255), (40, 86, 150, 255))
PURP = ((150, 96, 214, 255), (196, 150, 240, 255), (96, 58, 150, 255))

def canvas(w, h=S):
    im = Image.new("RGBA", (w, h), TR); return im, ImageDraw.Draw(im)
def save(im, n):
    im.resize((im.width * UP, im.height * UP), Image.NEAREST).save(os.path.join(OUT, n + ".png"))

def car(name, ramp):
    base, hi, sh = ramp
    im, d = canvas(S)
    # wheels (behind body)
    for wx in (7, 17):
        d.ellipse([wx - 3, 16, wx + 3, 22], fill=INK)
        d.ellipse([wx - 1, 18, wx + 1, 20], fill=HUB)
    # lower body
    d.rounded_rectangle([2, 12, 21, 18], radius=2, fill=base, outline=INK)
    d.line([3, 13, 20, 13], fill=hi)               # top highlight band
    d.line([3, 17, 20, 17], fill=sh)               # bottom shadow band
    # cabin
    d.polygon([(7, 12), (16, 12), (14, 7), (9, 7)], fill=sh)
    d.polygon([(7, 12), (16, 12), (14, 8), (9, 8)], fill=base)
    d.line([(9, 7), (14, 7)], fill=INK)
    # windows (split by a pillar)
    d.polygon([(9, 11), (11, 11), (11, 8), (10, 8)], fill=GLASS)
    d.polygon([(12, 11), (14, 11), (13, 8), (12, 8)], fill=GLASS)
    d.line([(11, 8), (11, 11)], fill=GLASS_D)
    # lights + outline accents
    d.rectangle([20, 14, 21, 15], fill=HEAD)       # headlight (front = right)
    d.rectangle([2, 14, 3, 15], fill=TAIL)         # taillight
    d.line([2, 18, 21, 18], fill=INK)
    save(im, name)

car("car_red", RED)
car("car_blue", BLUE)
car("bug", PURP)

def truck():
    im, d = canvas(S * 2)                           # 48x24, 2:1
    for wx in (9, 20, 36):
        d.ellipse([wx - 3, 16, wx + 3, 22], fill=INK)
        d.ellipse([wx - 1, 18, wx + 1, 20], fill=HUB)
    # box trailer
    d.rounded_rectangle([2, 7, 30, 18], radius=1, fill=(210, 212, 216, 255), outline=INK)
    d.line([3, 8, 29, 8], fill=(238, 240, 244, 255))
    d.line([3, 17, 29, 17], fill=(150, 152, 158, 255))
    # cab (amber)
    d.rounded_rectangle([30, 10, 45, 18], radius=1, fill=(255, 152, 16, 255), outline=INK)
    d.polygon([(30, 10), (40, 10), (40, 13), (30, 13)], fill=(184, 107, 7, 255))
    d.rectangle([40, 11, 44, 15], fill=GLASS)       # cab window
    d.rectangle([44, 14, 45, 15], fill=HEAD)        # headlight
    save(im, "truck")
truck()

def hopper(name, jump):
    im, d = canvas(S)
    if jump:
        d.ellipse([7, 2, 16, 18], fill=LIME_D, outline=INK)   # stretched up
        d.ellipse([8, 3, 15, 16], fill=LIME)
        d.ellipse([8, 4, 12, 9], fill=LIME_H)
        feet = [(6, 16), (17, 16)]
        eyes_y = 6
    else:
        d.ellipse([4, 8, 19, 20], fill=LIME_D, outline=INK)   # squat
        d.ellipse([5, 9, 18, 19], fill=LIME)
        d.ellipse([6, 10, 12, 14], fill=LIME_H)
        feet = [(3, 18), (20, 18)]
        eyes_y = 9
    # eyes (big, with highlight)
    for ex in (9, 14):
        d.ellipse([ex - 2, eyes_y - 2, ex + 1, eyes_y + 1], fill=WHITE, outline=INK)
        d.rectangle([ex, eyes_y, ex, eyes_y], fill=INK)
    for fx, fy in feet:                                        # little feet
        d.ellipse([fx - 1, fy, fx + 2, fy + 3], fill=LIME_D, outline=INK)
    save(im, name)
hopper("hopper_idle", False)
hopper("hopper_hop", True)

# tiles 24x24 — stronger lane colour-coding, subtle texture, dark top edge
def grass():
    im, d = canvas(S)
    d.rectangle([0, 0, S - 1, S - 1], fill=(44, 118, 58, 255))
    for (x, y) in ((4, 6), (14, 9), (9, 16), (19, 4), (6, 19), (17, 18)):
        d.line([x, y, x, y - 2], fill=(74, 150, 86, 255))     # blades
        d.point((x, y - 3), fill=(100, 180, 110, 255))
    save(im, "grass")
def road():
    im, d = canvas(S)
    d.rectangle([0, 0, S - 1, S - 1], fill=(42, 46, 54, 255))
    d.rectangle([0, 0, S - 1, 1], fill=(26, 29, 35, 255))     # lane seam
    for (x, y) in ((5, 7), (18, 14), (11, 20)):
        d.point((x, y), fill=(58, 63, 72, 255))               # asphalt speckle
    save(im, "road")
def road_line():
    im, d = canvas(S)
    d.rectangle([0, 0, S - 1, S - 1], fill=(42, 46, 54, 255))
    d.rectangle([8, 11, 15, 13], fill=(196, 198, 150, 255))   # dashed centre
    save(im, "road_line")
def water():
    im, d = canvas(S)
    d.rectangle([0, 0, S - 1, S - 1], fill=(40, 102, 176, 255))
    d.rectangle([0, 0, S - 1, 1], fill=(28, 72, 128, 255))
    for (x, y) in ((3, 6), (13, 10), (7, 16), (17, 19)):
        d.line([x, y, x + 3, y], fill=(104, 168, 228, 255))   # wave glints
    save(im, "water")
grass(); road(); road_line(); water()

# contact sheet
names = ["hopper_idle", "hopper_hop", "car_red", "car_blue", "bug", "grass", "road", "road_line", "water"]
cols = 5; cw = S * UP + 8; rows = (len(names) + cols - 1) // cols + 1
sheet = Image.new("RGBA", (cols * cw + 8, rows * cw + 8), (40, 46, 56, 255))
for i, n in enumerate(names):
    t = Image.open(os.path.join(OUT, n + ".png")).convert("RGBA")
    sheet.alpha_composite(t, (8 + (i % cols) * cw, 8 + (i // cols) * cw))
tk = Image.open(os.path.join(OUT, "truck.png")).convert("RGBA")
sheet.alpha_composite(tk, (8, 8 + 2 * cw))
sheet.save(os.path.join(os.path.dirname(__file__), "roadhopper_v2_sheet.png"))
print("wrote road-hopper v3.2 ->", OUT)
