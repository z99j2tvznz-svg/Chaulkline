import pickle, sys, numpy as np, onnxruntime as ort, json
from PIL import Image
S = sys.argv[1]; M = sys.argv[2]; T3 = json.load(open(f'{S}/rd/T.json'))['T']
te = pickle.load(open(f'{S}/rd/old/native.pkl', 'rb'))['test']
X = np.stack([np.asarray(Image.fromarray(e['crop']).resize((40, 40), Image.BILINEAR), np.float32) / 255 for e in te]).transpose(0, 3, 1, 2); Y = np.array([int(e['y']) for e in te])
def sm(z, T): z = z / T; z = z - z.max(1, keepdims=True); p = np.exp(z); return p / p.sum(1, keepdims=True)
def score(P, nbi, name):
    top = P[:, :10].argmax(1); pt = P[np.arange(len(Y)), top]; nb = P[:, nbi]; ball = Y < 10
    kind = np.where(nb >= 0.5, 'nb', np.where(pt >= 0.6, 'sure', 'unsure'))
    print(name, 'balls', ball.sum(), 'sure right', ((kind == 'sure') & (top == Y) & ball).sum(), 'sure wrong', ((kind == 'sure') & (top != Y) & ball).sum(), 'unsure', ((kind == 'unsure') & ball).sum(), 'nb on balls', ((kind == 'nb') & ball).sum(), '| not-a-ball', (~ball).sum(), 'called nb', ((kind == 'nb') & ~ball).sum())
P2 = sm(ort.InferenceSession('/home/user/Chaulkline/models/reader-v2.onnx').run(None, {'x': X})[0], 0.6674199270850172); score(P2, 10, 'reader-v2')
P3 = sm(ort.InferenceSession(M).run(None, {'x': X})[0], T3); P3[:, 10:16] = 0; P3 /= P3.sum(1, keepdims=True); score(P3, 16, 'new (9-ball ids)')
