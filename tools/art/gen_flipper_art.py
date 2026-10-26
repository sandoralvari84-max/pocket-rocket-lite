#!/usr/bin/env python3
"""
Flipper Frenzy — pinball art. ORIGINAL owned art (Pillow, in-repo).

Full rights, no third-party assets. Shares the app-wide "Pocket Rocket nostalgia"
finish via polish.py (supersample -> LANCZOS downscale for smooth, glossy chrome).
Brand amber #FF9800, cyan #00E5FF.

Sprites skin the EXISTING physics geometry (bumper radius 22, ball radius 11) — the
art matches the collision shapes, it does NOT change them. Interactive inserts
(lanes, drop targets, lock, ramp arrows, slings) are drawn LIVE as React-Native
Views on top of this backdrop so they stay perfectly aligned to the physics; this
playfield is the premium ambiance UNDER them.

  bumper_idle.png / bumper_lit.png  pop-bumper (chrome ring, lit cap, glow)
  ball.png                          chrome pinball (radial sheen + highlight)
  playfield.png                     premium portrait playfield (owned, Pillow)

Regenerate: python tools/art/gen_flipper_art.py
"""
import os
import math
from PIL import Image, ImageDraw, ImageFilter
from polish import P

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "arcade", "flipper")
S = 120
CLEAR = (0, 0, 0, 0)

AMBER = (255, 152, 0)
CYAN = (0, 229, 255)


def bumper(lit: bool) -> Image.Image:
    """Illuminated pop-bumper. Supersampled for a smooth chrome ring + lit cap."""
    ws = S * 3
    im, d = P.canvas(ws)
    cx = cy = ws // 2
    # outer glow (amber when hit, cyan when idle)
    P.glow(im, cx, cy, int(ws * 0.46), AMBER if lit else CYAN, a=170 if lit else 85)
    d = ImageDraw.Draw(im)
    # dark rim
    d.ellipse([ws * 0.08, ws * 0.08, ws * 0.92, ws * 0.92], fill=(30, 36, 48, 255),
              outline=(14, 18, 26, 255), width=int(ws * 0.02))
    # chrome ring (light top -> dark bottom)
    P.ell_grad(im, [ws * 0.13, ws * 0.11, ws * 0.87, ws * 0.85],
               (196, 208, 224), (78, 88, 104), outline=None)
    d = ImageDraw.Draw(im)
    # coloured band
    band = (255, 170, 60, 255) if lit else (0, 196, 228, 255)
    d.ellipse([ws * 0.23, ws * 0.23, ws * 0.77, ws * 0.77], fill=band,
              outline=(14, 18, 26, 255), width=int(ws * 0.015))
    # lit / idle centre cap (domed)
    if lit:
        P.ell_grad(im, [ws * 0.33, ws * 0.33, ws * 0.67, ws * 0.67],
                   (255, 250, 228), (255, 176, 60), outline=None)
    else:
        P.ell_grad(im, [ws * 0.33, ws * 0.33, ws * 0.67, ws * 0.67],
                   (6, 168, 198), (4, 96, 120), outline=None)
    # specular highlight
    P.spec(im, ws * 0.42, ws * 0.40, ws * 0.09, ws * 0.06, a=220)
    return P.finish(im, S)


def ball() -> Image.Image:
    """Chrome pinball — polished sphere with offset highlight + cool rim."""
    ws = S * 3
    im, _ = P.canvas(ws)
    P.glow(im, ws // 2, ws // 2, int(ws * 0.40), (150, 170, 200), a=55)
    pad = ws * 0.10
    # steel sphere: dark steel edge -> bright near the light
    P.sphere(im, [pad, pad, ws - pad, ws - pad], (214, 224, 238), (26, 32, 44),
             rim=(236, 244, 252))
    # second, tighter hot specular for a glassy read
    P.spec(im, ws * 0.37, ws * 0.33, ws * 0.07, ws * 0.05, a=235)
    return P.finish(im, S)


def _vgrad(d, w, h, top, bot):
    for y in range(h):
        t = y / max(1, h - 1)
        d.line([(0, y), (w, y)], fill=(
            int(top[0] + (bot[0] - top[0]) * t),
            int(top[1] + (bot[1] - top[1]) * t),
            int(top[2] + (bot[2] - top[2]) * t), 255))


def playfield() -> Image.Image:
    """Premium portrait playfield backdrop (owned, hand-composited in Pillow).

    Reads as a real pinball deck: lit dome at the top, pop-bumper nest, chrome
    habitrail ramps sweeping the sides, a drop-target bank plate (left) and a lit
    lock saucer (right), slingshot wedges, inlane/outlane guides, and a metal apron
    with a FLIPPER FRENZY wordmark. Stretched behind the live table — decorative,
    no physics effect; the interactive inserts are drawn on top in React Native."""
    RW, RH = 360, 720
    SS = 2
    w, h = RW * SS, RH * SS
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    # --- deck base: deep navy gradient --------------------------------------
    _vgrad(d, w, h, (20, 32, 56), (8, 11, 20))

    def sx(v):
        return int(v * SS)

    # faint woodgrain-free texture: large soft radial vignette toward centre top
    P.glow(im, w // 2, int(h * 0.30), int(w * 0.62), (40, 70, 120), a=40)

    # --- arched dome at the very top ----------------------------------------
    for i, (box, col, wd) in enumerate([
        ([-40, -220, w + 40, 360], (70, 115, 180, 255), 7),
        ([-18, -180, w + 18, 330], (44, 78, 130, 255), 11),
    ]):
        d.arc([sx(0) + box[0], box[1], box[2], box[3]], 18, 162, fill=col, width=sx(wd))
    # dome glow bar
    P.glow(im, w // 2, int(h * 0.045), int(w * 0.40), AMBER, a=60)

    # --- side rails (polished metal) ----------------------------------------
    rail = int(w * 0.045)
    P.rr_grad(im, [0, 0, rail, h], sx(6), (64, 82, 112), (26, 36, 56), outline=None)
    P.rr_grad(im, [w - rail, 0, w, h], sx(6), (64, 82, 112), (26, 36, 56), outline=None)
    d = ImageDraw.Draw(im)
    d.line([(rail, 0), (rail, h)], fill=(120, 150, 190, 150), width=sx(1))
    d.line([(w - rail, 0), (w - rail, h)], fill=(120, 150, 190, 150), width=sx(1))

    # --- top rollover lane slots (4) ----------------------------------------
    lane_y = int(h * 0.085)
    for i in range(4):
        lx = int(w * (0.22 + 0.187 * i))
        P.rr_grad(im, [lx - sx(16), lane_y - sx(14), lx + sx(16), lane_y + sx(16)],
                  sx(7), (30, 44, 66), (16, 24, 38), outline=(60, 80, 110, 255), ow=sx(1))
        d = ImageDraw.Draw(im)
        # up-arrow hint
        d.polygon([(lx, lane_y - sx(8)), (lx - sx(7), lane_y + sx(4)),
                   (lx + sx(7), lane_y + sx(4))], outline=(70, 110, 150, 200), width=sx(1))

    # --- centre bumper nest: concentric insert rings ------------------------
    cx, cy = w // 2, int(h * 0.26)
    for rr, col, a in [(int(w * 0.34), (40, 64, 104), 90),
                       (int(w * 0.26), CYAN, 70),
                       (int(w * 0.17), AMBER, 60)]:
        g = Image.new("RGBA", im.size, (0, 0, 0, 0))
        ImageDraw.Draw(g).ellipse([cx - rr, cy - rr, cx + rr, cy + rr],
                                  outline=col + (a,), width=sx(2))
        im.alpha_composite(g)
    # three faint bumper seats (matching the live cluster)
    for (bx, by) in [(cx, cy - int(h * 0.055)),
                     (cx - int(w * 0.24), cy + int(h * 0.035)),
                     (cx + int(w * 0.24), cy + int(h * 0.035))]:
        P.ell_grad(im, [bx - sx(26), by - sx(26), bx + sx(26), by + sx(26)],
                   (34, 46, 66), (18, 26, 40), outline=(58, 78, 108, 220), ow=sx(1))

    # --- chrome habitrail ramps sweeping the upper sides --------------------
    d = ImageDraw.Draw(im)
    for mirror in (False, True):
        pts = []
        for tdeg in range(0, 101, 5):
            t = tdeg / 100.0
            ang = math.radians(200 + t * 110)
            ox = cx + int(math.cos(ang) * w * (0.40 + 0.02 * t))
            oy = cy + int(math.sin(ang) * h * (0.20 + 0.02 * t))
            if mirror:
                ox = w - ox
            pts.append((ox, oy))
        d.line(pts, fill=(150, 168, 196, 200), width=sx(4), joint="curve")
        d.line(pts, fill=(210, 224, 244, 120), width=sx(1), joint="curve")

    # --- drop-target bank plate (left mid) ----------------------------------
    bank_x = int(w * 0.17)
    bank_y0 = int(h * 0.355)
    P.rr_grad(im, [bank_x - sx(20), bank_y0 - sx(8), bank_x + sx(20), bank_y0 + sx(96)],
              sx(6), (26, 34, 50), (14, 20, 32), outline=(56, 76, 106, 255), ow=sx(1))
    for i in range(3):
        ty = bank_y0 + sx(6) + i * sx(30)
        P.rr_grad(im, [bank_x - sx(15), ty, bank_x + sx(15), ty + sx(20)],
                  sx(4), (0, 150, 180), (0, 90, 120), outline=(10, 20, 30, 255), ow=sx(1))

    # --- lock saucer (right mid) --------------------------------------------
    lock_x, lock_y = int(w * 0.82), int(h * 0.40)
    P.glow(im, lock_x, lock_y, sx(30), AMBER, a=70)
    P.ell_grad(im, [lock_x - sx(24), lock_y - sx(24), lock_x + sx(24), lock_y + sx(24)],
               (46, 40, 24), (20, 18, 12), outline=(120, 90, 30, 255), ow=sx(2))
    P.ell_grad(im, [lock_x - sx(13), lock_y - sx(13), lock_x + sx(13), lock_y + sx(13)],
               (30, 26, 18), (12, 12, 10), outline=None)

    # --- slingshot wedges above the flippers --------------------------------
    sling_y = int(h * 0.70)
    for mirror in (False, True):
        bx = int(w * 0.20)
        if mirror:
            pts = [(w - bx, sling_y - sx(70)), (w - bx + sx(8), sling_y + sx(6)),
                   (w - int(w * 0.40), sling_y + sx(6))]
        else:
            pts = [(bx, sling_y - sx(70)), (bx - sx(8), sling_y + sx(6)),
                   (int(w * 0.40), sling_y + sx(6))]
        P.poly_grad(im, pts, (40, 58, 86), (22, 32, 50), outline=(0, 160, 190, 220), ow=sx(1))

    # --- inlane / outlane guides toward the flippers ------------------------
    d = ImageDraw.Draw(im)
    fy = int(h * 0.90)
    d.line([(int(w * 0.14), int(h * 0.74)), (int(w * 0.30), fy)],
           fill=(70, 95, 130, 230), width=sx(3))
    d.line([(w - int(w * 0.14), int(h * 0.74)), (w - int(w * 0.30), fy)],
           fill=(70, 95, 130, 230), width=sx(3))
    d.line([(int(w * 0.30), int(h * 0.80)), (int(w * 0.40), fy)],
           fill=(44, 62, 92, 220), width=sx(2))
    d.line([(w - int(w * 0.30), int(h * 0.80)), (w - int(w * 0.40), fy)],
           fill=(44, 62, 92, 220), width=sx(2))

    # --- metal apron + wordmark at the bottom -------------------------------
    ap_y = int(h * 0.915)
    P.poly_grad(im, [(0, ap_y), (w, ap_y), (w, h), (0, h)],
                (34, 44, 62), (14, 20, 30), outline=(58, 78, 108, 255), ow=sx(1))
    d = ImageDraw.Draw(im)
    # amber wordmark bar
    P.glow(im, w // 2, int(h * 0.955), int(w * 0.30), AMBER, a=55)
    txt_y = int(h * 0.945)
    # draw block "FLIPPER FRENZY" as simple vector caps (no font dependency)
    _wordmark(im, "FLIPPER", w // 2, txt_y, sx(2), AMBER)
    _wordmark(im, "FRENZY", w // 2, txt_y + sx(22), sx(2), CYAN)

    # subtle top gloss over the whole deck
    P.gloss(im, [rail, 0, w - rail, int(h * 0.5)])

    return P.finish(im, (RW, RH))


# --- tiny 5x7 vector font for the apron wordmark (owned, no font file) -------
_FONT = {
    "F": ["11111", "10000", "11110", "10000", "10000", "10000", "10000"],
    "L": ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
    "I": ["111", "010", "010", "010", "010", "010", "111"],
    "P": ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
    "E": ["11111", "10000", "11110", "10000", "10000", "10000", "11111"],
    "R": ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
    "N": ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
    "Z": ["11111", "00010", "00100", "01000", "10000", "10000", "11111"],
    "Y": ["10001", "01010", "00100", "00100", "00100", "00100", "00100"],
}


def _wordmark(im, text, cx, cy, px, rgb):
    d = ImageDraw.Draw(im)
    gap = px
    widths = [len(_FONT[c][0]) * px for c in text]
    total = sum(widths) + gap * (len(text) - 1) * 2
    x = cx - total // 2
    for ci, ch in enumerate(text):
        glyph = _FONT[ch]
        for ry, row in enumerate(glyph):
            for rx, bit in enumerate(row):
                if bit == "1":
                    d.rectangle([x + rx * px, cy + ry * px,
                                 x + rx * px + px - 1, cy + ry * px + px - 1],
                                fill=tuple(rgb) + (255,))
        x += widths[ci] + gap * 2


def main():
    os.makedirs(OUT, exist_ok=True)
    bumper(False).save(os.path.join(OUT, "bumper_idle.png"))
    bumper(True).save(os.path.join(OUT, "bumper_lit.png"))
    ball().save(os.path.join(OUT, "ball.png"))
    playfield().save(os.path.join(OUT, "playfield.png"))
    print("wrote bumper_idle/lit + ball + playfield to", os.path.normpath(OUT))


if __name__ == "__main__":
    main()
