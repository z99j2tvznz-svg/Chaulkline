import json, sys, collections
sys.path.insert(0, '.')
from evalfind import PICS, HALL
O = json.load(open('old-finder.json'))
INS = ('2026-10-12', '2026-10-13')   # the reader was trained on library real1-real6 = these sessions
rows = []
for p in O['pictures']:
    L = PICS[p['id']]
    for rd in p['read']:
        b = L['balls'][rd['i']]
        s = L['session']
        rows.append(dict(num=b['num'], top=rd['top'], p=rd['p'], nb=rd['nb'], r=b['r'], partial=b['partial'], pocket=bool(b['inPocket']),
                         sess=s, ins=s.startswith(INS), hall=s == HALL, split=L['split'], kind=L['kind'], pid=p['id']))
def acc(rs):
    rs = [r for r in rs if r['num'] is not None]
    n = len(rs); ok = sum(r['top'] == r['num'] for r in rs); nb = sum(r['nb'] >= 0.5 for r in rs)
    return f"{ok}/{n} ({100*ok/n:.0f}%)" if n else '-', f"{nb}" if n else '-'
clean = lambda r: not r['partial'] and not r['pocket']
def row(name, rs): a, nb = acc(rs); print(f'| {name} | {a} | {nb} |')
print('| Group (clear balls unless named) | Number right | Called "not a ball" |\n|---|---|---|')
row('All 185 pictures, clear balls', [r for r in rows if clean(r)])
row('Out of sample (Oct 14 to 16), clear', [r for r in rows if clean(r) and not r['ins']])
row('In sample (Oct 12 to 13; reader trained on these), clear', [r for r in rows if clean(r) and r['ins']])
row('Checking split, clear', [r for r in rows if clean(r) and r['split'] == 'validation'])
row('… Oct 16 crops', [r for r in rows if clean(r) and r['split'] == 'validation' and r['kind'] == 'crop' and not r['hall']])
row('… Oct 16 full frames', [r for r in rows if clean(r) and r['kind'] == 'frame'])
row('… hall (in sample)', [r for r in rows if clean(r) and r['hall']])
row('Oct 14 to 15 (training side, out of sample for the reader)', [r for r in rows if clean(r) and not r['ins'] and r['split'] == 'training'])
row('Partly hidden', [r for r in rows if r['partial'] and not r['pocket']])
row('In a pocket', [r for r in rows if r['pocket']])
OOS = [r for r in rows if clean(r) and not r['ins']]
print('\nBy size, out of sample, clear')
for lo, hi in [(0, 11), (11, 13), (13, 99)]: row(f'radius {lo}-{hi} px', [r for r in OOS if lo <= r['r'] < hi])
print('\nPer session, clear'); 
for s in sorted({r['sess'] for r in rows}): row(s + (' (in sample)' if s.startswith(INS) else ''), [r for r in rows if clean(r) and r['sess'] == s])
def conf(rs, title):
    print('\n' + title + ' (rows = real number, columns = what the reader said)')
    print('| real \\ said | ' + ' | '.join(['cue'] + [str(i) for i in range(1, 10)]) + ' | right |'); print('|' + '---|' * 12)
    for t in range(10):
        c = collections.Counter(r['top'] for r in rs if r['num'] == t); n = sum(c.values())
        if not n: continue
        print(f"| {'cue' if t == 0 else t} | " + ' | '.join(str(c[k]) if c[k] else '·' for k in range(10)) + f" | {c[t]}/{n} |")
conf(OOS, 'Confusion, out of sample (Oct 14 to 16), clear balls')
conf([r for r in rows if clean(r) and r['ins']], 'Confusion, in sample (Oct 12 to 13), clear balls')
print('\n"Can\'t tell" balls (16): what the reader said:', collections.Counter('cue' if r['top'] == 0 else r['top'] for r in rows if r['num'] is None))
print('Top wrong pairs, out of sample:', collections.Counter((r['num'], r['top']) for r in OOS if r['num'] is not None and r['top'] != r['num']).most_common(8))
# confidence: is p useful to flag wrong reads?
w = [r for r in OOS if r['num'] is not None]
for th in (0.5, 0.8, 0.95):
    hi = [r for r in w if r['p'] >= th]; ok = sum(r['top'] == r['num'] for r in hi)
    print(f'reader sure >= {th}: {len(hi)}/{len(w)} balls, right {ok}/{len(hi)} ({100*ok/max(1,len(hi)):.0f}%)')
json.dump(rows, open('recog-rows.json', 'w'))
