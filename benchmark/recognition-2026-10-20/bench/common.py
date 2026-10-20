"""Shared helpers for the isolated recognition benchmark. Reads the recognition package; never writes into it."""
import base64, csv, hashlib, json, math, os
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
BENCH = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(BENCH))
CFG = json.load(open(os.path.join(BENCH, 'config.json')))
PKG = os.path.join(REPO, CFG['package'])
OUT = os.environ.get('BENCH_OUT', os.path.join(BENCH, 'out'))
CLASSES = CFG['classes']  # index 0 = cue, 1..9 = balls 1-9, 10 = not a ball
NB = 10
SIDE = CFG['crop']['model_input_px']
NB_T = CFG['decision_rule']['not_a_ball_if_nb_at_least']
P_T = CFG['decision_rule']['confident_if_top_number_p_at_least']


def out(*p):
    f = os.path.join(OUT, *p); os.makedirs(os.path.dirname(f), exist_ok=True); return f


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''): h.update(b)
    return h.hexdigest()


def read_csv(path): return list(csv.DictReader(open(path, newline='')))


def write_csv(path, rows, cols=None):
    cols = cols or list(rows[0].keys())
    with open(path, 'w', newline='') as f:
        w = csv.DictWriter(f, cols, extrasaction='ignore'); w.writeheader(); w.writerows(rows)


# ---------- crops ----------
def crop_square(img, cx, cy, r):
    """The reader's crop rule (reader-input.js): square of 3.2 radii centred on the spot, cut at integer pixels
    (floor of the corner, ceil of the side); parts outside the picture are black. Returns an RGB uint8 array."""
    a = np.asarray(img.convert('RGB')); H, W = a.shape[:2]
    s = CFG['crop']['side_radii'] * r; x0 = math.floor(cx - s / 2); y0 = math.floor(cy - s / 2); n = math.ceil(s)
    o = np.zeros((n, n, 3), np.uint8)
    xs, ys, xe, ye = max(0, x0), max(0, y0), min(W, x0 + n), min(H, y0 + n)
    if xe > xs and ye > ys: o[ys - y0:ye - y0, xs - x0:xe - x0] = a[ys:ye, xs:xe]
    return o


def to_input(crop):
    """Model input for both challengers: the 3.2-radius crop resized to SIDE x SIDE (bilinear), float 0..1."""
    im = Image.fromarray(crop).resize((SIDE, SIDE), Image.BILINEAR)
    return np.asarray(im, np.float32) / 255


# ---------- frozen reader (same maths as package 03-reader-and-detector/reader/run_reader.py) ----------
def frozen_reader():
    R = json.load(open(os.path.join(PKG, '03-reader-and-detector', 'reader', 'recog.json')))
    dec = lambda s: np.frombuffer(base64.b64decode(s), dtype=np.int8).astype(np.float32)
    W1 = dec(R['w1']).reshape(R['nin'], R['nh']); W2 = dec(R['w2']).reshape(R['nh'], len(R['classes']))
    s1, b1, s2, b2 = (np.array(R[k], dtype=np.float32) for k in ('s1', 'b1', 's2', 'b2')); S = 24

    def run(img):  # 24 x 24 x 3 floats 0..1
        c = img[S // 4:3 * S // 4, S // 4:3 * S // 4].reshape(-1, 3)
        mx, mn = c.max(1), c.min(1); sat = (mx - mn) / (mx + 1e-3)
        wh = ((sat < 0.25) & (mx > 0.6)).mean(); dk = (mx < 0.3).mean(); col = (sat >= 0.25) & (mx >= 0.3)
        m = c[col].mean(0) if col.any() else np.zeros(3)
        x = np.array(list(img.reshape(-1)) + [wh * 3, dk * 3, *(m * 3)], dtype=np.float32)
        h = np.maximum((x @ W1) * s1 + b1, 0); z = (h @ W2) * s2 + b2; z = np.exp(z - z.max()); return z / z.sum()
    return run


# ---------- decisions ----------
def decide(p):
    """p: 11 probabilities. Returns (kind, number, p_top, nb). kind: confident | unsure | not_a_ball."""
    nb = float(p[NB]); k = int(np.argmax(p[:NB])); pt = float(p[k])
    if nb >= NB_T: return 'not_a_ball', k, pt, nb
    return ('confident' if pt >= P_T else 'unsure'), k, pt, nb


def softmax(z, T=1.0):
    z = np.asarray(z, np.float64) / T; z = z - z.max(-1, keepdims=True); e = np.exp(z); return e / e.sum(-1, keepdims=True)


def fit_temperature(logits, y):
    """One temperature minimising dev negative log-likelihood (grid, deterministic)."""
    best = None
    for T in np.exp(np.linspace(np.log(0.25), np.log(8), 241)):
        p = softmax(logits, T); nll = -np.log(np.clip(p[np.arange(len(y)), y], 1e-12, 1)).mean()
        if best is None or nll < best[1]: best = (float(T), float(nll))
    return best
