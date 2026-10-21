# edge boxes: not-a-ball from Challenger B (the frozen reader calls rail/jaw balls not-a-ball); kept boxes unchanged
import json, sys, numpy as np
det, npz, out = sys.argv[1:4]
D = json.load(open(det)); pb = np.load(npz)['challenger_b'].astype(float) / 65535; j = 0
for f in D['frames']:
    for b in f['balls']:
        if b.get('edge'): b['nbFrozen'] = b['nb']; b['nb'] = round(float(pb[j, 10]), 2)
        j += 1
assert j == len(pb)
json.dump(D, open(out, 'w'))
