"""Rack-start probe (pixel level, offline): find the pack of touching balls on the still table before the break, where
detector-v1 sees only a few of them, and estimate how many balls it holds. No ball has to be read.

  python rackprobe.py <detections json> <video> <t0> <t1> <out json> [--debug out.png]

t0..t1: a still stretch before the first shot (from the tracker). Method:
  1. median picture of up to 15 frames in t0..t1 (a hand or cue passing through is removed);
  2. table-to-picture mapping fitted on the clip's own detections (table inches <-> picture pixels), ball radius in
     pixels as a straight line in picture height;
  3. non-cloth mask: colour away from the cloth (Lab a/b distance), plus the discs of the balls the detector found
     (a blue ball on blue cloth is not "non-cloth" by colour);
  4. the pack = the mask region around a cluster, at least 1.8 single-ball areas;
  5. count: touching balls sit on a hexagonal grid 2.25 in apart. Grids at every turn (3 degree steps) and shift are
     laid over the pack; grid points whose ball disc is mostly inside the mask are taken as balls, the drawn discs are
     compared with the pack region, and the best match gives the count. Reported as an estimate with its match score.
Output: pack centre in table inches, the end of the table it is at (foot end = the rack end), estimated count, match.
"""
import json, math, sys
import numpy as np, cv2, subprocess, tempfile, os

R_IN = 1.125


def frames_at(video, ts):
    out = []
    with tempfile.TemporaryDirectory() as tmp:
        for i, t in enumerate(ts):
            f = os.path.join(tmp, f'{i}.png')
            subprocess.run(['ffmpeg', '-v', 'error', '-ss', f'{t:.3f}', '-i', video, '-frames:v', '1', '-vf', 'scale=1280:720', f], check=True)
            out.append(cv2.imread(f))
    return out


def fit_mapping(D):
    src, dst = [], []
    for f in D['frames'][::3]:
        for b in f['balls']:
            src.append([b['x'], b['y']]); dst.append([b['px'], b['py']])
    src, dst = np.array(src, np.float32), np.array(dst, np.float32)
    H, _ = cv2.findHomography(src, dst, cv2.RANSAC, 3.0)
    return H


def main():
    det, video, t0, t1, out = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4]), sys.argv[5]
    dbg = sys.argv[sys.argv.index('--debug') + 1] if '--debug' in sys.argv else None
    D = json.load(open(det)); L, W = D['table']
    H = fit_mapping(D)
    proj = lambda pts: cv2.perspectiveTransform(np.array([pts], np.float32), H)[0]
    # ball radius in pixels vs picture height, from the detections that carry it (c = detector box)
    fr = [f for f in D['frames'] if t0 <= f['t'] <= t1]
    ts = np.linspace(t0, t1, min(15, max(1, len(fr))))
    imgs = frames_at(video, ts)
    img = np.median(np.stack(imgs), 0).astype(np.uint8)
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB).astype(np.float32)
    # cloth colour: median over a grid on the cloth
    g = proj([[x, y] for x in np.linspace(6, L - 6, 40) for y in np.linspace(5, W - 5, 20)])
    cloth = np.median(np.array([lab[int(p[1]), int(p[0])] for p in g if 0 <= p[0] < 1280 and 0 <= p[1] < 720]), 0)
    # radius: one ball diameter across the table plane at that spot, in pixels (the picture of a sphere is about the
    # projected diameter wide)
    def rad(x, y):
        a, b = proj([[x - R_IN, y], [x + R_IN, y]]); return float(np.hypot(*(b - a)) / 2)
    ab = np.linalg.norm(lab[..., 1:] - cloth[1:], axis=2)
    mask = (ab > 15).astype(np.uint8)
    # only the cloth inside the cushions
    poly = proj([[0.5, 0.5], [L - 0.5, 0.5], [L - 0.5, W - 0.5], [0.5, W - 0.5]]).astype(np.int32)
    inside = np.zeros_like(mask); cv2.fillPoly(inside, [poly], 1)
    # the detector's balls in the still stretch (median spot per cluster)
    spots = []
    for f in fr:
        for b in f['balls']:
            for s in spots:
                if math.hypot(s[0] - b['x'], s[1] - b['y']) < 1.5: s[2].append((b['x'], b['y'])); break
            else: spots.append([b['x'], b['y'], [(b['x'], b['y'])]])
    balls = [(float(np.median([p[0] for p in s[2]])), float(np.median([p[1] for p in s[2]]))) for s in spots if len(s[2]) >= 0.5 * len(fr)]
    for (x, y) in balls:
        p = proj([[x, y]])[0]; cv2.circle(mask, (int(p[0]), int(p[1])), int(rad(x, y)), 1, -1)
    mask = cv2.morphologyEx(mask * inside, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, lbl, st, cen = cv2.connectedComponentsWithStats(mask)
    packs = []
    for k in range(1, n):
        cx, cy = cen[k]
        # single-ball area at this spot: invert the centre to table inches
        Hi = np.linalg.inv(H); q = cv2.perspectiveTransform(np.array([[[cx, cy]]], np.float32), Hi)[0, 0]
        a1 = math.pi * rad(*q) ** 2
        if st[k, cv2.CC_STAT_AREA] >= 1.8 * a1: packs.append((k, q, st[k, cv2.CC_STAT_AREA] / a1))
    res = {'t': [t0, t1], 'frames': len(imgs), 'cloth': [round(float(v), 1) for v in cloth], 'detectedBalls': [[round(x, 1), round(y, 1)] for x, y in balls], 'packs': []}
    for k, q, areaBalls in packs:
        comp = (lbl == k).astype(np.uint8)
        best = None
        for th in np.arange(0, 60, 3):
            c, s = math.cos(math.radians(th)), math.sin(math.radians(th))
            a1, a2 = np.array([c, s]) * 2 * R_IN, np.array([math.cos(math.radians(th + 60)), math.sin(math.radians(th + 60))]) * 2 * R_IN
            for ox in np.linspace(0, 1, 5, endpoint=False):
                for oy in np.linspace(0, 1, 5, endpoint=False):
                    o = q + ox * a1 + oy * a2
                    cells = [o + i * a1 + j * a2 for i in range(-6, 7) for j in range(-6, 7)]
                    cells = [p for p in cells if 0 < p[0] < L and 0 < p[1] < W and np.hypot(*(p - q)) < 10]
                    if not cells: continue
                    P = proj([list(p) for p in cells]); keep, drawn = [], np.zeros_like(comp)
                    for p, pp in zip(cells, P):
                        r = rad(*p); disc = np.zeros_like(comp); cv2.circle(disc, (int(round(pp[0])), int(round(pp[1]))), int(round(0.8 * r)), 1, -1)
                        tot = disc.sum()
                        if tot and (disc & comp).sum() >= 0.85 * tot: keep.append(p); cv2.circle(drawn, (int(round(pp[0])), int(round(pp[1]))), int(round(r)), 1, -1)
                    if not keep: continue
                    iou = (drawn & comp).sum() / max(1, (drawn | comp).sum())
                    if best is None or iou > best[0] + 1e-9: best = (iou, len(keep), th, keep)
        if best is None: continue
        iou, nb, th, keep = best
        res['packs'].append({'centre': [round(float(q[0]), 1), round(float(q[1]), 1)], 'areaInBalls': round(float(areaBalls), 1), 'count': nb,
                             'match': round(float(iou), 3), 'turn': float(th), 'end': 'x0' if q[0] < L / 2 else 'xL',
                             'grid': [[round(float(p[0]), 1), round(float(p[1]), 1)] for p in keep]})
        if dbg:
            vis = img.copy()
            for p in proj([list(p) for p in keep]): cv2.circle(vis, (int(p[0]), int(p[1])), 3, (0, 0, 255), -1)
            ys, xs = np.nonzero(comp); x0, x1, y0, y1 = max(0, xs.min() - 30), xs.max() + 30, max(0, ys.min() - 30), ys.max() + 30
            cv2.imwrite(dbg, cv2.resize(np.concatenate([vis[y0:y1, x0:x1], cv2.cvtColor(comp[y0:y1, x0:x1] * 255, cv2.COLOR_GRAY2BGR)], 0), None, fx=3, fy=3, interpolation=cv2.INTER_NEAREST))
    # the pack: a region of touching balls is matched well by the ball grid and holds at least one ball the detector
    # found; anything else (an arm or body over the cloth, a cue lying on it) is not a pack
    for p in res['packs']:
        p['holdsDetected'] = any(min(math.hypot(x - g[0], y - g[1]) for g in p['grid']) < 2.25 for x, y in balls)
        p['isPack'] = p['holdsDetected'] and p['match'] >= 0.7
    res['packs'].sort(key=lambda p: (not p['isPack'], -p['match']))
    if res['packs'] and not res['packs'][0]['isPack']: res['noPack'] = True
    json.dump(res, open(out, 'w'), indent=1)
    print(json.dumps({k: v for k, v in res.items() if k != 'packs'}), [{k: v for k, v in p.items() if k != 'grid'} for p in res['packs']])


if __name__ == '__main__':
    main()
