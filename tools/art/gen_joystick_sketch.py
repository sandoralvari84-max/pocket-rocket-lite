# Sketch of the arcade joystick UI control (matches src/design/Joystick.tsx look).
# Smooth control art (not pixel): draw at 4x, downscale LANCZOS. Two states.
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), "joystick_sketch.png")
SS = 4           # supersample
D = 150          # control diameter (logical)
PAD = 20
BG = (11, 15, 20, 255)

def disc(d, cx, cy, r, fill=None, outline=None, w=2):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=fill, outline=outline, width=w * SS)

def draw_stick(offx, offy):
    w = (D + PAD * 2)
    im = Image.new("RGBA", (w * SS, w * SS), BG)
    d = ImageDraw.Draw(im)
    cx = cy = (w // 2) * SS
    R = (D // 2) * SS
    # base plate
    disc(d, cx, cy, R, fill=(16, 21, 28, 255), outline=(42, 52, 63, 255), w=2)
    # dish ring
    disc(d, cx, cy, int(R * 0.82), fill=(10, 14, 19, 255), outline=(42, 52, 63, 255), w=2)
    # centre pivot
    disc(d, cx, cy, int(R * 0.25), fill=(5, 7, 12, 255), outline=(42, 52, 63, 255), w=1)
    # shaft hint (line from pivot toward ball)
    bx, by = cx + int(offx * SS), cy + int(offy * SS)
    d.line([cx, cy, bx, by], fill=(60, 66, 76, 255), width=int(R * 0.14))
    # red ball-top
    br = int(R * 0.40)
    disc(d, bx, by, br, fill=(224, 67, 63, 255), outline=(154, 46, 43, 255), w=2)
    # gloss highlight
    disc(d, bx - int(br * 0.3), by - int(br * 0.3), int(br * 0.3), fill=(255, 255, 255, 150))
    return im.resize((w, w), Image.LANCZOS)

centered = draw_stick(0, 0)
pushed = draw_stick(int(D * 0.26), -int(D * 0.26))   # pushed up-right

w = centered.width
sheet = Image.new("RGBA", (w * 2 + 24, w + 16), BG)
sheet.alpha_composite(centered, (8, 8))
sheet.alpha_composite(pushed, (w + 16, 8))
sheet.convert("RGB").save(OUT)
print("wrote", OUT)
