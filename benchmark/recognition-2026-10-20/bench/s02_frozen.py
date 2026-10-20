"""Re-run the frozen reader (recog.json) on the exact 24 x 24 pictures of every test example and compare with the
probabilities stored in the package's index.csv. Writes out/predictions/frozen.csv + out/frozen-reproduction.json."""
import json, os
import numpy as np
from common import PKG, CLASSES, out, read_csv, write_csv, frozen_reader, decide

run = frozen_reader()
d = np.load(out('data', 'test.npz'))
stored = {'I:' + r['image_id']: r for r in read_csv(os.path.join(PKG, '01-images', 'reader-inputs', 'index.csv'))}
rows, diffs = [], []
for x, i in zip(d['X24'], d['ids']):
    p = run(x.astype(np.float32) / 255); s = stored[str(i)]
    sp = np.array([float(s['p_' + n]) for n in ['cue'] + [str(k) for k in range(1, 10)] + ['not a ball']])
    diffs.append(float(np.abs(p - sp).max()))
    kind, k, pt, nb = decide(p)
    rows.append(dict(id=str(i), kind=kind, number=k, p_top=round(pt, 4), nb=round(nb, 4), **{f'p_{c}': round(float(v), 5) for c, v in zip(CLASSES, p)}))
write_csv(out('predictions', 'frozen.csv'), rows)
rep = dict(pictures=len(rows), max_abs_prob_difference_vs_stored=max(diffs), under_0_001=int(sum(v < 1e-3 for v in diffs)),
           under_0_01=int(sum(v < 1e-2 for v in diffs)), note='stored values in index.csv are rounded; differences up to ~1e-4 are rounding')
json.dump(rep, open(out('frozen-reproduction.json'), 'w'), indent=1)
print(json.dumps(rep))
