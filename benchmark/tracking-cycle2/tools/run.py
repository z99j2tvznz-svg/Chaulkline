"""Score one experimental system configuration with the experimental copies in ../exp/tools (score-racks.js and
product-metrics.js are the frozen v0.6 scorer files; only the system modules they call carry experiment options, all
off by default). Detections: the Cycle 1 recognition baseline (Challenger B number + frozen not-a-ball), both 30 fps picks.
  python run.py <out.json> '<json list of {"name", "opts"}>'      opts = the --track JSON (version v0.6 + experiment options)
Reuses the benchmark's s06_product.score() so totals, held-out split and racks are computed exactly as before."""
import json, os, sys
from concurrent.futures import ProcessPoolExecutor
HERE = os.path.dirname(os.path.abspath(__file__)); C2 = os.environ['C2_OUT']
os.environ['BENCH_OUT'] = os.path.join(C2, 'bench_out')
sys.path.insert(0, os.path.join(HERE, '..', '..', 'recognition-2026-10-20', 'bench'))
import s06_product as S  # noqa: E402
S.CODE = os.path.join(HERE, '..', 'exp')
SESS = [d for d, _, _ in S.SESS]


def one(a):
    name, opts, sampling = a
    S.OPTS = json.dumps(opts)
    dirs = {d: os.path.join(C2, 'dets', sampling, d) for d in SESS}
    r = S.score(dirs, f'{sampling}.{name}'); r.update(name=name, opts=opts, sampling=sampling); return r


def line(r):
    h, hc = r['heldout_only']['checkpoint'], r['heldout_only']['continuous']; a, ac = r['checkpoint'], r['continuous']
    ho_r = r['heldout_only']['racks_complete']
    return (f"{r['sampling']:8} {r['name']:28} ALL {a['correctAutomatically']:2}/{ac['correctAutomatically']:2} cw{a['confidentlyWrong']:2}/{ac['confidentlyWrong']:2} | "
            f"HO {h['correctAutomatically']:2}/{hc['correctAutomatically']:2} cw{h['confidentlyWrong']:2}/{hc['confidentlyWrong']:2} miss{h['realShotsMissed']} false{h['falseShots']} "
            f"ph{h['phantomPockets']} mp{h['madeCalledOnTable']} unres{h['madeLeftUnresolved']} st{h['stateErrors']} racks {r['racks_complete']} "
            + ' '.join(f"{s['session'][5:10] if s['session'][0] == '2' else s['session'][9:13]}:{s['checkpoint_correctAutomatically']}/{s['continuous_correctAutomatically']}" for s in r['per_session']))


def main():
    out, V = sys.argv[1], json.loads(sys.argv[2])
    jobs = [(v['name'], v['opts'], s) for v in V for s in ('frozen30', 'd30b')]
    with ProcessPoolExecutor(4) as ex: R = list(ex.map(one, jobs))
    json.dump(R, open(out, 'w'), indent=1)
    for r in sorted(R, key=lambda r: (r['sampling'] != 'frozen30', jobs.index((r['name'], r['opts'], r['sampling'])))): print(line(r), flush=True)


if __name__ == '__main__':
    main()
