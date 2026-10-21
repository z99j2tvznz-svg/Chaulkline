"""Recognition inputs for the rack, exactly as Cycle 1/2: Challenger B's number on every detection spot + the frozen
reader's not-a-ball (already in the detection file), plus B's full probabilities q (Cycle 2 add_probs). Also writes the
frozen-reader-only input (the detection file as clip-detect made it).
  python prep_inputs.py <det json> <radii json> <video> <out dir>"""
import json, os, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'recognition-2026-10-20', 'local'))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'recognition-2026-10-20', 'bench'))
from infer_footage import job  # noqa: E402
MODELS = os.path.join(HERE, '..', '..', 'recognition-2026-10-20', 'actions-results', 'run-39500020895', 'models')
det, radii, video, out = sys.argv[1:5]
clip = os.path.basename(det)[:-5]; R = json.load(open(radii))
_, _, n, p0, pa, pb = job(('rack', 'frozen30', os.path.dirname(det), video, {clip: R[clip]}, MODELS, clip))
D = json.load(open(det)); assert [len(f['balls']) for f in D['frames']] == list(n)
os.makedirs(os.path.join(out, 'frozen'), exist_ok=True); os.makedirs(os.path.join(out, 'bnb'), exist_ok=True)
json.dump(D, open(os.path.join(out, 'frozen', 'rack1.json'), 'w'))
P = pb.astype(np.float64) / 65535; j = 0
for fr in D['frames']:
    for b in fr['balls']:
        p = P[j]; j += 1; k = int(np.argmax(p[:10])); b['rec'] = k; b['p'] = round(float(min(1.0, p[k])), 2)
        b['q'] = [round(float(v), 3) for v in p[:10] / max(1e-9, 1 - p[10])]
json.dump(D, open(os.path.join(out, 'bnb', 'rack1.json'), 'w'))
np.savez_compressed(os.path.join(out, 'probs.npz'), n=np.array(n), control_frozen=p0, challenger_a=pa, challenger_b=pb)
print('spots', j, 'frames', len(D['frames']))
