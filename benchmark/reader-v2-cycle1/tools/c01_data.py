"""Rebuild the benchmark's exact train / dev / test examples (examples.csv of Actions run 39504265303) as NATIVE
3.2-radius crops (before any resize), so crop-size / resolution variants can be made from the same pictures.
Checks every crop's md5 against examples.csv. Writes $CYCLE_OUT/native.pkl."""
import csv, hashlib, os, pickle, sys
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); BENCH = os.path.join(HERE, '..', '..', 'recognition-2026-10-20')
sys.path.insert(0, os.path.join(BENCH, 'bench'))
from common import PKG, crop_square  # noqa: E402
OUT = os.environ['CYCLE_OUT']


def main():
    ex = list(csv.DictReader(open(os.path.join(BENCH, 'actions-results', 'run-39504265303', 'data', 'examples.csv'))))
    lab = {}
    for r in csv.DictReader(open(os.path.join(PKG, '02-ground-truth', 'player-verified', 'all-verified-ball-labels.csv'))):
        if r['label_set'] == 'labels-v1': lab[(r['picture_id'], r['ball_index'], 'nb' if r['entry'] != 'ball' else 'b')] = r
    imgs = {}; data = {s: [] for s in ('train', 'dev', 'test')}; bad = 0
    for e in ex:
        if e['id'].startswith('L:'):
            _, pid, bi, kind = e['id'].split(':'); r = lab[(pid, bi, kind)]
            im = imgs.get(r['image']) or imgs.setdefault(r['image'], Image.open(os.path.join(PKG, r['image'])).convert('RGB'))
            c = crop_square(im, float(r['x_px']), float(r['y_px']), float(r['r_px']))
        else:
            c = np.asarray(Image.open(os.path.join(PKG, '01-images', 'reader-inputs', 'crop-before-resize', e['image_id'] + '.png')).convert('RGB'))
        bad += hashlib.md5(c.tobytes()).hexdigest() != e['md5']
        data[e['split']].append(dict(crop=c, **{k: e[k] for k in ('id', 'y', 'session', 'clip', 'frame', 'ball_key', 'touching', 'nearest_spot_radii', 'radius_px', 'status', 'light_step')}))
    assert bad == 0, f'{bad} crops differ from the benchmark'
    pickle.dump(data, open(os.path.join(OUT, 'native.pkl'), 'wb'))
    print({s: len(v) for s, v in data.items()}, 'md5 mismatches', bad)


if __name__ == '__main__':
    main()
