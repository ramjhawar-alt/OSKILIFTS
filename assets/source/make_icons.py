"""Builds the app icons from the artwork in assets/source/oski-icon-source.png.

Run: python3 assets/source/make_icons.py
The source is a gold rounded tile on a black canvas. This script
  - paints the black corners gold so the iOS icon is a full-bleed opaque square (iOS rounds it),
  - cuts the bear out of the gold for the Android adaptive foreground (transparent, inside the safe zone),
  - makes the splash tile, the web favicon, and assets/source/preview.png (not shipped).
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..')
BLUE = (0, 50, 98)

src = Image.open(os.path.join(HERE, 'oski-icon-source.png')).convert('RGB')
a = np.array(src).astype(int)
GOLD = tuple(int(v) for v in np.median(a[40:80, 560:640].reshape(-1, 3), axis=0))  # flat background gold

# 1) Black corners (connected to the image border, near black) -> gold, grown a few px to cover the antialiased edge
dark = a.sum(axis=2) < 90
labels, _ = ndimage.label(dark)
border = set(np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))) - {0}
corners = np.isin(labels, list(border))
corners = ndimage.binary_dilation(corners, iterations=7)
a[corners] = GOLD
full = Image.fromarray(a.astype('uint8'))

icon = full.resize((1024, 1024), Image.LANCZOS)
icon.save(os.path.join(OUT, 'icon.png'), optimize=True)

# 2) Android foreground: remove the gold that is connected to the border (the bear's outline is closed)
near_gold = np.abs(a - np.array(GOLD)).sum(axis=2) < 60
labels, _ = ndimage.label(near_gold)
border = set(np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))) - {0}
bg = np.isin(labels, list(border))
bg = ndimage.binary_dilation(bg, iterations=1)
alpha = (~bg).astype('uint8') * 255
alpha = np.array(Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(1.2)))
fg = Image.fromarray(a.astype('uint8')).convert('RGBA')
fg.putalpha(Image.fromarray(alpha))
fg = fg.crop(fg.getbbox())
scale = 640 / max(fg.size)
fg = fg.resize((round(fg.width * scale), round(fg.height * scale)), Image.LANCZOS)
canvas = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
canvas.paste(fg, ((1024 - fg.width) // 2, (1024 - fg.height) // 2), fg)
canvas.save(os.path.join(OUT, 'adaptive-icon.png'), optimize=True)


def rounded(img, ratio=0.225):
    big = 4096
    mask = Image.new('L', (big, big), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, big, big], radius=int(big * ratio), fill=255)
    mask = mask.resize(img.size, Image.LANCZOS)
    out = Image.new('RGBA', img.size, (0, 0, 0, 0))
    out.paste(img.convert('RGBA'), (0, 0), mask)
    return out


# 3) Splash (rounded tile on transparent canvas, shown on Berkeley blue) and favicon
tile = rounded(icon).resize((560, 560), Image.LANCZOS)
splash = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
splash.paste(tile, (232, 232), tile)
splash.save(os.path.join(OUT, 'splash-icon.png'), optimize=True)
rounded(icon).resize((64, 64), Image.LANCZOS).save(os.path.join(OUT, 'favicon.png'), optimize=True)

# 4) Preview sheet: iOS rounded, Android circle on the adaptive background, splash on blue, tiny home-screen size
sheet = Image.new('RGB', (1900, 560), (235, 238, 243))
a1 = rounded(icon).resize((420, 420), Image.LANCZOS)
sheet.paste(a1, (40, 70), a1)
adaptive = Image.new('RGBA', (1024, 1024), GOLD + (255,))
adaptive.alpha_composite(canvas)
circle = Image.new('L', (1024, 1024), 0)
ImageDraw.Draw(circle).ellipse([0, 0, 1023, 1023], fill=255)
c = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0)); c.paste(adaptive, (0, 0), circle)
c = c.resize((420, 420), Image.LANCZOS); sheet.paste(c, (520, 70), c)
sp = Image.new('RGB', (420, 420), BLUE); t = tile.resize((220, 220), Image.LANCZOS); sp.paste(t, (100, 100), t); sheet.paste(sp, (1000, 70))
small = rounded(icon).resize((120, 120), Image.LANCZOS); sheet.paste(small, (1500, 70), small)
small2 = rounded(icon).resize((60, 60), Image.LANCZOS); sheet.paste(small2, (1660, 70), small2)
sheet.save(os.path.join(HERE, 'preview.png'))
print('gold', '#%02X%02X%02X' % GOLD)
