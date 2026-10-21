"""Integrity check: at every labelled held-out test spot, the per-spot footage predictions (c04_infer.py) must equal
the recognition-test predictions of the same models on the package crops (c03_eval.py).
  python c06_check.py <pred_frozen30.npz> <system>=<model>[+<model>...] ..."""
import csv, json, os, sys
import numpy as np
from common1 import PKG, load_native
from c03_eval import Model

DET = {'2026-10-17_1500_V2.3.3_otherside': 'v04-otherside', '2026-10-17_2151_V2.3.3_firstspot': 'v04-firstspot', 'rec-20261017-1730': 'rec-20261017-1730',
       'rec-20261018-2310': 'rec-20261018-2310', 'rec-20261019-1710': 'rec-20261019-1710'}


def main():
    Z = np.load(sys.argv[1]); test = load_native()['test']
    idx = {'I:' + r['image_id']: r for r in csv.DictReader(open(os.path.join(PKG, '01-images', 'reader-inputs', 'index.csv')))}
    rep = {}
    for spec in sys.argv[2:]:
        name, models = spec.split('='); ms = [Model(m) for m in models.split('+')]
        P = np.mean([m.probs([e['crop'] for e in test]) for m in ms], 0); diffs = []
        for e, p in zip(test, P):
            d = DET[e['session']]; n = Z[f"{d}/{e['clip']}/n"]; f = int(e['frame']); s = int(idx[e['id']]['spot_index'])
            diffs.append(float(np.abs(Z[f"{d}/{e['clip']}/{name}"][int(n[:f].sum()) + s] / 65535 - p).max()))
        rep[name] = dict(spots=len(diffs), max_prob_diff=round(max(diffs), 4), over_0_01=int(sum(x > 0.01 for x in diffs)))
    print(json.dumps(rep))


if __name__ == '__main__':
    main()
