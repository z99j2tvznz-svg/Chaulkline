# one detection file + its probs.npz: add nbB to every spot
import json, sys, numpy as np
det, npz, out = sys.argv[1:4]
D = json.load(open(det)); pb = np.load(npz)['challenger_b'].astype(float) / 65535; j = 0
for f in D['frames']:
    for b in f['balls']: b['nbB'] = round(float(pb[j, 10]), 3); j += 1
assert j == len(pb); json.dump(D, open(out, 'w'))
