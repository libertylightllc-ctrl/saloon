# The captured phone screen (390 × 844 at 2×) to the website's 600 × 1298 WebP.
import sys
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
Image.open(src).convert('RGB').resize((600, 1298), Image.LANCZOS).save(dst, 'WEBP', quality=82, method=6)
print('saved', dst)
