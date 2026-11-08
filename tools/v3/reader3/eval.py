# Held-out sessions: each LOSO reader on the session it never saw. Temperature fitted on the pooled held-out logits.
import pickle, sys, numpy as np, onnxruntime as ort, json
from PIL import Image
from collections import Counter
S = sys.argv[1]; D = pickle.load(open(f'{S}/rd/raw.pkl', 'rb'))
Z, Y, I = [], [], []
for s in ('1304', '1309', '1313', '1409', '1415'):
    L = [d for d in D if d['sess'] == s and d['y'] is not None and d['y'] >= 0]
    X = np.stack([np.asarray(Image.fromarray(d['crop']).resize((40, 40), Image.BILINEAR), np.float32) / 255 for d in L]).transpose(0, 3, 1, 2)
    z = ort.InferenceSession(f'{S}/rd/loso_{s}.onnx').run(None, {'x': X})[0]; Z.append(z); Y += [d['y'] for d in L]; I += [d['i'] for d in L]
Z = np.concatenate(Z); Y = np.array(Y)
def sm(z, T): z = z / T; z = z - z.max(1, keepdims=True); p = np.exp(z); return p / p.sum(1, keepdims=True)
Ts = np.arange(0.3, 3.0, 0.01); nll = [-np.log(sm(Z, T)[np.arange(len(Y)), Y] + 1e-12).mean() for T in Ts]; T = float(Ts[int(np.argmin(nll))])
P = sm(Z, T); print('T', round(T, 3), 'nll', round(min(nll), 4), 'n', len(Y))
top = P[:, :16].argmax(1); nb = P[:, 16]; pt = P[np.arange(len(Y)), top]
kind = np.where(nb >= 0.5, 'nb', np.where(pt >= 0.6, 'sure', 'unsure'))
ball = Y < 16
print('balls', ball.sum(), 'sure right', ((kind == 'sure') & (top == Y) & ball).sum(), 'sure wrong', ((kind == 'sure') & (top != Y) & ball).sum(),
      'unsure', ((kind == 'unsure') & ball).sum(), 'called not a ball', ((kind == 'nb') & ball).sum(), '| not-a-ball spots', (~ball).sum(), 'called nb', ((kind == 'nb') & ~ball).sum())
print('top-1 on balls', round(float((top[ball] == Y[ball]).mean()), 4))
per = {c: (int(((top == Y) & (Y == c)).sum()), int((Y == c).sum())) for c in range(17)}; print('per class right/n', per)
print('sure wrong (i, truth, read, p):', [(I[j], int(Y[j]), int(top[j]), round(float(pt[j]), 2)) for j in range(len(Y)) if kind[j] == 'sure' and top[j] != Y[j] and ball[j]])
print('confusions', Counter((int(Y[j]), int(top[j])) for j in range(len(Y)) if ball[j] and top[j] != Y[j]).most_common(12))
json.dump(dict(T=T), open(f'{S}/rd/T.json', 'w'))
