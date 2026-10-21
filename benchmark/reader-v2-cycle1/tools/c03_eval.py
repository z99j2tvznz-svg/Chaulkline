"""Recognition metrics for experimental readers (single models or seed ensembles) on:
  dev (real, Oct 15 + odd Oct 16), dev-touch (dev balls with a second ball pasted at 1.6-2.4 radii, in front or behind, fixed seed),
  dev-far (dev pictures shrunk to 55 % and enlarged back, fixed seed) -- used for selection;
  test (held-out Oct 17-19, verified only) -- reported, NOT used for selection.
  python c03_eval.py <out json> <system>=<model>[+<model>...] ...     (model = models/<name>_s<seed>, ensemble = mean probs)
Decision rule as the benchmark: not a ball if nb >= 0.5, else confident if top number >= 0.6, else unsure."""
import collections, json, math, os, sys
import numpy as np
import onnxruntime as ort
from PIL import Image
from common1 import o, make_input, load_native, softmax, frozen_reader

CAN = 64  # canonical working size of the 3.2-radius crop for the synthetic dev sets


def canon(c): return np.asarray(Image.fromarray(c).resize((CAN, CAN), Image.BILINEAR), np.uint8)


def synth(dev):
    rng = np.random.default_rng(12345); balls = [e for e in dev if int(e['y']) < 10]; R = CAN / 3.2
    yy, xx = np.mgrid[0:CAN, 0:CAN] + .5; touch, far = [], []
    for e in balls:
        d = canon(rng.choice(balls)['crop']).astype(np.float32); a = rng.uniform(0, 2 * math.pi); r = rng.uniform(1.6, 2.4) * R
        dx, dy = r * math.cos(a), r * math.sin(a)
        sh = np.asarray(Image.fromarray(d.astype(np.uint8)).transform((CAN, CAN), Image.AFFINE, (1, 0, -dx, 0, 1, -dy), Image.BILINEAR), np.float32)
        m = np.clip(R + 0.7 - np.hypot(xx - CAN / 2 - dx, yy - CAN / 2 - dy), 0, 1)[..., None]
        x = canon(e['crop']).astype(np.float32); y = x * (1 - m) + sh * m
        if rng.random() < .5: m0 = np.clip(R + 0.7 - np.hypot(xx - CAN / 2, yy - CAN / 2), 0, 1)[..., None]; y = y * (1 - m0) + x * m0
        touch.append(dict(e, crop=y.round().astype(np.uint8)))
    for e in dev:
        c = canon(e['crop']); s = round(CAN * 0.55)
        far.append(dict(e, crop=np.asarray(Image.fromarray(c).resize((s, s), Image.BILINEAR).resize((CAN, CAN), Image.BILINEAR), np.uint8)))
    return touch, far


class Model:
    def __init__(s, path):
        s.m = json.load(open(o(path + '.json'))); s.sess = ort.InferenceSession(o(path + '.onnx'), providers=['CPUExecutionProvider'])

    def probs(s, crops):
        X = np.stack([make_input(c, s.m['side_frac'], s.m['px']) for c in crops]).transpose(0, 3, 1, 2).astype(np.float32) / 255
        return softmax(np.concatenate([s.sess.run(None, {'x': X[i:i + 512]})[0] for i in range(0, len(X), 512)]), s.m['temperature'])


def frozen_probs(crops):
    run = frozen_reader()
    return np.stack([run(np.asarray(Image.fromarray(c).resize((24, 24), Image.BILINEAR), np.float32) / 255) for c in crops])


def metrics(P, L):
    y = np.array([int(e['y']) for e in L]); nb = P[:, 10]; k = P[:, :10].argmax(1); pt = P[np.arange(len(P)), k]
    rej = nb >= 0.5; conf = ~rej & (pt >= 0.6); isb = y < 10
    r = dict(pictures=int(len(y)), balls=int(isb.sum()), right=int((conf & isb & (k == y)).sum()), conf_wrong=int((conf & isb & (k != y)).sum()),
             unsure=int((~rej & ~conf & isb).sum()), rejected_ball=int((rej & isb).sum()),
             nonballs=int((~isb).sum()), nonball_accepted=int((~rej & ~isb).sum()),
             nll=round(float(-np.log(np.clip(P[np.arange(len(y)), np.where(isb, y, 10)], 1e-9, 1)).mean()), 4))
    return r


def per_ball(P, L):
    g = collections.defaultdict(list)
    for p, e in zip(P, L): g[e['ball_key']].append((p, e))
    Pb = np.stack([np.mean([p for p, _ in v], 0) for v in g.values()]); Lb = [v[0][1] for v in g.values()]
    return metrics(Pb, Lb)


def main():
    outp = sys.argv[1]; D = load_native(); dev = D['dev']; test = [e for e in D['test'] if int(e['y']) >= 0]
    touch, far = synth(dev)
    sets = dict(dev=dev, dev_touch=touch, dev_far=far, test=test,
                test_touching=[e for e in test if e['touching'] == '1'], test_far_spot=[e for e in test if 'firstspot' in e['session']])
    res = {}
    for spec in sys.argv[2:]:
        name, models = spec.split('=')
        if models == 'frozen': fn = frozen_probs
        else:
            ms = [Model(m) for m in models.split('+')]; fn = lambda crops, ms=ms: np.mean([m.probs(crops) for m in ms], 0)
        res[name] = {}
        for sn, L in sets.items():
            P = fn([e['crop'] for e in L]); res[name][sn] = metrics(P, L)
            if sn == 'test': res[name]['test_per_ball'] = per_ball(P, L)
        print(name, json.dumps({k: (v['right'], v['conf_wrong'], v['unsure'], v['rejected_ball'], v['nonball_accepted']) for k, v in res[name].items()}), flush=True)
    json.dump(res, open(outp, 'w'), indent=1)


if __name__ == '__main__':
    main()
