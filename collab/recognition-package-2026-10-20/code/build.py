"""Build index.html from the files in src/.

    python3 build.py           write index.html
    python3 build.py --check   rebuild in memory and fail if it differs from index.html

index.html is the file the phone opens (GitHub Pages). Never edit it by hand: edit src/ and rebuild.
"""
import base64, io, os, re, sys
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')


def read(name):
    with open(os.path.join(SRC, name), encoding='utf-8') as f:
        return f.read()


def build():
    t = read('template.html')
    strip = lambda s: re.sub(r"if \(typeof module[\s\S]*$", "", s)
    core = strip(read('core.js'))
    vis = strip(read('vision.js')).replace('/*RECOG_JSON*/null', read('recog.json').strip())
    app = read('app.js')
    body = t.replace('/*CORE*/', core).replace('/*VISION*/', vis).replace('/*APP*/', app)
    # home-screen icon
    im = Image.new('RGB', (180, 180), (13, 19, 24)); d = ImageDraw.Draw(im)
    d.rounded_rectangle((26, 50, 154, 130), 10, fill=(29, 107, 87), outline=(75, 53, 39), width=6)
    d.ellipse((118, 78, 140, 100), fill=(244, 241, 232)); d.line((40, 112, 112, 90), fill=(70, 184, 242), width=5)
    b = io.BytesIO(); im.save(b, 'PNG'); icon = 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()
    head = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="Chalkline">
<meta name="theme-color" content="#0d1318"><link rel="apple-touch-icon" href="{icon}"><link rel="icon" href="{icon}">
'''
    # title, links and style go in head, the rest in body
    idx = body.index('<div id="home">')
    return head + body[:idx] + '</head><body>\n' + body[idx:] + '\n</body></html>\n'


if __name__ == '__main__':
    out = build()
    target = os.path.join(ROOT, 'index.html')
    if '--check' in sys.argv:
        with open(target, encoding='utf-8') as f:
            same = f.read() == out
        print('index.html matches src/' if same else 'index.html is NOT what src/ builds: run python3 build.py')
        sys.exit(0 if same else 1)
    with open(target, 'w', encoding='utf-8') as f:
        f.write(out)
    print(len(out), 'bytes written to index.html')
