"""Picture sheet of before/after table looks (read-only), from tools/experiments/table-looks.js output.
Per shot: the real frame with Chalkline's spots (green = named, amber = seen but not named, red ring = named but not on
the true table), and Chalkline's top-down table beside it; a line lists the true table, missing and wrong balls.
   python3 tools/experiments/table-sheet.py <looks.json> <out folder>
"""
import json, os, subprocess, sys, tempfile
from PIL import Image, ImageDraw, ImageFont

looks, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
COL = {0: (245, 245, 240), 1: (240, 200, 0), 2: (20, 60, 200), 3: (210, 30, 30), 4: (110, 40, 150), 5: (250, 120, 0),
       6: (0, 120, 60), 7: (120, 20, 30), 8: (15, 15, 15), 9: (240, 200, 0)}
try: F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 18); FS = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 16)
except Exception: F = FS = ImageFont.load_default()

def frame(video, f):
    tmp = tempfile.mktemp(suffix='.png')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', video, '-vf', f'fps=30,scale=1280:720,select=eq(n\\,{f})', '-vsync', '0', '-frames:v', '1', tmp], check=True)
    return Image.open(tmp).convert('RGB')

def topdown(look, W=560):
    k = W / 78; H = int(39 * k); im = Image.new('RGB', (W + 40, H + 40), (60, 40, 25)); d = ImageDraw.Draw(im)
    d.rectangle((20, 20, 20 + W, 20 + H), fill=(30, 140, 200))
    for px, py in [(0, 0), (39, -0.6), (78, 0), (0, 39), (39, 39.6), (78, 39)]:
        x, y = 20 + px * k, 20 + (39 - py) * k; d.ellipse((x - 9, y - 9, x + 9, y + 9), fill=(10, 10, 10))
    truth = look['truthOn']; r = 1.125 * k
    for s in look['seen']:
        x, y = 20 + s['x'] * k, 20 + (39 - s['y']) * k; n = s['num']
        if n is None: d.ellipse((x - r, y - r, x + r, y + r), outline=(255, 190, 0), width=3); d.text((x - 5, y - 9), '?', fill=(255, 190, 0), font=F); continue
        d.ellipse((x - r, y - r, x + r, y + r), fill=COL[n], outline=(255, 255, 255) if n == 9 else None, width=2)
        if truth is not None and n not in truth: d.ellipse((x - r - 4, y - r - 4, x + r + 4, y + r + 4), outline=(255, 0, 0), width=3)
        d.text((x - 6, y - 10), str(n), fill=(0, 0, 0) if n in (0, 1, 9) else (255, 255, 255), font=F)
    return im

def summary(look):
    named = sorted(s['num'] for s in look['seen'] if s['num'] is not None); truth = look['truthOn']
    t = f"Chalkline named {named}" + (f", {look['unnamed']} spot(s) not named" if look['unnamed'] else '')
    if truth is not None:
        miss = [n for n in truth if n not in named]; wrong = [n for n in named if n not in truth]
        t += f". True table {sorted(truth)}. Missing {miss or 'none'}; wrong {wrong or 'none'}."
    else: t += '. True table not recorded for this session (check against the picture).'
    if not look['settled']: t += ' Table still moving in this look.'
    return t

for shot in json.load(open(looks)):
    rows = []
    for look in shot['looks']:
        im = frame(shot['video'], look['frame']); d = ImageDraw.Draw(im); truth = look['truthOn']
        for s in look['spots']:
            n = s['num']; c = (0, 230, 0) if n is not None else (255, 190, 0)
            if n is not None and truth is not None and n not in truth: c = (255, 0, 0)
            d.ellipse((s['px'] - 16, s['py'] - 16, s['px'] + 16, s['py'] + 16), outline=c, width=3)
            d.text((s['px'] + 17, s['py'] - 20), '?' if n is None else str(n), fill=c, font=F)
        ys = [s['py'] for s in look['spots']] or [200, 520]
        im = im.crop((0, max(0, min(ys) - 90), 1280, min(720, max(ys) + 90))); im = im.resize((900, int(im.height * 900 / 1280)))
        td = topdown(look); h = max(im.height, td.height) + 30
        row = Image.new('RGB', (900 + td.width + 10, h), 'white'); row.paste(im, (0, 0)); row.paste(td, (910, 0))
        ImageDraw.Draw(row).text((5, h - 24), f"{look['label'].upper()} (t={look['t']} s): " + summary(look), fill='black', font=FS)
        rows.append(row)
    W = max(r.width for r in rows); head = 34
    sheet = Image.new('RGB', (W, head + sum(r.height for r in rows) + 10), 'white'); d = ImageDraw.Draw(sheet)
    verdict = shot['result'] + (f"; balls in: {shot['made']}" if shot['made'] else '; no ball in')
    if shot['open']: verdict += '; left open: ' + ', '.join(f"{o['fact']} {o['ball']}" for o in shot['open'])
    if shot['wrong']: verdict += '; wrong: ' + '; '.join(f"{w['fact']} {w.get('ball', '')} ({w['what']})" for w in shot['wrong'])
    d.text((5, 8), f"{shot['session']} {shot['clip']}: {verdict}", fill='black', font=F)
    y = head
    for r in rows: sheet.paste(r, (0, y)); y += r.height
    sheet.save(os.path.join(out, f"{shot['session']}-{shot['clip']}.png")); print(shot['clip'], sheet.size)
