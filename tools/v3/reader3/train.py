# Reader v3: cue, 1-15, not a ball (17 classes), Challenger B's network and augmentation; old crops + Nov 8 crops.
#   python train.py <out.onnx> <seed> [holdout session or -] [epochs]
import sys, math, json, pickle, time, numpy as np, torch, torch.nn.functional as F

import os; S = os.path.dirname(os.path.dirname(os.path.abspath(sys.argv[0])))
import importlib.util, os
spec = importlib.util.spec_from_file_location('cb', f'{S}/oldb/benchmark/recognition-2026-10-20/bench/s04_challenger_b.py')
torch.set_num_threads(2)
src = open(spec.origin).read().split('def tensor(X)')[0].replace("torch.set_num_threads(cfg['torch_threads']); torch.use_deterministic_algorithms(True)", '').replace('from common import', '#').replace("cfg = dict(CFG['challenger_b'])", '')
ns = {}; exec(compile(src, 'cb', 'exec'), ns); Net, augment = ns['Net'], ns['augment']
from PIL import Image
out, seed = sys.argv[1], int(sys.argv[2]); hold = sys.argv[3] if len(sys.argv) > 3 else '-'; EP = int(sys.argv[4]) if len(sys.argv) > 4 else 40
def x40(c): return np.asarray(Image.fromarray(c).resize((40, 40), Image.BILINEAR), np.uint8)
old = pickle.load(open(f'{S}/rd/old/native.pkl', 'rb')); new = pickle.load(open(f'{S}/rd/raw.pkl', 'rb'))
X, Y, G = [], [], []
for sp in (('train', 'dev') if hold == 'oldtest' else ('train', 'dev', 'test')):
    for e in old[sp]: X.append(x40(e['crop'])); y = int(e['y']); Y.append(16 if y == 10 else y); G.append('old')
for d in new:
    if d['y'] is None or d['y'] < 0 or d['sess'] == hold: continue
    X.append(x40(d['crop'])); Y.append(d['y']); G.append(d['sess'])
X = torch.tensor(np.stack(X), dtype=torch.float32).permute(0, 3, 1, 2) / 255; Y = torch.tensor(Y); G = np.array(G)
# each class equally; within a class the old and the new pictures half each where both exist
w = np.zeros(len(Y))
for c in range(17):
    for grp in (G == 'old', G != 'old'):
        m = (Y.numpy() == c) & grp
        if m.sum(): w[m] = 1 / m.sum()
    m = Y.numpy() == c
    if m.sum(): w[m] /= w[m].sum()
w = torch.tensor(w)
torch.manual_seed(seed); g = torch.Generator().manual_seed(seed); net = Net(17)
opt = torch.optim.AdamW(net.parameters(), lr=0.002, weight_decay=0.0005); B = 128; spe = math.ceil(len(Y) / B)
sched = torch.optim.lr_scheduler.OneCycleLR(opt, 0.002, total_steps=EP * spe)
def shrink(x, lo=0.45, hi=0.9):
    o = x.clone()
    for i in range(len(x)):
        f = lo + (hi - lo) * float(torch.rand(1, generator=g)); s = max(8, round(40 * f))
        o[i] = F.interpolate(F.interpolate(x[i:i+1], size=(s, s), mode='bilinear', antialias=True, align_corners=False), size=(40, 40), mode='bilinear', align_corners=False)[0]
    return o
t0 = time.time()
for ep in range(EP):
    net.train(); idx = torch.multinomial(w, spe * B, replacement=True, generator=g); tot = 0
    for s in range(spe):
        b = idx[s * B:(s + 1) * B]; xb = X[b]; sel = torch.rand(len(b), generator=g) < 0.3
        if sel.any(): xb = xb.clone(); xb[sel] = shrink(xb[sel])
        loss = F.cross_entropy(net(augment(xb, g)), Y[b]); opt.zero_grad(); loss.backward(); opt.step(); sched.step(); tot += loss.item()
    if ep % 10 == 9: print(ep + 1, round(tot / spe, 4), round(time.time() - t0), flush=True)
net.eval(); torch.onnx.export(net, torch.zeros(1, 3, 40, 40), out, input_names=['x'], output_names=['logits'], dynamic_axes={'x': {0: 'n'}, 'logits': {0: 'n'}}, opset_version=17, dynamo=False)
print('saved', out, len(Y))
