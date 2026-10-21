"""Product-level scoring of experimental reader inputs with the UNCHANGED v0.6 tracker and scorer (the benchmark's
bench/s06_product.py score(): score-racks.js + product-metrics.js, tracker {"version":"v0.6"}).
Only rec / p / nb of each detection spot are replaced; spots, positions and frames are byte-for-byte the frozen ones.
  python c05_product.py <frozen30|d30b> <out json> '<json list of variants>'
variant: {"name", "npz", "system"  (key inside the npz),
          "nb": "own" | "frozen" (stored frozen answer) | "min" (not a ball only if both say so), "max" (not a ball if either says so),
          "renorm": false | true  (number probabilities divided by 1 - the system's own not-a-ball),
          "pool": 0 | k  (average the system's probabilities over the same still spot in the +-k neighbouring frames)}"""
import glob, json, math, os, shutil, sys
from concurrent.futures import ProcessPoolExecutor
import numpy as np
os.environ['BENCH_OUT'] = os.path.join(os.environ['CYCLE_OUT'], 'bench_out')  # before the benchmark's common.py is imported
from common1 import OUT  # noqa: E402
from s06_product import SESS, base_dirs, score  # noqa: E402

STILL = 0.3  # inches: a spot counts as the same still ball if within this distance in every frame of the window


def pool(D, P, k):
    """Average P over the same still spot in frames f-k..f+k (only when matched in every frame of the window)."""
    F = D['frames']; idx, j = [], 0
    for fr in F: idx.append(list(range(j, j + len(fr['balls'])))); j += len(fr['balls'])
    Q = P.copy()
    for f, fr in enumerate(F):
        if f - k < 0 or f + k >= len(F): continue
        for si, b in enumerate(fr['balls']):
            m = []
            for g in range(f - k, f + k + 1):
                best = None
                for sj, c in enumerate(F[g]['balls']):
                    d = math.hypot(c['x'] - b['x'], c['y'] - b['y'])
                    if d < STILL and (best is None or d < best[0]): best = (d, idx[g][sj])
                if best is None: m = None; break
                m.append(best[1])
            if m: Q[idx[f][si]] = P[m].mean(0)
    return Q


def merged(sampling, v):
    Z = np.load(v['npz']); base = base_dirs(sampling); dirs = {}; tag = f"{sampling}.{v['name']}"
    for d, _, _ in SESS:
        od = os.path.join(OUT, 'bench_out', 'product', 'dets', tag, d); os.makedirs(od, exist_ok=True); dirs[d] = od
        for f in sorted(glob.glob(os.path.join(base[d], '*.json'))):
            c = os.path.basename(f)[:-5]; D = json.load(open(f)); P = Z[f'{d}/{c}/{v["system"]}'].astype(np.float64) / 65535
            assert [len(fr['balls']) for fr in D['frames']] == Z[f'{d}/{c}/n'].tolist(), f'spot count mismatch {d} {c}'
            if v.get('pool'): P = pool(D, P, v['pool'])
            j = 0
            for fr in D['frames']:
                for b in fr['balls']:
                    p = P[j]; j += 1; num = p[:10] / max(1e-9, 1 - p[10]) if v.get('renorm') else p[:10]; k = int(np.argmax(num))
                    b['rec'] = k; b['p'] = round(float(min(1.0, num[k])), 2)
                    if v['nb'] == 'own': b['nb'] = round(float(p[10]), 2)
                    elif v['nb'] == 'min': b['nb'] = round(min(float(p[10]), b['nb']), 2)
                    elif v['nb'] == 'max': b['nb'] = round(max(float(p[10]), b['nb']), 2)
            json.dump(D, open(os.path.join(od, c + '.json'), 'w'))
    return dirs, tag


def run(a):
    sampling, v = a
    if v['name'] == 'frozen-as-published': dirs, tag = base_dirs(sampling), f'{sampling}.frozen-as-published'
    else: dirs, tag = merged(sampling, v)
    r = score(dirs, tag); r.update(sampling=sampling, variant=v)
    if v['name'] != 'frozen-as-published': shutil.rmtree(os.path.join(OUT, 'bench_out', 'product', 'dets', tag))
    return r


def summary(r):
    h, c = r['heldout_only'], r
    return dict(name=r['variant']['name'], sampling=r['sampling'],
                all_ind=c['checkpoint']['correctAutomatically'], all_cont=c['continuous']['correctAutomatically'], all_cw=c['checkpoint']['confidentlyWrong'],
                ho_ind=h['checkpoint']['correctAutomatically'], ho_cont=h['continuous']['correctAutomatically'], ho_cw=h['checkpoint']['confidentlyWrong'],
                ho_cw_cont=h['continuous']['confidentlyWrong'], ho_missed_shots=h['checkpoint']['realShotsMissed'], ho_false_shots=h['checkpoint']['falseShots'],
                ho_false_pockets=h['checkpoint']['phantomPockets'], ho_missed_pockets=h['checkpoint']['madeCalledOnTable'],
                ho_made_unresolved=h['checkpoint']['madeLeftUnresolved'], racks=r['racks_complete'],
                oct16_ind=[s for s in r['per_session'] if s['session'].startswith('2026-10-16')][0]['checkpoint_correctAutomatically'],
                per_session_ind={s['session']: s['checkpoint_correctAutomatically'] for s in r['per_session']})


def main():
    sampling, outp, V = sys.argv[1], sys.argv[2], json.loads(sys.argv[3])
    base_dirs(sampling)  # extract the alternate pick once before the workers start
    with ProcessPoolExecutor(min(4, len(V))) as ex: R = list(ex.map(run, [(sampling, v) for v in V]))
    json.dump(R, open(outp, 'w'), indent=1)
    for r in R: print(json.dumps(summary(r)), flush=True)


if __name__ == '__main__':
    main()
