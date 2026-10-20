"""Run the frozen number reader (recog.json) on the exact 24 x 24 reader pictures and compare with the stored answers.
Same maths as recogRun() in vision.js (copied from code/tools/experiments/colour-stripe.py). Needs numpy + Pillow.
    python3 run_reader.py            (run from this folder; paths below are relative to the package root)
"""
import base64, csv, json, os
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
S = 24
NAMES = ['cue'] + [str(i) for i in range(1, 10)] + ['not a ball']


def recog(path):
    R = json.load(open(path)); dec = lambda s: np.frombuffer(base64.b64decode(s), dtype=np.int8).astype(np.float32)
    W1 = dec(R['w1']).reshape(R['nin'], R['nh']); W2 = dec(R['w2']).reshape(R['nh'], len(R['classes']))
    s1, b1, s2, b2 = (np.array(R[k], dtype=np.float32) for k in ('s1', 'b1', 's2', 'b2'))

    def run(img):  # img: 24 x 24 x 3 floats in 0..1
        x = list(img.reshape(-1)); c = img[S // 4:3 * S // 4, S // 4:3 * S // 4].reshape(-1, 3)
        mx, mn = c.max(1), c.min(1); sat = (mx - mn) / (mx + 1e-3)
        wh = ((sat < 0.25) & (mx > 0.6)).mean(); dk = (mx < 0.3).mean(); col = (sat >= 0.25) & (mx >= 0.3)
        m = c[col].mean(0) if col.any() else np.zeros(3)
        x = np.array(x + [wh * 3, dk * 3, *(m * 3)], dtype=np.float32)
        hdn = np.maximum((x @ W1) * s1 + b1, 0); z = (hdn @ W2) * s2 + b2; z = np.exp(z - z.max()); return z / z.sum()
    return run


run = recog(os.path.join(ROOT, '03-reader-and-detector', 'reader', 'recog.json'))
D = os.path.join(ROOT, '01-images', 'reader-inputs')
rows = list(csv.DictReader(open(os.path.join(D, 'index.csv'))))
diff = []
for r in rows:
    img = np.asarray(Image.open(os.path.join(D, 'input-24x24', r['image_id'] + '.png')).convert('RGB'), np.float32) / 255
    p = run(img)
    diff.append(max(abs(p[i] - float(r['p_' + n])) for i, n in enumerate(NAMES)))
diff = np.array(diff)
print(f'{len(rows)} pictures; largest probability difference vs index.csv {diff.max():.4f}; under 0.01: {(diff < 0.01).sum()}')
