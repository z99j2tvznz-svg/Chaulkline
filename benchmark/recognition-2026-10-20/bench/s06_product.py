"""Product-level evaluation with the UNCHANGED v0.6 scorer (package code/tools/score-racks.js and
code/tools/experiments/product-metrics.js, tracker {"version":"v0.6"}).
1. Baseline: the frozen detections exactly as published (30 fps set), and the alternate 30 fps pick (d30b).
2. Replacement readers: the frozen detection files with only rec / p / nb of each spot replaced by another reader's
   answers (replacement-predictions/*.npz, made from the footage by local/infer_footage.py). Spots, positions,
   frames and everything else stay byte-for-byte the same.
   Variants: "<system>" = that system's number AND not-a-ball answer; "<system>+frozen-nb" = its number, the frozen
   reader's stored not-a-ball answer.
Writes out/product/*.json, out/product/product_metrics.csv."""
import glob, json, os, shutil, subprocess, sys, tarfile
import numpy as np
from common import PKG, BENCH, out, write_csv

CODE = os.path.join(PKG, 'code'); TRUTH = os.path.join(PKG, '02-ground-truth', 'player-verified', 'shot-outcomes')
SESS = [('v04-oct16', 'oct16', '2026-10-16_evening_V2.3.3'), ('v04-firstspot', 'firstspot', '2026-10-17_2151_V2.3.3_firstspot'),
        ('v04-otherside', 'otherside', '2026-10-17_1500_V2.3.3_otherside'), ('rec-20261017-1730', 'rec-20261017-1730', 'rec-20261017-1730'),
        ('rec-20261018-2310', 'rec-20261018-2310', 'rec-20261018-2310'), ('rec-20261019-1710', 'rec-20261019-1710', 'rec-20261019-1710')]
OPTS = '{"version":"v0.6"}'
DOCUMENTED = dict(checkpoint_correct=38, continuous_correct=27, confidently_wrong=26, racks_complete='0/5', shots=116)
K = ['correctAutomatically', 'confidentlyWrong', 'phantomPockets', 'madeCalledOnTable', 'stateErrors', 'madeLeftUnresolved',
     'realShotsMissed', 'falseShots', 'correctionsNeeded', 'realShotClips']


def base_dirs(sampling):
    if sampling == 'frozen30': return {d: os.path.join(PKG, '04-detections', 'v0.6-scoring-set', d) for d, _, _ in SESS}
    root = out('product', 'alt');
    if not os.path.isdir(os.path.join(root, 'd30b')):
        with tarfile.open(os.path.join(PKG, '04-detections', 'alternate-sampling', 'sampling-sets-15-30.tgz')) as t:
            t.extractall(root, members=[m for m in t.getmembers() if m.name.startswith('d30b/')], filter='data')
    return {d: os.path.join(root, 'd30b', a) for d, a, _ in SESS}


def score(dirs, tag):
    """Run both scorers on one set of 6 session folders; return totals."""
    pm_out = out('product', 'runs', tag + '.pm.json')
    args = ['node', os.path.join(CODE, 'tools', 'experiments', 'product-metrics.js'), OPTS] + \
           [f'{dirs[d]}:{os.path.join(TRUTH, t + ".json")}' for d, _, t in SESS] + ['--out', pm_out]
    log = subprocess.run(args, capture_output=True, text=True, cwd=CODE)
    open(out('product', 'runs', tag + '.pm.log'), 'w').write(log.stdout + log.stderr)
    if log.returncode: sys.exit(f'product-metrics failed for {tag}: {log.stderr[-2000:]}')
    pm = json.load(open(pm_out)); tot = {m: {k: 0 for k in K} for m in ('checkpoint', 'continuous')}; per = []
    for d, _, t in SESS:
        ro = out('product', 'runs', f'{tag}.{d}.racks.json')
        r = subprocess.run(['node', os.path.join(CODE, 'tools', 'score-racks.js'), dirs[d], os.path.join(TRUTH, t + '.json'), '--track', OPTS, '--out', ro],
                           capture_output=True, text=True, cwd=CODE)
        if r.returncode: sys.exit(f'score-racks failed for {tag} {d}: {r.stderr[-2000:]}')
        R = json.load(open(ro))
        for m in tot:
            for k in K: tot[m][k] += R[m]['totals'][k]
        per.append(dict(session=t, **{f'{m}_{k}': R[m]['totals'][k] for m in tot for k in ('correctAutomatically', 'confidentlyWrong', 'realShotClips')}))
    real = [x for x in pm if 'racks' in json.load(open(os.path.join(TRUTH, x['session'] + '.json')))]
    racks = f"{sum(x['racksComplete'] for x in real)}/{sum(x['racks'] for x in real)}"
    return dict(tag=tag, checkpoint=tot['checkpoint'], continuous=tot['continuous'], racks_complete=racks, per_session=per,
                pm_totals={k: sum(x[k] for x in pm) for k in ('shots', 'endRight', 'confidentlyWrong', 'phantom', 'madeCalledOnTable', 'madeLeftOpen', 'shotsMissed', 'falseShots')})


def merged(sampling, system, frozen_nb):
    """Copy of the frozen detection files with rec / p / nb replaced from the replacement predictions."""
    Z = np.load(os.path.join(BENCH, 'replacement-predictions', sampling + '.npz')); base = base_dirs(sampling); dirs = {}; stats = dict(spots=0)
    tag = f'{sampling}.{system}{"+frozen-nb" if frozen_nb else ""}'
    for d, _, _ in SESS:
        od = out('product', 'dets', tag, d); os.makedirs(od, exist_ok=True); dirs[d] = od
        for f in sorted(glob.glob(os.path.join(base[d], '*.json'))):
            c = os.path.basename(f)[:-5]; D = json.load(open(f)); P = Z[f'{d}/{c}/{system}'].astype(np.float64) / 65535; n = Z[f'{d}/{c}/n']
            assert [len(fr['balls']) for fr in D['frames']] == n.tolist(), f'spot count mismatch {d} {c}'
            j = 0
            for fr in D['frames']:
                for b in fr['balls']:
                    p = P[j]; j += 1; k = int(np.argmax(p[:10]))
                    b['rec'] = k; b['p'] = round(float(p[k]), 2)
                    if not frozen_nb: b['nb'] = round(float(p[10]), 2)
            stats['spots'] += j
            json.dump(D, open(os.path.join(od, c + '.json'), 'w'))
    return dirs, tag, stats


def main():
    res = []
    for sampling in ('frozen30', 'd30b'):
        res.append(dict(score(base_dirs(sampling), f'{sampling}.frozen-as-published'), sampling=sampling, system='frozen reader (stored answers)', variant='published'))
        if not os.path.exists(os.path.join(BENCH, 'replacement-predictions', sampling + '.npz')): continue
        for system in ('control_frozen', 'challenger_a', 'challenger_b'):
            for fnb in (False, True):
                dirs, tag, st = merged(sampling, system, fnb)
                res.append(dict(score(dirs, tag), sampling=sampling, system=system, variant='own not-a-ball' if not fnb else 'frozen not-a-ball', spots=st['spots']))
                shutil.rmtree(out('product', 'dets', tag))
    b = res[0]; pm_ref = json.load(open(os.path.join(PKG, '06-product-evaluation', 'baselines', 'tracker-v0.6-data', 'pm-v06.json')))
    pm_now = json.load(open(out('product', 'runs', 'frozen30.frozen-as-published.pm.json')))
    strip = lambda L: [{k: v for k, v in x.items() if k not in ('commit',)} for x in L]
    repro = dict(documented=DOCUMENTED,
                 measured=dict(checkpoint_correct=b['checkpoint']['correctAutomatically'], continuous_correct=b['continuous']['correctAutomatically'],
                               confidently_wrong_checkpoint=b['checkpoint']['confidentlyWrong'], confidently_wrong_continuous=b['continuous']['confidentlyWrong'],
                               racks_complete=b['racks_complete'], shots=b['checkpoint']['realShotClips']),
                 product_metrics_output_identical_to_published_pm_v06=strip(pm_now) == strip(pm_ref))
    m = repro['measured']
    repro['exact'] = dict(checkpoint_correct=m['checkpoint_correct'] == 38, continuous_correct=m['continuous_correct'] == 27,
                          confidently_wrong=m['confidently_wrong_checkpoint'] == 26, racks_complete=m['racks_complete'] == '0/5', shots=m['shots'] == 116)
    json.dump(repro, open(out('product', 'baseline-reproduction.json'), 'w'), indent=1)
    json.dump(res, open(out('product', 'product_results.json'), 'w'), indent=1)
    rows = []
    for r in res:
        rows.append(dict(sampling=r['sampling'], system=r['system'], variant=r['variant'],
                         ending_table_right_independent=r['checkpoint']['correctAutomatically'], ending_table_right_continuous=r['continuous']['correctAutomatically'],
                         shots=r['checkpoint']['realShotClips'], confidently_wrong_independent=r['checkpoint']['confidentlyWrong'],
                         confidently_wrong_continuous=r['continuous']['confidentlyWrong'], made_balls_unresolved_independent=r['checkpoint']['madeLeftUnresolved'],
                         made_balls_unresolved_continuous=r['continuous']['madeLeftUnresolved'], false_pockets=r['checkpoint']['phantomPockets'],
                         made_called_on_table_missed_pockets=r['checkpoint']['madeCalledOnTable'], real_shots_missed=r['checkpoint']['realShotsMissed'],
                         false_shots=r['checkpoint']['falseShots'], racks_complete=r['racks_complete']))
    write_csv(out('product', 'product_metrics.csv'), rows)
    print(json.dumps(repro, indent=1))
    for r in rows: print(r)
    if not all(repro['exact'].values()): print('BASELINE DID NOT REPRODUCE EXACTLY: see baseline-reproduction.json', file=sys.stderr)


if __name__ == '__main__':
    main()
