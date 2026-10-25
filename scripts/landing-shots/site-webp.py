# The website's app pictures (full update, Phase 4) from the captures of site.shot.ts:
# e2e-results/site-shots/<cur>/<lang>/<name>.png → assets/site/shots/<lang>/<cur>/<name>.webp (600 × 1298) and
# <name>-360.webp (360 × 779). A phone screen is captured 47 px short; a status-bar strip in the screen's own top
# colour goes on top, where the frame's camera sits, so the camera never covers a title. The queue card is a crop
# (640 wide, no strip). The English dirham set also refreshes assets/images/landing/ for the app's own home page.
import os
import shutil
import sys
from PIL import Image

SRC = 'e2e-results/site-shots'
DST = 'assets/site/shots'
APP = 'assets/images/landing'
STRIP = 94  # 47 px at 2×


def phone(png):
    im = Image.open(png).convert('RGB')
    w, h = im.size
    # The top row's most common colour: the header's own, without its pattern's lines drawn out into streaks.
    colour = max(im.crop((0, 0, w, 1)).getcolors(w))[1]
    full = Image.new('RGB', (w, h + STRIP), colour)
    full.paste(im, (0, STRIP))
    return full


def save(im, path, size):
    im.resize(size, Image.LANCZOS).save(path, 'WEBP', quality=82, method=6)


count = 0
for cur in sorted(os.listdir(SRC)):
    for lang in sorted(os.listdir(os.path.join(SRC, cur))):
        out = os.path.join(DST, lang, cur)
        os.makedirs(out, exist_ok=True)
        for file in sorted(os.listdir(os.path.join(SRC, cur, lang))):
            name, ext = os.path.splitext(file)
            if ext != '.png':
                continue
            png = os.path.join(SRC, cur, lang, file)
            if name == 'queue-card':
                im = Image.open(png).convert('RGB')
                save(im, os.path.join(out, 'queue-card.webp'), (640, round(im.size[1] * 640 / im.size[0])))
            else:
                im = phone(png)
                save(im, os.path.join(out, f'{name}.webp'), (600, 1298))
                save(im, os.path.join(out, f'{name}-360.webp'), (360, 779))
            if cur == 'aed' and lang == 'en' and os.path.exists(os.path.join(APP, f'{name}.webp')):
                shutil.copyfile(os.path.join(out, f'{name}.webp'), os.path.join(APP, f'{name}.webp'))
            count += 1
print('pictures:', count, file=sys.stderr)
