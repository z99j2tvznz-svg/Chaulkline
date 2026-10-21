# copy detection sets adding nbB (Challenger B's not-a-ball) to every spot; nothing else changes
import json, os, sys, numpy as np
src, npz, dst = sys.argv[1:4]
z = np.load(npz)
for sess in sorted(os.listdir(src)):
    os.makedirs(os.path.join(dst, sess), exist_ok=True)
    for fn in sorted(os.listdir(os.path.join(src, sess))):
        if not fn.endswith('.json'): continue
        clip = fn[:-5]; D = json.load(open(os.path.join(src, sess, fn)))
        k = f'{sess}/{clip}/challenger_b'
        if k not in z.files: print('missing', k); json.dump(D, open(os.path.join(dst, sess, fn), 'w')); continue
        pb = z[k].astype(float) / 65535; n = z[f'{sess}/{clip}/n']
        assert [len(f['balls']) for f in D['frames']] == list(n), k
        j = 0
        for f in D['frames']:
            for b in f['balls']: b['nbB'] = round(float(pb[j, 10]), 3); j += 1
        json.dump(D, open(os.path.join(dst, sess, fn), 'w'))
