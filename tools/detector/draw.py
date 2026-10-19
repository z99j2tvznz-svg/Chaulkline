"""Draw misses (red circle) and false balls (yellow square) for a finder on the checking pictures with the most errors.
   python3 draw.py old|new <threshold> <out.png> [n]"""
import json, sys
sys.path.insert(0, '.')
from evalfind import *
from newdet import at, inside
from PIL import Image, ImageDraw

which, th, out = sys.argv[1], float(sys.argv[2]), sys.argv[3]
n = int(sys.argv[4]) if len(sys.argv) > 4 else 8
if which == 'old':
    O = json.load(open('old-finder.json'))
    D = {p['id']: [(d['px'], d['py'], d['pr'], 1.0) for d in p['found'] if d['nb'] is None or d['nb'] < 0.5] for p in O['pictures']}
else:
    D = at(json.load(open('new-det.json')), th, region=True)
bad = []
for pid in ids_where(split='validation'):
    p = PICS[pid]; table = [b for b in p['balls'] if not b['inPocket']]; dets = D.get(pid, [])
    m = match(table, dets, RULES['main']); mi = {i for i, _, _ in m}; mj = {j for _, j, _ in m}
    pock = [b for b in p['balls'] if b['inPocket']]
    rest = [j for j in range(len(dets)) if j not in mj]
    mp = match(pock, [dets[j] for j in rest], RULES['main']); pj = {rest[j] for _, j, _ in mp}
    miss = [b for i, b in enumerate(table) if i not in mi]; fal = [dets[j] for j in rest if j not in pj]
    if miss or fal: bad.append((len(miss) + len(fal), pid, miss, fal))
bad.sort(key=lambda t: -t[0])
tiles = []
for _, pid, miss, fal in bad[:n]:
    p = PICS[pid]; im = Image.open('/mnt/project-files/chalkline-data/label-set-v1/' + p['image']).convert('RGB'); g = ImageDraw.Draw(im)
    for b in miss: g.ellipse([b['x'] - b['r'] - 3, b['y'] - b['r'] - 3, b['x'] + b['r'] + 3, b['y'] + b['r'] + 3], outline=(255, 40, 40), width=3)
    for d in fal: g.rectangle([d[0] - d[2] - 2, d[1] - d[2] - 2, d[0] + d[2] + 2, d[1] + d[2] + 2], outline=(255, 230, 0), width=2)
    if p['kind'] == 'frame':  # keep the table part of a full frame
        im = im.crop((60, 150, 1140, 420))
    g = ImageDraw.Draw(im); g.rectangle([0, 0, 520, 16], fill=(0, 0, 0)); g.text((3, 2), f"{pid}  missed {len(miss)}  false {len(fal)}", fill=(255, 255, 255))
    tiles.append(im)
W = max(t.width for t in tiles); H = sum(t.height + 6 for t in tiles)
sheet = Image.new('RGB', (W, H), (30, 30, 30)); y = 0
for t in tiles: sheet.paste(t, (0, y)); y += t.height + 6
sheet.save(out); print(out, [(b[1], len(b[2]), len(b[3])) for b in bad[:n]])
