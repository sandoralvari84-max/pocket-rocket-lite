#!/usr/bin/env python3
"""
Flipper Frenzy — pinball art. ORIGINAL owned art (Pillow, in-repo).

Skins the EXISTING physics geometry (bumper radius 24, ball radius 11) — the art
matches the collision shapes, it does not change them:
  bumper_idle.png / bumper_lit.png  120px illuminated pop-bumper (chrome ring, lit cap)
  ball.png                           120px chrome pinball (radial sheen + highlight)

Full rights, no third-party assets. Regenerate: python tools/art/gen_flipper_art.py
"""
import os
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "arcade", "flipper")
S = 120
CLEAR = (0, 0, 0, 0)


def bumper(lit: bool) -> Image.Image:
    img = Image.new("RGBA", (S, S), CLEAR)
    # outer glow (stronger when lit)
    glow = Image.new("RGBA", (S, S), CLEAR)
    dg = ImageDraw.Draw(glow)
    gcol = (255, 180, 70, 150) if lit else (0, 200, 230, 70)
    dg.ellipse([6, 6, S - 6, S - 6], fill=gcol)
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(10)))
    d = ImageDraw.Draw(img)
    cx = cy = S // 2
    # dark rim
    d.ellipse([10, 10, S - 10, S - 10], fill=(34, 40, 52, 255), outline=(16, 20, 28, 255), width=3)
    # chrome ring (light top -> dark bottom)
    d.ellipse([16, 14, S - 16, S - 18], fill=(170, 182, 198, 255))
    d.ellipse([20, 22, S - 20, S - 14], fill=(96, 106, 122, 255))
    # coloured band
    band = (255, 170, 60, 255) if lit else (0, 196, 228, 255)
    d.ellipse([28, 28, S - 28, S - 28], fill=band, outline=(16, 20, 28, 255), width=2)
    # lit/idle centre cap
    cap = (255, 246, 214, 255) if lit else (0, 140, 170, 255)
    d.ellipse([40, 40, S - 40, S - 40], fill=cap)
    # specular highlight
    d.ellipse([46, 44, 70, 62], fill=(255, 255, 255, 200))
    return img


def ball() -> Image.Image:
    img = Image.new("RGBA", (S, S), CLEAR)
    d = ImageDraw.Draw(img)
    cx = cy = S // 2
    # radial chrome: dark edge -> light centre via stacked ellipses
    stops = [(56, (28, 34, 44)), (48, (70, 80, 96)), (38, (120, 132, 150)),
             (28, (176, 188, 204)), (18, (220, 228, 238))]
    for r, col in stops:
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col + (255,))
    # offset bright highlight
    d.ellipse([cx - 30, cy - 34, cx - 6, cy - 12], fill=(255, 255, 255, 230))
    # rim
    d.ellipse([cx - 56, cy - 56, cx + 56, cy + 56], outline=(14, 18, 26, 255), width=3)
    return img


def playfield() -> Image.Image:
    """Decorative portrait pinball backdrop (stretched behind the live table).
    Does not affect physics — pure art: space gradient, arched top, centre guide
    rings (echoing the bumper cluster), lane chevrons, side rails, stars."""
    import math
    import random
    w, h = 360, 720
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # vertical gradient top -> bottom
    top = (18, 34, 62); bot = (10, 14, 26)
    for y in range(h):
        t = y / h
        d.line([(0, y), (w, y)], fill=(
            int(top[0] + (bot[0] - top[0]) * t),
            int(top[1] + (bot[1] - top[1]) * t),
            int(top[2] + (bot[2] - top[2]) * t), 255))
    # arched dome at the top
    d.arc([-30, -120, w + 30, 260], 20, 160, fill=(70, 110, 170, 255), width=6)
    d.arc([-10, -90, w + 10, 240], 25, 155, fill=(40, 70, 120, 255), width=10)
    # side rails
    d.rectangle([0, 0, 16, h], fill=(26, 40, 66, 255))
    d.rectangle([w - 16, 0, w, h], fill=(26, 40, 66, 255))
    # centre guide rings (where the bumper cluster sits)
    cx, cy = w // 2, int(h * 0.36)
    for rr, col in [(120, (36, 60, 100, 120)), (92, (0, 140, 170, 90)), (64, (255, 160, 60, 70))]:
        d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], outline=col, width=3)
    # lane chevrons pointing up toward the cluster (lower half)
    random.seed(9)
    for i, ly in enumerate(range(int(h * 0.60), int(h * 0.9), 46)):
        a = 14 + i * 2
        col = (0, 170, 200, 110) if i % 2 == 0 else (255, 150, 60, 100)
        d.line([(cx - a, ly + 14), (cx, ly), (cx + a, ly + 14)], fill=col, width=3)
    # funnel guides toward the flippers at the bottom
    d.line([(40, int(h * 0.82)), (cx - 28, h - 70)], fill=(44, 60, 90, 255), width=4)
    d.line([(w - 40, int(h * 0.82)), (cx + 28, h - 70)], fill=(44, 60, 90, 255), width=4)
    # stars
    for _ in range(60):
        x = random.randrange(20, w - 20); y = random.randrange(0, h)
        s = random.choice([1, 1, 2])
        d.ellipse([x - s, y - s, x + s, y + s], fill=(210, 224, 245, random.randint(90, 210)))
    return img.filter(ImageFilter.GaussianBlur(0.3))


def main():
    os.makedirs(OUT, exist_ok=True)
    bumper(False).save(os.path.join(OUT, "bumper_idle.png"))
    bumper(True).save(os.path.join(OUT, "bumper_lit.png"))
    ball().save(os.path.join(OUT, "ball.png"))
    playfield().save(os.path.join(OUT, "playfield.png"))
    print("wrote bumper_idle/lit + ball + playfield to", os.path.normpath(OUT))


if __name__ == "__main__":
    main()
