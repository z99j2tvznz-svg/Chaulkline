# Balls from the Nov 8 15-ball sessions' before/after pictures (960x540): finder detector-v1-960x544, reader-v2.
import glob, json, os, sys, math, pickle, numpy as np, onnxruntime as ort
from PIL import Image
S, R = sys.argv[1], '/home/user/Chaulkline'
def letterbox(img, iw, ih):
    W, H = img.size; k = min(iw / W, ih / H); nw, nh = round(W * k), round(H * k)
    left, top = round((iw - nw) / 2 - 0.1), round((ih - nh) / 2 - 0.1)
    c = Image.new('RGB', (iw, ih), (114, 114, 114)); c.paste(img.resize((nw, nh), Image.BILINEAR), (left, top))
    return np.asarray(c, np.float32).transpose(2, 0, 1)[None] / 255, k, left, top
def iou(a, b):
    w = min(a[2], b[2]) - max(a[0], b[0]); h = min(a[3], b[3]) - max(a[1], b[1])
    if w <= 0 or h <= 0: return 0
    i = w * h; return i / ((a[2]-a[0])*(a[3]-a[1]) + (b[2]-b[0])*(b[3]-b[1]) - i)
def find(sess, img, iw, ih):
    x, k, l, t = letterbox(img, iw, ih); o = sess.run(None, {'images': x})[0][0]
    m = o[4] >= 0.3; b = o[:, m].T; out = []
    for cx, cy, w, h, s in sorted(b.tolist(), key=lambda r: -r[4]):
        cx, cy, w, h = (cx - l) / k, (cy - t) / k, w / k, h / k; bx = (cx - w/2, cy - h/2, cx + w/2, cy + h/2, s)
        if all(iou(q, bx) <= 0.5 for q in out): out.append(bx)
    return [((q[0]+q[2])/2, (q[1]+q[3])/2, (q[2]-q[0]+q[3]-q[1])/4, q[4]) for q in out]
def crop_native(a, cx, cy, r):
    H, W = a.shape[:2]; s = 3.2 * r; x0, y0, n = math.floor(cx - s/2), math.floor(cy - s/2), math.ceil(s)
    o = np.zeros((n, n, 3), np.uint8); xs, ys, xe, ye = max(0, x0), max(0, y0), min(W, x0 + n), min(H, y0 + n)
    if xe > xs and ye > ys: o[ys-y0:ye-y0, xs-x0:xe-x0] = a[ys:ye, xs:xe]
    return o
def inq(q, x, y):
    s = [ (q[(i+1)%4][0]-q[i][0])*(y-q[i][1]) - (q[(i+1)%4][1]-q[i][1])*(x-q[i][0]) for i in range(4)]
    return all(v >= 0 for v in s) or all(v <= 0 for v in s)
det = ort.InferenceSession(f'{R}/models/detector-v1-960x544.onnx'); rs = ort.InferenceSession(f'{R}/models/reader-v2.onnx')
out = []
for sess in sys.argv[2:]:
    L = json.load(open(f'{S}/d{sess}/log.json')); q = [[p[0]/2, p[1]/2] for p in L['header']['quad']]
    c = [sum(p[0] for p in q)/4, sum(p[1] for p in q)/4]; qq = [[c[0]+(p[0]-c[0])*1.04, c[1]+(p[1]-c[1])*1.06] for p in q]
    for f in sorted(glob.glob(f'{S}/d{sess}/shot*-before.jpg') + glob.glob(f'{S}/d{sess}/shot*-after.jpg')):
        img = Image.open(f).convert('RGB'); a = np.asarray(img)
        D = [d for d in find(det, img, 960, 544) if inq(qq, d[0], d[1])]
        if not D: continue
        crops = [crop_native(a, x, y, max(3, r)) for x, y, r, s in D]
        X = np.stack([np.asarray(Image.fromarray(cr).resize((40, 40), Image.BILINEAR), np.float32) / 255 for cr in crops]).transpose(0, 3, 1, 2)
        z = rs.run(None, {'x': X})[0] / 0.6674; z -= z.max(1, keepdims=True); p = np.exp(z); p /= p.sum(1, keepdims=True)
        for d, cr, pp in zip(D, crops, p):
            out.append(dict(sess=sess, pic=os.path.basename(f), x=d[0], py=d[1], r=d[2], score=d[3], crop=cr, p=pp.round(3).tolist()))
    print(sess, len(out), flush=True)
pickle.dump(out, open(f'{S}/rd/raw0.pkl', 'wb'))
