"""Challenger A: colour and appearance features + one multinomial logistic regression over all 11 classes
(cue, 1-9, not a ball). No pairwise rules, no candidate shortlist. Trained on train, temperature from dev,
then scored once on test. Writes out/predictions/challenger_a.csv, out/models/challenger_a.json, out/logs/challenger_a.json."""
import json, pickle
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from common import CFG, CLASSES, SIDE, out, write_csv, decide, softmax, fit_temperature

C = (SIDE - 1) / 2; R = SIDE / CFG['crop']['side_radii']  # ball radius in model-input pixels (12.5 at 40 px)
yy, xx = np.mgrid[0:SIDE, 0:SIDE]; DX, DY = xx - C, yy - C; D = np.hypot(DX, DY) / R
DISC, INNER, RING = D < 0.9, D < 0.45, (D > 1.25) & (D < 1.55)


def hsv(a):
    mx, mn = a.max(-1), a.min(-1); d = mx - mn + 1e-6; r, g, b = a[..., 0], a[..., 1], a[..., 2]
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) / 6
    return h, (mx - mn) / (mx + 1e-3), mx


def features(a):
    """a: SIDE x SIDE x 3 floats 0..1, ball centred, 3.2 radii wide."""
    h, s, v = hsv(a); cloth = np.median(a[RING], 0); cl_v = cloth.max()
    white = (s < 0.25) & (v > 0.6); white_rel = (s < 0.3) & (v > max(0.45, cl_v * 1.3)); dark = v < 0.3
    col = (s >= 0.25) & (v >= 0.3); n = DISC.sum(); f = []
    for m in (white, white_rel, dark, col):
        f += [(m & DISC).sum() / n, (m & INNER).sum() / max(1, INNER.sum()), (m & DISC & ~INNER).sum() / max(1, (DISC & ~INNER).sum())]
    # hue histogram of coloured disc pixels, weighted by saturation (12 bins), as share of the disc
    cm = col & DISC; hist = np.zeros(12)
    if cm.any(): np.add.at(hist, (h[cm] * 12).astype(int) % 12, s[cm])
    f += list(hist / n)
    mc = a[cm].mean(0) if cm.any() else np.zeros(3)
    md = a[DISC].mean(0); f += list(mc) + list(md) + list(cloth) + list(md - cloth)
    f += [v[DISC].mean(), v[DISC].std(), np.percentile(v[DISC], 90), np.percentile(v[DISC], 10), s[DISC].mean(), s[DISC].std()]
    # where the white is: centroid distance and spread along its main axis (stripe = two opposite caps)
    wm = white_rel & DISC
    if wm.sum() >= 3:
        P = np.stack([DX[wm], DY[wm]], 1) / R; mu = P.mean(0); cov = np.cov((P - mu).T) + 1e-6 * np.eye(2)
        ev, evec = np.linalg.eigh(cov); proj = (P - mu) @ evec[:, 1]
        caps = min((proj > 0.35).mean(), (proj < -0.35).mean())
        f += [np.hypot(*mu), ev[1], ev[0], ev[0] / ev[1], caps, np.abs(P).mean()]
    else:
        f += [0, 0, 0, 0, 0, 0]
    return np.array(f, np.float64)


def feats(X): return np.stack([features(x.astype(np.float32) / 255) for x in X])


def main():
    cfg = CFG['challenger_a']; tr, dv, te = (np.load(out('data', s + '.npz')) for s in ('train', 'dev', 'test'))
    Ftr, Fdv, Fte = feats(tr['X40']), feats(dv['X40']), feats(te['X40'])
    sc = StandardScaler().fit(Ftr)
    clf = LogisticRegression(C=cfg['C'], class_weight=cfg['class_weight'], max_iter=cfg['max_iter'], random_state=cfg['seed'])
    clf.fit(sc.transform(Ftr), tr['y'])
    assert list(clf.classes_) == list(range(11))
    T, nll = fit_temperature(clf.decision_function(sc.transform(Fdv)), dv['y'])
    P = softmax(clf.decision_function(sc.transform(Fte)), T)
    rows = []
    for i, p in zip(te['ids'], P):
        kind, k, pt, nb = decide(p)
        rows.append(dict(id=str(i), kind=kind, number=k, p_top=round(pt, 4), nb=round(nb, 4), **{f'p_{c}': round(float(v), 5) for c, v in zip(CLASSES, p)}))
    write_csv(out('predictions', 'challenger_a.csv'), rows)
    acc = lambda F, y: float((clf.predict(sc.transform(F)) == y).mean())
    log = dict(features=int(Ftr.shape[1]), train_examples=int(len(tr['y'])), dev_examples=int(len(dv['y'])), temperature=T, dev_nll=nll,
               train_top1=acc(Ftr, tr['y']), dev_top1=acc(Fdv, dv['y']), config=cfg)
    json.dump(log, open(out('logs', 'challenger_a.json'), 'w'), indent=1)
    json.dump(dict(mean=sc.mean_.tolist(), scale=sc.scale_.tolist(), coef=clf.coef_.tolist(), intercept=clf.intercept_.tolist(), temperature=T),
              open(out('models', 'challenger_a.json'), 'w'))
    pickle.dump((sc, clf, T), open(out('models', 'challenger_a.pkl'), 'wb'))
    print(json.dumps(log))


if __name__ == '__main__':
    main()
