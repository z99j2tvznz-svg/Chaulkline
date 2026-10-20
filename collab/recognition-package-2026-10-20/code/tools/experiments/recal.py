"""Per-table reader calibration experiment (Oct 20, 2026). Offline only: the app, the reader's weights and tracker v0.6
are unchanged. The frozen reader stays as it is; a small correction is learned on top of its last layer from verified
labels of one table and camera spot, and applied to that session's other clips:
    new scores = softmax(log(old probabilities) + A . hidden + c)
A (11 x 64) and c are pulled towards zero (no correction) so a few examples can only nudge the reader. The strength of
the pull is picked by leave-one-picture-out on the calibration pictures only. Hidden units and probabilities come from
tools/experiments/reader-dump.js.

    python3 -I recal.py <config.json>

config: { "dets": frozen detections folder, "dump": reader-dump folder, "out": new detections folder,
          "labels": [{ "clip", "balls": [{x, y, num, partial, inPocket}], "removed": [{x, y}] }] (picture pixels, 1280x720),
          "window": frames at the end of the clip that show the labelled still table (default 15),
          "test": [clips to rewrite], "lams": [pull strengths to try] }
Writes the rewritten detections (only rec, p, nb change) and <out>/calibration.json (examples, pull, fit).
"""
import json, os, sys
import numpy as np

ROW = 2 + 11 + 64
NB = 10


def load_dump(path):
    a = np.fromfile(path, dtype=np.float32)
    return a.reshape(-1, ROW)


def examples(cfg, lab):
    det = json.load(open(os.path.join(cfg['dets'], lab['clip'] + '.json')))
    rows = load_dump(os.path.join(cfg['dump'], lab['clip'] + '.bin'))
    nfr = int(rows[:, 0].max()) + 1
    first = nfr - cfg.get('window', 15)
    X, P, Y = [], [], []
    balls = [b for b in lab['balls'] if not b.get('inPocket')]
    for r in rows[rows[:, 0] >= first]:
        f, s = int(r[0]), int(r[1])
        sp = det['frames'][f]['balls'][s]
        d = [np.hypot(sp['px'] - b['x'], sp['py'] - b['y']) for b in balls]
        j = int(np.argmin(d)) if d else -1
        if j >= 0 and d[j] < 10:
            b = balls[j]
            if b.get('num') is None or b.get('partial'):
                continue  # a real ball whose number is not verified: no example
            y = b['num']
        elif (not d or min(d) > 20):
            y = NB  # a spot where the reviewer marked no ball
        else:
            continue
        X.append(r[13:]); P.append(r[2:13]); Y.append(y)
    return np.array(X), np.array(P), np.array(Y)


def anchors(cfg, clips, every=5):
    """every spot of the calibration clips, with the frozen reader's own answer: the correction must keep those"""
    rows = np.concatenate([load_dump(os.path.join(cfg['dump'], c + '.bin')) for c in clips])
    rows = rows[rows[:, 0] % every == 0]
    return rows[:, 13:], rows[:, 2:13]


def fit(X, P, Y, lam, anc=None, mu=1.0, iters=400, mask=None):
    n = len(Y)
    L = np.log(np.clip(P, 1e-6, 1))
    if anc is not None:
        XA, PA = anc; LA = np.log(np.clip(PA, 1e-6, 1))
    A = np.zeros((11, X.shape[1])); c = np.zeros(11)
    m = [np.zeros_like(A), np.zeros_like(c)]; v = [np.zeros_like(A), np.zeros_like(c)]
    onehot = np.eye(11)[Y]
    for t in range(1, iters + 1):
        z = L + X @ A.T + c
        z -= z.max(1, keepdims=True); q = np.exp(z); q /= q.sum(1, keepdims=True)
        g = (q - onehot) / n
        gA = g.T @ X + 2 * lam * A; gc = g.sum(0) + 2 * lam * c
        if anc is not None:
            za = LA + XA @ A.T + c; za -= za.max(1, keepdims=True); qa = np.exp(za); qa /= qa.sum(1, keepdims=True)
            ga = mu * (qa - PA) / len(PA); gA += ga.T @ XA; gc += ga.sum(0)
        if mask is not None:
            gA *= mask[:, None]; gc *= mask
        for k, (p, gr) in enumerate(((A, gA), (c, gc))):
            m[k] = 0.9 * m[k] + 0.1 * gr; v[k] = 0.999 * v[k] + 0.001 * gr * gr
            p -= 0.05 * (m[k] / (1 - 0.9 ** t)) / (np.sqrt(v[k] / (1 - 0.999 ** t)) + 1e-8)
    return A, c


def apply(P, X, A, c):
    z = np.log(np.clip(P, 1e-6, 1)) + X @ A.T + c
    z -= z.max(1, keepdims=True); q = np.exp(z)
    return q / q.sum(1, keepdims=True)


def ce(P, Y):
    return float(-np.mean(np.log(np.clip(P[np.arange(len(Y)), Y], 1e-9, 1))))


def main():
    cfg = json.load(open(sys.argv[1]))
    per = [examples(cfg, lab) for lab in cfg['labels']]
    per = [e for e in per if len(e[2])]
    X = np.concatenate([e[0] for e in per]); P = np.concatenate([e[1] for e in per]); Y = np.concatenate([e[2] for e in per])
    lams = cfg.get('lams', [0.001, 0.01, 0.1, 1.0])
    mu = cfg.get('mu', 1.0)
    # mode 'gate': only the "not a ball" score is corrected; the ranking of the numbers stays the frozen reader's
    mask = np.eye(11)[NB] if cfg.get('mode') == 'gate' else None
    anc = anchors(cfg, sorted({l['clip'] for l in cfg['labels']})) if mu > 0 else None
    cv = {}
    for lam in lams:
        if len(per) < 2:
            break
        loss = []
        for i in range(len(per)):
            Xt = np.concatenate([e[0] for k, e in enumerate(per) if k != i]); Pt = np.concatenate([e[1] for k, e in enumerate(per) if k != i]); Yt = np.concatenate([e[2] for k, e in enumerate(per) if k != i])
            A, c = fit(Xt, Pt, Yt, lam, anc, mu, mask=mask)
            loss.append(ce(apply(per[i][1], per[i][0], A, c), per[i][2]))
        cv[lam] = float(np.mean(loss))
    lam = min(cv, key=cv.get) if cv else cfg.get('lam', 0.1)
    A, c = fit(X, P, Y, lam, anc, mu, mask=mask)
    Q = apply(P, X, A, c)
    base = float(np.mean([ce(e[1], e[2]) for e in per]))
    acc = lambda PP: float(np.mean(PP.argmax(1) == Y))
    info = {'pictures': len(per), 'examples': int(len(Y)), 'perClass': np.bincount(Y, minlength=11).tolist(), 'lam': lam, 'cv': cv,
            'lossNoCalibration': base, 'mode': cfg.get('mode', 'full'), 'mu': mu, 'anchors': 0 if anc is None else int(len(anc[1])), 'trainTop1Before': acc(P), 'trainTop1After': acc(Q)}
    # the same correction on the frozen detections and, if given, on an alternate frame pick of the same clips
    for dets, dump, out in [(cfg['dets'], cfg['dump'], cfg['out'])] + ([(cfg['alt']['dets'], cfg['alt']['dump'], cfg['alt']['out'])] if cfg.get('alt') else []):
        os.makedirs(out, exist_ok=True)
        for clip in cfg['test']:
            det = json.load(open(os.path.join(dets, clip + '.json')))
            rows = load_dump(os.path.join(dump, clip + '.bin'))
            Qc = apply(rows[:, 2:13], rows[:, 13:], A, c)
            for r, q in zip(rows, Qc):
                b = det['frames'][int(r[0])]['balls'][int(r[1])]
                top = int(np.argmax(q[:10]))
                b['rec'], b['p'], b['nb'] = top, round(float(q[top]), 2), round(float(q[NB]), 2)
            det['recal'] = {'lam': lam, 'examples': int(len(Y))}
            json.dump(det, open(os.path.join(out, clip + '.json'), 'w'))
    json.dump(info, open(os.path.join(cfg['out'], 'calibration.json'), 'w'), indent=1)
    print(json.dumps(info))


if __name__ == '__main__':
    main()
