"""Cycle 4: several racks in one recording (offline, experimental). Splits a continuous recording into racks and runs the
continuous-rack runner (../exp/tools/rack.js) on each.

  python racks.py <detections json> <video> <out dir> [--opts '<rack.js opts json>'] [--set 0,1,...] [--marks t1,t2,...]

Automatic boundaries (default): rack.js --find-racks proposes a cut where the spot count on a still table rises by 2 or
more after a shot (balls only come back to the table when someone re-racks). A proposal is accepted only when a pack is
then found on a still table (rackprobe.py) and a later shot scatters it (the break: the pack is gone at the next still
table). Shots between the cut and the break are racking, not play. A proposal with no pack is reported and not used:
the recording is then treated as one rack after the cut is logged as a doubt.
Explicit boundaries (--marks): times inside each new rack's racked-but-unbroken still table (for example a "New rack"
button pressed before the break). The old rack ends at the proposed cut before the mark if there is one, else at the
end of the first still table after its last shot before the mark.
Output: <out dir>/racks.json (boundaries and how each was decided) and <out dir>/rack<k>-log.json per rack."""
import json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
RACK = os.path.join(HERE, '..', 'exp', 'tools', 'rack.js')
PROBE = os.path.join(HERE, 'rackprobe.py')


def arg(k, d=None):
    if k in sys.argv:
        i = sys.argv.index(k); v = sys.argv[i + 1]; del sys.argv[i:i + 2]; return v
    return d


def main():
    opts, ballset, marks = arg('--opts', '{}'), arg('--set', '0,1,2,3,4,5,6,7,8,9'), arg('--marks')
    det_path, video, out = sys.argv[1:4]
    os.makedirs(out, exist_ok=True)
    D = json.load(open(det_path))
    fr = json.loads(subprocess.run(['node', RACK, '--find-racks', det_path, '--opts', opts], capture_output=True, text=True, check=True).stdout)
    shots, still, cuts = fr['shots'], fr['still'], fr['cuts']
    cache = {}

    def probe(st):
        k = (st['from'], st['to'])
        if k not in cache:
            p = os.path.join(out, f"probe-{st['from']:.2f}-{st['to']:.2f}.json")
            if not os.path.exists(p):  # a probe already in the out dir is reused (same detections, same still table)
                subprocess.run([sys.executable, PROBE, det_path, video, str(st['from']), str(st['to']), p + '.part'], capture_output=True, check=True)
                os.replace(p + '.part', p)
            r = json.load(open(p)); pk = r['packs'][0] if r.get('packs') else None
            cache[k] = {'file': p, 'isPack': bool(pk and pk['isPack']), 'count': pk and pk['count'], 'match': pk and pk['match'], 'end': pk and pk['end']}
        return cache[k]

    before = lambda t, lo: [s for s in still if s['to'] <= t + 0.5 and s['from'] >= lo]
    after = lambda t: next((s for s in still if s['from'] > t), None)

    def find_break(lo, hi=float('inf')):
        # the first shot after lo whose still table before it holds a pack, and after which the pack is gone
        for t in [s for s in shots if s > lo and s < hi]:
            b = before(t, lo)
            if not b: continue
            st = b[-1]; p = probe(st)
            if not p['isPack']: continue
            a = after(t)
            if a is None or not probe(a)['isPack']: return t, st, p
        return None

    bounds, starts = [], [None]
    if marks:
        for m in map(float, marks.split(',')):
            prior = [c for c in cuts if c['cut'] < m]
            last = max([s for s in shots if s < m] or [None], key=lambda v: v or -1)
            st_after_last = after(last) if last is not None else None
            cut = prior[-1]['cut'] if prior else (st_after_last['to'] if st_after_last else m)
            br = find_break(m - 30 if m - 30 > cut else cut)
            bounds.append({'how': 'explicit mark', 'mark': m, 'cut': cut, 'break': br and br[0], 'rackStart': br and br[1]['from'], 'pack': br and br[2]})
    else:
        for c in cuts:
            br = find_break(c['cut'])
            if br: bounds.append({'how': 'count rise + pack + break', **c, 'break': br[0], 'rackStart': br[1]['from'], 'pack': br[2]})
            else: bounds.append({'how': 'count rise, no pack found: not used', **c, 'rejected': True})
    use = [b for b in bounds if not b.get('rejected') and b.get('rackStart') is not None]
    # segments: [start, end) in recording time
    segs, t0 = [], D['frames'][0]['t'] - 1
    for b in use: segs.append((t0, b['cut'])); t0 = b['rackStart'] - 0.01
    segs.append((t0, D['frames'][-1]['t'] + 1))
    logs = []
    for k, (a, b) in enumerate(segs):
        seg = {**D, 'frames': [f for f in D['frames'] if a <= f['t'] < b]}
        sp = os.path.join(out, f'rack{k + 1}-dets.json'); json.dump(seg, open(sp, 'w'))
        first = next((s for s in shots if s > a and s < b and (k == 0 or s >= use[k - 1]['break'] - 0.5)), None)
        lk = before(first, a)[-1] if first is not None and before(first, a) else None
        pr = probe(lk) if lk else None
        lp = os.path.join(out, f'rack{k + 1}-log.json')
        cmd = ['node', RACK, sp, '--set', ballset, '--opts', opts, '--out', lp] + (['--probe', pr['file']] if pr else [])
        subprocess.run(cmd, capture_output=True, check=True)
        os.remove(sp)
        logs.append({'rack': k + 1, 'from': round(max(a, D['frames'][0]['t']), 2), 'to': round(min(b, D['frames'][-1]['t']), 2), 'log': lp, 'rackLookProbe': pr})
    res = {'recording': det_path, 'proposals': bounds, 'racks': logs}
    json.dump(res, open(os.path.join(out, 'racks.json'), 'w'), indent=1)
    print(json.dumps({'proposals': bounds, 'racks': [{k: v for k, v in r.items() if k != 'log'} for r in logs]}))


if __name__ == '__main__':
    main()
