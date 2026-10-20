"""Run the recognisers on EVERY detection spot of a detection set, from the original footage (which is not on GitHub).
This is the only step that needs the footage; its output (replacement reader predictions) is committed and the GitHub
Actions workflow merges it into the frozen detection files and runs the unchanged v0.6 scorer.

  python infer_footage.py <sampling: frozen30|d30b> <detections root> <footage root> <radii dir> <models dir> <out.npz>

Systems: control_frozen (the frozen reader on this script's own crops: measures what the crop pipeline alone changes),
challenger_a, challenger_b (ONNX). Frames: ffmpeg -vf fps=F,scale=1280:720 -q:v 3 (as clip-detect.js); frame k = picture k+1.
For d30b (odd frames of the 60 fps run), F = 60 and k = round(t * 60)."""
import glob, json, os, pickle, subprocess, sys, tempfile
from concurrent.futures import ProcessPoolExecutor
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'bench'))
from common import crop_square, to_input, frozen_reader, softmax, SIDE  # noqa: E402

SESSIONS = {  # detection folder -> (footage folder, d30b folder)
    'v04-oct16': ('2026-10-16_evening_V2.3.3', 'oct16'), 'v04-firstspot': ('2026-10-17_2151_V2.3.3_firstspot', 'firstspot'),
    'v04-otherside': ('2026-10-17_1500_V2.3.3_otherside', 'otherside'), 'rec-20261017-1730': ('rec-20261017-1730', 'rec-20261017-1730'),
    'rec-20261018-2310': ('rec-20261018-2310', 'rec-20261018-2310'), 'rec-20261019-1710': ('rec-20261019-1710', 'rec-20261019-1710')}


def frozen24(img, cx, cy, r):
    s = 3.2 * r; x, y = cx - s / 2, cy - s / 2
    return np.asarray(img.resize((24, 24), Image.BILINEAR, box=(x, y, x + s, y + s)), np.float32) / 255


def job(args):
    det, sampling, det_dir, video, radii, models, clip = args
    from s03_challenger_a import features
    import onnxruntime as ort
    d = json.load(open(os.path.join(det_dir, clip + '.json'))); R = radii[clip]
    fps = 60 if sampling == 'd30b' else d.get('fps', 30)
    run = frozen_reader(); sc, clf, Ta = pickle.load(open(os.path.join(models, 'challenger_a.pkl'), 'rb'))
    Tb = json.load(open(os.path.join(models, 'challenger_b.json')))['temperature']
    sess = ort.InferenceSession(os.path.join(models, 'challenger_b.onnx'), providers=['CPUExecutionProvider'])
    X40, P0, Fa, n = [], [], [], []
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(['ffmpeg', '-v', 'error', '-i', video, '-vf', f'fps={fps},scale=1280:720', '-q:v', '3', os.path.join(tmp, '%05d.jpg')], check=True)
        for fi, fr in enumerate(d['frames']):
            k = round(fr['t'] * 60) if sampling == 'd30b' else fi
            img = Image.open(os.path.join(tmp, f'{k + 1:05d}.jpg')).convert('RGB'); n.append(len(fr['balls']))
            for bi, b in enumerate(fr['balls']):
                r = R[fi][bi]; c = crop_square(img, b['px'], b['py'], r); x = to_input(c)
                X40.append(x); P0.append(run(frozen24(img, b['px'], b['py'], r))); Fa.append(features(x))
    if not X40: return det, clip, n, *(np.zeros((0, 11), np.uint16),) * 3
    Pa = softmax(clf.decision_function(sc.transform(np.stack(Fa))), Ta)
    X = np.stack(X40).transpose(0, 3, 1, 2).astype(np.float32)
    Pb = softmax(np.concatenate([sess.run(None, {'x': X[i:i + 512]})[0] for i in range(0, len(X), 512)]), Tb)
    q = lambda p: np.round(np.asarray(p) * 65535).astype(np.uint16)
    return det, clip, n, q(P0), q(Pa), q(Pb)


def main():
    sampling, root, footage, radii_dir, models, out = sys.argv[1:7]
    res = {}; jobs = []
    for det, (vid, alt) in SESSIONS.items():
        dd = os.path.join(root, alt if sampling == 'd30b' else det); radii = json.load(open(os.path.join(radii_dir, f'{sampling}-{det}.json')))
        for f in sorted(glob.glob(os.path.join(dd, '*.json'))):
            c = os.path.basename(f)[:-5]; jobs.append((det, sampling, dd, os.path.join(footage, vid, c + '.mp4'), {c: radii[c]}, models, c))
    with ProcessPoolExecutor(4) as ex:
        for r in ex.map(job, jobs):
            res.setdefault(r[0], []).append(r[1:]); print(r[0], r[1], sum(r[2]), flush=True)
    arr = {}
    for det, rows in res.items():
        for clip, n, p0, pa, pb in rows:
            arr[f'{det}/{clip}/n'] = np.array(n, np.int32)
            for s, p in (('control_frozen', p0), ('challenger_a', pa), ('challenger_b', pb)): arr[f'{det}/{clip}/{s}'] = p
    np.savez_compressed(out, **arr)


if __name__ == '__main__':
    main()
