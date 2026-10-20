"""Challenger B: a small convolutional network (about 60k weights) on the detector-spot crops at 40 x 40
(the 3.2-radius crop at native resolution, 32-58 px, instead of the reader's 24 x 24). 11 classes (cue, 1-9, not a ball).
Augmentation: any rotation, flips, small scale/shift, brightness, contrast, white balance, noise, blur.
Trained on train, temperature from dev, exported to ONNX; the test predictions come from the ONNX model
(the same file used for the product-level run). Writes out/predictions/challenger_b.csv, out/models/challenger_b.onnx, out/logs/."""
import json, math, os, random, time
import numpy as np
import torch, torch.nn as nn, torch.nn.functional as F
from common import CFG, CLASSES, out, write_csv, decide, softmax, fit_temperature, read_csv

cfg = CFG['challenger_b']
random.seed(cfg['seed']); np.random.seed(cfg['seed']); torch.manual_seed(cfg['seed'])
torch.set_num_threads(cfg['torch_threads']); torch.use_deterministic_algorithms(True)


class Net(nn.Module):
    def __init__(s, k=11):
        super().__init__()
        def blk(i, o): return nn.Sequential(nn.Conv2d(i, o, 3, padding=1, bias=False), nn.BatchNorm2d(o), nn.ReLU())
        s.f = nn.Sequential(blk(3, 24), blk(24, 24), nn.MaxPool2d(2), blk(24, 48), blk(48, 48), nn.MaxPool2d(2), blk(48, 64), nn.MaxPool2d(2))
        s.head = nn.Sequential(nn.Dropout(0.2), nn.Linear(64, k))

    def forward(s, x):  # x: N x 3 x 40 x 40, 0..1
        return s.head(s.f(x - 0.5).mean((2, 3)))


def augment(x, g):
    n = x.shape[0]
    ang = torch.rand(n, generator=g) * 2 * math.pi; sc = 1 + (torch.rand(n, generator=g) - .5) * .2
    sh = (torch.rand(n, 2, generator=g) - .5) * (3 / 20)
    cos, sin = torch.cos(ang) / sc, torch.sin(ang) / sc
    th = torch.stack([torch.stack([cos, -sin, sh[:, 0]], 1), torch.stack([sin, cos, sh[:, 1]], 1)], 1)
    flip = (torch.rand(n, generator=g) < .5).float() * 2 - 1; th[:, 0, :2] *= flip[:, None]
    x = F.grid_sample(x, F.affine_grid(th, x.shape, align_corners=False), padding_mode='reflection', align_corners=False)
    b = 0.6 + 0.8 * torch.rand(n, 1, 1, 1, generator=g)                     # brightness x0.6..1.4
    wb = 1 + (torch.rand(n, 3, 1, 1, generator=g) - .5) * .2                 # white balance +-10 % per channel
    m = x.mean((1, 2, 3), keepdim=True); c = 0.75 + 0.5 * torch.rand(n, 1, 1, 1, generator=g)
    x = ((x - m) * c + m) * b * wb
    blur = torch.rand(n, generator=g) < .3
    if blur.any():
        k = torch.tensor([1., 2., 1.]); k = (k[:, None] * k[None]) / 16
        xb = F.conv2d(F.pad(x[blur], (1, 1, 1, 1), mode='replicate'), k.expand(3, 1, 3, 3).contiguous(), groups=3); x = x.clone(); x[blur] = xb
    x = x + torch.randn(x.shape, generator=g) * 0.02
    return x.clamp(0, 1)


def tensor(X): return torch.tensor(X, dtype=torch.float32).permute(0, 3, 1, 2) / 255


def logits(net, X):
    net.eval()
    with torch.no_grad(): return torch.cat([net(X[i:i + 512]) for i in range(0, len(X), 512)]).numpy()


def main():
    tr, dv, te = (np.load(out('data', s + '.npz')) for s in ('train', 'dev', 'test'))
    ex = {e['id']: e for e in read_csv(out('data', 'examples.csv'))}
    Xtr, ytr, Xdv, ydv = tensor(tr['X40']), torch.tensor(tr['y']), tensor(dv['X40']), dv['y']
    # sample weights: each class equally, and each ball once however many video frames it has
    per_ball = {}
    for i in tr['ids']: per_ball[ex[str(i)]['ball_key']] = per_ball.get(ex[str(i)]['ball_key'], 0) + 1
    w_ball = np.array([1 / per_ball[ex[str(i)]['ball_key']] for i in tr['ids']])
    cls_w = {c: w_ball[tr['y'] == c].sum() for c in range(11)}
    w = torch.tensor([w_ball[j] / cls_w[int(y)] for j, y in enumerate(tr['y'])], dtype=torch.float64)
    g = torch.Generator().manual_seed(cfg['seed'])
    net = Net(); opt = torch.optim.AdamW(net.parameters(), lr=cfg['lr'], weight_decay=cfg['weight_decay'])
    steps_per_epoch = math.ceil(len(ytr) / cfg['batch']); sched = torch.optim.lr_scheduler.OneCycleLR(opt, cfg['lr'], total_steps=cfg['epochs'] * steps_per_epoch)
    log = dict(config=cfg, parameters=sum(p.numel() for p in net.parameters()), train_examples=len(ytr), dev_examples=len(ydv), epochs=[])
    t0 = time.time()
    for ep in range(cfg['epochs']):
        net.train(); idx = torch.multinomial(w, steps_per_epoch * cfg['batch'], replacement=True, generator=g); tot = 0
        for s in range(steps_per_epoch):
            b = idx[s * cfg['batch']:(s + 1) * cfg['batch']]
            loss = F.cross_entropy(net(augment(Xtr[b], g)), ytr[b]); opt.zero_grad(); loss.backward(); opt.step(); sched.step(); tot += loss.item()
        dl = logits(net, Xdv); dacc = float((dl.argmax(1) == ydv).mean())
        log['epochs'].append(dict(epoch=ep + 1, train_loss=round(tot / steps_per_epoch, 4), dev_top1=round(dacc, 4), seconds=round(time.time() - t0, 1)))
        print(log['epochs'][-1], flush=True)
    # final model = last epoch (fixed in advance; the dev score is logged, not used to pick an epoch)
    T, nll = fit_temperature(logits(net, Xdv), ydv); log.update(temperature=T, dev_nll=nll,
                                                            train_top1_no_aug=float((logits(net, Xtr).argmax(1) == tr['y']).mean()))
    torch.save(net.state_dict(), out('models', 'challenger_b.pt'))
    net.eval(); torch.onnx.export(net, torch.zeros(1, 3, 40, 40), out('models', 'challenger_b.onnx'), input_names=['x'], output_names=['logits'],
                                  dynamic_axes={'x': {0: 'n'}, 'logits': {0: 'n'}}, opset_version=17)
    json.dump(dict(temperature=T, input='N x 3 x 40 x 40 RGB 0..1 (3.2-radius crop, bilinear resize)', classes=CLASSES),
              open(out('models', 'challenger_b.json'), 'w'), indent=1)
    import onnxruntime as ort
    sess = ort.InferenceSession(out('models', 'challenger_b.onnx'), providers=['CPUExecutionProvider'])
    Xte = tensor(te['X40']).numpy(); L = np.concatenate([sess.run(None, {'x': Xte[i:i + 512]})[0] for i in range(0, len(Xte), 512)])
    log['onnx_vs_torch_max_logit_diff'] = float(np.abs(L - logits(net, tensor(te['X40']))).max())
    P = softmax(L, T); rows = []
    for i, p in zip(te['ids'], P):
        kind, k, pt, nb = decide(p)
        rows.append(dict(id=str(i), kind=kind, number=k, p_top=round(pt, 4), nb=round(nb, 4), **{f'p_{c}': round(float(v), 5) for c, v in zip(CLASSES, p)}))
    write_csv(out('predictions', 'challenger_b.csv'), rows)
    json.dump(log, open(out('logs', 'challenger_b.json'), 'w'), indent=1)
    print(json.dumps({k: v for k, v in log.items() if k != 'epochs'}))


if __name__ == '__main__':
    main()
