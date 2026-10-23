import sys, glob, os
from PIL import Image
d = sys.argv[1]; out = sys.argv[2]; cols = int(sys.argv[3]) if len(sys.argv) > 3 else 3
lo = int(sys.argv[4]) if len(sys.argv) > 4 else 0; hi = int(sys.argv[5]) if len(sys.argv) > 5 else 10**9
tw = int(sys.argv[6]) if len(sys.argv) > 6 else 640
fs = sorted(f for f in glob.glob(os.path.join(d, '*.jpg')) if lo <= int(os.path.basename(f)[:5]) <= hi)
th = tw * 9 // 16
rows = (len(fs) + cols - 1) // cols
im = Image.new('RGB', (cols * tw, rows * th), (20, 20, 20))
from PIL import ImageDraw
dr = ImageDraw.Draw(im)
for i, f in enumerate(fs):
    x = Image.open(f).convert('RGB').resize((tw, th), Image.LANCZOS)
    im.paste(x, ((i % cols) * tw, (i // cols) * th))
    dr.text(((i % cols) * tw + 6, (i // cols) * th + 4), os.path.basename(f)[:5], fill=(255, 255, 0))
im.save(out, quality=88)
print(len(fs), 'frames ->', out)
