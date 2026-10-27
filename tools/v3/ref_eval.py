"""Reference run (Python, onnxruntime CPU) of the finder at several sizes and the reader, on the 14 player-verified frames."""
import glob, json, os, sys, math, time, numpy as np, onnxruntime as ort
from PIL import Image
S = sys.argv[1]; CL = ['cue'] + [str(i) for i in range(1, 10)] + ['nb']
def letterbox(img, iw, ih):
    W, H = img.size; k = min(iw / W, ih / H); nw, nh = round(W * k), round(H * k)
    left, top = round((iw - nw) / 2 - 0.1), round((ih - nh) / 2 - 0.1)
    c = Image.new('RGB', (iw, ih), (114, 114, 114)); c.paste(img.resize((nw, nh), Image.BILINEAR), (left, top))
    x = np.asarray(c, np.float32).transpose(2, 0, 1)[None] / 255; return x, k, left, top
def iou(a, b):
    w = min(a[2], b[2]) - max(a[0], b[0]); h = min(a[3], b[3]) - max(a[1], b[1])
    if w <= 0 or h <= 0: return 0
    i = w * h; return i / ((a[2]-a[0])*(a[3]-a[1]) + (b[2]-b[0])*(b[3]-b[1]) - i)
def find(sess, img, iw, ih):
    x, k, l, t = letterbox(img, iw, ih); o = sess.run(None, {'images': x})[0][0]
    m = o[4] >= 0.35; b = o[:, m].T; out = []
    for cx, cy, w, h, s in sorted(b.tolist(), key=lambda r: -r[4]):
        cx, cy, w, h = (cx - l) / k, (cy - t) / k, w / k, h / k; bx = (cx - w/2, cy - h/2, cx + w/2, cy + h/2, s)
        if all(iou(q, bx) <= 0.7 for q in out): out.append(bx)
    return [((q[0]+q[2])/2, (q[1]+q[3])/2, (q[2]-q[0]+q[3]-q[1])/4, q[4]) for q in out]
def crop(img, cx, cy, r):
    a = np.asarray(img); H, W = a.shape[:2]; s = 3.2 * r; x0, y0, n = math.floor(cx - s/2), math.floor(cy - s/2), math.ceil(s)
    o = np.zeros((n, n, 3), np.uint8); xs, ys, xe, ye = max(0, x0), max(0, y0), min(W, x0 + n), min(H, y0 + n)
    if xe > xs and ye > ys: o[ys-y0:ye-y0, xs-x0:xe-x0] = a[ys:ye, xs:xe]
    return np.asarray(Image.fromarray(o).resize((40, 40), Image.BILINEAR), np.float32) / 255
def read(rs, img, spots):
    if not spots: return []
    X = np.stack([crop(img, x, y, max(3, r)) for x, y, r in spots]).transpose(0, 3, 1, 2).astype(np.float32)
    z = rs.run(None, {'x': X})[0] / 0.6674199270850172; z -= z.max(1, keepdims=True); p = np.exp(z); return p / p.sum(1, keepdims=True)
def kind(p):
    k = int(np.argmax(p[:10])); return ('nb', k) if p[10] >= 0.5 else (('sure' if p[k] >= 0.6 else 'unsure'), k)
rs = ort.InferenceSession(f'{S}/models/reader.onnx'); res = {}
sizes = [(1280, 1280), (1280, 736), (960, 544), (640, 384)]
sess = {sz: ort.InferenceSession(f'{S}/models/det-{sz[0]}x{sz[1]}.onnx') for sz in sizes}
tot = {sz: dict(balls=0, found=0, extra=0, sure_right=0, sure_wrong=0, unsure=0, nb=0, ms=0) for sz in sizes}
lab = dict(sure_right=0, sure_wrong=0, unsure=0, nb=0, n=0); conf = {}
for jf in sorted(glob.glob(f'{S}/cal/*.json')):
    name = os.path.basename(jf)[:-5]; L = [b for b in json.load(open(jf))['balls'] if b.get('num') is not None and not b.get('unknown')]
    im = glob.glob(f'{S}/cal/images/*'); img = Image.open([p for p in im if os.path.basename(p).replace('.', '_')[:-4] == name][0]).convert('RGB')
    P = read(rs, img, [(b['x'], b['y'], b['r']) for b in L])  # reader at the labelled spots (radius from the label page)
    for b, p in zip(L, P):
        kd, k = kind(p); lab['n'] += 1
        if kd == 'nb': lab['nb'] += 1
        elif kd == 'unsure': lab['unsure'] += 1
        elif k == b['num']: lab['sure_right'] += 1
        else: lab['sure_wrong'] += 1; conf[(b['num'], k)] = conf.get((b['num'], k), 0) + 1
    res[name] = {}
    for sz in sizes:
        t0 = time.time(); D = find(sess[sz], img, *sz); tot[sz]['ms'] += (time.time() - t0) * 1000
        used = set(); T = tot[sz]; T['balls'] += len(L); rows = []
        for b in L:
            j = min(range(len(D)), key=lambda i: math.hypot(D[i][0]-b['x'], D[i][1]-b['y']), default=None)
            if j is not None and j not in used and math.hypot(D[j][0]-b['x'], D[j][1]-b['y']) <= max(4, b['r']): used.add(j); T['found'] += 1; rows.append((b, D[j]))
        T['extra'] += len(D) - len(used)
        for (b, d), p in zip(rows, read(rs, img, [(d[0], d[1], d[2]) for _, d in rows])):
            kd, k = kind(p)
            if kd == 'nb': T['nb'] += 1
            elif kd == 'unsure': T['unsure'] += 1
            elif k == b['num']: T['sure_right'] += 1
            else: T['sure_wrong'] += 1
        res[name][f'{sz[0]}x{sz[1]}'] = [[round(v, 2) for v in d] for d in D]
print('reader at the labelled spots:', lab, 'wrong (truth, read):', conf)
for sz, T in tot.items(): print(f'{sz[0]}x{sz[1]}', T)
json.dump(res, open(f'{S}/ref-detections.json', 'w'))
