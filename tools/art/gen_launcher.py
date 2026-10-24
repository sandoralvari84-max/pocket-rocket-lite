#!/usr/bin/env python3
"""
Launcher + splash assets — regenerate the home-screen icon, adaptive icon layers,
monochrome, favicon and splash logo from the BRAND emblem (replaces the off-brand
blue-chevron/placeholder set). Writes both the Expo source assets (assets/*.png)
and the already-prebuilt Android native resources (res/mipmap-*, res/drawable-*),
so the installed app updates without a full prebuild. Brand charcoal #0B0F14,
locked amber #FF9800.

Run: python tools/art/gen_launcher.py
"""
import os
import sys
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from gen_brand import emblem  # noqa: E402

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", ".."))
ASSETS = os.path.join(ROOT, "assets")
RES = os.path.join(ROOT, "android", "app", "src", "main", "res")
CHARCOAL = (11, 15, 20, 255)   # #0B0F14 brand background


def on_bg(px, scale=0.82, bg=CHARCOAL):
    """Emblem centered on a solid background square."""
    im = Image.new("RGBA", (px, px), bg)
    e = emblem(int(px * scale))
    off = (px - e.width) // 2
    im.alpha_composite(e, (off, off))
    return im


def transparent(px, scale=0.82):
    """Emblem centered on transparent (adaptive foreground / splash)."""
    im = Image.new("RGBA", (px, px), (0, 0, 0, 0))
    e = emblem(int(px * scale))
    off = (px - e.width) // 2
    im.alpha_composite(e, (off, off))
    return im


def solid(px, bg=CHARCOAL):
    return Image.new("RGBA", (px, px), bg)


def mono(px, scale=0.82):
    """White silhouette of the emblem (Android themed/monochrome icon)."""
    e = emblem(int(px * scale))
    white = Image.new("RGBA", e.size, (255, 255, 255, 0))
    white.putalpha(e.split()[3])
    im = Image.new("RGBA", (px, px), (0, 0, 0, 0))
    off = (px - e.width) // 2
    im.alpha_composite(white, (off, off))
    return im


def save_webp(img, path):
    img.save(path, "WEBP", lossless=True)


# dpi -> (adaptive 108dp px, legacy 48dp px, splash logo px)
DPI = {
    "mdpi": (108, 48, 288),
    "hdpi": (162, 72, 432),
    "xhdpi": (216, 96, 576),
    "xxhdpi": (324, 144, 864),
    "xxxhdpi": (432, 192, 1152),
}


def main():
    # 1) Expo source assets (used on the next clean prebuild / EAS build)
    os.makedirs(ASSETS, exist_ok=True)
    on_bg(1024).convert("RGB").save(os.path.join(ASSETS, "icon.png"))
    transparent(1024, scale=0.72).save(os.path.join(ASSETS, "splash-icon.png"))
    transparent(512, scale=0.80).save(os.path.join(ASSETS, "android-icon-foreground.png"))
    solid(512).convert("RGB").save(os.path.join(ASSETS, "android-icon-background.png"))
    mono(512).save(os.path.join(ASSETS, "android-icon-monochrome.png"))
    transparent(48, scale=0.9).save(os.path.join(ASSETS, "favicon.png"))

    # 2) Native Android resources (already prebuilt — update in place)
    for dpi, (adp, leg, splash) in DPI.items():
        md = os.path.join(RES, f"mipmap-{dpi}")
        if os.path.isdir(md):
            save_webp(transparent(adp, scale=0.80), os.path.join(md, "ic_launcher_foreground.webp"))
            save_webp(solid(adp), os.path.join(md, "ic_launcher_background.webp"))
            save_webp(mono(adp, scale=0.80), os.path.join(md, "ic_launcher_monochrome.webp"))
            save_webp(on_bg(leg), os.path.join(md, "ic_launcher.webp"))
            save_webp(on_bg(leg), os.path.join(md, "ic_launcher_round.webp"))
        dd = os.path.join(RES, f"drawable-{dpi}")
        if os.path.isdir(dd):
            transparent(splash, scale=0.55).save(os.path.join(dd, "splashscreen_logo.png"))

    print("wrote brand launcher + splash assets (source + native) — charcoal #0B0F14, amber #FF9800")


if __name__ == "__main__":
    main()
