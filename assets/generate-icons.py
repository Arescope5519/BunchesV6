#!/usr/bin/env python3
"""
FILENAME: assets/generate-icons.py
PURPOSE: Regenerate every app icon asset from one definition, so the
mark stays identical across icon / adaptive-icon / splash / favicon.

The mark is a white "M" (Melibri) on the Honey+Forest primary green,
matching src/components/LetterPlaceholder.js so in-app placeholders and
the launcher icon read as the same family.

Usage:  python3 assets/generate-icons.py
Requires Pillow and the font below. This is a build-time tool, not
shipped code - the PNGs it writes are what the app uses.
"""

import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONT_PATH = "/mnt/skills/examples/canvas-design/canvas-fonts/YoungSerif-Regular.ttf"

# from src/constants/colors.js
GREEN = (45, 106, 79)      # colors.primary  #2D6A4F
HONEY = (233, 180, 76)     # colors.accent   #E9B44C
WHITE = (255, 255, 255)

LETTER = "M"


def fit_font(target_ink_height):
    """Point size whose 'M' ink box is target_ink_height tall."""
    lo, hi = 8, int(target_ink_height * 4) + 32
    while lo < hi:
        mid = (lo + hi) // 2
        f = ImageFont.truetype(FONT_PATH, mid)
        _, y0, _, y1 = f.getbbox(LETTER)
        if (y1 - y0) < target_ink_height:
            lo = mid + 1
        else:
            hi = mid
    return ImageFont.truetype(FONT_PATH, lo)


def draw_letter(img, height_frac, fill, dy_frac=0.0):
    """Centre the glyph on its ink box, not its font metrics."""
    size = img.size[0]
    f = fit_font(size * height_frac)
    x0, y0, x1, y1 = f.getbbox(LETTER)
    px = (size - (x1 - x0)) / 2 - x0
    py = (size - (y1 - y0)) / 2 - y0 + size * dy_frac
    ImageDraw.Draw(img).text((px, py), LETTER, font=f, fill=fill + (255,))
    return img


def tile(size, radius_frac, height_frac, bg=GREEN, fg=WHITE):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    if bg is not None:
        r = int(size * radius_frac)
        ImageDraw.Draw(img).rounded_rectangle(
            [0, 0, size - 1, size - 1], radius=r, fill=bg + (255,)
        )
    return draw_letter(img, height_frac, fg)


def save_rgb(img, path, bg=GREEN):
    """Flatten to RGB - iOS rejects icons with an alpha channel."""
    flat = Image.new("RGB", img.size, bg)
    flat.paste(img, (0, 0), img)
    flat.save(path)
    print("wrote", os.path.relpath(path, HERE), img.size, "RGB")


def save_rgba(img, path):
    img.save(path)
    print("wrote", os.path.relpath(path, HERE), img.size, "RGBA")


# icon.png - iOS + legacy Android launcher. Square, no rounding (the OS
# masks it), no alpha.
save_rgb(tile(1024, radius_frac=0, height_frac=0.56), os.path.join(HERE, "icon.png"))

# adaptive-icon.png - Android foreground layer only, transparent. Android
# crops to 66% of the canvas for its mask shapes, so the glyph is kept
# well inside that safe zone and the green moves to adaptiveIcon
# .backgroundColor in app.json.
save_rgba(
    tile(1024, radius_frac=0, height_frac=0.38, bg=None),
    os.path.join(HERE, "adaptive-icon.png"),
)

# splash.png - shown on the white splash background, so it carries its
# own rounded green tile and sits small in the middle.
splash = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
mark = tile(420, radius_frac=0.22, height_frac=0.56)
splash.paste(mark, ((1024 - 420) // 2, (1024 - 420) // 2), mark)
save_rgba(splash, os.path.join(HERE, "splash.png"))

# favicon.png - small, so it keeps the rounded tile.
save_rgb(
    tile(48, radius_frac=0.22, height_frac=0.58),
    os.path.join(HERE, "favicon.png"),
)


# ---------------------------------------------------------------------
# Web assets for site/ (melibri.app)
#
# Generated from the same mark as the app icons so the website and the
# launcher icon can never drift apart.
# ---------------------------------------------------------------------

SITE = os.path.join(os.path.dirname(HERE), "site")

# Browser tab icon. 32px is what tabs actually render.
save_rgb(tile(32, radius_frac=0.22, height_frac=0.60), os.path.join(SITE, "favicon.png"))

# Home-screen icon when someone saves the site on iOS. Apple applies its
# own rounding, so this one is a flat square.
save_rgb(tile(180, radius_frac=0, height_frac=0.56), os.path.join(SITE, "apple-touch-icon.png"))

# Open Graph card - what renders when the domain is pasted into a social
# post or a chat. 1200x630 is the size every platform crops toward.


def wordmark(draw, centre_x, baseline_y, cap_px, fg=WHITE):
    """
    "Melibri" set so the oversized M IS the app icon's M - one word with
    a drop-cap initial, rather than a logo sitting beside its own name.

    cap_px is the cap height of the big M; the rest of the word is set at
    a fraction of it and shares the same baseline.
    """
    big = fit_font(cap_px)
    small = fit_font(cap_px * 0.52)

    w_big = draw.textlength("M", font=big)
    w_rest = draw.textlength("elibri", font=small)
    # Tighten the join slightly - the M's right serif already reaches
    # toward the following letter, so metric spacing reads as a gap.
    kern = -cap_px * 0.035
    total = w_big + kern + w_rest

    x = centre_x - total / 2
    draw.text((x, baseline_y), "M", font=big, fill=fg + (255,), anchor="ls")
    draw.text((x + w_big + kern, baseline_y), "elibri", font=small,
              fill=fg + (255,), anchor="ls")
    return total


TAGLINE = "Your recipes, one home"

og = Image.new("RGBA", (1200, 630), GREEN + (255,))
_od = ImageDraw.Draw(og)
wordmark(_od, 600, 350, 240)
_ot = ImageFont.truetype(FONT_PATH, 46)
_od.text((600, 440), TAGLINE, font=_ot, fill=HONEY + (255,), anchor="ma")
save_rgb(og, os.path.join(SITE, "og.png"), bg=GREEN)


# ---------------------------------------------------------------------
# Play Store listing assets (store/play/)
# ---------------------------------------------------------------------

PLAY = os.path.join(os.path.dirname(HERE), "store", "play")
os.makedirs(PLAY, exist_ok=True)

# Play's app icon: 512x512, 32-bit PNG, no transparency, no rounding
# (Play applies its own mask).
save_rgb(tile(512, radius_frac=0, height_frac=0.56), os.path.join(PLAY, "icon-512.png"))

# Feature graphic: 1024x500, top of the listing. Play crops it on some
# surfaces, so the wordmark stays well inside the edges.
fg_img = Image.new("RGBA", (1024, 500), GREEN + (255,))
_fd = ImageDraw.Draw(fg_img)
wordmark(_fd, 512, 285, 185)
_ft = ImageFont.truetype(FONT_PATH, 40)
_fd.text((512, 355), TAGLINE, font=_ft, fill=HONEY + (255,), anchor="ma")
save_rgb(fg_img, os.path.join(PLAY, "feature-graphic.png"), bg=GREEN)
