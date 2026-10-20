"""Colour-and-stripe measurement check (Oct 20, 2026). Offline, read only: no training, the reader, tracker v0.6 and the
app are unchanged. On the exact 24 x 24 reader pictures (tools/experiments/reader-input.js) it takes a few fixed
measurements of each spot against the cloth around it, and asks whether they can tell apart the reader's recurring
confusions: 9 vs cue, 8 vs 2, 7 vs 4, 5 vs 3, and ball vs not a ball under changed light.

    python3 -I colour-stripe.py prep <setup.json> <labels folder> <out list.json>     (then reader-input.js on the list)
    python3 -I colour-stripe.py score <list.json> <inputs.json> <recog.json> <out.json>

Scoring: the cut-offs for each pair come from every other session; the held-out session (one camera spot) is scored with
them (ball vs not a ball: a fixed rule, see BALL_CUT). A value inside the range where the training classes overlap, or between them, is "can't tell". Only verified
labels are scored; the light steps (identities by eye only) are reported apart.
"""
import base64, glob, json, math, os, sys
import numpy as np

S = 24
C0 = S / 2 - 0.5
YY, XX = np.mgrid[0:S, 0:S]
RAD = np.hypot(YY - C0, XX - C0)
DISK = RAD <= 6.0          # the ball is 7.5 px across its radius in the picture; stay off its edge
RING = RAD >= 10.0         # the corners of the square: cloth, unless a rail or another ball is there
NAMES = ['cue'] + [str(i) for i in range(1, 10)] + ['not a ball']
PAIRS = [('9 vs cue', 9, 0, 'colour'), ('8 vs 2', 2, 8, 'blue'), ('7 vs 4', 4, 7, 'blue'), ('5 vs 3', 5, 3, 'hue')]
LIGHT = ['clip012', 'clip013', 'clip014']
# the labelled pictures have no verified empty spots, so ball vs not a ball uses a fixed rule, set before looking: more than
# half the ball area unlike the cloth is a ball, under a quarter is not, in between can't tell
BALL_CUT = (0.25, 0.5)
SESSION_SPOT = {'oct16': 'Oct 16 close side', 'firstspot': 'Oct 17 far spot', 'otherside': 'Oct 17 other side',
                'rec-20261017-1730': 'Oct 17 recorder', 'rec-20261018-2310': 'Oct 18 recorder', 'rec-20261019-1710': 'Oct 19 recorder'}


def prep(setup_path, labels_dir, out):
    setup = json.load(open(setup_path)); rows = []
    names = {'2026-10-17_2151_V2.3.3_firstspot': 'firstspot', '2026-10-17_1500_V2.3.3_otherside': 'otherside'}
    pics = []
    for f in sorted(glob.glob(os.path.join(labels_dir, '*.json'))):
        d = json.load(open(f)); pics.append((names.get(d['session'], d['session']), d['file'][:-4], d['balls'], d.get('removed') or []))
    pics += [('oct16', l['clip'], l['balls'], l.get('removed') or []) for l in setup['oct16']['labels']]
    for sess, clip, balls, removed in pics:
        s = setup[sess]; det = json.load(open(os.path.join(s['dets'], clip + '.json')))
        video = s['video'].format(clip=clip)
        # the frame inside the labelled still window where the most labelled balls have a spot
        nfr = len(det['frames']); best = None
        for f in range(nfr - 15, nfr):
            sp = det['frames'][f]['balls']
            n = sum(any(math.hypot(p['px'] - b['x'], p['py'] - b['y']) < 10 for p in sp) for b in balls)
            if best is None or n > best[0]:
                best = (n, f)
        f = best[1]
        for j, p in enumerate(det['frames'][f]['balls']):
            d = [math.hypot(p['px'] - b['x'], p['py'] - b['y']) for b in balls]
            k = int(np.argmin(d)) if d else -1
            if k >= 0 and d[k] < 10:
                b = balls[k]
                if b.get('inPocket'):
                    continue
                truth = None if (b.get('unknown') or b.get('partial') or b.get('num') is None) else b['num']
                kind = 'ball' if truth is not None else 'ball, number not verified'
            elif not d or min(d) > 20:
                truth, kind = 10, 'no ball (verified)'
            else:
                continue
            others = [(b['x'], b['y']) for i, b in enumerate(balls) if i != k or kind.startswith('no')]
            rows.append({'id': f'{sess}:{clip}:{j}', 'session': sess, 'clip': clip, 'frame': f, 'spot': j, 'dets': s['dets'], 'video': video,
                         'truth': truth, 'kind': kind, 'verified': True, 'others': others})
    # light steps: every spot of the still layout; identities by eye only (not verified)
    s = setup['rec-20261017-1730']
    for clip in LIGHT:
        det = json.load(open(os.path.join(s['dets'], clip + '.json'))); f = len(det['frames']) - 8
        sp = det['frames'][f]['balls']
        for j, p in enumerate(sp):
            rows.append({'id': f'light:{clip}:{j}', 'session': 'rec-20261017-1730', 'clip': clip, 'frame': f, 'spot': j, 'dets': s['dets'],
                         'video': s['video'].format(clip=clip), 'truth': None, 'kind': 'light step (by eye)', 'verified': False,
                         'others': [(q['px'], q['py']) for i, q in enumerate(sp) if i != j]})
    json.dump(rows, open(out, 'w'))
    print(len(rows), 'spots')


def hsv(rgb):
    mx = rgb.max(-1); mn = rgb.min(-1); v = mx; s = (mx - mn) / (mx + 1e-3)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]; d = mx - mn + 1e-6
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    return h, s, v


def measure(img, ref_cloth=None):
    """img: 24 x 24 x 3 in 0-1. Colours are taken relative to the cloth in the corners of the square: each channel is
    scaled so that the cloth matches the reference cloth colour (a white balance on the cloth)."""
    cloth = np.median(img[RING], 0)
    if ref_cloth is not None:
        img = np.clip(img * (ref_cloth / np.maximum(cloth, 0.03)), 0, 1); cloth = ref_cloth
    px = img[DISK]; h, s, v = hsv(px)
    off = np.linalg.norm(px - cloth, axis=1) > 0.18                      # not cloth-coloured
    white = (s < 0.3) & (v > 0.6)
    coloured = (s >= 0.35) & (v >= 0.25) & off & ~white
    body = off & ~white                                                  # ball colour, including black
    hue = h[coloured]
    hc = float(np.degrees(np.arctan2(np.sin(np.radians(hue)).mean(), np.cos(np.radians(hue)).mean()))) if len(hue) >= 3 else float('nan')
    bp = px[body]
    blue = float(((bp[:, 2] - bp[:, 0]) / (bp.max(1) + 0.05)).mean()) if len(bp) >= 3 else float('nan')
    return {'ballness': float(off.mean()), 'white': float(white.mean()), 'colour': float(coloured.mean()), 'dark': float((v < 0.25).mean()),
            'hue': hc, 'blue': blue, 'cloth': cloth.tolist()}


def recog(path):
    R = json.load(open(path)); dec = lambda s: np.frombuffer(base64.b64decode(s), dtype=np.int8).astype(np.float32)
    W1 = dec(R['w1']).reshape(R['nin'], R['nh']); W2 = dec(R['w2']).reshape(R['nh'], R['classes'] if isinstance(R['classes'], int) else len(R['classes']))
    s1, b1, s2, b2 = (np.array(R[k], dtype=np.float32) for k in ('s1', 'b1', 's2', 'b2'))

    def run(img):
        x = list(img.reshape(-1)); c = img[S // 4:3 * S // 4, S // 4:3 * S // 4].reshape(-1, 3)
        mx, mn = c.max(1), c.min(1); sat = (mx - mn) / (mx + 1e-3)
        wh = ((sat < 0.25) & (mx > 0.6)).mean(); dk = (mx < 0.3).mean(); col = (sat >= 0.25) & (mx >= 0.3)
        m = c[col].mean(0) if col.any() else np.zeros(3)
        x = np.array(x + [wh * 3, dk * 3, *(m * 3)], dtype=np.float32)
        hdn = np.maximum((x @ W1) * s1 + b1, 0); z = (hdn @ W2) * s2 + b2; z = np.exp(z - z.max()); return z / z.sum()
    return run


def cutoffs(a, b):
    """a: values of the class expected high, b: expected low (training). Returns (lo, hi): below lo -> b, above hi -> a,
    in between -> can't tell. If the ranges overlap, the overlap is "can't tell"; if they don't, the gap is."""
    a, b = np.sort(a), np.sort(b)
    if not len(a) or not len(b):
        return None
    lo, hi = min(a[0], b[-1]), max(a[0], b[-1])
    return lo, hi


def score(list_path, inputs_path, recog_path, out):
    L = json.load(open(list_path)); I = json.load(open(inputs_path)); run = recog(recog_path)
    rows = []
    for r in L:
        e = I[r['id']]; img = np.array(e['input']['rgb'], dtype=np.float32).reshape(S, S, 3) / 255
        rad = e['ballRadiusPx']; px, py = None, None
        det = json.load(open(os.path.join(r['dets'], r['clip'] + '.json')))['frames'][r['frame']]['balls'][r['spot']]
        near = min([math.hypot(det['px'] - x, det['py'] - y) for x, y in r['others']] or [1e9]) / rad
        r2 = {k: r[k] for k in ('id', 'session', 'clip', 'truth', 'kind', 'verified')}
        r2.update(img=img, probs=np.array(e['probs']), near=near, view='touching or overlapping' if near < 2.3 else 'another ball in the square' if near < 2.9 else 'clean single ball')
        py_probs = run(img); r2['readerCheck'] = float(np.abs(py_probs - r2['probs']).max())
        rows.append(r2)
    ver = [r for r in rows if r['verified']]
    ref = np.median([np.median(r['img'][RING], 0) for r in ver if r['session'] == 'oct16' and r['view'] == 'clean single ball'], 0)
    for r in rows:
        r['m'] = measure(r['img']); r['mn'] = measure(r['img'], ref)
    res = {'readerReproduced': max(r['readerCheck'] for r in rows), 'referenceCloth': ref.tolist(), 'pairs': {}, 'veto': {}, 'light': {}, 'counts': {}}
    sessions = sorted({r['session'] for r in ver})

    def reader_call(r, a, b):
        p = r['probs']; top = int(p[:10].argmax())
        if p[10] >= 0.5 or p[top] < 0.6 or top not in (a, b):
            return 'unsure'
        return 'right' if top == r['truth'] else 'confidently wrong'

    for name, A, B, feat in PAIRS:
        res['pairs'][name] = {}
        for norm in ('m', 'mn'):
            ex = [r for r in ver if r['truth'] in (A, B) and not math.isnan(r[norm][feat])]
            per = {}
            for held in sessions:
                tr = [r for r in ex if r['session'] != held]; te = [r for r in ex if r['session'] == held]
                if not te:
                    continue
                cut = cutoffs(np.array([r[norm][feat] for r in tr if r['truth'] == A]), np.array([r[norm][feat] for r in tr if r['truth'] == B]))
                # the same held-out cut-offs on every ball of the held-out session (for the overconfidence check)
                for r in ver:
                    if r['session'] == held and not math.isnan(r[norm][feat]):
                        x = r[norm][feat]
                        r.setdefault('callsAll', {})[(name, norm)] = 'unsure' if cut is None or cut[0] <= x <= cut[1] else (A if x > cut[1] else B)
                for r in te:
                    x = r[norm][feat]
                    call = 'unsure' if cut is None or cut[0] <= x <= cut[1] else (A if x > cut[1] else B)
                    out_ = 'unsure' if call == 'unsure' else 'right' if call == r['truth'] else 'confidently wrong'
                    k = (held, r['view'])
                    per.setdefault(k, {'n': 0, 'right': 0, 'confidently wrong': 0, 'unsure': 0, 'reader right': 0, 'reader confidently wrong': 0, 'reader unsure': 0, 'cut': cut})
                    per[k]['n'] += 1; per[k][out_] += 1; per[k]['reader ' + reader_call(r, A, B)] += 1
                    r.setdefault('calls', {})[(name, norm)] = call
            res['pairs'][name][norm] = {f'{SESSION_SPOT[h]} | {v}': {kk: (list(map(float, vv)) if kk == 'cut' and vv else vv) for kk, vv in d.items()} for (h, v), d in sorted(per.items())}
    # ball vs not a ball: verified spots (real balls vs verified empty spots), then the light steps by eye
    for norm in ('m', 'mn'):
        per = {}
        for held in sessions:
            tr = [r for r in ver if r['session'] != held]; te = [r for r in ver if r['session'] == held]
            cut = BALL_CUT
            for r in te:
                x = r[norm]['ballness']; isball = r['truth'] != 10
                call = 'unsure' if cut is None or cut[0] <= x <= cut[1] else ('ball' if x > cut[1] else 'no ball')
                o = 'unsure' if call == 'unsure' else 'right' if (call == 'ball') == isball else 'confidently wrong'
                rd = 'right' if (r['probs'][10] < 0.5) == isball and (r['probs'][10] < 0.2 or r['probs'][10] > 0.8) else 'confidently wrong' if (r['probs'][10] < 0.2 or r['probs'][10] > 0.8) else 'unsure'
                k = f"{SESSION_SPOT[held]} | {'ball' if isball else 'no ball'}"
                per.setdefault(k, {'n': 0, 'right': 0, 'confidently wrong': 0, 'unsure': 0, 'reader right': 0, 'reader confidently wrong': 0, 'reader unsure': 0})
                per[k]['n'] += 1; per[k][o] += 1; per[k]['reader ' + rd] += 1
        cut = BALL_CUT
        for clip in LIGHT:
            te = [r for r in rows if r['clip'] == clip and not r['verified']]
            calls = ['unsure' if cut[0] <= r[norm]['ballness'] <= cut[1] else 'ball' if r[norm]['ballness'] > cut[1] else 'no ball' for r in te]
            per[f'light step {clip} (by eye: all balls)'] = {'n': len(te), 'ball': calls.count('ball'), 'no ball': calls.count('no ball'), 'unsure': calls.count('unsure'),
                                                           'reader not a ball': int(sum(r['probs'][10] >= 0.5 for r in te)), 'cut': list(map(float, cut))}
        res['pairs']['ball vs not a ball ' + norm] = per
    # cloth probe: the same pictures with the cloth made the reference colour, read again by the frozen reader
    def cloth_swap(img, mode):
        cloth = np.median(img[RING], 0)
        if mode == 'white balance':
            return np.clip(img * (ref / np.maximum(cloth, 0.03)), 0, 1)
        o = img.copy(); m = (RAD > 7.5) & (np.linalg.norm(img - cloth, axis=-1) < 0.15); o[m] = ref; return o
    for grp, sel in [('light steps 12-14 (by eye)', [r for r in rows if not r['verified']])] + [(f'verified balls, {SESSION_SPOT[s]}', [r for r in ver if r['session'] == s and r['truth'] != 10]) for s in sessions]:
        d = {'n': len(sel), 'not a ball as captured': int(sum(r['probs'][10] >= 0.5 for r in sel))}
        if any(r['truth'] is not None for r in sel):
            d['named right as captured'] = int(sum(r['truth'] is not None and r['probs'][:10].argmax() == r['truth'] and r['probs'][r['truth']] >= 0.6 and r['probs'][10] < 0.5 for r in sel))
        for mode in ('cloth replaced', 'white balance'):
            P = [run(cloth_swap(r['img'], mode)) for r in sel]
            d[f'not a ball, {mode}'] = int(sum(p[10] >= 0.5 for p in P))
            if 'named right as captured' in d:
                d[f'named right, {mode}'] = int(sum(r['truth'] is not None and p[:10].argmax() == r['truth'] and p[r['truth']] >= 0.6 and p[10] < 0.5 for r, p in zip(sel, P)))
                d[f'confidently wrong, {mode}'] = int(sum(r['truth'] is not None and p[:10].argmax() != r['truth'] and p[:10].max() >= 0.6 and p[10] < 0.5 for r, p in zip(sel, P)))
        if 'named right as captured' in d:
            d['confidently wrong as captured'] = int(sum(r['truth'] is not None and r['probs'][:10].argmax() != r['truth'] and r['probs'][:10].max() >= 0.6 and r['probs'][10] < 0.5 for r in sel))
        res['light'][grp] = d
    # overconfidence: the reader's sure answer is set to "unsure" when the measurement (held out) is sure of the other ball
    for norm in ('m', 'mn'):
        v = {}
        for r in ver:
            if r['truth'] in (None, 10):
                continue
            p = r['probs']; top = int(p[:10].argmax())
            if p[10] >= 0.5 or p[top] < 0.6:
                continue
            before = 'right' if top == r['truth'] else 'wrong'
            after = before
            by = []
            for name, A, B, feat in PAIRS:
                if top in (A, B) and r.get('callsAll', {}).get((name, norm)) not in (None, 'unsure', top):
                    after = 'unsure'; by.append(name)
            for k in (f"{SESSION_SPOT[r['session']]} | {r['view']}", 'ALL') + tuple('by pair ' + b for b in by):
                v.setdefault(k, {'sure right': 0, 'sure wrong': 0, 'sure wrong -> unsure': 0, 'sure right -> unsure': 0})
                if not k.startswith('by pair'):
                    v[k]['sure ' + before] += 1
                if after == 'unsure':
                    v[k][('sure wrong' if before != 'right' else 'sure right') + ' -> unsure'] += 1
        res['veto'][norm] = v
    for r in ver:
        k = f"{SESSION_SPOT[r['session']]} | {r['kind']} | {r['view']}"; res['counts'][k] = res['counts'].get(k, 0) + 1
    res['examples'] = [{'id': r['id'], 'truth': r['truth'], 'view': r['view'], 'reader': int(r['probs'][:10].argmax()), 'p': round(float(r['probs'][:10].max()), 2), 'nb': round(float(r['probs'][10]), 2),
                        'm': {k: (round(x, 3) if isinstance(x, float) else x) for k, x in r['m'].items() if k != 'cloth'},
                        'mn': {k: (round(x, 3) if isinstance(x, float) else x) for k, x in r['mn'].items() if k != 'cloth'},
                        'calls': {f'{a}/{b}': c for (a, b), c in r.get('calls', {}).items()}} for r in rows]
    json.dump(res, open(out, 'w'), indent=1, default=lambda o: None if isinstance(o, float) and math.isnan(o) else str(o))
    print('reader reproduced to', res['readerReproduced'])


if __name__ == '__main__':
    {'prep': prep, 'score': score}[sys.argv[1]](*sys.argv[2:])
