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


def main():
    os.makedirs(OUT, exist_ok=True)
    bumper(False).save(os.path.join(OUT, "bumper_idle.png"))
    bumper(True).save(os.path.join(OUT, "bumper_lit.png"))
    ball().save(os.path.join(OUT, "ball.png"))
    print("wrote bumper_idle/lit + ball to", os.path.normpath(OUT))


if __name__ == "__main__":
    main()
