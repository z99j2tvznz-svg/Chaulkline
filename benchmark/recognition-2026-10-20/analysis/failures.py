"""Product-level failure breakdown (analysis only; no training, no scorer or tracker change).
For every real-shot clip that is not "correct automatically", list what blocks it, from the unchanged v0.6 scorer's own
trace (score-racks.js output: looks, reconcile decisions, wrong / unresolved facts), and for identity problems, from the
reader answers in the detection files the scorer read (which frames voted what, at the spot in question).

  python failures.py <racks.json dir> <tag prefix e.g. frozen30.challenger_b> <detections root (6 session folders)> <out dir>

"Confirmed" blockers are read directly from the scorer trace. Sub-causes marked "suspected" are inferred (for example
from positions, because the truth files have no ball positions for most clips)."""
import collections, glob, json, math, os, sys

OBS = dict(group=1.5, share=0.5, nb=0.5, p=0.6, minScore=2, margin=2)  # code/tools/reconcile.js OBS (unchanged)
LOOK, T0, T1 = 1.0, 1.5, 0.2                                           # code/tools/score-racks.js (unchanged)
NEAR = 2.8   # inches, centre to centre: within 2.5 ball radii = touching / nearly touching (same rule as the recognition test)
SESS = ['v04-oct16', 'v04-firstspot', 'v04-otherside', 'rec-20261017-1730', 'rec-20261018-2310', 'rec-20261019-1710']


def groups(frames):
    gs = []
    for fr in frames:
        for b in fr['balls']:
            g, gd = None, OBS['group']
            for c in gs:
                d = math.hypot(b['x'] - c['x'], b['y'] - c['y'])
                if d < gd: gd, g = d, c
            if g is None: g = dict(x=b['x'], y=b['y'], n=0, frames=set(), nb=0, nbN=0, score=[0] * 10, reads=[]); gs.append(g)
            g['x'] = (g['x'] * g['n'] + b['x']) / (g['n'] + 1); g['y'] = (g['y'] * g['n'] + b['y']) / (g['n'] + 1); g['n'] += 1; g['frames'].add(fr['t'])
            if b.get('nb') is not None: g['nb'] += b['nb']; g['nbN'] += 1
            g['reads'].append((b.get('rec'), b.get('p'), b.get('nb')))
            if b.get('rec') is not None and b.get('p') is not None and b['p'] >= OBS['p'] and b.get('nb') is not None and b['nb'] < OBS['nb']: g['score'][b['rec']] += b['p']
    return gs


def why_group(g, nframes, all_groups):
    """Why a spot group did not give a name (mirrors observe())."""
    near = any(o is not g and math.hypot(o['x'] - g['x'], o['y'] - g['y']) < NEAR and len(o['frames']) >= OBS['share'] * nframes for o in all_groups)
    if len(g['frames']) < OBS['share'] * nframes: k = 'spot flickers (seen in < half the look frames)'
    elif g['nbN'] and g['nb'] / g['nbN'] >= OBS['nb']: k = 'reader says "not a ball" (rejected)'
    else:
        sc = sorted(g['score'], reverse=True)
        if sc[0] < OBS['minScore']: k = 'reader unsure (too few confident frames)'
        elif sc[0] < OBS['margin'] * sc[1]: k = 'reader votes split between two numbers'
        else: k = 'number taken by a surer spot'
    conf = [r for r in g['reads'] if r[1] is not None and r[1] >= OBS['p'] and (r[2] or 0) < OBS['nb']]
    return k, near, collections.Counter(r[0] for r in conf).most_common(3)


def look_frames(D, label, shot_t):
    fr = D['frames']; end = fr[-1]['t']
    if label == 'after': return [f for f in fr if f['t'] >= end - LOOK]
    return [f for f in fr if f['t'] >= shot_t - T0 and f['t'] <= shot_t - T1] if shot_t is not None else [f for f in fr if f['t'] <= LOOK]


def classify(c, D, sess, mode):
    """Return a list of (blocker, detail, confirmed?) for one failing real-shot clip, most upstream first."""
    out = []; tr = {t['label']: t for t in c['trace']}; a = tr.get('after'); b = tr.get('before')
    for w in c['wrong']:
        if w['fact'] == 'shot': out.append(('missed shot' if 'not found' in w['what'] else 'false shot', w['what'], True))
    if a and not a['settled']: out.append(('table still moving at clip end (settled-table selection)', '', True))
    for w in c['wrong']:
        if 'system says it is on the table' in w['what'] or 'gone, but the system has it' in w['what']:
            gw = {x['ball']: x['why'] for x in c.get('goneWhy') or []}
            out.append(('wrong identity: a spot named as a ball that is gone', f"ball {w.get('ball')}" + (f" ({gw[w.get('ball')]})" if w.get('ball') in gw else ''), True))
        if 'confirmed pocketed, but it did not go in' in w['what']: out.append(('false pocket: ball missing from the after look', f"ball {w.get('ball')}", True))
        if 'on the table, but the system has it gone' in w['what']: out.append(('false pocket: ball missing from the after look', f"ball {w.get('ball')}", True))
    made_open = [u['ball'] for u in c['unresolved'] if u['fact'] == 'made']
    state_open = [u['ball'] for u in c['unresolved'] if u['fact'] == 'state']
    shot_t = c['shotsAt'][0] if c['shotsAt'] else None
    for lab, t in (('before', b), ('after', a)):
        if not t or not t['unnamed'] or (lab == 'after' and not t['settled']): continue
        fr = look_frames(D, lab, shot_t); gs = groups(fr)
        for s in t['seen']:
            if s['num'] is not None: continue
            g = min(gs, key=lambda g: math.hypot(g['x'] - s['x'], g['y'] - s['y']))
            k, near, votes = why_group(g, len(fr), gs)
            out.append((f'uncertain identity: unnamed spot in the {lab} look', f"{k}; touching/near another ball: {'yes' if near else 'no'}; confident reads {votes}", True))
    if a and a['settled']:
        for u in a['unresolved']:
            if u['why'] == 'not seen, nothing explains it' and u['ball'] not in made_open and b and any(s['num'] == u['ball'] for s in b['seen']):
                # a ball named before the shot that is not in the after look and did not go in -> missing from the look
                s0 = next(s for s in b['seen'] if s['num'] == u['ball']); fr = look_frames(D, 'after', shot_t); gs = groups(fr)
                g = min(gs, key=lambda g: math.hypot(g['x'] - s0['x'], g['y'] - s0['y'])) if gs else None
                if g is None or math.hypot(g['x'] - s0['x'], g['y'] - s0['y']) > OBS['group']: det = 'no spot where it sat before (moved, hidden, or not detected; suspected)'
                else:
                    k, near, votes = why_group(g, len(fr), gs); det = f"spot still there: {k}; confident reads {votes}" if k != 'number taken by a surer spot' else f"spot still there, read as another number: {votes}"
                out.append(('ball on the table missing from the after look (blocks the absence rule)', f"ball {u['ball']}: {det}", True))
        for n in made_open:
            if b and not any(s['num'] == n for s in b['seen']):
                carried = mode == 'continuous' and (b['prev'].get(str(n)) == 'unconfirmed')
                out.append(('made ball not named before the shot', f"ball {n}" + (' (already uncertain from an earlier shot)' if carried else ''), True))
        if made_open and a['unnamed'] == 0 and b:
            drop = len(b['seen']) - len(a['seen'])
            miss = [u['ball'] for u in a['unresolved'] if u['why'] == 'not seen, nothing explains it']
            if drop != len(miss): out.append(('absence rule: spot count did not fall by the missing balls', f"count change {drop}, missing {miss}", True))
            elif len(miss) > 2: out.append(('absence rule: 3+ balls missing at once', str(miss), True))
            elif all(any(s['num'] == m for s in b['seen']) for m in miss): out.append(('absence rule: no track seen rolling away from the spot', str(miss), True))
    if mode == 'continuous' and b:
        carried = [n for n in made_open if b['prev'].get(str(n)) == 'unconfirmed']
        if carried: out.append(('uncertainty carried from an earlier shot', f'balls {carried}', True))
    if not out and state_open: out.append(('ball on the table left unconfirmed', f'balls {state_open}', True))
    if not out: out.append(('other / not classified', json.dumps(c['unresolved'])[:200], False))
    return out


def main():
    rdir, tag, droot, odir = sys.argv[1:5]; os.makedirs(odir, exist_ok=True); rows = []; summ = {}
    for mode in ('checkpoint', 'continuous'):
        prim, anyb, sub = collections.Counter(), collections.Counter(), collections.Counter(); racks = []
        for s in SESS:
            R = json.load(open(os.path.join(rdir, f'{tag}.{s}.racks.json')))[mode]
            for r in R['racks']:
                rr = dict(session=s, rack=r['rack'], shots=0, right=0, blockers=collections.Counter())
                for c in r['clips']:
                    if c.get('missing') or not c['realShot']: continue
                    rr['shots'] += 1
                    if c['result'] == 'correct automatically': rr['right'] += 1; continue
                    D = json.load(open(os.path.join(droot, s, c['clip'] + '.json')))
                    bl = classify(c, D, s, mode); prim[bl[0][0]] += 1
                    for k in {x[0] for x in bl}: anyb[k] += 1
                    for x in bl:
                        if x[0].startswith('uncertain identity') or x[0].startswith('ball on the table missing'): sub[(x[0], x[1].split(';')[0].split(': ', 1)[-1])] += 1
                    for k in {x[0] for x in bl}: rr['blockers'][k] += 1
                    rows.append(dict(mode=mode, session=s, rack=r['rack'], clip=c['clip'], result=c['result'], primary=bl[0][0],
                                     blockers=' | '.join(f"{x[0]}{' — ' + x[1] if x[1] else ''}{'' if x[2] else ' (suspected)'}" for x in bl)))
                rr['blockers'] = dict(rr['blockers']); racks.append(rr)
        summ[mode] = dict(primary_blocker=prim.most_common(), clips_with_blocker=anyb.most_common(),
                          identity_and_missing_subcauses=[[k[0], k[1], v] for k, v in sub.most_common()],
                          real_racks=[r for r in racks if not r['session'].startswith('rec-')])
    json.dump(summ, open(os.path.join(odir, f'{tag}.failures.json'), 'w'), indent=1)
    import csv
    with open(os.path.join(odir, f'{tag}.failures.csv'), 'w', newline='') as f:
        w = csv.DictWriter(f, list(rows[0])); w.writeheader(); w.writerows(rows)
    for m in summ:
        print(m, 'primary:'); [print('  ', v, k) for k, v in summ[m]['primary_blocker']]
        print(m, 'clips with each blocker:'); [print('  ', v, k) for k, v in summ[m]['clips_with_blocker']]
        print(m, 'sub-causes:'); [print('  ', v, a, '|', b) for a, b, v in summ[m]['identity_and_missing_subcauses']]


if __name__ == '__main__':
    main()
