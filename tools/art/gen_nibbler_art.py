# Pocket Rocket — Nibbler owned art (v3). Apple + obstacle boulder. Pillow, owned.
import os
from PIL import Image, ImageDraw

OUT = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "assets", "arcade", "nibbler"))
os.makedirs(OUT, exist_ok=True)
S, UP, TR = 16, 6, (0, 0, 0, 0)

def tile():
    im = Image.new("RGBA", (S, S), TR); return im, ImageDraw.Draw(im)
def save(im, n):
    im.resize((S * UP, S * UP), Image.NEAREST).save(os.path.join(OUT, n + ".png"))

RED, REDD, REDH = (224, 67, 63, 255), (154, 46, 43, 255), (255, 150, 140, 255)
LEAF, LEAFD = (79, 179, 80, 255), (46, 120, 50, 255)
STEM = (120, 84, 50, 255)
GREY, GREYL, GREYD = (107, 114, 128, 255), (150, 160, 174, 255), (56, 62, 78, 255)
INK = (10, 14, 22, 255)

def apple():
    im, d = tile()
    d.ellipse([2, 4, 13, 14], fill=REDD)
    d.ellipse([3, 5, 12, 13], fill=RED)
    d.ellipse([4, 6, 7, 9], fill=REDH)        # highlight
    d.rectangle([8, 2, 8, 5], fill=STEM)      # stem
    d.polygon([(9, 3), (12, 2), (11, 5)], fill=LEAF)  # leaf
    d.point((11, 3), fill=LEAFD)
    save(im, "apple")

def rock():
    im, d = tile()
    d.ellipse([1, 3, 14, 14], fill=GREYD)
    d.ellipse([2, 4, 13, 13], fill=GREY)
    d.ellipse([3, 5, 8, 9], fill=GREYL)       # lit facet
    d.line([5, 10, 10, 10], fill=GREYD)       # crack
    d.line([8, 10, 8, 12], fill=GREYD)
    save(im, "rock")

apple(); rock()

# contact sheet
sheet = Image.new("RGBA", (2 * (S * UP) + 24, S * UP + 16), (60, 66, 76, 255))
for i, n in enumerate(("apple", "rock")):
    t = Image.open(os.path.join(OUT, n + ".png")).convert("RGBA")
    sheet.alpha_composite(t, (8 + i * (S * UP + 8), 8))
sheet.save(os.path.join(os.path.dirname(__file__), "nibbler_contact_sheet.png"))
print("wrote nibbler art ->", OUT)
