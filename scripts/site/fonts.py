"""
The website home page's fonts (brief 4.5): the app's own Poppins and IBM Plex Sans Arabic, cut down to the letters
each language needs and saved as WOFF2 in assets/site/fonts/. Run again only when the fonts change:

    python3 scripts/site/fonts.py
"""
import os
import sys

from fontTools import subset

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'assets', 'site', 'fonts')
WEIGHTS = {'300': 'Light', '400': 'Regular', '500': 'Medium', '600': 'SemiBold', '700': 'Bold'}

LATIN = 'U+0000-017F,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+2000-206F,U+20AC,U+2122,U+2190-2199,U+2212,U+2215,U+FEFF,U+FFFD'
DEVANAGARI = 'U+0900-097F,U+1CD0-1CF9,U+200C-200D,U+20A8,U+20B9,U+25CC,U+A830-A839,U+A8E0-A8FF'
ARABIC = 'U+0600-06FF,U+0750-077F,U+08A0-08FF,U+200C-200F,U+2010-2011,U+204F,U+2E41,U+FB50-FDFF,U+FE70-FE74,U+FE76-FEFC,' + LATIN

SETS = [
    ('poppins', 'latin', '@expo-google-fonts/poppins/{w}{n}/Poppins_{w}{n}.ttf', LATIN),
    ('poppins', 'deva', '@expo-google-fonts/poppins/{w}{n}/Poppins_{w}{n}.ttf', DEVANAGARI),
    ('plex', 'arabic', '@expo-google-fonts/ibm-plex-sans-arabic/{w}{n}/IBMPlexSansArabic_{w}{n}.ttf', ARABIC),
]


def unicodes(ranges):
    out = []
    for part in ranges.split(','):
        a, _, b = part[2:].partition('-')
        out.extend(range(int(a, 16), int(b or a, 16) + 1))
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    for family, script, path, ranges in SETS:
        for w, n in WEIGHTS.items():
            source = os.path.join(ROOT, 'node_modules', path.format(w=w, n=n))
            options = subset.Options()
            options.flavor = 'woff2'
            options.layout_features = ['*']
            options.name_IDs = ['*']
            font = subset.load_font(source, options)
            sub = subset.Subsetter(options)
            sub.populate(unicodes=unicodes(ranges))
            sub.subset(font)
            target = os.path.join(OUT, f'{family}-{script}-{w}.woff2')
            subset.save_font(font, target, options)
            print(f'{target}: {os.path.getsize(target)} bytes')


if __name__ == '__main__':
    sys.exit(main())
