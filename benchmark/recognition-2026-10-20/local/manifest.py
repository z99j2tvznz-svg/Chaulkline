"""Write replacement-predictions/MANIFEST.json: what made the committed replacement predictions.
  python manifest.py <models dir relative to the benchmark folder> <source run id> <footage zip>..."""
import json, os, subprocess, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'bench'))
from common import BENCH, REPO, sha256  # noqa: E402
import numpy as np  # noqa: E402

models, run, zips = sys.argv[1], sys.argv[2], sys.argv[3:]
M = os.path.join(BENCH, models); RP = os.path.join(BENCH, 'replacement-predictions')
sets = {}
for f in sorted(os.listdir(RP)):
    if f.endswith('.npz'):
        Z = np.load(os.path.join(RP, f)); n = sum(int(Z[k].sum()) for k in Z.files if k.endswith('/n'))
        sets[f] = dict(sha256=sha256(os.path.join(RP, f)), clips=sum(k.endswith('/n') for k in Z.files), spots=n,
                       systems=sorted({k.split('/')[2] for k in Z.files if not k.endswith('/n')}))
man = dict(
    made_by='local/infer_footage.py (frames with ffmpeg as clip-detect.js; crops with bench/common.py crop_square; radii from local/radii.js)',
    benchmark_commit=subprocess.run(['git', '-C', REPO, 'rev-parse', 'HEAD'], capture_output=True, text=True).stdout.strip(),
    source_run=f'https://github.com/z99j2tvznz-svg/Chaulkline/actions/runs/{run}', models_dir=models,
    model_sha256={f: sha256(os.path.join(M, f)) for f in ('challenger_a.pkl', 'challenger_b.onnx', 'challenger_b.json')},
    footage_zip_sha256={os.path.basename(z): sha256(z) for z in zips},
    ffmpeg=subprocess.run(['ffmpeg', '-version'], capture_output=True, text=True).stdout.splitlines()[0],
    detection_sources=dict(frozen30='collab/recognition-package-2026-10-20/04-detections/v0.6-scoring-set',
                           d30b='collab/recognition-package-2026-10-20/04-detections/alternate-sampling/sampling-sets-15-30.tgz (d30b)'),
    probability_encoding='uint16, value / 65535; arrays per <session>/<clip>/<system>, spots in file order (frames, then balls); <session>/<clip>/n = spots per frame',
    control_frozen='the frozen reader run on this pipeline\'s own 24x24 inputs (Pillow bilinear resize of the 3.2-radius square), to measure what re-cropping alone changes',
    sets=sets)
json.dump(man, open(os.path.join(RP, 'MANIFEST.json'), 'w'), indent=1)
print(json.dumps(man, indent=1))
