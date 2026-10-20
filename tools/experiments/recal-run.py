"""Calibration experiment driver (Oct 20, 2026): for each session, fit the per-table correction from that session's
verified calibration pictures (recal.py), rewrite its test clips (frozen 30 fps pick and the alternate odd-frame pick),
and score v0.6 before and after on test clips only (recal-compare.js, reader-looks.js). Calibration clips are never
scored. Paths come from a setup file.

    python3 -I recal-run.py <setup.json> <out folder> [session ...] [--k 1,2,4,6]
setup: { "<session>": { "truth", "dets", "dump", "altDets", "altDump", "labels": [{clip, balls, removed}], "test": [clips] } }
"""
import json, os, shutil, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
args = sys.argv[1:]
ks = None
mode = 'full'
if '--mode' in args:
    i = args.index('--mode'); mode = args[i + 1]; del args[i:i + 2]
if '--k' in args:
    i = args.index('--k'); ks = [int(x) for x in args[i + 1].split(',')]; del args[i:i + 2]
setup = json.load(open(args[0])); OUT = args[1]; only = args[2:]
res = {}
for name, s in setup.items():
    if only and name not in only:
        continue
    for k in (ks or [len(s['labels'])]):
        k = min(k, len(s['labels']))
        tag = f'{name}-k{k}' + ('' if mode == 'full' else '-' + mode); d = os.path.join(OUT, tag)
        if os.path.exists(d):
            shutil.rmtree(d)
        cfg = {'dets': s['dets'], 'dump': s['dump'], 'out': os.path.join(d, 'cal'), 'labels': s['labels'][:k], 'test': s['test'], 'window': 15, 'mode': mode,
               'alt': {'dets': s['altDets'], 'dump': s['altDump'], 'out': os.path.join(d, 'cal-alt')}}
        os.makedirs(d); json.dump(cfg, open(os.path.join(d, 'config.json'), 'w'))
        info = json.loads(subprocess.check_output(['python3', '-I', os.path.join(HERE, 'recal.py'), os.path.join(d, 'config.json')]).decode().strip().splitlines()[-1])
        # every clip that is not a test clip stays as frozen, so racks and memory run as before
        for src, dst in ((s['dets'], 'cal'), (s['altDets'], 'cal-alt')):
            for f in os.listdir(src):
                if f.endswith('.json') and not os.path.exists(os.path.join(d, dst, f)):
                    shutil.copy(os.path.join(src, f), os.path.join(d, dst, f))
        test = ','.join(s['test'])
        out = {'calibration': info, 'pictures': [l['clip'] for l in s['labels'][:k]]}
        for pick, a, b in (('frozen30', s['dets'], os.path.join(d, 'cal')), ('odd30', s['altDets'], os.path.join(d, 'cal-alt'))):
            subprocess.check_call(['node', os.path.join(HERE, 'recal-compare.js'), s['truth'], a, b, test, os.path.join(d, pick + '-compare.json')], stdout=subprocess.DEVNULL)
            out[pick] = json.load(open(os.path.join(d, pick + '-compare.json')))
            skip = ','.join(c for c in setup[name]['allClips'] if c not in s['test'])
            for lab, dd in (('v06', a), ('cal', b)):
                o = os.path.join(d, f'{pick}-looks-{lab}.json')
                subprocess.check_call(['node', os.path.join(HERE, 'reader-looks.js'), '--scripted', '--skip', skip, f'{dd}:{s["truth"]}', '--out', o], stdout=subprocess.DEVNULL)
                out[pick]['looks-' + lab] = {kk: v for kk, v in json.load(open(o))['summary'].items() if kk.startswith('ALL')}
        res[tag] = out
        c, f = out['frozen30']['checkpoint'], out['odd30']['checkpoint']
        L = lambda p, lab, look: out[p]['looks-' + lab].get('ALL ' + look, {})
        print(f"{tag}: {info['examples']} examples, pull {info['lam']} | end table right per shot {c['v06']['endRight']} -> {c['calibrated']['endRight']} of {c['v06']['shots']}"
              f" (odd pick {f['v06']['endRight']} -> {f['calibrated']['endRight']}); confidently wrong {c['v06']['confidentlyWrong']} -> {c['calibrated']['confidentlyWrong']}; new wrong clips {c['newWrongClips'] + out['frozen30']['continuous']['newWrongClips']}")
        for look in ('start', 'end'):
            a, b = L('frozen30', 'v06', look), L('frozen30', 'cal', look)
            if a:
                print(f"   {look}: named {a['named']} -> {b['named']} of {a['N']}; rejected {a['rejected']} -> {b['rejected']}; unnamed {a['unnamed']} -> {b['unnamed']}; wrong {a['wrong']} -> {b['wrong']}; absent {a['absent']} -> {b['absent']}; extra {a['extra']} -> {b['extra']}; whole right {a['right']} -> {b['right']} of {a['looks']}")
json.dump(res, open(os.path.join(OUT, 'results-' + mode + ('-' + '-'.join(only) if only else '') + '.json'), 'w'), indent=1)
