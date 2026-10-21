"""Train one experimental reader variant on the benchmark's train split (Oct 12-16), temperature on dev (Oct 15 + odd
Oct 16 clips), exactly Challenger B's recipe except the named change. Exports ONNX + json.
  python c02_train.py <name> <seed> '<json options>'
options: side_frac (crop centre fraction, 1 = B's 3.2 radii), px (input size, B = 40),
         p_touch (chance a ball picture gets a second ball pasted beside it at 1.5-2.6 radii, overlapping below 2),
         p_far (chance a picture is shrunk to 45-80 % and enlarged back: far-camera blur / fewer pixels)."""
import json, math, sys, time
import numpy as np
import torch, torch.nn.functional as F
from common1 import o, make_input, load_native, fit_temperature
from s04_challenger_b import Net, augment, logits, cfg as BCFG  # B's network, augmentation, settings (unchanged)

torch.set_num_threads(2)


def shift(x, dx, dy):
    """Translate N x C x H x W by (dx, dy) pixels (zeros outside)."""
    n, _, h, w = x.shape; th = torch.zeros(n, 2, 3); th[:, 0, 0] = 1; th[:, 1, 1] = 1
    th[:, 0, 2] = -2 * dx / w; th[:, 1, 2] = -2 * dy / h
    return F.grid_sample(x, F.affine_grid(th, x.shape, align_corners=False), padding_mode='zeros', align_corners=False)


def paste_neighbour(x, donors, R, g, lo=1.5, hi=2.6):
    """Paste a donor ball (disc of radius R at the donor's centre) at distance lo..hi radii from the centre. Below 2 radii
    the two balls overlap in the picture (seen from a low camera): half the time the neighbour is in front, half behind."""
    n, _, h, w = x.shape
    yy, xx = torch.meshgrid(torch.arange(h) + .5, torch.arange(w) + .5, indexing='ij')
    disc = ((xx - w / 2) ** 2 + (yy - h / 2) ** 2).sqrt()
    m = (R + 0.7 - disc).clamp(0, 1)[None, None].expand(n, 1, h, w)
    a = torch.rand(n, generator=g) * 2 * math.pi; d = (lo + (hi - lo) * torch.rand(n, generator=g)) * R
    dx, dy = d * torch.cos(a), d * torch.sin(a)
    ds, ms = shift(donors, dx, dy), shift(m, dx, dy)
    y = x * (1 - ms) + ds * ms
    front = (torch.rand(n, generator=g) < .5).float()[:, None, None, None]   # 1 = the labelled ball is in front
    return front * (y * (1 - m) + x * m) + (1 - front) * y


def shrink(x, g, lo=0.45, hi=0.8):
    n, _, h, w = x.shape; out = x.clone()
    for i in range(n):
        f = lo + (hi - lo) * float(torch.rand(1, generator=g)); s = max(8, round(h * f))
        out[i] = F.interpolate(F.interpolate(x[i:i + 1], size=(s, s), mode='bilinear', antialias=True, align_corners=False),
                               size=(h, w), mode='bilinear', align_corners=False)[0]
    return out


def tensor(L, side_frac, px): return torch.tensor(np.stack([make_input(e['crop'], side_frac, px) for e in L]), dtype=torch.float32).permute(0, 3, 1, 2) / 255


def main():
    name, seed, opt = sys.argv[1], int(sys.argv[2]), json.loads(sys.argv[3] if len(sys.argv) > 3 else '{}')
    sf, px, pt, pf = opt.get('side_frac', 1.0), opt.get('px', 40), opt.get('p_touch', 0), opt.get('p_far', 0)
    R = px / (3.2 * sf)
    torch.manual_seed(seed); np.random.seed(seed)
    D = load_native(); tr, dv = D['train'], D['dev']
    Xtr, ytr = tensor(tr, sf, px), torch.tensor([int(e['y']) for e in tr]); Xdv, ydv = tensor(dv, sf, px), np.array([int(e['y']) for e in dv])
    per_ball = {}
    for e in tr: per_ball[e['ball_key']] = per_ball.get(e['ball_key'], 0) + 1
    wb = np.array([1 / per_ball[e['ball_key']] for e in tr]); cw = {c: wb[ytr.numpy() == c].sum() for c in range(11)}
    w = torch.tensor([wb[j] / cw[int(y)] for j, y in enumerate(ytr)], dtype=torch.float64)
    balls = torch.nonzero(ytr < 10).flatten()
    g = torch.Generator().manual_seed(seed); net = Net()
    optim = torch.optim.AdamW(net.parameters(), lr=BCFG['lr'], weight_decay=BCFG['weight_decay'])
    spe = math.ceil(len(ytr) / BCFG['batch']); sched = torch.optim.lr_scheduler.OneCycleLR(optim, BCFG['lr'], total_steps=BCFG['epochs'] * spe)
    t0 = time.time(); log = dict(name=name, seed=seed, options=opt, epochs=[])
    for ep in range(BCFG['epochs']):
        net.train(); idx = torch.multinomial(w, spe * BCFG['batch'], replacement=True, generator=g); tot = 0
        for s in range(spe):
            b = idx[s * BCFG['batch']:(s + 1) * BCFG['batch']]; xb, yb = Xtr[b], ytr[b]
            if pt:
                sel = (torch.rand(len(b), generator=g) < pt) & (yb < 10)
                if sel.any():
                    donors = Xtr[balls[torch.randint(len(balls), (int(sel.sum()),), generator=g)]]
                    xb = xb.clone(); xb[sel] = paste_neighbour(xb[sel], donors, R, g)
            if pf:
                sel = torch.rand(len(b), generator=g) < pf
                if sel.any(): xb = xb.clone(); xb[sel] = shrink(xb[sel], g)
            loss = F.cross_entropy(net(augment(xb, g)), yb); optim.zero_grad(); loss.backward(); optim.step(); sched.step(); tot += loss.item()
        log['epochs'].append(dict(epoch=ep + 1, loss=round(tot / spe, 4)))
    T, nll = fit_temperature(logits(net, Xdv), ydv)
    log.update(temperature=T, dev_nll=nll, seconds=round(time.time() - t0, 1), parameters=sum(p.numel() for p in net.parameters()))
    net.eval(); f = o('models', f'{name}_s{seed}.onnx')
    torch.onnx.export(net, torch.zeros(1, 3, px, px), f, input_names=['x'], output_names=['logits'], dynamic_axes={'x': {0: 'n'}, 'logits': {0: 'n'}}, opset_version=17)
    json.dump(dict(temperature=T, side_frac=sf, px=px, options=opt, seed=seed), open(o('models', f'{name}_s{seed}.json'), 'w'), indent=1)
    json.dump(log, open(o('logs', f'train_{name}_s{seed}.json'), 'w'), indent=1)
    print(name, seed, 'T', round(T, 3), 'dev nll', round(nll, 4), log['seconds'], 's', flush=True)


if __name__ == '__main__':
    main()
