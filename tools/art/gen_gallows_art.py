# Pocket Rocket — Word Gallows cartoon hangman (v3 word-game feel prototype).
# Owned (Pillow). A charming stickman execution that builds per wrong guess,
# plus a WIN "escaped" frame. Drawn at 40x48, upscale NEAREST x5.
import os
from PIL import Image, ImageDraw

OUT = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "assets", "arcade", "gallows"))
os.makedirs(OUT, exist_ok=True)
W, Hh, UP, TR = 40, 48, 5, (0, 0, 0, 0)

WOOD, WOODD = (255, 152, 16, 255), (184, 107, 7, 255)
ROPE = (201, 168, 106, 255)
SKIN = (243, 239, 230, 255)   # light stickman on dark bg
INK = (20, 24, 32, 255)
RED = (255, 82, 71, 255)
CYAN = (0, 229, 255, 255)
GREEN = (120, 220, 120, 255)

def new():
    im = Image.new("RGBA", (W, Hh), TR); return im, ImageDraw.Draw(im)
def save(im, n):
    im.resize((W * UP, Hh * UP), Image.NEAREST).save(os.path.join(OUT, n + ".png"))

def gallows(d):
    d.rectangle([3, 44, 24, 46], fill=WOODD)          # base plank
    d.rectangle([6, 5, 8, 46], fill=WOOD)             # upright pole
    d.rectangle([6, 5, 27, 7], fill=WOOD)             # top beam
    d.polygon([(8, 9), (12, 7), (8, 7)], fill=WOODD)  # corner brace
    d.line([27, 7, 27, 13], fill=ROPE, width=1)       # rope

def face(d, cx, cy, mood):
    # eyes
    if mood == "dead":
        for ex in (cx - 2, cx + 1):
            d.line([ex, cy - 1, ex + 1, cy + 1], fill=INK)
            d.line([ex + 1, cy - 1, ex, cy + 1], fill=INK)
        d.rectangle([cx - 1, cy + 2, cx, cy + 3], fill=RED)  # tongue
    else:
        d.point((cx - 2, cy), fill=INK); d.point((cx + 1, cy), fill=INK)
        if mood == "worried":
            d.line([cx - 2, cy + 3, cx + 1, cy + 3], fill=INK)  # straight mouth
        elif mood == "happy":
            d.line([cx - 2, cy + 2, cx + 1, cy + 2], fill=INK)
            d.point((cx - 2, cy + 1), fill=INK); d.point((cx + 1, cy + 1), fill=INK)

def hanged(parts):
    im, d = new()
    gallows(d)
    cx = 27
    if parts >= 1:  # head
        d.ellipse([cx - 3, 13, cx + 3, 19], outline=SKIN, width=1)
        face(d, cx, 16, "dead" if parts >= 6 else "worried")
    if parts >= 2:  # body
        d.line([cx, 19, cx, 30], fill=SKIN, width=1)
    if parts >= 3:  # left arm
        d.line([cx, 22, cx - 4, 26], fill=SKIN, width=1)
    if parts >= 4:  # right arm
        d.line([cx, 22, cx + 4, 26], fill=SKIN, width=1)
    if parts >= 5:  # left leg
        d.line([cx, 30, cx - 4, 36], fill=SKIN, width=1)
    if parts >= 6:  # right leg -> fully hanged
        d.line([cx, 30, cx + 4, 36], fill=SKIN, width=1)
    save(im, f"stage{parts}")

for p in range(0, 7):
    hanged(p)

# WIN — escaped: cut rope, happy stickman standing on the plank, arms up
def win():
    im, d = new()
    d.rectangle([3, 44, 24, 46], fill=WOODD)
    d.rectangle([6, 5, 8, 46], fill=WOOD)
    d.rectangle([6, 5, 27, 7], fill=WOOD)
    d.line([27, 7, 27, 10], fill=ROPE, width=1)       # cut rope stub
    cx, cy = 14, 34
    d.ellipse([cx - 3, cy - 3, cx + 3, cy + 3], outline=SKIN, width=1)
    face(d, cx, cy, "happy")
    d.line([cx, cy + 3, cx, cy + 10], fill=SKIN, width=1)   # body
    d.line([cx, cy + 5, cx - 4, cy + 1], fill=CYAN, width=1)  # arms up
    d.line([cx, cy + 5, cx + 4, cy + 1], fill=CYAN, width=1)
    d.line([cx, cy + 10, cx - 3, cy + 14], fill=SKIN, width=1)  # legs
    d.line([cx, cy + 10, cx + 3, cy + 14], fill=SKIN, width=1)
    # little "free!" spark
    d.point((cx - 6, cy - 4), fill=GREEN); d.point((cx + 6, cy - 2), fill=GREEN)
    save(im, "win")
win()

# contact sheet
names = [f"stage{p}" for p in range(0, 7)] + ["win"]
cols = 4
cw, ch = W * UP + 8, Hh * UP + 8
rows = (len(names) + cols - 1) // cols
sheet = Image.new("RGBA", (cols * cw + 8, rows * ch + 8), (28, 34, 44, 255))
for i, n in enumerate(names):
    t = Image.open(os.path.join(OUT, n + ".png")).convert("RGBA")
    sheet.alpha_composite(t, (8 + (i % cols) * cw, 8 + (i // cols) * ch))
sheet.save(os.path.join(os.path.dirname(__file__), "gallows_contact_sheet.png"))
print("wrote gallows art ->", OUT)
