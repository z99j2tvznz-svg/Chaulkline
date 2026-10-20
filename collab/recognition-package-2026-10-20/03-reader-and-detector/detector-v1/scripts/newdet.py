"""Run the trained detector on labels-v1 pictures (low threshold, every box kept) -> new-det.json, then score.
   python3 newdet.py <weights> run        # detect on all 185 pictures
   python3 newdet.py score                 # threshold from the internal validation session, then the checking split
"""
import json, sys, math
sys.path.insert(0, '.')
from evalfind import *

SET = '/mnt/project-files/chalkline-data/label-set-v1/'
IVAL = '2026-10-15_2107_V2.3.2'   # training-side session held back inside training, used only to watch training and pick the threshold
# Oct 16 table outline in the 1280x720 frame (as the baseline and the old finder used), grown 4% about its middle
Q = [[0.1975, 0.2788], [0.7625, 0.2612], [0.845, 0.5112], [0.1162, 0.5388]]
Q = [(x * 1280, y * 720) for x, y in Q]
cx, cy = sum(p[0] for p in Q) / 4, sum(p[1] for p in Q) / 4
Q = [(cx + (x - cx) * 1.04, cy + (y - cy) * 1.04) for x, y in Q]


def inside(x, y, poly=Q):
    s = None
    for i in range(len(poly)):
        (x1, y1), (x2, y2) = poly[i], poly[(i + 1) % len(poly)]
        c = (x2 - x1) * (y - y1) - (y2 - y1) * (x - x1)
        if c != 0:
            if s is None: s = c > 0
            elif s != (c > 0): return False
    return True


def run(weights):
    from ultralytics import YOLO
    m = YOLO(weights); out = {}
    for p in LAB['pictures']:
        r = m.predict(SET + p['image'], imgsz=1280, conf=0.01, iou=0.5, max_det=100, device='cpu', verbose=False)[0]
        out[p['id']] = [[round((b[0] + b[2]) / 2, 1), round((b[1] + b[3]) / 2, 1), round((b[2] - b[0] + b[3] - b[1]) / 4, 1), round(c, 3)]
                        for b, c in zip(r.boxes.xyxy.tolist(), r.boxes.conf.tolist())]
    json.dump(out, open('new-det.json', 'w'))


def at(D, th, region=False):
    return {k: [d for d in v if d[3] >= th and (not region or PICS[k]['kind'] != 'frame' or inside(d[0], d[1]))] for k, v in D.items()}


if __name__ == '__main__':
    if sys.argv[-1] == 'run': run(sys.argv[1]); sys.exit()
    D = json.load(open('new-det.json'))
    iv = [p['id'] for p in LAB['pictures'] if p['session'] == IVAL]
    print('## Threshold sweep on the internal validation session (12 training-side pictures; picks the threshold)')
    print(HEAD); best = None; F1 = []
    for th in [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]:
        c = score(at(D, th), iv); P = c['found'] / max(1, c['found'] + c['false']); R = c['found'] / c['balls']; f = 2 * P * R / max(1e-9, P + R)
        print(line(f'conf >= {th} (F1 {f:.3f})', c))
        F1.append((th, f))
        if best is None or f > best[0] + 1e-9: best = (f, th)
    # the internal validation session is perfect from 0.1 to 0.6, so F1 cannot pick; rule fixed before looking at the
    # checking split: the middle of the threshold range that is perfect there
    perfect = [th for th, f in F1 if f >= best[0] - 1e-9]
    TH = round((min(perfect) + max(perfect)) / 2, 2)
    print(f'\nChosen threshold: {TH} (middle of the range with the best F1 on the internal validation session: {min(perfect)} to {max(perfect)})')
    sets = [('A. Checking crops, all (24)', ids_where(split='validation', kind='crop'), False),
            ('… Oct 16 crops (12)', ids_where(group='oct16-crop'), False), ('… hall crops (12)', ids_where(group='hall'), False),
            ('B. Checking full frames, whole frame (29)', ids_where(split='validation', kind='frame'), False),
            ('B. Checking full frames, inside the table outline (29)', ids_where(split='validation', kind='frame'), True)]
    for name, ids, reg in sets:
        print('\n###', name); print(HEAD)
        print(line(f'new detector, conf >= {TH}', score(at(D, TH, reg), ids)))
        for th in [0.1, 0.25, 0.5, 0.7, 0.85]:
            if th != TH: print(line(f'… (sweep, not chosen) conf >= {th}', score(at(D, th, reg), ids)))
