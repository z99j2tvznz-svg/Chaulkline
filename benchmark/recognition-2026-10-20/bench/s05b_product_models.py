"""The product-level run uses the models named in replacement-predictions/MANIFEST.json (trained by an earlier Actions
run and published to this branch). Re-score exactly those models on the held-out test pictures, so the recognition and
product numbers refer to the same weights, and check the predictions equal the ones that run published.
Writes out/metrics/product_models_recognition.json."""
import json, os, pickle
import numpy as np
import onnxruntime as ort
from common import BENCH, PKG, CLASSES, out, read_csv, decide, softmax, sha256
from s03_challenger_a import feats
from s05_evaluate import counts

man = json.load(open(os.path.join(BENCH, 'replacement-predictions', 'MANIFEST.json'))); M = os.path.join(BENCH, man['models_dir'])
assert all(sha256(os.path.join(M, f)) == h for f, h in man['model_sha256'].items()), 'model files differ from the manifest'
te = np.load(out('data', 'test.npz')); ex = {e['id']: e for e in read_csv(out('data', 'examples.csv')) if e['split'] == 'test'}
sc, clf, Ta = pickle.load(open(os.path.join(M, 'challenger_a.pkl'), 'rb'))
Pa = softmax(clf.decision_function(sc.transform(feats(te['X40']))), Ta)
sess = ort.InferenceSession(os.path.join(M, 'challenger_b.onnx'), providers=['CPUExecutionProvider'])
X = te['X40'].transpose(0, 3, 1, 2).astype(np.float32) / 255
Pb = softmax(np.concatenate([sess.run(None, {'x': X[i:i + 512]})[0] for i in range(0, len(X), 512)]), json.load(open(os.path.join(M, 'challenger_b.json')))['temperature'])
rep = dict(models_dir=man['models_dir'], source_run=man['source_run'])
for name, P in (('challenger_a', Pa), ('challenger_b', Pb)):
    pub = {r['id']: r for r in read_csv(os.path.join(M, '..', 'predictions', name + '.csv'))}
    d = [decide(p) for p in P]
    rep[name] = dict(all_verified_pictures=counts([(int(ex[str(i)]['y']), k, n) for i, (k, n, _, _) in zip(te['ids'], d) if int(ex[str(i)]['y']) >= 0]),
                     max_prob_diff_vs_published_predictions=float(max(abs(float(pub[str(i)]['p_' + c]) - p[j]) for i, p in zip(te['ids'], P) for j, c in enumerate(CLASSES))))
# the committed per-spot answers at the labelled test spots must equal these test predictions (same crops, same models)
Z = np.load(os.path.join(BENCH, 'replacement-predictions', 'frozen30.npz')); DET = {'2026-10-17_1500_V2.3.3_otherside': 'v04-otherside',
     '2026-10-17_2151_V2.3.3_firstspot': 'v04-firstspot', 'rec-20261017-1730': 'rec-20261017-1730', 'rec-20261018-2310': 'rec-20261018-2310', 'rec-20261019-1710': 'rec-20261019-1710'}
idx = {'I:' + r['image_id']: r for r in read_csv(os.path.join(PKG, '01-images', 'reader-inputs', 'index.csv'))}; diffs = []
for i, pb in zip(te['ids'], Pb):
    e = ex[str(i)]; d = DET[e['session']]; n = Z[f"{d}/{e['clip']}/n"]; f = int(e['frame'])
    spot = int(idx[str(i)]['spot_index']); diffs.append(float(np.abs(Z[f"{d}/{e['clip']}/challenger_b"][int(n[:f].sum()) + spot] / 65535 - pb).max()))
rep['replacement_predictions_vs_test_predictions_at_labelled_spots'] = dict(spots=len(diffs), max_prob_diff=max(diffs), over_0_01=int(sum(x > 0.01 for x in diffs)))
json.dump(rep, open(out('metrics', 'product_models_recognition.json'), 'w'), indent=1)
print(json.dumps(rep, indent=1))
