import json, math, collections, sys
V = sys.argv[1] if len(sys.argv) > 1 else 'v04'
S = '../v04/'
PK = [(0, 0), (39, 0), (78, 0), (0, 39), (39, 39), (78, 39)]
def dpk(x, y): return min(math.hypot(x - a, y - b) for a, b in PK)
rows = []
for sess in ['firstspot', 'otherside', 'rec', 'oct16']:
    d = json.load(open(f'{S}score/{V}-{sess}.json'))
    for rack in d['continuous']['racks']:
        for c in rack['clips']:
            made = {}
            for u in c['unresolved']:
                if u['fact'] == 'made': made[u['ball']] = 'unresolved: ' + u['what'].split('(')[-1].rstrip(')')
            for w in c['wrong']:
                if isinstance(w, dict) and w.get('fact') == 'made': made[w['ball']] = 'wrong: ' + w['what']
            tr = c.get('trace') or []
            after = tr[-1] if tr else {}
            for cf in after.get('confirmed', []):
                if cf.get('change') == 'pocketed': made.setdefault(cf['ball'], 'confirmed')
            evs = after.get('pocketEvents', [])
            if not made: continue
            try: fr = json.load(open(f'{S}{V}-{sess}/{c["clip"]}.json'))['frames']
            except Exception: fr = []
            T = fr[-1]['t'] if fr else 0
            for b, st in made.items():
                last = None
                for f in fr:
                    for o in f['balls']:
                        if o['rec'] == b and o['nb'] is not None and o['nb'] < 0.5 and (o['p'] or 0) >= 0.5: last = (f['t'], o['x'], o['y'])
                ev = [e for e in evs if e.get('ball') == b]
                rows.append(dict(sess=sess, clip=c['clip'], ball=b, status=st, event=(('jaws' if ev[0].get('jaws') else 'mouth' if ev[0].get('inMouth') else 'outside') if ev else ('loose event' if evs else 'none')),
                                 lastSeen=None if not last else dict(t=last[0], end=round(T - last[0], 1), pocketIn=round(dpk(last[1], last[2]), 1))))
json.dump(rows, open(f'made-{V}.json', 'w'), indent=0)
def cls(r):
    s = r['status']
    if s == 'confirmed': return 'confirmed'
    if 'not settled' in s: return 'clip ended before the table was still'
    if s.startswith('wrong'): return 'called still on the table (misread or late drop)'
    if 'outside the mouth' in s: return 'pocket event, but lost outside the mouth'
    ls = r['lastSeen']
    if not ls: return 'no pocket event: never named before the shot'
    if ls['pocketIn'] <= 8: return 'no pocket event: last named within 8 in of a pocket'
    return 'no pocket event: last named far from any pocket'
C = collections.Counter(); bys = collections.defaultdict(collections.Counter)
for r in rows: k = cls(r); C[k] += 1; bys[r['sess']][k] += 1
print(V, 'made balls', len(rows))
for k, n in C.most_common(): print(f'  {n:3d}  {k}   ', dict((s, bys[s][k]) for s in bys if bys[s][k]))
