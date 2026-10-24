#!/usr/bin/env python3
"""
Rock-Paper-Scissors — original hand-token art (Pillow, in-repo).

Clean, readable arcade tokens instead of emoji:
  rock.png      120px  faceted grey boulder with highlight
  paper.png     120px  cream sheet with a folded corner + rule lines
  scissors.png  120px  open steel scissors with amber/cyan handles

Drawn at native 120 px (no upscaling → no blur).
Full rights, no third-party assets. Regenerate: python tools/art/gen_rps_art.py
"""
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "arcade", "rps")
S = 120
CLEAR = (0, 0, 0, 0)
OUTLINE = (16, 22, 32, 255)


def rock() -> Image.Image:
    img = Image.new("RGBA", (S, S), CLEAR)
    d = ImageDraw.Draw(img)
    g, gl, gd = (120, 130, 144, 255), (168, 178, 192, 255), (78, 88, 102, 255)
    pts = [(20, 84), (16, 56), (40, 34), (74, 30), (100, 50), (104, 80), (86, 96), (44, 96)]
    d.polygon(pts, fill=g, outline=OUTLINE)
    d.polygon([(40, 34), (74, 30), (66, 58), (36, 56)], fill=gl)           # top light facet
    d.polygon([(66, 58), (100, 50), (104, 80), (82, 78)], fill=gd)         # right dark facet
    d.line([(36, 56), (82, 78)], fill=gd, width=2)
    d.line([(66, 58), (44, 96)], fill=gd, width=2)
    return img


def paper() -> Image.Image:
    img = Image.new("RGBA", (S, S), CLEAR)
    d = ImageDraw.Draw(img)
    cream, line = (238, 236, 222, 255), (150, 158, 150, 255)
    d.polygon([(26, 16), (84, 16), (104, 36), (104, 104), (26, 104)], fill=cream, outline=OUTLINE)
    d.polygon([(84, 16), (104, 36), (84, 36)], fill=(206, 204, 190, 255), outline=OUTLINE)  # folded corner
    for y in (52, 66, 80):
        d.line([(38, y), (92, y)], fill=line, width=3)
    return img


def scissors() -> Image.Image:
    img = Image.new("RGBA", (S, S), CLEAR)
    d = ImageDraw.Draw(img)
    steel, steel_hi = (176, 186, 200, 255), (220, 228, 238, 255)
    # two open blades meeting at a pivot
    d.polygon([(60, 64), (96, 18), (104, 26), (70, 70)], fill=steel, outline=OUTLINE)
    d.polygon([(60, 64), (24, 18), (16, 26), (50, 70)], fill=steel_hi, outline=OUTLINE)
    # handle loops
    d.ellipse([40, 74, 64, 100], outline=(255, 152, 16, 255), width=7)   # amber loop
    d.ellipse([56, 74, 80, 100], outline=(0, 229, 255, 255), width=7)    # cyan loop
    d.ellipse([56, 60, 64, 68], fill=(40, 48, 60, 255), outline=OUTLINE)  # pivot
    return img


def main():
    os.makedirs(OUT, exist_ok=True)
    rock().save(os.path.join(OUT, "rock.png"))
    paper().save(os.path.join(OUT, "paper.png"))
    scissors().save(os.path.join(OUT, "scissors.png"))
    print("wrote rock, paper, scissors to", os.path.normpath(OUT))


if __name__ == "__main__":
    main()
