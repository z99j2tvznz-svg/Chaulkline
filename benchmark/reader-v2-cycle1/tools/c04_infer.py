"""Run experimental readers on EVERY detection spot of a 30 fps detection set, from the original footage (not on
GitHub), exactly as the benchmark's local/infer_footage.py (same frames, same crops, same radii). Output: an .npz in
the benchmark's replacement-prediction format (per clip: n spots per frame, 11 probabilities x 65535 per spot).
  python c04_infer.py <frozen30|d30b> <detections root> <footage root> <radii dir> <out.npz> <system>=<model>[+<model>...] ..."""
import glob, json, os, subprocess, sys, tempfile
from concurrent.futures import ProcessPoolExecutor
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'recognition-2026-10-20', 'local'))
from infer_footage import SESSIONS  # noqa: E402
from common1 import crop_square  # noqa: E402


def job(a):
    det, sampling, det_dir, video, radii, systems, clip = a
    from c03_eval import Model
    d = json.load(open(os.path.join(det_dir, clip + '.json'))); R = radii[clip]; fps = 60 if sampling == 'd30b' else d.get('fps', 30)
    crops, n = [], []
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(['ffmpeg', '-v', 'error', '-i', video, '-vf', f'fps={fps},scale=1280:720', '-q:v', '3', os.path.join(tmp, '%05d.jpg')], check=True)
        for fi, fr in enumerate(d['frames']):
            k = round(fr['t'] * 60) if sampling == 'd30b' else fi
            img = Image.open(os.path.join(tmp, f'{k + 1:05d}.jpg')).convert('RGB'); n.append(len(fr['balls']))
            for bi, b in enumerate(fr['balls']): crops.append(crop_square(img, b['px'], b['py'], R[fi][bi]))
    out = {}
    for name, models in systems:
        if not crops: out[name] = np.zeros((0, 11), np.uint16); continue
        P = np.mean([Model(m).probs(crops) for m in models], 0); out[name] = np.round(P * 65535).astype(np.uint16)
    return det, clip, n, out


def main():
    sampling, root, footage, radii_dir, outp = sys.argv[1:6]
    systems = [(s.split('=')[0], s.split('=')[1].split('+')) for s in sys.argv[6:]]
    jobs = []
    for det, (vid, alt) in SESSIONS.items():
        dd = os.path.join(root, alt if sampling == 'd30b' else det); radii = json.load(open(os.path.join(radii_dir, f'{sampling}-{det}.json')))
        for f in sorted(glob.glob(os.path.join(dd, '*.json'))):
            c = os.path.basename(f)[:-5]; jobs.append((det, sampling, dd, os.path.join(footage, vid, c + '.mp4'), {c: radii[c]}, systems, c))
    arr = {}
    with ProcessPoolExecutor(4) as ex:
        for det, clip, n, out in ex.map(job, jobs):
            arr[f'{det}/{clip}/n'] = np.array(n, np.int32)
            for s, p in out.items(): arr[f'{det}/{clip}/{s}'] = p
            print(det, clip, sum(n), flush=True)
    np.savez_compressed(outp, **arr)


if __name__ == '__main__':
    main()
