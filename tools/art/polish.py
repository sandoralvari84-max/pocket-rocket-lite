#!/usr/bin/env python3
"""
Shared "Pocket Rocket nostalgia" polish helpers (Pillow) — reused by every sprite
generator so the whole app shares ONE finish: alternate-90s-future gadget (idealized
chrome, warm glow, glass gloss, smooth anti-aliased forms). Work at a supersampled
size then downscale LANCZOS for smoothness.

Usage:
    from polish import P
    im, d = P.canvas(480)
    P.glow(im, cx, cy, r, (255,170,40))
    P.ell_grad(im, box, top_rgb, bot_rgb)
    P.gloss(im, box); P.spec(im, cx, cy, rx, ry)
    out = P.finish(im, 120)
"""
from PIL import Image, ImageDraw, ImageFilter

OUT_C = (20, 26, 38, 255)   # soft dark outline (not pure black)


class _Polish:
    def canvas(self, ws):
        im = Image.new("RGBA", (ws, ws), (0, 0, 0, 0))
        return im, ImageDraw.Draw(im)

    def canvas_wh(self, w, h):
        im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        return im, ImageDraw.Draw(im)

    def finish(self, im, size):
        if isinstance(size, tuple):
            return im.resize(size, Image.LANCZOS)
        return im.resize((size, size), Image.LANCZOS)

    def glow(self, im, cx, cy, r, rgb, a=70):
        g = Image.new("RGBA", im.size, (0, 0, 0, 0))
        ImageDraw.Draw(g).ellipse([cx - r, cy - r, cx + r, cy + r], fill=tuple(rgb[:3]) + (a,))
        im.alpha_composite(g.filter(ImageFilter.GaussianBlur(r * 0.42)))

    def _grad(self, w, h, top, bot):
        g = Image.new("RGBA", (w, h))
        px = g.load()
        for y in range(h):
            t = y / max(1, h - 1)
            px0 = (int(top[0] + (bot[0] - top[0]) * t), int(top[1] + (bot[1] - top[1]) * t),
                   int(top[2] + (bot[2] - top[2]) * t), 255)
            for x in range(w):
                px[x, y] = px0
        return g

    def ell_grad(self, im, box, top, bot, outline=OUT_C, ow=6):
        x0, y0, x1, y1 = [int(v) for v in box]
        w, h = x1 - x0, y1 - y0
        if w <= 0 or h <= 0:
            return
        m = Image.new("L", (w, h), 0); ImageDraw.Draw(m).ellipse([0, 0, w - 1, h - 1], fill=255)
        im.paste(self._grad(w, h, top, bot), (x0, y0), m)
        if outline:
            ImageDraw.Draw(im).ellipse(box, outline=outline, width=ow)

    def rr_grad(self, im, box, r, top, bot, outline=OUT_C, ow=6):
        x0, y0, x1, y1 = [int(v) for v in box]
        w, h = x1 - x0, y1 - y0
        if w <= 0 or h <= 0:
            return
        m = Image.new("L", (w, h), 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, w - 1, h - 1], r, fill=255)
        im.paste(self._grad(w, h, top, bot), (x0, y0), m)
        if outline:
            ImageDraw.Draw(im).rounded_rectangle(box, r, outline=outline, width=ow)

    def poly_grad(self, im, pts, top, bot, outline=OUT_C, ow=6):
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        x0, y0, x1, y1 = int(min(xs)), int(min(ys)), int(max(xs)), int(max(ys))
        w, h = max(1, x1 - x0), max(1, y1 - y0)
        m = Image.new("L", (w, h), 0)
        ImageDraw.Draw(m).polygon([(px - x0, py - y0) for (px, py) in pts], fill=255)
        im.paste(self._grad(w, h, top, bot), (x0, y0), m)
        if outline:
            ImageDraw.Draw(im).polygon(pts, outline=outline, width=ow)

    def gloss(self, im, box):
        x0, y0, x1, y1 = box
        g = Image.new("RGBA", im.size, (0, 0, 0, 0))
        ImageDraw.Draw(g).ellipse([x0 + (x1 - x0) * 0.16, y0 + (y1 - y0) * 0.08,
                                   x1 - (x1 - x0) * 0.16, y0 + (y1 - y0) * 0.42], fill=(255, 255, 255, 90))
        im.alpha_composite(g.filter(ImageFilter.GaussianBlur(7)))

    def spec(self, im, cx, cy, rx, ry, a=210):
        g = Image.new("RGBA", im.size, (0, 0, 0, 0))
        ImageDraw.Draw(g).ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=(255, 255, 255, a))
        im.alpha_composite(g.filter(ImageFilter.GaussianBlur(8)))

    def sphere(self, im, box, top, bot, rim=(232, 240, 248)):
        self.ell_grad(im, box, top, bot, outline=OUT_C, ow=7)
        x0, y0, x1, y1 = box
        ImageDraw.Draw(im).ellipse(box, outline=tuple(rim) + (120,), width=4)
        self.spec(im, x0 + (x1 - x0) * 0.34, y0 + (y1 - y0) * 0.3, (x1 - x0) * 0.12, (y1 - y0) * 0.09)


P = _Polish()
