"""Draws the OSKILIFTS app icons (run: python3 assets/source/make_icons.py).

Oski in his blue cap, lifting a barbell, on Berkeley gold. Drawn at 4x and scaled
down for smooth edges. Outputs: assets/icon.png (iOS, opaque), adaptive-icon.png
(Android foreground, transparent, kept inside the safe zone), splash-icon.png and
favicon.png. No text and no Cal logo, on purpose.
"""
from PIL import Image, ImageDraw
import os

OUT = os.path.join(os.path.dirname(__file__), '..')
BLUE = (0, 50, 98); BLUE_LIGHT = (11, 74, 133); GOLD = (253, 181, 21)
TAN = (210, 180, 140); MUZZLE = (236, 211, 176); BROWN = (139, 69, 19); DARK = (84, 56, 30)
STEEL = (58, 66, 80); BLACK = (20, 20, 20); WHITE = (255, 255, 255); PALE_GOLD = (255, 224, 138)
S = 4  # supersampling


def art(background):
    """The artwork on a 1024 canvas. background: an RGB tuple, or None for transparent."""
    size = 1024 * S
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0) if background is None else background + (255,))
    d = ImageDraw.Draw(img)

    def circ(cx, cy, r, fill, outline=None, w=0):
        d.ellipse([(cx - r) * S, (cy - r) * S, (cx + r) * S, (cy + r) * S], fill=fill, outline=outline, width=int(w * S))

    def ell(cx, cy, rx, ry, fill, outline=None, w=0):
        d.ellipse([(cx - rx) * S, (cy - ry) * S, (cx + rx) * S, (cy + ry) * S], fill=fill, outline=outline, width=int(w * S))

    def rrect(x0, y0, x1, y1, r, fill, outline=None, w=0):
        d.rounded_rectangle([x0 * S, y0 * S, x1 * S, y1 * S], radius=r * S, fill=fill, outline=outline, width=int(w * S))

    def limb(x0, y0, x1, y1, width, fill, outline, w):
        # a thick rounded line (an arm): outline first, then the fill on top
        for (col, wd) in ((outline, width + 2 * w), (fill, width)):
            d.line([x0 * S, y0 * S, x1 * S, y1 * S], fill=col, width=int(wd * S))
            circ(x0, y0, wd / 2, col)
            circ(x1, y1, wd / 2, col)

    # barbell: bar, plates (drawn first so the paws and head sit on top)
    rrect(50, 785, 974, 827, 20, STEEL, BLACK, 6)
    for mirror in (False, True):
        def x(a, b):
            return (1024 - b, 1024 - a) if mirror else (a, b)
        x0, x1 = x(96, 176)
        rrect(x0, 640, x1, 972, 18, BLUE, BLACK, 7)
        x0, x1 = x(188, 244)
        rrect(x0, 690, x1, 922, 14, BLUE_LIGHT, BLACK, 7)
        x0, x1 = x(256, 282)
        rrect(x0, 758, x1, 854, 8, STEEL, BLACK, 5)

    # arms from the shoulders down to the bar (behind the head so the cheeks stay clean)
    limb(380, 690, 338, 806, 96, TAN, DARK, 9)
    limb(644, 690, 686, 806, 96, TAN, DARK, 9)

    # ears (behind the head), then head
    for sx in (-1, 1):
        circ(512 + sx * 186, 262, 104, TAN, DARK, 10)
        circ(512 + sx * 186, 262, 60, BROWN)
    circ(512, 478, 262, TAN, DARK, 11)
    ell(512, 560, 118, 88, MUZZLE)

    # Oski's cap: blue crown, gold band, brim
    rrect(318, 168, 706, 304, 30, BLUE, DARK, 9)
    rrect(318, 262, 706, 300, 6, PALE_GOLD, DARK, 5)
    ell(512, 306, 236, 30, BLUE, DARK, 9)
    circ(512, 160, 26, PALE_GOLD, DARK, 7)  # button on top

    # face
    for ex in (-76, 76):
        circ(512 + ex, 446, 36, BLACK)
        circ(512 + ex + 13, 432, 13, WHITE)
    ell(512, 530, 42, 31, BLACK)
    d.arc([(512 - 62) * S, (548) * S, (512 + 62) * S, (628) * S], start=20, end=160, fill=BLACK, width=int(11 * S))

    # paws gripping the bar
    for px in (338, 686):
        circ(px, 806, 56, BROWN, DARK, 9)
    return img.resize((1024, 1024), Image.LANCZOS)


def rounded(img, radius_ratio=0.225):
    mask = Image.new('L', (1024 * S, 1024 * S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, 1024 * S, 1024 * S], radius=int(1024 * S * radius_ratio), fill=255)
    mask = mask.resize((1024, 1024), Image.LANCZOS)
    out = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


# iOS icon: full-bleed, opaque (the system rounds the corners)
icon = art(GOLD).convert('RGB')
icon.save(os.path.join(OUT, 'icon.png'), optimize=True)

# Android adaptive foreground: transparent, shrunk to sit inside the 66% safe zone
fg = art(None)
bbox = fg.getbbox()
fg = fg.crop(bbox)
scale = 640 / max(fg.size)
fg = fg.resize((int(fg.width * scale), int(fg.height * scale)), Image.LANCZOS)
canvas = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
canvas.paste(fg, ((1024 - fg.width) // 2, (1024 - fg.height) // 2 + 10), fg)
canvas.save(os.path.join(OUT, 'adaptive-icon.png'), optimize=True)

# Splash: the icon as a rounded tile on a transparent canvas (shown on Berkeley blue)
tile = rounded(icon.convert('RGBA')).resize((560, 560), Image.LANCZOS)
splash = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
splash.paste(tile, ((1024 - 560) // 2, (1024 - 560) // 2), tile)
splash.save(os.path.join(OUT, 'splash-icon.png'), optimize=True)

# Web favicon
rounded(icon.convert('RGBA')).resize((64, 64), Image.LANCZOS).save(os.path.join(OUT, 'favicon.png'), optimize=True)

# A preview sheet for checking how the system masks will crop it (not shipped)
sheet = Image.new('RGB', (1600, 560), (235, 238, 243))
a = rounded(icon.convert('RGBA')).resize((420, 420), Image.LANCZOS)
sheet.paste(a, (40, 70), a)
adaptive_bg = Image.new('RGBA', (1024, 1024), GOLD + (255,))
adaptive_bg.alpha_composite(canvas)
circle = Image.new('L', (1024, 1024), 0)
ImageDraw.Draw(circle).ellipse([0, 0, 1023, 1023], fill=255)
c = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0)); c.paste(adaptive_bg, (0, 0), circle)
c = c.resize((420, 420), Image.LANCZOS); sheet.paste(c, (520, 70), c)
sp = Image.new('RGB', (420, 420), BLUE); t = tile.resize((220, 220), Image.LANCZOS); sp.paste(t, (100, 100), t); sheet.paste(sp, (1000, 70))
sheet.save(os.path.join(os.path.dirname(__file__), 'preview.png'))
print('done')
