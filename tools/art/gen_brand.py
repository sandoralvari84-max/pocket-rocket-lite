#!/usr/bin/env python3
"""
Pocket Rocket brand emblem — ORIGINAL owned art (Pillow). A stylised rocket in a
broken amber/cyan ring (the brand-board motif), transparent background. Scalable:
emblem(px) renders crisply at any size (2x supersample -> LANCZOS). Used on the
home/chat hero, onboarding, and (via gen_launcher.py) the launcher/splash assets.

Brand amber is the LOCKED #FF9800 (255,152,0) — never #FF9810. Regenerate:
python tools/art/gen_brand.py
"""
import os
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "brand")
AMBER = (255, 152, 0, 255)
AMBER_HI = (255, 200, 110, 255)
AMBER_DK = (200, 104, 8, 255)
CYAN = (0, 229, 255, 255)
WHITE = (240, 244, 250, 255)
INK = (14, 20, 30, 255)
CLEAR = (0, 0, 0, 0)


def emblem(px: int = 240) -> Image.Image:
    """Brand emblem at `px`, transparent background. Coordinates authored in a
    240 space and scaled; drawn at 2x then downscaled for smoothness."""
    ss = 2
    W = px * ss
    k = W / 240.0
    C = W // 2

    def s(v):
        return int(round(v * k))

    img = Image.new("RGBA", (W, W), CLEAR)
    # soft glow ring
    glow = Image.new("RGBA", (W, W), CLEAR)
    ImageDraw.Draw(glow).ellipse([s(30), s(30), W - s(30), W - s(30)], outline=(255, 152, 0, 110), width=s(18))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(s(12))))
    d = ImageDraw.Draw(img)
    # broken ring: amber arc (top-right) + cyan arc (bottom-left)
    box = [s(26), s(26), W - s(26), W - s(26)]
    d.arc(box, -70, 120, fill=AMBER, width=s(10))
    d.arc(box, 130, 250, fill=CYAN, width=s(10))

    # rocket, built upright then rotated -45 (nose up-right)
    r = Image.new("RGBA", (W, W), CLEAR)
    rd = ImageDraw.Draw(r)
    bx = C
    rd.polygon([(bx, s(56)), (bx + s(26), s(104)), (bx + s(22), s(150)), (bx - s(22), s(150)), (bx - s(26), s(104))],
               fill=AMBER, outline=INK, width=max(1, s(3)))
    rd.polygon([(bx, s(56)), (bx + s(26), s(104)), (bx + s(6), s(104)), (bx - s(2), s(70))], fill=AMBER_HI)
    rd.polygon([(bx - s(22), s(150)), (bx + s(22), s(150)), (bx + s(16), s(150)), (bx - s(16), s(150))], fill=AMBER_DK)
    rd.ellipse([bx - s(14), s(92), bx + s(14), s(120)], fill=CYAN, outline=INK, width=max(1, s(3)))
    rd.ellipse([bx - s(6), s(96), bx + s(6), s(108)], fill=WHITE)
    rd.polygon([(bx - s(26), s(118)), (bx - s(46), s(158)), (bx - s(22), s(150))], fill=AMBER_DK, outline=INK)
    rd.polygon([(bx + s(26), s(118)), (bx + s(46), s(158)), (bx + s(22), s(150))], fill=AMBER_DK, outline=INK)
    rd.polygon([(bx - s(12), s(150)), (bx, s(196)), (bx + s(12), s(150))], fill=(255, 196, 70, 255))
    rd.polygon([(bx - s(7), s(150)), (bx, s(178)), (bx + s(7), s(150))], fill=WHITE)
    r = r.rotate(-45, resample=Image.BICUBIC, center=(C, C))
    img.alpha_composite(r)

    # sparkle stars
    for (sx, sy, sr) in [(188, 70, 4), (62, 170, 5), (176, 180, 3)]:
        d.line([(s(sx) - s(sr), s(sy)), (s(sx) + s(sr), s(sy))], fill=WHITE, width=max(1, s(2)))
        d.line([(s(sx), s(sy) - s(sr)), (s(sx), s(sy) + s(sr))], fill=WHITE, width=max(1, s(2)))

    return img.resize((px, px), Image.LANCZOS)


def main():
    os.makedirs(OUT, exist_ok=True)
    emblem(240).save(os.path.join(OUT, "emblem.png"))
    print("wrote emblem to", os.path.normpath(OUT))


if __name__ == "__main__":
    main()
