"""Build the app pages from the files in src/.

    python3 build.py           write index.html (V3) and v2/index.html (V2.3.3, kept as it was)
    python3 build.py --check   rebuild in memory and fail if either differs from what is on disk

index.html is the page the phone opens (GitHub Pages). Never edit it by hand: edit src/ and rebuild.
V3: src/v3/page.html + core.js, vision.js (table finding), detect.js, track.js, v3/app.js. It loads ONNX Runtime Web from
vendor/ort/ and the models from models/v3/ at run time, so it must be served from the repo root.
V2.3.3: src/template.html + core.js, vision.js (with the old recognizer), app.js, unchanged.
"""
import base64, io, os, re, sys
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')


def read(name):
    with open(os.path.join(SRC, name), encoding='utf-8') as f:
        return f.read()


strip = lambda s: re.sub(r"if \(typeof (window|module)[\s\S]*$", "", s)


def build_v2():
    t = read('template.html')
    core = strip(read('core.js'))
    vis = strip(read('vision.js')).replace('/*RECOG_JSON*/null', read('recog.json').strip())
    app = read('app.js')
    return page(t.replace('/*CORE*/', core).replace('/*VISION*/', vis).replace('/*APP*/', app))


def build_v3():
    t = read('v3/page.html')
    parts = {'/*CORE*/': strip(read('core.js')), '/*VISION*/': strip(read('vision.js')), '/*DETECT*/': strip(read('detect.js')),
             '/*TRACK*/': strip(read('track.js')), '/*CLOTH*/': strip(read('v3/cloth.js')), '/*APP*/': read('v3/app.js')}
    for k, v in parts.items():
        assert k in t, k
        t = t.replace(k, v)
    return page(t)


def page(body):
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
    ok = True
    for rel, fn in (('index.html', build_v3), ('v2/index.html', build_v2)):
        out, target = fn(), os.path.join(ROOT, rel)
        if '--check' in sys.argv:
            try:
                with open(target, encoding='utf-8') as f:
                    same = f.read() == out
            except FileNotFoundError:
                same = False
            print(rel + (' matches src/' if same else ' is NOT what src/ builds: run python3 build.py'))
            ok = ok and same
            continue
        os.makedirs(os.path.dirname(target), exist_ok=True)
        with open(target, 'w', encoding='utf-8') as f:
            f.write(out)
        print(len(out), 'bytes written to', rel)
    sys.exit(0 if ok else 1)
