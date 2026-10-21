"""Add each spot's full number probabilities from Challenger B (field q: 10 numbers, cue..9, given that it is a ball,
i.e. divided by 1 - B's not-a-ball; 3 decimals) to the Cycle 2 baseline detection files (B number + frozen not-a-ball).
The frozen tracker and scorer ignore the extra field; only the whole-table experiment reads it.
  python add_probs.py <dets root for one pick> <replacement npz for that pick>"""
import glob, json, os, sys
import numpy as np
root, npz = sys.argv[1:3]; Z = np.load(npz)
for d in sorted(os.listdir(root)):
    for f in sorted(glob.glob(os.path.join(root, d, '*.json'))):
        c = os.path.basename(f)[:-5]; D = json.load(open(f)); P = Z[f'{d}/{c}/challenger_b'].astype(np.float64) / 65535
        assert [len(fr['balls']) for fr in D['frames']] == Z[f'{d}/{c}/n'].tolist(); j = 0
        for fr in D['frames']:
            for b in fr['balls']:
                p = P[j]; j += 1; b['q'] = [round(float(v), 3) for v in p[:10] / max(1e-9, 1 - p[10])]
        json.dump(D, open(f, 'w'))
print('ok', root)
